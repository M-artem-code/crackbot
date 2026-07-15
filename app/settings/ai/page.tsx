import type { Metadata } from 'next'

import { getAiProviders } from '@/app/actions/ai-providers'
import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { AiProviderSettings } from '@/components/settings/ai-provider-settings'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Настройки AI — BotForge' }

export default async function AiSettingsPage() {
  const providers = await getAiProviders()
  return (
    <AppShell>
      <PageHeader title="Настройки AI" description="свои ключи OpenAI и OpenAI-compatible провайдеров" />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col p-4 lg:p-6">
        <AiProviderSettings providers={providers} />
      </main>
    </AppShell>
  )
}
