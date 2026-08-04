export type Session = {
  id: string
  title: string
  shell: string
}

export type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

export type AppSettings = {
  endpoint: string
  model: string
  apiKey: string
  uiFont: string
  monoFont: string
}

export type TerminalOutput = {
  sessionId: string
  data: string
}
