import * as React from "react"
import { cn } from "@/lib/utils"

const bubbleVariants = {
  default:
    "bg-primary text-primary-foreground",
  secondary:
    "bg-secondary text-secondary-foreground",
  muted:
    "bg-muted text-foreground",
  tinted:
    "bg-primary/10 text-primary ring-1 ring-primary/20",
  outline:
    "border border-border bg-transparent text-foreground",
  ghost:
    "bg-transparent text-foreground",
  destructive:
    "bg-destructive text-destructive-foreground",
} as const

type BubbleVariant = keyof typeof bubbleVariants

type BubbleContextValue = { variant: BubbleVariant }
const BubbleContext = React.createContext<BubbleContextValue>({ variant: "default" })

type BubbleProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: BubbleVariant
  align?: "start" | "end"
}

function Bubble({ className, variant = "default", align = "start", ...props }: BubbleProps) {
  return (
    <BubbleContext.Provider value={{ variant }}>
      <div
        data-slot="bubble"
        className={cn(
          "group/bubble relative flex w-fit max-w-[85%] flex-col",
          variant === "ghost" && "max-w-full",
          align === "end" && "ml-auto",
          className,
        )}
        {...props}
      />
    </BubbleContext.Provider>
  )
}

function useBubbleContext() {
  return React.useContext(BubbleContext)
}

type BubbleContentProps = React.HTMLAttributes<HTMLDivElement> & {
  render?: React.ElementType
}

function BubbleContent({ className, render, children, ...props }: BubbleContentProps) {
  const { variant } = useBubbleContext()
  const Comp = render || "div"
  return (
    <Comp
      data-slot="bubble-content"
      className={cn(
        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
        bubbleVariants[variant],
        render && "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  )
}

type BubbleReactionsProps = React.HTMLAttributes<HTMLDivElement> & {
  side?: "top" | "bottom"
  align?: "start" | "end"
}

function BubbleReactions({
  className,
  side = "bottom",
  align = "end",
  ...props
}: BubbleReactionsProps) {
  return (
    <div
      data-slot="bubble-reactions"
      className={cn(
        "flex items-center gap-0.5",
        align === "end" && "justify-end",
        align === "start" && "justify-start",
        side === "bottom" && "-mb-1.5 mt-0.5",
        side === "top" && "-mt-1.5 mb-0.5",
        className,
      )}
      {...props}
    />
  )
}

type BubbleGroupProps = React.HTMLAttributes<HTMLDivElement>

function BubbleGroup({ className, ...props }: BubbleGroupProps) {
  return (
    <div
      data-slot="bubble-group"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

export { Bubble, BubbleContent, BubbleReactions, BubbleGroup }
export type { BubbleVariant }
