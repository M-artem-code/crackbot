import Link from 'next/link'
import { PlusIcon } from 'lucide-react'

import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { BotsGrid } from '@/components/bots/bots-grid'
import { Button } from '@/components/ui/button'

export default function BotsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Мои боты"
        description="все боты-автоматизации"
        actions={
          <Button size="sm" render={<Link href="/create" />}>
            <PlusIcon data-icon="inline-start" />
            Новый бот
          </Button>
        }
      />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <BotsGrid />
      </main>
    </AppShell>
  )
}
