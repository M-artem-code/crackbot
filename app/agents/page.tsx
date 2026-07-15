import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { AgentsView } from '@/components/agents/agents-view'
import { getAgents } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function AgentsPage() {
  const agents = await getAgents()
  return (
    <AppShell>
      <PageHeader title="Агенты" description="раннеры, которые запускают ботов" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <AgentsView agents={agents} />
      </main>
    </AppShell>
  )
}
