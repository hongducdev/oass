import { useEffect, useRef, useState, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { FitAddon } from "@xterm/addon-fit"
import { Terminal } from "@xterm/xterm"
import { Bug, Command, Sparkles, SquareTerminal, TerminalIcon } from "lucide-react"

import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import type { AppSettings, TerminalOutput } from "@/types"

type TerminalPaneProps = {
  sessionId: string
  active: boolean
  settings: AppSettings
}

const isTauri = () => "__TAURI_INTERNALS__" in window

type SlashCommand = {
  prefix: string
  label: string
  description: string
  icon: React.ReactNode
}

const slashCommands: SlashCommand[] = [
  { prefix: "/explain", label: "Explain command", description: "Explain what the previous command does", icon: <TerminalIcon className="size-3.5" /> },
  { prefix: "/fix", label: "Fix last error", description: "Suggest a fix for the last error", icon: <Bug className="size-3.5" /> },
  { prefix: "/generate", label: "Generate command", description: "Generate a command from description", icon: <Sparkles className="size-3.5" /> },
  { prefix: "/clear", label: "Clear terminal", description: "Clear the terminal screen", icon: <Command className="size-3.5" /> },
]

export function TerminalPane({ sessionId, active, settings }: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const [overlay, setOverlay] = useState<{ type: "ai" | "slash" } | null>(null)
  const [aiInput, setAiInput] = useState("")
  const [aiBusy, setAiBusy] = useState(false)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const aiInputRef = useRef<HTMLInputElement>(null)

  const writeToTerminal = useCallback((data: string) => {
    if (isTauri()) {
      void invoke("write_terminal", { sessionId, data }).catch(() => undefined)
    } else {
      terminalRef.current?.writeln(data)
    }
  }, [sessionId])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const terminal = new Terminal({
      allowTransparency: true,
      convertEol: true,
      cursorBlink: true,
      fontFamily: '"Geist Mono", "Cascadia Code", "Cascadia Mono", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.35,
      theme: {
        background: "#00000000",
        foreground: "#eeeeF3",
        cursor: "#9b8cff",
        selectionBackground: "#8b7cff55",
        black: "#15151b",
        brightBlack: "#666674",
        red: "#ff6b7d",
        green: "#63d6a3",
        yellow: "#e8c66b",
        blue: "#7aa2f7",
        magenta: "#bb9af7",
        cyan: "#66d9cf",
        white: "#d9d9e2",
      },
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(host)
    terminalRef.current = terminal

    let disposed = false
    let created = false
    let unlisten: (() => void) | undefined
    let interceptBuffer = ""

    const resize = () => {
      if (!active || disposed || !created) return
      fit.fit()
      if (isTauri()) {
        void invoke("resize_terminal", { sessionId, rows: terminal.rows, cols: terminal.cols }).catch(() => undefined)
      }
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    void (async () => {
      if (!isTauri()) {
        terminal.writeln("Oass browser preview")
        terminal.writeln("Launch with `npm run tauri dev` for a native Rust PTY.\r\n")
        return
      }
      unlisten = await listen<TerminalOutput>("terminal-output", ({ payload }) => {
        if (payload.sessionId === sessionId) terminal.write(payload.data)
      })
      fit.fit()
      try {
        await invoke("create_terminal", { sessionId, rows: terminal.rows, cols: terminal.cols })
        created = true
        resize()
      } catch (error) {
        terminal.writeln(`\r\nUnable to start Rust PTY: ${String(error)}`)
      }
    })()

    const inputDisposable = terminal.onData((data) => {
      if (!isTauri() || !created) return

      for (const char of data) {
        if (char === "\r") {
          if (interceptBuffer.startsWith("#") || interceptBuffer.startsWith("/")) {
            const value = interceptBuffer.trim()
            if (value.startsWith("#")) {
              setAiInput(value)
              setOverlay({ type: "ai" })
            } else if (value.startsWith("/")) {
              setOverlay({ type: "slash" })
              setSlashIndex(0)
            }
            interceptBuffer = ""
            return
          }
          void invoke("write_terminal", { sessionId, data: `${interceptBuffer}\r` }).catch(() => undefined)
          interceptBuffer = ""
        } else if (char === "\x7f") {
          if (interceptBuffer.length > 0) {
            interceptBuffer = interceptBuffer.slice(0, -1)
            terminal.write("\b \b")
          }
        } else if (char === "\x03") {
          interceptBuffer = ""
          setOverlay(null)
          setAiResult(null)
          void invoke("write_terminal", { sessionId, data: "\x03" }).catch(() => undefined)
        } else if (char >= " ") {
          interceptBuffer += char
          terminal.write(char)
        } else {
          void invoke("write_terminal", { sessionId, data: char }).catch(() => undefined)
        }
      }
    })

    return () => {
      disposed = true
      observer.disconnect()
      inputDisposable.dispose()
      unlisten?.()
      terminal.dispose()
      terminalRef.current = null
      if (isTauri() && created) {
        void invoke("close_terminal", { sessionId }).catch(() => undefined)
      }
    }
  }, [sessionId, writeToTerminal, active])

  useEffect(() => {
    if (!active || !terminalRef.current) return
    requestAnimationFrame(() => terminalRef.current?.focus())
  }, [active])

  useEffect(() => {
    if (overlay?.type === "ai") {
      requestAnimationFrame(() => aiInputRef.current?.focus())
    }
  }, [overlay])

  async function generateAISuggestion() {
    const prompt = aiInput.replace(/^#\s*/, "").trim()
    if (!prompt) return
    setAiBusy(true)
    setAiResult(null)
    try {
      const result = await invoke<string>("generate_command", { prompt, endpoint: settings.endpoint, model: settings.model })
      setAiResult(result)
    } catch {
      setAiResult("Unable to generate command. Check your API settings.")
    } finally {
      setAiBusy(false)
    }
  }

  function runSlashCommand(cmd: SlashCommand) {
    if (cmd.prefix === "/clear") {
      terminalRef.current?.clear()
      setOverlay(null)
      return
    }

    setAiBusy(true)
    setAiResult(null)
    const mode = cmd.prefix.slice(1)
    const arg = aiInput.slice(cmd.prefix.length).trim() || "last command"
    void invoke<string>("slash_command", { sessionId, mode, arg, endpoint: settings.endpoint, model: settings.model })
      .then((result) => {
        setAiResult(result)
        setAiBusy(false)
      })
      .catch(() => {
        setAiResult("AI command failed. Check your API settings.")
        setAiBusy(false)
      })
  }

  function insertAiResult() {
    if (!aiResult) return
    writeToTerminal(`${aiResult}\r`)
    setAiResult(null)
    setOverlay(null)
    setAiInput("")
  }

  function handleSlashKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setSlashIndex((i) => (i + 1) % slashCommands.length)
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setSlashIndex((i) => (i - 1 + slashCommands.length) % slashCommands.length)
    }
    if (event.key === "Enter") {
      event.preventDefault()
      setAiInput(slashCommands[slashIndex].prefix + " ")
      runSlashCommand(slashCommands[slashIndex])
    }
    if (event.key === "Escape") {
      setOverlay(null)
      setAiInput("")
    }
  }

  return (
    <section className={active ? "relative flex min-h-0 flex-1 flex-col" : "hidden"} aria-hidden={!active}>
      <div className="flex h-9 shrink-0 items-center border-b border-border/80 px-4 text-xs">
        <SquareTerminal className="mr-2 size-3.5 text-primary" />
        <span className="font-semibold">PowerShell session</span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-400" /> LIVE
        </span>
      </div>
      <div ref={hostRef} className="terminal-canvas min-h-0 flex-1 overflow-hidden" />

      {overlay?.type === "ai" && (
        <div className="absolute inset-x-3 bottom-3 z-10">
          <div className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground">
            AI ASSISTANT — describe what you want
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-[#14131b] p-1.5 shadow-2xl ring-1 ring-primary/10">
            <Sparkles className="ml-2 size-4 shrink-0 text-primary" />
            <input
              ref={aiInputRef}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); void generateAISuggestion() }
                if (e.key === "Escape") { setOverlay(null); setAiInput("") }
              }}
              placeholder="e.g. list files sorted by size..."
              className="h-9 flex-1 bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Button size="icon" className="size-9 rounded-lg" onClick={() => void generateAISuggestion()} disabled={aiBusy || !aiInput.trim()}>
              {aiBusy ? <Spinner className="size-3.5" /> : <Sparkles className="size-3.5" />}
            </Button>
          </div>
          {aiResult && (
            <Bubble variant="secondary" align="start" className="mt-2">
              <BubbleContent className="flex flex-col gap-2">
                <p className="font-mono text-[13px] text-primary">{aiResult}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="default" onClick={insertAiResult} className="h-7 text-xs">Run command</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAiResult(null); setAiInput(""); setOverlay(null) }} className="h-7 text-xs">Dismiss</Button>
                </div>
              </BubbleContent>
            </Bubble>
          )}
        </div>
      )}

      {overlay?.type === "slash" && (
        <div className="absolute inset-x-3 bottom-3 z-10" onKeyDown={handleSlashKeyDown}>
          <div className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground">
            SLASH COMMANDS
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-[#14131b] p-1.5 shadow-2xl ring-1 ring-primary/10">
            <input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={handleSlashKeyDown}
              placeholder="Type a command or select below..."
              className="h-9 flex-1 bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          {aiResult ? (
            <Bubble variant="secondary" align="start" className="mt-2">
              <BubbleContent className="flex flex-col gap-2">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{aiResult}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="default" onClick={() => {
                    writeToTerminal(`${aiResult}\r`)
                    setAiResult(null)
                    setOverlay(null)
                    setAiInput("")
                  }} className="h-7 text-xs">Run suggestion</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAiResult(null); setAiInput(""); setOverlay(null) }} className="h-7 text-xs">Dismiss</Button>
                </div>
              </BubbleContent>
            </Bubble>
          ) : !aiBusy && (
            <div className="mt-1 rounded-xl border border-border bg-card/95 p-1 shadow-lg">
              {slashCommands.map((cmd, i) => (
                <button
                  key={cmd.prefix}
                  type="button"
                  onClick={() => { setAiInput(cmd.prefix + " "); runSlashCommand(cmd) }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${i === slashIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/70"}`}
                >
                  <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
                    {cmd.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{cmd.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{cmd.description}</span>
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">{cmd.prefix}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
