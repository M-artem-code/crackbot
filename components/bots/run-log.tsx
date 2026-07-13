'use client'

import { CheckIcon, CircleIcon, XIcon } from 'lucide-react'

import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { formatDuration, type LogStep } from '@/lib/mock-data'

export function RunLog({ steps }: { steps: LogStep[] }) {
  return (
    <div className="flex flex-col rounded-md border bg-background font-mono text-xs">
      <div className="flex items-center gap-1.5 border-b px-3 py-2">
        <span className="size-2.5 rounded-full bg-destructive/60" />
        <span className="size-2.5 rounded-full bg-warning/60" />
        <span className="size-2.5 rounded-full bg-primary/60" />
        <span className="ml-2 text-muted-foreground">runner — лог прогона</span>
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        {steps.length === 0 ? (
          <p className="px-2 py-4 text-center text-muted-foreground">
            Ожидаем первые шаги от локального агента...
          </p>
        ) : null}
        {steps.map((step, i) => (
          <div
            key={step.id}
            className={cn(
              'flex items-start gap-2.5 rounded px-2 py-1.5',
              step.status === 'failed' && 'bg-destructive/10',
              step.status === 'running' && 'bg-primary/5',
            )}
          >
            <span className="mt-0.5 shrink-0">
              {step.status === 'success' ? (
                <CheckIcon className="size-3.5 text-primary" />
              ) : step.status === 'failed' ? (
                <XIcon className="size-3.5 text-destructive" />
              ) : step.status === 'running' ? (
                <Spinner className="size-3.5 text-primary" />
              ) : (
                <CircleIcon className="size-3.5 text-muted-foreground/40" />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={cn(
                    step.status === 'pending' && 'text-muted-foreground/50',
                    step.status === 'failed' && 'text-destructive',
                  )}
                >
                  <span className="mr-2 text-muted-foreground/60">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {step.label}
                  {step.attempt && step.attempt > 1 ? (
                    <span className="ml-2 text-warning">попытка {step.attempt}</span>
                  ) : null}
                </span>
                {step.status === 'success' || step.status === 'failed' ? (
                  <span className="shrink-0 text-muted-foreground/60">
                    {formatDuration(step.durationMs)}
                  </span>
                ) : null}
              </div>
              {step.detail ? (
                <p className="text-pretty rounded bg-destructive/10 px-2 py-1 text-destructive">
                  {step.detail}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
