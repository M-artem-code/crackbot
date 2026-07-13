'use client'

import * as React from 'react'
import { CheckIcon, CopyIcon, ServerIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { AgentCard } from '@/components/agents/agent-card'
import { NewAgentDialog } from '@/components/agents/new-agent-dialog'
import type { AgentInfo } from '@/lib/mock-data'

function ConnectionGuide() {
  const [origin, setOrigin] = React.useState('')
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  async function copy() {
    await navigator.clipboard.writeText(origin)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ServerIcon className="size-4" />
          </div>
          <span className="text-sm font-semibold">Как подключить агента</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ol className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <li>1. Создайте агента и скопируйте API-ключ (или скачайте конфиг).</li>
          <li>2. Установите раннер на машине и укажите адрес сервера и ключ.</li>
          <li>3. Агент начнёт присылать heartbeat и забирать задания из очереди.</li>
        </ol>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Адрес сервера</span>
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
            <code className="min-w-0 flex-1 truncate font-mono text-[11px]">
              {origin || '—'}
            </code>
            <Button variant="outline" size="icon-sm" onClick={copy} aria-label="Скопировать адрес">
              {copied ? <CheckIcon className="text-primary" /> : <CopyIcon />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function AgentsView({ agents }: { agents: AgentInfo[] }) {
  const online = agents.filter((a) => a.status === 'online').length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Всего агентов: <span className="font-mono text-foreground">{agents.length}</span> ·
          онлайн: <span className="font-mono text-primary">{online}</span>
        </p>
        <NewAgentDialog />
      </div>

      <ConnectionGuide />

      {agents.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ServerIcon />
            </EmptyMedia>
            <EmptyTitle>Пока нет агентов</EmptyTitle>
            <EmptyDescription>
              Создайте первого агента-раннера, чтобы запускать ботов на своих машинах.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  )
}
