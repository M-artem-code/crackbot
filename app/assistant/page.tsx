import type { Metadata } from "next"
import { AppShell } from "@/components/app-shell"
import { AssistantChat } from "@/components/assistant/assistant-chat"

export const metadata: Metadata = {
  title: "AI-ассистент — BotForge",
}

export default function AssistantPage() {
  return (
    <AppShell>
      <AssistantChat />
    </AppShell>
  )
}
