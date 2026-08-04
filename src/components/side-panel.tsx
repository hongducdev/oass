import { useEffect, useState } from "react"
import { Channel, invoke } from "@tauri-apps/api/core"
import { Bot, KeyRound, Save, Send, Settings, X } from "lucide-react"

import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import type { AppSettings, ChatMessage } from "@/types"

type SidePanelProps = {
  mode: "chat" | "settings"
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
  onClose: () => void
}

const isTauri = () => "__TAURI_INTERNALS__" in window

export function SidePanel({ mode, settings, onSettingsChange, onClose }: SidePanelProps) {
  const [draft, setDraft] = useState(settings)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [prompt, setPrompt] = useState("")
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("")

  useEffect(() => setDraft(settings), [settings])

  async function saveSettings() {
    try {
      localStorage.setItem("oass.settings", JSON.stringify({ endpoint: draft.endpoint, model: draft.model, uiFont: draft.uiFont, monoFont: draft.monoFont }))
      if (isTauri()) await invoke("save_api_key", { apiKey: draft.apiKey })
      onSettingsChange(draft)
      setStatus("Settings saved")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault()
    const content = prompt.trim()
    if (!content || busy) return
    if (!settings.apiKey) {
      setStatus("Add your 9router API key in Settings first.")
      return
    }

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }]
    setMessages([...nextMessages, { role: "assistant", content: "" }])
    setPrompt("")
    setBusy(true)
    setStatus("")

    try {
      if (!isTauri()) throw new Error("Native Tauri runtime is required for chat.")
      const onEvent = new Channel<string>()
      onEvent.onmessage = (chunk) => {
        setMessages((current) => {
          const copy = [...current]
          const last = copy.at(-1)
          if (last?.role === "assistant") copy[copy.length - 1] = { ...last, content: last.content + chunk }
          return copy
        })
      }
      await invoke("stream_chat", {
        request: {
          endpoint: settings.endpoint,
          apiKey: settings.apiKey,
          model: settings.model,
          messages: nextMessages,
        },
        onEvent,
      })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="panel-in flex w-[380px] max-w-[calc(100%-1rem)] shrink-0 flex-col rounded-xl border border-border bg-card/95 shadow-2xl max-[1050px]:absolute max-[1050px]:inset-y-2 max-[1050px]:right-2 max-[1050px]:z-20">
      <div className="flex items-start border-b border-border/80 p-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {mode === "chat" ? <Bot /> : <Settings />}
        </div>
        <div className="ml-3">
          <h2 className="text-lg font-semibold tracking-tight">{mode === "chat" ? "AI Assistant" : "Settings"}</h2>
          <p className="text-xs text-muted-foreground">
            {mode === "chat" ? "Context-aware help for your workspace" : "Native Oass preferences"}
          </p>
        </div>
        <Button aria-label="Close panel" variant="ghost" size="icon" className="ml-auto" onClick={onClose}>
          <X />
        </Button>
      </div>

      {mode === "chat" ? (
        <>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-3 p-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <Bot className="mb-3 size-8 text-primary/70" />
                <p className="text-sm font-medium text-foreground">Ask Oass</p>
                <p className="mt-1 max-w-56 text-xs leading-5">Debug commands, explain output, or plan your next terminal task.</p>
              </div>
            )}
            {messages.map((message, index) => {
              const isUser = message.role === "user"
              const isLastAssistant = !isUser && index === messages.length - 1 && busy
              return (
                <Bubble
                  key={index}
                  variant={isUser ? "default" : "secondary"}
                  align={isUser ? "end" : "start"}
                >
                  <BubbleContent>
                    {isLastAssistant && !message.content ? (
                      <div className="flex flex-col gap-2">
                        <Marker role="status">
                          <MarkerIcon>
                            <Spinner />
                          </MarkerIcon>
                          <MarkerContent className="shimmer">Thinking...</MarkerContent>
                        </Marker>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content}
                      </p>
                    )}
                  </BubbleContent>
                </Bubble>
              )
            })}
            </div>
          </ScrollArea>
          {status && <p className="px-4 pb-2 text-xs text-amber-300">{status}</p>}
          <form onSubmit={sendMessage} className="m-3 flex min-h-12 items-center gap-2 rounded-xl border border-border bg-secondary/75 p-1.5 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
            <Input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask about this terminal session" className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0" />
            <Button aria-label="Send message" size="icon" className="size-9 rounded-lg" disabled={busy}>
              <Send className="size-3.5" />
            </Button>
          </form>
        </>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 p-4">
            <label className="block space-y-2">
              <span className="text-xs font-medium">9router endpoint</span>
              <Input value={draft.endpoint} onChange={(event) => setDraft({ ...draft, endpoint: event.target.value })} placeholder="http://localhost:20128/v1" />
            </label>
            <label className="block space-y-2">
              <span className="flex items-center gap-1.5 text-xs font-medium"><KeyRound className="size-3.5" /> API key</span>
              <Input type="password" value={draft.apiKey} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} placeholder="Stored in Windows Credential Manager" />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-medium">Chat model</span>
              <Input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-medium">UI font</span>
              <select
                value={draft.uiFont}
                onChange={(event) => setDraft({ ...draft, uiFont: event.target.value })}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
              >
                <optgroup label="Bundled">
                  <option>Geist</option>
                </optgroup>
                <optgroup label="System">
                  <option>Segoe UI</option>
                  <option>Segoe UI Variable Text</option>
                  <option>Segoe UI Variable Display</option>
                  <option>Calibri</option>
                  <option>Tahoma</option>
                  <option>Verdana</option>
                  <option>Trebuchet MS</option>
                  <option>Arial</option>
                </optgroup>
                <optgroup label="Other">
                  <option>Inter</option>
                  <option>system-ui</option>
                </optgroup>
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-medium">Mono font</span>
              <select
                value={draft.monoFont}
                onChange={(event) => setDraft({ ...draft, monoFont: event.target.value })}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
              >
                <optgroup label="Bundled">
                  <option>Geist Mono</option>
                </optgroup>
                <optgroup label="System">
                  <option>Cascadia Code</option>
                  <option>Cascadia Mono</option>
                  <option>Consolas</option>
                  <option>Lucida Console</option>
                  <option>Courier New</option>
                  <option>Iosevka Term</option>
                  <option>Paper Mono</option>
                  <option>SpaceMono Nerd Font</option>
                  <option>SpaceMono Nerd Font Mono</option>
                </optgroup>
                <optgroup label="Other">
                  <option>JetBrains Mono</option>
                  <option>Fira Code</option>
                  <option>Hack</option>
                  <option>monospace</option>
                </optgroup>
              </select>
            </label>
            {status && <p className="text-xs text-emerald-300">{status}</p>}
            <Button onClick={() => void saveSettings()}>
              <Save /> Save settings
            </Button>
          </div>
        </ScrollArea>
      )}
    </aside>
  )
}
