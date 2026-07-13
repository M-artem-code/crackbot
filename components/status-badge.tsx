import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AgentStatus, BotStatus, RefStatus, RunStatus } from "@/lib/mock-data"

const botStatusConfig: Record<BotStatus, { label: string; dot: string; pulse?: boolean }> = {
  active: { label: "Активен", dot: "bg-primary", pulse: true },
  idle: { label: "Готов", dot: "bg-muted-foreground" },
  paused: { label: "Пауза", dot: "bg-muted-foreground" },
  error: { label: "Ошибка", dot: "bg-destructive" },
}

export function BotStatusBadge({ status }: { status: BotStatus }) {
  const cfg = botStatusConfig[status] ?? botStatusConfig.idle
  return (
    <Badge variant="outline" className="gap-1.5 font-mono text-[11px]">
      <span className={cn("size-1.5 rounded-full", cfg.dot, cfg.pulse && "animate-status-pulse")} />
      {cfg.label}
    </Badge>
  )
}

const runStatusConfig: Record<RunStatus, { label: string; className: string }> = {
  success: { label: "Успех", className: "border-primary/40 text-primary" },
  failed: { label: "Ошибка", className: "border-destructive/40 text-destructive" },
  running: { label: "Выполняется", className: "border-warning/40 text-warning" },
  queued: { label: "В очереди", className: "border-muted-foreground/40 text-muted-foreground" },
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const cfg = runStatusConfig[status] ?? runStatusConfig.queued
  return (
    <Badge variant="outline" className={cn("font-mono text-[11px]", cfg.className)}>
      {cfg.label}
    </Badge>
  )
}

const agentStatusConfig: Record<
  AgentStatus,
  { label: string; dot: string; pulse?: boolean; className?: string }
> = {
  online: { label: "Онлайн", dot: "bg-primary", pulse: true, className: "border-primary/40 text-primary" },
  offline: { label: "Оффлайн", dot: "bg-muted-foreground", className: "text-muted-foreground" },
  disabled: {
    label: "Отключён",
    dot: "bg-destructive",
    className: "border-destructive/40 text-destructive",
  },
}

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const cfg = agentStatusConfig[status] ?? agentStatusConfig.offline
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-mono text-[11px]", cfg.className)}>
      <span className={cn("size-1.5 rounded-full", cfg.dot, cfg.pulse && "animate-status-pulse")} />
      {cfg.label}
    </Badge>
  )
}

const refStatusConfig: Record<RefStatus, { label: string; className: string }> = {
  active: { label: "Активна", className: "border-primary/40 text-primary" },
  exhausted: { label: "Исчерпана", className: "border-warning/40 text-warning" },
  disabled: { label: "Отключена", className: "border-muted-foreground/40 text-muted-foreground" },
}

export function RefStatusBadge({ status }: { status: RefStatus }) {
  const cfg = refStatusConfig[status] ?? refStatusConfig.disabled
  return (
    <Badge variant="outline" className={cn("font-mono text-[11px]", cfg.className)}>
      {cfg.label}
    </Badge>
  )
}
