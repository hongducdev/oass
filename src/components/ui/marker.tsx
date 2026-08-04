import * as React from "react"
import { cn } from "@/lib/utils"

const markerVariants = {
  default:
    "flex items-center gap-2 text-muted-foreground",
  border:
    "flex items-center gap-2 border-b border-border pb-2 text-muted-foreground",
  separator:
    "flex items-center gap-3 text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border",
}

type MarkerVariant = keyof typeof markerVariants

type MarkerProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: MarkerVariant
  render?: React.ElementType
}

function Marker({ className, variant = "default", render, ...props }: MarkerProps) {
  const Comp = render || "div"
  return (
    <Comp
      data-slot="marker"
      className={cn(markerVariants[variant], "text-xs", className)}
      {...props}
    />
  )
}

function MarkerIcon({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden
      data-slot="marker-icon"
      className={cn("flex shrink-0 items-center justify-center", className)}
      {...props}
    />
  )
}

function MarkerContent({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="marker-content"
      className={cn("leading-none", className)}
      {...props}
    />
  )
}

export { Marker, MarkerIcon, MarkerContent, markerVariants }
export type { MarkerVariant }
