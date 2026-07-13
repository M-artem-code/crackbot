import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BotStatus, RunStatus, DbRecordStatus } from '@/lib/mock-data'

const botStatusConfig: Record<BotStatus, { label: string; dot: string }> = {
  active: { label: 'Активен', dot: 'bg-primary' },
  paused: { label: 'Пауза', dot: 'bg-muted-foreground' },
  error: { label: 'Ошибка', dot: 'bg-destructive' },
}

export function BotStatusBadge({ status }: { status: BotStatus }) {
  const cfg = botStatusConfig[status]
  return (
    <Badge variant="outline" className="gap-1.5 font-mono text-[11px]">
      <span
        className={cn(
          'size-1.5 rounded-full',
          cfg.dot,
          status === 'active' && 'animate-status-pulse',
        )}
      />
      {cfg.label}
    </Badge>
  )
}

const runStatusConfig: Record<RunStatus, { label: string; className: string }> = {
  success: { label: 'Успех', className: 'border-primary/40 text-primary' },
  failed: { label: 'Ошибка', className: 'border-destructive/40 text-destructive' },
  running: { label: 'Выполняется', className: 'border-warning/40 text-warning' },
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const cfg = runStatusConfig[status]
  return (
    <Badge variant="outline" className={cn('font-mono text-[11px]', cfg.className)}>
      {cfg.label}
    </Badge>
  )
}

const dbStatusConfig: Record<DbRecordStatus, { label: string; className: string }> = {
  processed: { label: 'Обработано', className: 'border-primary/40 text-primary' },
  queued: { label: 'В очереди', className: 'border-warning/40 text-warning' },
  error: { label: 'Ошибка', className: 'border-destructive/40 text-destructive' },
}

export function DbRecordStatusBadge({ status }: { status: DbRecordStatus }) {
  const cfg = dbStatusConfig[status]
  return (
    <Badge variant="outline" className={cn('font-mono text-[11px]', cfg.className)}>
      {cfg.label}
    </Badge>
  )
}
