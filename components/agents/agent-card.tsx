'use client'

import * as React from 'react'
import {
  MonitorIcon,
  MoreVerticalIcon,
  PlayIcon,
  PowerIcon,
  RefreshCwIcon,
  Trash2Icon,
} from 'lucide-react'

import { deleteAgent, rotateApiKey, setAgentDisabled } from '@/app/actions/agents'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { AgentStatusBadge } from '@/components/status-badge'
import { ApiKeyDialog } from '@/components/agents/api-key-dialog'
import { formatRelativeTime, type AgentInfo } from '@/lib/mock-data'

export function AgentCard({ agent }: { agent: AgentInfo }) {
  const [pending, startTransition] = React.useTransition()
  const [showDelete, setShowDelete] = React.useState(false)
  const [rotatedKey, setRotatedKey] = React.useState<string | null>(null)
  const [keyDialogOpen, setKeyDialogOpen] = React.useState(false)

  function handleRotate() {
    startTransition(async () => {
      const res = await rotateApiKey(agent.id)
      setRotatedKey(res.apiKey)
      setKeyDialogOpen(true)
    })
  }

  function handleToggleDisabled() {
    startTransition(async () => {
      await setAgentDisabled(agent.id, !agent.disabled)
    })
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteAgent(agent.id)
      setShowDelete(false)
    })
  }

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {pending && <Spinner className="size-3.5 text-muted-foreground" />}
              <span className="truncate text-sm font-semibold">{agent.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AgentStatusBadge status={agent.status} />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon-sm" aria-label="Действия" />}
                >
                  <MoreVerticalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleRotate}>
                    <RefreshCwIcon />
                    Перевыпустить ключ
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleToggleDisabled}>
                    {agent.disabled ? <PlayIcon /> : <PowerIcon />}
                    {agent.disabled ? 'Включить' : 'Отключить'}
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setShowDelete(true)}>
                    <Trash2Icon />
                    Удалить агента
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <MonitorIcon className="size-3" />
            <span className="truncate">{agent.os || 'ОС не указана'}</span>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 rounded-md border p-2.5">
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-mono text-sm font-semibold">{agent.activeRuns}</span>
              <span className="text-[10px] text-muted-foreground">активных прогонов</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 border-l">
              <span className="font-mono text-sm font-semibold">
                {formatRelativeTime(agent.lastSeenAt)}
              </span>
              <span className="text-[10px] text-muted-foreground">heartbeat</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 rounded-md border bg-muted/40 p-2">
            <code className="truncate font-mono text-[11px]">{agent.keyPrefix}</code>
            <span className="text-[10px] text-muted-foreground">
              Полный ключ показывается только один раз при создании или перевыпуске.
            </span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить агента?</DialogTitle>
            <DialogDescription>
              Агент «{agent.name}» будет удалён, а его API-ключ перестанет работать. Действие
              необратимо.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApiKeyDialog
        open={keyDialogOpen}
        onOpenChange={setKeyDialogOpen}
        agentName={agent.name}
        apiKey={rotatedKey}
        title="Ключ перевыпущен"
        description="Старый ключ больше не действует. Обновите конфиг агента новым ключом."
      />
    </>
  )
}
