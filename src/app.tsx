import { useEffect, useMemo, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Plus, X } from "lucide-react"

import { CommandPalette } from "@/components/command-palette"
import { SessionSidebar } from "@/components/session-sidebar"
import { SidePanel } from "@/components/side-panel"
import { TerminalPane } from "@/components/terminal-pane"
import { TitleBar } from "@/components/title-bar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AppSettings, Session } from "@/types"

const defaultSettings: AppSettings = {
  endpoint: "http://localhost:20128/v1",
  model: "gpt-4.1-mini",
  apiKey: "",
  uiFont: "Geist",
  monoFont: "Geist Mono",
}

function makeSession(index: number): Session {
  return { id: crypto.randomUUID(), title: `Shell ${index}`, shell: "PowerShell" }
}

export function App() {
  const [sessions, setSessions] = useState<Session[]>(() => [makeSession(1)])
  const [activeId, setActiveId] = useState(() => sessions[0].id)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [panel, setPanel] = useState<"chat" | "settings" | null>(null)
  const [search, setSearch] = useState("")
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem("oass.settings")
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings
    } catch {
      return defaultSettings
    }
  })
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  const activeSession = useMemo(() => sessions.find((session) => session.id === activeId) ?? sessions[0], [sessions, activeId])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty("--app-font-sans", `"${settings.uiFont}"`)
    root.style.setProperty("--app-font-mono", `"${settings.monoFont}"`)
  }, [settings.uiFont, settings.monoFont])

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return
    void invoke<string | null>("load_api_key")
      .then((apiKey) => {
        if (apiKey) setSettings((current) => ({ ...current, apiKey }))
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "t") {
        event.preventDefault()
        addSession()
      }
      if ((event.ctrlKey && event.key.toLowerCase() === "k") || (event.ctrlKey && event.key.toLowerCase() === "p")) {
        event.preventDefault()
        setCommandPaletteOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  function addSession() {
    setSessions((current) => {
      const next = makeSession(current.length + 1)
      setActiveId(next.id)
      return [...current, next]
    })
  }

  function closeSession(id: string) {
    setSessions((current) => {
      if (current.length === 1) return current
      const index = current.findIndex((session) => session.id === id)
      const next = current.filter((session) => session.id !== id)
      if (activeId === id) setActiveId(next[Math.max(0, index - 1)].id)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <TitleBar
        search={search}
        onSearchChange={setSearch}
        onToggleSidebar={() => setSidebarOpen((value) => !value)}
        onOpenChat={() => setPanel("chat")}
        onOpenSettings={() => setPanel("settings")}
      />

      <div className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <SessionSidebar
            sessions={sessions}
            activeId={activeId}
            search={search}
            onSelect={setActiveId}
            onNew={addSession}
            onOpenChat={() => setPanel("chat")}
            onOpenSettings={() => setPanel("settings")}
          />
        )}

        <main className="relative flex min-w-0 flex-1 gap-2 p-2">
          <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-[linear-gradient(145deg,#14131b_0%,#0f0f15_55%,#0c0c11_100%)]">
            <Tabs value={activeId} onValueChange={setActiveId} className="flex flex-col min-h-0 flex-1">
              <div className="flex h-10 shrink-0 items-end border-b border-border/80 px-2">
                <span className="mb-2 mr-2 px-1.5 text-[10px] font-medium tracking-[0.1em] text-muted-foreground">WORKSPACE</span>
                <TabsList className="h-auto gap-0.5 rounded-none bg-transparent p-0">
                  {sessions.map((session) => (
                    <TabsTrigger
                      key={session.id}
                      value={session.id}
                      className="group relative h-8 min-w-24 gap-1.5 rounded-t-lg rounded-b-none px-3 text-[13px] font-medium data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                    >
                      <span className="truncate">{session.title}</span>
                      <X
                        className="size-3 rounded-sm opacity-50 transition-opacity group-hover:opacity-100 hover:bg-accent"
                        onClick={(event) => {
                          event.stopPropagation()
                          closeSession(session.id)
                        }}
                      />
                    </TabsTrigger>
                  ))}
                </TabsList>
                <Button aria-label="New tab" variant="ghost" size="icon" className="mb-1 ml-0.5 size-7" onClick={addSession}>
                  <Plus className="size-3.5" />
                </Button>
              </div>

              {sessions.map((session) => (
                <TerminalPane key={session.id} sessionId={session.id} active={session.id === activeId} settings={settings} />
              ))}
            </Tabs>
          </section>

          {panel && (
            <>
              <button
                type="button"
                aria-label="Close side panel backdrop"
                className="absolute bottom-2 left-2 right-[388px] top-2 z-10 hidden rounded-xl bg-black/35 outline-none backdrop-blur-[1px] focus-visible:ring-2 focus-visible:ring-primary/60 max-[1050px]:block"
                onClick={() => setPanel(null)}
              />
              <SidePanel mode={panel} settings={settings} onSettingsChange={setSettings} onClose={() => setPanel(null)} />
            </>
          )}
        </main>
      </div>

      <footer className="flex h-7 shrink-0 items-center border-t border-border bg-card px-3 text-[10px] text-muted-foreground">
        <span className="mr-2 size-1.5 rounded-full bg-emerald-400" />
        <span className="text-foreground">Terminal ready</span>
        <span className="ml-5">{activeSession?.shell ?? "PowerShell"}</span>
        <span className="ml-auto">Rust PTY</span>
      </footer>

      <CommandPalette
        open={commandPaletteOpen}
        sessions={sessions}
        activeId={activeId}
        onClose={() => setCommandPaletteOpen(false)}
        onNewSession={addSession}
        onSelectSession={setActiveId}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onOpenChat={() => { setCommandPaletteOpen(false); setPanel("chat") }}
        onOpenSettings={() => { setCommandPaletteOpen(false); setPanel("settings") }}
      />
    </div>
  )
}
