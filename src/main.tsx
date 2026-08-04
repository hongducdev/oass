import ReactDOM from "react-dom/client"
import "@xterm/xterm/css/xterm.css"

import { App } from "@/app"
import { TooltipProvider } from "@/components/ui/tooltip"
import "@/index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <TooltipProvider delayDuration={200}>
    <App />
  </TooltipProvider>,
)
