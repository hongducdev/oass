import { cn } from "@/lib/utils"

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn("shrink-0 bg-border", className)} />
}
