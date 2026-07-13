import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { BotDetail } from '@/components/bots/bot-detail'
import { getBot, getRunsForBot } from '@/lib/queries'

export default async function BotPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const bot = await getBot(id)
  if (!bot) notFound()

  const runs = await getRunsForBot(id)

  return (
    <AppShell>
      <BotDetail bot={bot} runs={runs} />
    </AppShell>
  )
}
