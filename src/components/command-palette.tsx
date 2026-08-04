import { useEffect } from "react"
import { Bot, Plus, SquareTerminal, Settings, Menu } from "lucide-react"
import type { Session } from "@/types"

import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command"

type CommandPaletteProps = {
  open: boolean
  sessions: Session[]
  activeId: string
  onClose: () => void
  onNewSession: () => void
  onSelectSession: (id: string) => void
  onToggleSidebar: () => void
  onOpenChat: () => void
  onOpenSettings: () => void
}

export function CommandPalette({
  open,
  sessions,
  activeId,
  onClose,
  onNewSession,
  onSelectSession,
  onToggleSidebar,
  onOpenChat,
  onOpenSettings,
}: CommandPaletteProps) {
  useEffect(() => {
    if (!open) return
    const down = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open, onClose])

  return (
    <CommandDialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Sessions">
          {sessions.map((session) => (
            <CommandItem
              key={session.id}
              value={`${session.title} ${session.shell}`}
              onSelect={() => {
                onSelectSession(session.id)
                onClose()
              }}
            >
              <SquareTerminal />
              <span>{session.title}</span>
              <span className="ml-2 text-xs text-muted-foreground">{session.shell}</span>
              {session.id === activeId && (
                <span className="ml-auto text-[10px] text-primary">Active</span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              onNewSession()
              onClose()
            }}
          >
            <Plus />
            <span>New session</span>
            <CommandShortcut>Ctrl+T</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onToggleSidebar()
              onClose()
            }}
          >
            <Menu />
            <span>Toggle sidebar</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onOpenChat()
              onClose()
            }}
          >
            <Bot />
            <span>AI assistant</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onOpenSettings()
              onClose()
            }}
          >
            <Settings />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Commands">
          <CommandItem onSelect={() => onClose()}>
            <span className="text-[10px] font-mono text-muted-foreground">{">_"}</span>
            <span>clear</span>
          </CommandItem>
          <CommandItem onSelect={() => onClose()}>
            <span className="text-[10px] font-mono text-muted-foreground">{">_"}</span>
            <span>ls</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
