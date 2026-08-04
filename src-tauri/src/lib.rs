use std::{
    collections::HashMap,
    io::{Read, Write},
    path::PathBuf,
    sync::{Arc, Mutex},
};

use futures_util::StreamExt;
use portable_pty::{Child, CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, ipc::Channel};

const CREDENTIAL_SERVICE: &str = "Oass.9router";
const CREDENTIAL_USER: &str = "api-key";

struct TerminalSession {
    writer: Mutex<Box<dyn Write + Send>>,
    master: Mutex<Box<dyn MasterPty + Send>>,
    child: Mutex<Box<dyn Child + Send + Sync>>,
}

#[derive(Default)]
struct AppState {
    sessions: Mutex<HashMap<String, Arc<TerminalSession>>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalOutput {
    session_id: String,
    data: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatRequest {
    endpoint: String,
    api_key: String,
    model: String,
    messages: Vec<ChatMessage>,
}

fn resolve_shell() -> PathBuf {
    if let Ok(program_files) = std::env::var("ProgramFiles") {
        let pwsh = PathBuf::from(program_files)
            .join("PowerShell")
            .join("7")
            .join("pwsh.exe");
        if pwsh.exists() {
            return pwsh;
        }
    }

    let windows = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into());
    PathBuf::from(windows)
        .join("System32")
        .join("WindowsPowerShell")
        .join("v1.0")
        .join("powershell.exe")
}

#[tauri::command]
fn create_terminal(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    if state
        .sessions
        .lock()
        .map_err(|error| error.to_string())?
        .contains_key(&session_id)
    {
        return Ok(());
    }

    let pty_system = NativePtySystem::default();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(2),
            cols: cols.max(20),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())?;

    let mut command = CommandBuilder::new(resolve_shell());
    command.arg("-NoLogo");
    command.env("TERM", "xterm-256color");
    command.env("TERM_PROGRAM", "oass");
    if let Ok(cwd) = std::env::current_dir() {
        command.cwd(cwd);
    }

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| error.to_string())?;
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| error.to_string())?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|error| error.to_string())?;
    let session = Arc::new(TerminalSession {
        writer: Mutex::new(writer),
        master: Mutex::new(pair.master),
        child: Mutex::new(child),
    });
    state
        .sessions
        .lock()
        .map_err(|error| error.to_string())?
        .insert(session_id.clone(), session.clone());

    std::thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(count) => {
                    let mut data = String::from_utf8_lossy(&buffer[..count]).to_string();
                    // Suppress DSR cursor position report echo
                    if data.contains("\x1b[6n") {
                        if let Ok(mut w) = session.writer.lock() {
                            let _ = w.write_all(b"\x1b[1;1R");
                            let _ = w.flush();
                        }
                        data = data.replace("\x1b[6n", "");
                    }
                    if data.is_empty() {
                        continue;
                    }
                    let _ = app.emit(
                        "terminal-output",
                        TerminalOutput {
                            session_id: session_id.clone(),
                            data,
                        },
                    );
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn write_terminal(
    state: State<'_, AppState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|error| error.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or("Terminal session was not found")?;
    let mut writer = session.writer.lock().map_err(|error| error.to_string())?;
    writer
        .write_all(data.as_bytes())
        .map_err(|error| error.to_string())?;
    writer.flush().map_err(|error| error.to_string())
}

#[tauri::command]
fn resize_terminal(
    state: State<'_, AppState>,
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|error| error.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or("Terminal session was not found")?;
    session
        .master
        .lock()
        .map_err(|error| error.to_string())?
        .resize(PtySize {
            rows: rows.max(2),
            cols: cols.max(20),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn close_terminal(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    let session = state
        .sessions
        .lock()
        .map_err(|error| error.to_string())?
        .remove(&session_id);
    if let Some(session) = session {
        session
            .child
            .lock()
            .map_err(|error| error.to_string())?
            .kill()
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn load_api_key() -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_USER)
        .map_err(|error| error.to_string())?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn save_api_key(api_key: String) -> Result<(), String> {
    let entry = keyring::Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_USER)
        .map_err(|error| error.to_string())?;
    if api_key.is_empty() {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error.to_string()),
        }
    } else {
        entry
            .set_password(&api_key)
            .map_err(|error| error.to_string())
    }
}

#[tauri::command]
async fn stream_chat(request: ChatRequest, on_event: Channel<String>) -> Result<(), String> {
    if request.api_key.trim().is_empty() {
        return Err("9router API key is required".into());
    }
    if request.model.trim().is_empty() {
        return Err("Chat model is required".into());
    }
    let url = chat_endpoint_url(&request.endpoint)?;
    let response = reqwest::Client::new()
        .post(url)
        .bearer_auth(request.api_key)
        .json(&serde_json::json!({
            "model": request.model,
            "messages": request.messages,
            "stream": true
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("9router returned {status}: {body}"));
    }

    let mut stream = response.bytes_stream();
    let mut pending = String::new();
    while let Some(chunk) = stream.next().await {
        pending.push_str(&String::from_utf8_lossy(
            &chunk.map_err(|error| error.to_string())?,
        ));
        while let Some(line_end) = pending.find('\n') {
            let line = pending[..line_end].trim().to_string();
            pending.drain(..=line_end);
            let Some(data) = line.strip_prefix("data:").map(str::trim) else {
                continue;
            };
            if data == "[DONE]" {
                return Ok(());
            }
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(content) = value["choices"][0]["delta"]["content"].as_str() {
                    on_event
                        .send(content.to_string())
                        .map_err(|error| error.to_string())?;
                }
            }
        }
    }

    Ok(())
}

fn chat_endpoint_url(endpoint: &str) -> Result<reqwest::Url, String> {
    let normalized = format!("{}/", endpoint.trim().trim_end_matches('/'));
    let base = reqwest::Url::parse(&normalized)
        .map_err(|error| format!("Invalid 9router endpoint: {error}"))?;
    if !base.username().is_empty()
        || base.password().is_some()
        || base.query().is_some()
        || base.fragment().is_some()
    {
        return Err("9router endpoint cannot contain credentials, a query, or a fragment".into());
    }

    let loopback = base.host_str().is_some_and(|host| {
        host.eq_ignore_ascii_case("localhost")
            || host
                .parse::<std::net::IpAddr>()
                .is_ok_and(|address| address.is_loopback())
    });
    if base.scheme() != "https" && !(base.scheme() == "http" && loopback) {
        return Err("9router endpoint must use HTTPS, except for HTTP loopback addresses".into());
    }

    base.join("chat/completions")
        .map_err(|error| format!("Invalid 9router endpoint path: {error}"))
}

async fn ask_9router(endpoint: &str, api_key: &str, model: &str, system_prompt: &str, user_prompt: &str) -> Result<String, String> {
    let url = chat_endpoint_url(endpoint)?;
    let response = reqwest::Client::new()
        .post(url)
        .bearer_auth(api_key)
        .json(&serde_json::json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt },
            ],
            "stream": false,
            "max_tokens": 500,
            "temperature": 0.3,
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("9router returned {status}: {body}"));
    }

    let json: serde_json::Value = response.json().await.map_err(|error| error.to_string())?;
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "No content in AI response".to_string())
}

#[tauri::command]
async fn generate_command(
    prompt: String,
    endpoint: String,
    model: String,
) -> Result<String, String> {
    let api_key = match keyring::Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_USER) {
        Ok(entry) => entry.get_password().unwrap_or_default(),
        Err(_) => String::new(),
    };
    if api_key.is_empty() {
        return Err("No API key configured. Add your 9router API key in Settings.".into());
    }

    ask_9router(
        &endpoint,
        &api_key,
        &model,
        "You are a helpful terminal assistant. User describes what they want to do in natural language. Respond ONLY with the exact shell command, nothing else. No markdown, no explanation. For PowerShell, use PowerShell syntax. Output ONLY the command.",
        &prompt,
    )
    .await
}

#[tauri::command]
async fn slash_command(
    _session_id: String,
    mode: String,
    arg: String,
    endpoint: String,
    model: String,
) -> Result<String, String> {
    let api_key = match keyring::Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_USER) {
        Ok(entry) => entry.get_password().unwrap_or_default(),
        Err(_) => String::new(),
    };
    if api_key.is_empty() {
        return Err("No API key configured. Add your 9router API key in Settings.".into());
    }

    let (system_prompt, user_prompt) = match mode.as_str() {
        "explain" => (
            "You are a terminal expert. Explain what a shell command does in a short paragraph. Be concise and clear.",
            arg,
        ),
        "fix" => (
            "You are a terminal expert. The user got an error from their last command. Suggest the correct command to fix it. Respond ONLY with the exact fixed command, nothing else.",
            format!("The last command had an error: {arg}. Provide the corrected command."),
        ),
        "generate" => (
            "You are a helpful terminal assistant. Generate the correct shell command based on the user's description. Respond ONLY with the exact command, nothing else. No markdown. For PowerShell, use PowerShell syntax.",
            arg,
        ),
        _ => return Err("Unknown command mode".into()),
    };

    ask_9router(&endpoint, &api_key, &model, system_prompt, &user_prompt).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .setup(|app| {
            let window = if let Some(window) = app.get_webview_window("main") {
                window
            } else {
                WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                    .title("Oass")
                    .inner_size(1240.0, 800.0)
                    .min_inner_size(800.0, 560.0)
                    .center()
                    .decorations(false)
                    .shadow(true)
                    .resizable(true)
                    .build()?
            };
            window.show()?;
            window.set_focus()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_terminal,
            write_terminal,
            resize_terminal,
            close_terminal,
            load_api_key,
            save_api_key,
            stream_chat,
            generate_command,
            slash_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Oass");
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::*;
    use std::{
        sync::mpsc,
        time::{Duration, Instant},
    };

    #[test]
    fn native_pty_captures_command_output() {
        let pair = NativePtySystem::default()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .expect("PTY should open");
        let windows = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into());
        let command_path = PathBuf::from(windows).join("System32").join("cmd.exe");
        let mut command = CommandBuilder::new(command_path);
        command.args([
            "/D",
            "/S",
            "/C",
            "ping.exe 127.0.0.1 -n 2 > nul & echo AGENTTER_RUST_PTY_OK",
        ]);
        let mut child = pair
            .slave
            .spawn_command(command)
            .expect("command shell should start");
        drop(pair.slave);
        let mut reader = pair
            .master
            .try_clone_reader()
            .expect("PTY reader should clone");
        let mut writer = pair.master.take_writer().expect("PTY writer should open");
        let (sender, receiver) = mpsc::channel();

        std::thread::spawn(move || {
            let mut output = String::new();
            let result = reader.read_to_string(&mut output).map(|_| output);
            let _ = sender.send(result);
        });

        writer
            .write_all(b"\x1b[1;1R")
            .expect("cursor response should write");
        writer.flush().expect("cursor response should flush");
        let deadline = Instant::now() + Duration::from_secs(15);
        loop {
            if child
                .try_wait()
                .expect("command status should read")
                .is_some()
            {
                break;
            }
            if Instant::now() >= deadline {
                let _ = child.kill();
                panic!("native PTY process timed out");
            }
            std::thread::sleep(Duration::from_millis(25));
        }
        drop(writer);
        drop(pair.master);

        let output = match receiver.recv_timeout(Duration::from_secs(2)) {
            Ok(result) => result.expect("PTY output should read"),
            Err(error) => {
                panic!("native PTY output timed out: {error}");
            }
        };
        assert!(
            output.contains("AGENTTER_RUST_PTY_OK"),
            "unexpected PTY output: {output:?}"
        );
    }

    #[test]
    fn powershell_path_resolves() {
        let shell = resolve_shell();
        let file_name = shell
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default();
        assert!(
            shell.is_file(),
            "PowerShell executable was not found at {shell:?}"
        );
        assert!(matches!(
            file_name.to_ascii_lowercase().as_str(),
            "pwsh.exe" | "powershell.exe"
        ));
    }

    #[test]
    fn chat_endpoint_requires_https_or_loopback() {
        assert_eq!(
            chat_endpoint_url("http://localhost:20128/v1")
                .expect("loopback endpoint should be allowed")
                .as_str(),
            "http://localhost:20128/v1/chat/completions"
        );
        assert!(chat_endpoint_url("https://router.example/v1").is_ok());
        assert!(chat_endpoint_url("http://router.example/v1").is_err());
        assert!(chat_endpoint_url("https://user:pass@router.example/v1").is_err());
    }
}
