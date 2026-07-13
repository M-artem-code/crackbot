import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { CreateBotWizard } from '@/components/create/create-bot-wizard'
import { getTemplates } from '@/lib/queries'

export default async function CreatePage() {
  const templates = await getTemplates()
  return (
    <AppShell>
      <PageHeader
        title="Создать бота"
        description="новый бот из шаблона за пару минут"
      />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <CreateBotWizard templates={templates} />
      </main>
    </AppShell>
  )
}
