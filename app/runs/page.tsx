import Link from 'next/link'
import { ChevronLeftIcon, ChevronRightIcon, FilterIcon, RotateCcwIcon } from 'lucide-react'

import { AppShell } from '@/components/app-shell'
import { RunStatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getRunsPage } from '@/lib/run-queries'

export const dynamic = 'force-dynamic'

function hrefFor(params: Record<string, string | undefined>) {
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])))
  return `/runs?${query}`
}

export default async function RunsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams
  const value = (key: string) => typeof raw[key] === 'string' ? raw[key] as string : undefined
  const filters = { status: value('status'), source: value('source'), failureKind: value('failureKind'), botId: value('botId'), query: value('query'), from: value('from'), to: value('to'), page: Number(value('page') ?? 1) }
  const data = await getRunsPage(filters)
  const shared = Object.fromEntries(Object.entries(filters).filter(([key, item]) => key !== 'page' && typeof item === 'string')) as Record<string, string>

  return <AppShell><main className="flex flex-col gap-6 p-6 lg:p-8">
    <header className="flex flex-col gap-2"><p className="font-mono text-xs uppercase tracking-widest text-primary">Operations</p><h1 className="text-balance text-3xl font-semibold tracking-tight">Прогоны</h1><p className="text-sm text-muted-foreground">Очередь, активные leases, результаты и инфраструктурные восстановления.</p></header>
    <form className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/5 md:grid-cols-4 xl:grid-cols-8">
      <label className="md:col-span-2"><span className="sr-only">Поиск по ID</span><Input name="query" defaultValue={filters.query} placeholder="run_..." /></label>
      <select name="status" defaultValue={filters.status ?? 'all'} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="all">Все статусы</option>{['queued','running','success','partial','failed','cancelled'].map((item) => <option key={item}>{item}</option>)}</select>
      <select name="source" defaultValue={filters.source ?? 'all'} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="all">Все источники</option>{['manual','scheduled','retry'].map((item) => <option key={item}>{item}</option>)}</select>
      <select name="failureKind" defaultValue={filters.failureKind ?? 'all'} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="all">Все ошибки</option><option value="business">business</option><option value="infrastructure">infrastructure</option></select>
      <select name="botId" defaultValue={filters.botId ?? 'all'} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="all">Все боты</option>{data.bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name}</option>)}</select>
      <Button type="submit"><FilterIcon data-icon="inline-start" />Фильтровать</Button><Button variant="outline" render={<Link href="/runs" />}><RotateCcwIcon data-icon="inline-start" />Сбросить</Button>
    </form>
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/5">
      {data.items.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-4 font-medium">Прогон</th><th className="p-4 font-medium">Бот</th><th className="p-4 font-medium">Статус</th><th className="p-4 font-medium">Источник</th><th className="p-4 font-medium">Попытки</th><th className="p-4 font-medium">Создан</th></tr></thead><tbody>{data.items.map(({ run, botName }) => <tr key={run.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30"><td className="p-4"><Link href={`/runs/${run.id}`} className="font-mono text-xs text-primary hover:underline">{run.id}</Link></td><td className="p-4">{botName}</td><td className="p-4"><RunStatusBadge status={run.status as 'queued'|'running'|'success'|'partial'|'failed'|'cancelled'} /></td><td className="p-4 font-mono text-xs text-muted-foreground">{run.source}</td><td className="p-4 font-mono text-xs">{run.attempt}/{run.maxInfraAttempts}</td><td className="p-4 font-mono text-xs text-muted-foreground">{run.createdAt.toLocaleString('ru-RU')}</td></tr>)}</tbody></table></div> : <p className="p-10 text-center text-sm text-muted-foreground">По выбранным фильтрам прогонов нет.</p>}
    </section>
    <nav className="flex items-center justify-between" aria-label="Пагинация"><Button variant="outline" disabled={data.page <= 1} render={data.page > 1 ? <Link href={hrefFor({ ...shared, page: String(data.page - 1) })} /> : undefined}><ChevronLeftIcon data-icon="inline-start" />Назад</Button><span className="font-mono text-xs text-muted-foreground">Страница {data.page}</span><Button variant="outline" disabled={!data.hasNext} render={data.hasNext ? <Link href={hrefFor({ ...shared, page: String(data.page + 1) })} /> : undefined}>Далее<ChevronRightIcon data-icon="inline-end" /></Button></nav>
  </main></AppShell>
}
