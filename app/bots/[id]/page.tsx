import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { BotDetail } from '@/components/bots/bot-detail'
import { bots, getBot } from '@/lib/mock-data'

export function generateStaticParams() {
  return bots.map((bot) => ({ id: bot.id }))
}

export default async function BotPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const bot = getBot(id)
  if (!bot) notFound()

  return (
    <AppShell>
      <BotDetail botId={bot.id} />
    </AppShell>
  )
}
