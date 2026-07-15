'use client'

import { ServerIcon } from 'lucide-react'


import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { AgentCard } from '@/components/agents/agent-card'
import { NewAgentDialog } from '@/components/agents/new-agent-dialog'
import type { AgentInfo } from '@/lib/mock-data'

function ConnectionGuide() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ServerIcon className="size-4" />
          </div>
          <span className="text-sm font-semibold">Как подключить Windows-компьютер</span>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
          <li><span className="font-medium text-foreground">1.</span> Установите и запустите Docker Desktop.</li>
          <li><span className="font-medium text-foreground">2.</span> Создайте агента и скачайте его персональный setup в течение 10 минут.</li>
          <li><span className="font-medium text-foreground">3.</span> Запустите setup: раннер привяжется один раз, появится рядом с часами и станет «Онлайн».</li>
          <li><span className="font-medium text-foreground">4.</span> Опубликуйте bot.py и запустите бота из BotForge. Браузер после этого можно закрыть.</li>
        </ol>
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
