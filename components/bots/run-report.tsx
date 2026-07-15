'use client'

import { DownloadIcon, FileCodeIcon, ImageIcon, TimerIcon } from 'lucide-react'

import { RunLog } from '@/components/bots/run-log'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration, type Run } from '@/lib/mock-data'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function RunReport({ run }: { run: Run }) {
  const artifacts = run.artifacts ?? []
  const screenshots = artifacts.filter((artifact) => artifact.kind === 'screenshot')
  const files = artifacts.filter((artifact) => artifact.kind !== 'screenshot')
  const failedStep = run.steps.find((step) => step.status === 'failed')

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs text-muted-foreground">Статус</span>
            <Badge variant="outline" className="w-fit">{run.status}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs text-muted-foreground">Длительность</span>
            <span className="flex items-center gap-2 font-mono text-sm"><TimerIcon className="size-4" />{formatDuration(run.durationMs)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs text-muted-foreground">Шаги</span>
            <span className="font-mono text-sm">{run.stepsPassed}/{run.stepsTotal}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs text-muted-foreground">Сценарий</span>
            <span className="truncate text-sm">{run.scenarioName ?? 'Scenario'} v{run.scenarioVersion ?? 1}</span>
          </CardContent>
        </Card>
      </div>

      {failedStep || run.error ? (
        <Card className="border-destructive/40">
          <CardHeader><CardTitle className="text-sm text-destructive">Первый сбой</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="font-medium">{failedStep?.stepId ?? 'run'} — {failedStep?.label ?? run.error}</p>
            {failedStep?.detail ? <p className="text-pretty text-muted-foreground">{failedStep.detail}</p> : null}
            {failedStep?.metadata?.currentUrl ? <code className="overflow-x-auto rounded bg-muted p-2 text-xs">{String(failedStep.metadata.currentUrl)}</code> : null}
          </CardContent>
        </Card>
      ) : null}

      <RunLog steps={run.steps} />

      {screenshots.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Скриншоты</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {screenshots.map((artifact) => (
              <a key={artifact.id} href={artifact.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-md border bg-card">
                {/* Private image route streams only after server-side artifact lookup. */}
                <img src={artifact.url} alt={`Скриншот шага ${artifact.stepId ?? 'run'}`} className="aspect-video w-full object-cover" />
                <div className="flex items-center justify-between gap-3 border-t p-3 text-xs">
                  <span className="flex items-center gap-2"><ImageIcon className="size-4" />{artifact.stepId ?? 'run'} · worker {artifact.worker}</span>
                  <span className="text-muted-foreground">{formatBytes(artifact.byteSize)}</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {files.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Диагностические файлы</h3>
          <div className="flex flex-col gap-2">
            {files.map((artifact) => (
              <div key={artifact.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileCodeIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0"><p className="truncate text-sm">{artifact.kind} · {artifact.stepId ?? 'run'}</p><p className="text-xs text-muted-foreground">worker {artifact.worker} · {formatBytes(artifact.byteSize)}</p></div>
                </div>
                <a
                  href={artifact.url}
                  aria-label={`Скачать ${artifact.kind}`}
                  className={cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }))}
                >
                  <DownloadIcon />
                </a>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
