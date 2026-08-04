import { getCurrentWindow } from "@tauri-apps/api/window"
import { Bot, Maximize2, Menu, Minus, Search, Settings, SquareTerminal, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type TitleBarProps = {
  search: string
  onSearchChange: (value: string) => void
  onToggleSidebar: () => void
  onOpenChat: () => void
  onOpenSettings: () => void
}

async function windowAction(action: "minimize" | "maximize" | "close") {
  if (!("__TAURI_INTERNALS__" in window)) return
  const appWindow = getCurrentWindow()
  if (action === "minimize") await appWindow.minimize()
  if (action === "maximize") await appWindow.toggleMaximize()
  if (action === "close") await appWindow.close()
}

export function TitleBar({ search, onSearchChange, onToggleSidebar, onOpenChat, onOpenSettings }: TitleBarProps) {
  return (
    <header data-tauri-drag-region className="relative flex h-12 shrink-0 select-none items-center border-b border-border/80 bg-card/95 pl-2">
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button aria-label="Toggle sidebar" variant="ghost" size="icon" onClick={onToggleSidebar}>
              <Menu />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Toggle sidebar</TooltipContent>
        </Tooltip>
        <div className="ml-1 flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <SquareTerminal className="size-4" />
        </div>
        <span className="ml-1.5 text-sm font-semibold tracking-tight">Oass</span>
      </div>

      <div className="pointer-events-auto absolute left-1/2 top-1/2 w-[min(420px,38vw)] -translate-x-1/2 -translate-y-1/2">
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search sessions and tabs"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search sessions and tabs"
          className="h-8 rounded-lg bg-secondary/70 pl-9 pr-3 text-xs shadow-none"
        />
      </div>

      <div className="ml-auto flex h-full items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button aria-label="AI assistant" variant="ghost" size="icon" className="rounded-none" onClick={onOpenChat}>
              <Bot />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">AI assistant</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button aria-label="Settings" variant="ghost" size="icon" className="rounded-none" onClick={onOpenSettings}>
              <Settings />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Settings</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button aria-label="Minimize" variant="ghost" className="h-full w-11 rounded-none px-0" onClick={() => void windowAction("minimize")}>
              <Minus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Minimize</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button aria-label="Maximize" variant="ghost" className="h-full w-11 rounded-none px-0" onClick={() => void windowAction("maximize")}>
              <Maximize2 className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Maximize</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button aria-label="Close" variant="ghost" className="h-full w-11 rounded-none px-0 hover:bg-red-500 hover:text-white" onClick={() => void windowAction("close")}>
              <X className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
