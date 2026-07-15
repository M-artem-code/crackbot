import type { Metadata } from "next"
import { AppShell } from "@/components/app-shell"
import { AssistantChat } from "@/components/assistant/assistant-chat"
import { getActiveAiProviderSummary } from "@/app/actions/ai-providers"
import { getAssistantHistory } from "@/lib/assistant"

export const metadata: Metadata = {
  title: "AI-ассистент — BotForge",
}

export const dynamic = "force-dynamic"

export default async function AssistantPage() {
  const [history, provider] = await Promise.all([getAssistantHistory(), getActiveAiProviderSummary()])
  return (
    <AppShell>
      <AssistantChat initialHistory={history} provider={provider} />
    </AppShell>
  )
}
