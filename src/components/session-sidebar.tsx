import { Bot, Plus, Settings, SquareTerminal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { Session } from "@/types"

type SessionSidebarProps = {
  sessions: Session[]
  activeId: string
  search: string
  onSelect: (id: string) => void
  onNew: () => void
  onOpenChat: () => void
  onOpenSettings: () => void
}

export function SessionSidebar({ sessions, activeId, search, onSelect, onNew, onOpenChat, onOpenSettings }: SessionSidebarProps) {
  const visibleSessions = sessions.filter((session) => session.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-border/80 bg-card/90 p-2">
      <Button variant="ghost" className="justify-start" onClick={() => onSelect(activeId)}>
        <SquareTerminal /> Terminal
      </Button>
      <Button variant="ghost" className="justify-start" onClick={onNew}>
        <Plus /> New session
        <Kbd className="ml-auto">Ctrl+T</Kbd>
      </Button>

      <p className="mb-2 mt-5 px-2 text-[10px] font-medium tracking-[0.12em] text-muted-foreground">SESSIONS</p>
      <Separator className="mb-2 h-px" />
      <ScrollArea className="min-h-0 flex-1 pr-1">
        <div className="space-y-1">
        {visibleSessions.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() => onSelect(session.id)}
            className={cn(
              "group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent",
              activeId === session.id && "bg-accent text-accent-foreground",
            )}
          >
            {activeId === session.id && <span className="absolute -left-2 h-5 w-0.5 rounded-r bg-primary" />}
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <SquareTerminal className="size-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">{session.title}</span>
              <span className="block truncate text-[10px] text-muted-foreground">{session.shell}</span>
            </span>
          </button>
        ))}
        </div>
      </ScrollArea>

      <Button variant="ghost" className="justify-start" onClick={onOpenChat}>
        <Bot /> AI assistant
      </Button>
      <Button variant="ghost" className="justify-start" onClick={onOpenSettings}>
        <Settings /> Settings
      </Button>
    </aside>
  )
}
