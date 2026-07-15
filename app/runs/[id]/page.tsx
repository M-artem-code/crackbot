import Link from 'next/link'
import { ArrowLeftIcon, RefreshCwIcon, ShieldAlertIcon } from 'lucide-react'
import { notFound } from 'next/navigation'

import { retryRun } from '@/app/actions/runs'
import { AppShell } from '@/components/app-shell'
import { RunStatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getRunObservability } from '@/lib/run-queries'

export const dynamic = 'force-dynamic'

function duration(from: Date | null, to: Date | null) {
  if (!from) return '—'
  const ms = (to?.getTime() ?? Date.now()) - from.getTime()
  return ms < 60_000 ? `${Math.max(0, Math.round(ms / 1000))} сек.` : `${Math.round(ms / 60_000)} мин.`
}

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getRunObservability(id)
  if (!detail) notFound()
  const { run } = detail
  const retryable = run.status === 'failed' || run.status === 'cancelled' || run.status === 'partial'

  return <AppShell><main className="flex flex-col gap-6 p-6 lg:p-8">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="flex flex-col gap-2"><Link href="/runs" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-3.5" />Все прогоны</Link><div className="flex flex-wrap items-center gap-3"><h1 className="font-mono text-2xl font-semibold tracking-tight">{run.id}</h1><RunStatusBadge status={run.status as 'queued'|'running'|'success'|'partial'|'failed'|'cancelled'} /></div><p className="text-sm text-muted-foreground">{detail.botName} · {run.source}{run.retryOfRunId ? ` · повтор ${run.retryOfRunId}` : ''}</p></div>{retryable && <form action={retryRun.bind(null, run.id)}><Button type="submit"><RefreshCwIcon data-icon="inline-start" />Повторить новым прогоном</Button></form>}</header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Длительность', duration(run.startedAt, run.finishedAt)], ['Успешно', String(run.successCount)], ['Ошибок', String(run.failedCount)], ['Создан', run.createdAt.toLocaleString('ru-RU')],
    ].map(([label,value]) => <article key={label} className="rounded-xl bg-card p-4 ring-1 ring-foreground/5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate font-mono text-sm font-medium">{value}</p></article>)}</section>
    {run.error && <section className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"><ShieldAlertIcon className="mt-0.5 size-5 shrink-0 text-destructive" /><div><div className="flex flex-wrap gap-2"><h2 className="font-medium">Ошибка прогона</h2></div><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{run.error}</p></div></section>}
    <article className="rounded-xl bg-card ring-1 ring-foreground/5"><div className="flex items-center justify-between border-b p-5"><div><h2 className="font-semibold">Логи прогона</h2><p className="text-xs text-muted-foreground">До 1000 последних событий</p></div><Badge variant="secondary">{detail.logs.length}</Badge></div><div className="max-h-[42rem] overflow-auto p-3 font-mono text-xs">{detail.logs.length ? detail.logs.map((log) => <div key={log.id} className="grid grid-cols-[5rem_2rem_minmax(0,1fr)] gap-2 rounded-md px-2 py-2 hover:bg-muted/40"><span className="text-muted-foreground">{log.ts.toLocaleTimeString('ru-RU')}</span><span className={log.level === 'error' ? 'text-destructive' : log.level === 'success' ? 'text-primary' : 'text-muted-foreground'}>w{log.worker}</span><span><span className="text-muted-foreground">{log.step}</span> {log.message}</span></div>) : <p className="p-6 text-center text-muted-foreground">Логов пока нет.</p>}</div></article>
  </main></AppShell>
}
