'use client'

import * as React from 'react'
import { ChevronDownIcon, HistoryIcon, RotateCcwIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { rollbackScenario } from '@/app/actions/bots'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { formatDateTime, type ScenarioVersionInfo } from '@/lib/mock-data'
import { diffScenarios } from '@/lib/scenario/diff'

export function ScenarioVersionHistory({ botId, versions }: { botId: string; versions: ScenarioVersionInfo[] }) {
  const router = useRouter()
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [rollingBack, setRollingBack] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)

  async function rollback(version: ScenarioVersionInfo) {
    if (version.isCurrent || rollingBack) return
    setRollingBack(version.id)
    setMessage(null)
    try {
      const result = await rollbackScenario(botId, version.id)
      setMessage(`Создана версия ${result.version} из версии ${version.version}`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rollback не выполнен')
    } finally {
      setRollingBack(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2"><HistoryIcon className="size-4 text-primary" /><CardTitle>История версий</CardTitle></div>
        <CardDescription>Опубликованные snapshots неизменяемы. Rollback всегда создаёт новую версию.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
        {versions.length === 0 ? <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">История появится после следующей публикации.</div> : null}
        {versions.map((version, index) => {
          const previous = versions[index + 1]
          const diff = previous ? diffScenarios(previous.snapshot, version.snapshot) : null
          const isExpanded = expanded === version.id
          return <div key={version.id} className="rounded-md border">
            <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setExpanded(isExpanded ? null : version.id)} aria-expanded={isExpanded}>
                <ChevronDownIcon className={`size-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="font-mono text-sm font-semibold">v{version.version}</span>{version.isCurrent ? <Badge>Текущая</Badge> : null}{version.sourceVersionId ? <Badge variant="outline">rollback</Badge> : null}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{version.changeSummary} · {formatDateTime(version.createdAt)} · {version.author}</span></span>
                <span className="hidden font-mono text-xs text-muted-foreground sm:block">{diff?.summary ?? 'Начальная версия'}</span>
              </button>
              {!version.isCurrent ? <Button size="sm" variant="outline" onClick={() => rollback(version)} disabled={rollingBack !== null}>{rollingBack === version.id ? <Spinner /> : <RotateCcwIcon />}Rollback</Button> : null}
            </div>
            {isExpanded ? <div className="flex flex-col gap-3 border-t p-3">
              {diff ? <div className="grid gap-2 text-xs sm:grid-cols-4"><Metric label="Добавлено" value={diff.added.length} /><Metric label="Удалено" value={diff.removed.length} /><Metric label="Изменено" value={diff.changed.length} /><Metric label="Порядок" value={diff.reordered ? 'изменён' : 'без изменений'} /></div> : null}
              {diff?.changed.length ? <p className="text-xs text-muted-foreground">Изменённые шаги: {diff.changed.map((item) => `${item.id} (${item.fields.join(', ')})`).join('; ')}</p> : null}
              <pre className="max-h-72 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed">{JSON.stringify(version.snapshot, null, 2)}</pre>
            </div> : null}
          </div>
        })}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2"><span className="text-muted-foreground">{label}</span><span className="font-mono font-medium">{value}</span></div>
}
