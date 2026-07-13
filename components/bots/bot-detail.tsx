'use client'

import * as React from 'react'
import { DatabaseIcon, ExternalLinkIcon, PlayIcon, SquareIcon } from 'lucide-react'
import useSWR from 'swr'

import { useRouter } from 'next/navigation'

import { cancelRun, enqueueRun } from '@/app/actions/bots'
import { PageHeader } from '@/components/page-header'
import { RunLog } from '@/components/bots/run-log'
import { RunReport } from '@/components/bots/run-report'
import { BotStatusBadge, RunStatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BotSettingsForm } from '@/components/bots/bot-settings-form'
import { RefPoolManager } from '@/components/bots/ref-pool-manager'
import {
  formatDateTime,
  formatDuration,
  type Bot,
  type LogStep,
  type Run,
} from '@/lib/mock-data'

const fetcher = async (url: string): Promise<Run> => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Не удалось обновить прогон')
  return response.json() as Promise<Run>
}

export function BotDetail({ bot, runs: botRuns }: { bot: Bot; runs: Run[] }) {
  const scenario = bot.scenarioSteps
  const [activeRunId, setActiveRunId] = React.useState<string | null>(
    botRuns.find((run) => run.status === 'running' || run.status === 'queued')?.id ?? null,
  )
  const [isStarting, setIsStarting] = React.useState(false)
  const [isCancelling, setIsCancelling] = React.useState(false)
  const [selectedRun, setSelectedRun] = React.useState<Run | null>(
    botRuns[0] ?? null,
  )
  const [activeTab, setActiveTab] = React.useState('overview')
  const router = useRouter()
  const { data: liveRun } = useSWR(
    activeRunId ? `/api/runs/${activeRunId}` : null,
    fetcher,
    {
      refreshInterval: (data) =>
        data && ['success', 'failed', 'cancelled'].includes(data.status) ? 0 : 1000,
      revalidateOnFocus: true,
    },
  )
  const isRunning = Boolean(
    activeRunId && (!liveRun || liveRun.status === 'queued' || liveRun.status === 'running'),
  )

  React.useEffect(() => {
    if (liveRun && ['success', 'failed', 'cancelled'].includes(liveRun.status)) {
      setSelectedRun(liveRun)
      router.refresh()
    }
  }, [liveRun, router])

  async function startLiveRun() {
    if (isRunning || isStarting) return
    setIsStarting(true)
    setActiveTab('logs')
    try {
      const { runId } = await enqueueRun(bot.id)
      setActiveRunId(runId)
      setSelectedRun(null)
    } finally {
      setIsStarting(false)
    }
  }

  async function stopLiveRun() {
    if (!activeRunId || isCancelling) return
    setIsCancelling(true)
    try {
      await cancelRun(activeRunId)
      router.refresh()
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <>
      <PageHeader
        title={bot.name}
        description={bot.targetUrl.replace('https://', '')}
        actions={
          <>
            <BotStatusBadge status={bot.status} />
            {isRunning ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={stopLiveRun}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SquareIcon data-icon="inline-start" />
                )}
                {isCancelling ? 'Останавливаем...' : 'Остановить'}
              </Button>
            ) : (
              <Button size="sm" onClick={startLiveRun} disabled={isStarting}>
                {isStarting ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <PlayIcon data-icon="inline-start" />
                )}
                {isStarting ? 'Ставим в очередь...' : 'Запустить проверку'}
              </Button>
            )}
          </>
        }
      />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as string)}>
          <TabsList>
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="runs">Прогоны</TabsTrigger>
            <TabsTrigger value="logs">Логи</TabsTrigger>
            <TabsTrigger value="database">Реф-пул</TabsTrigger>
            <TabsTrigger value="settings">Настройки</TabsTrigger>
          </TabsList>

          {/* ------------------------------ Обзор ------------------------------ */}
          <TabsContent value="overview" className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardContent className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Всего прогонов</span>
                  <span className="font-mono text-2xl font-semibold">
                    {bot.totalRuns}
                  </span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Success rate</span>
                  <span
                    className={`font-mono text-2xl font-semibold ${
                      bot.successRate >= 90 ? 'text-primary' : 'text-warning'
                    }`}
                  >
                    {bot.successRate}%
                  </span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Средняя длительность</span>
                  <span className="font-mono text-2xl font-semibold">
                    {formatDuration(bot.avgDurationMs)}
                  </span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Воркеры</span>
                  <span className="font-mono text-2xl font-semibold">
                    {bot.workers}
                  </span>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>О боте</CardTitle>
                  <CardDescription>{bot.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2.5">
                    <span className="text-xs text-muted-foreground">Шаблон</span>
                    <Badge variant="secondary">{bot.template}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2.5">
                    <span className="text-xs text-muted-foreground">Целевой URL</span>
                    <a
                      href={bot.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-mono text-xs hover:underline"
                    >
                      {bot.targetUrl.replace('https://', '')}
                      <ExternalLinkIcon className="size-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2.5">
                    <span className="text-xs text-muted-foreground">Реф-пул</span>
                    <span className="flex items-center gap-1.5 font-mono text-xs">
                      <DatabaseIcon className="size-3" />
                      {bot.refs.length} ссылок
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Сценарий шаблона</CardTitle>
                  <CardDescription>
                    {scenario.length} шагов проверки регистрации
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ol className="flex flex-col gap-1.5 font-mono text-xs">
                    {scenario.map((step, i) => (
                      <li key={step.step} className="flex items-center gap-2.5">
                        <span className="text-muted-foreground/60">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span>{step.label}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ----------------------------- Прогоны ----------------------------- */}
          <TabsContent value="runs">
            <Card>
              <CardHeader>
                <CardTitle>История прогонов</CardTitle>
                <CardDescription>
                  Нажмите на прогон, чтобы посмотреть его лог
                </CardDescription>
              </CardHeader>
              <CardContent>
                {botRuns.length === 0 ? (
                  <div className="flex flex-col items-center gap-1 rounded-md border border-dashed py-10 text-center">
                    <span className="text-sm font-medium">Прогонов ещё не было</span>
                    <span className="text-xs text-muted-foreground">
                      Нажмите «Запустить проверку», чтобы создать первый прогон
                    </span>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead className="hidden sm:table-cell">Шаги</TableHead>
                        <TableHead className="hidden sm:table-cell">Время</TableHead>
                        <TableHead className="text-right">Запущен</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {botRuns.map((run) => (
                        <TableRow
                          key={run.id}
                          className="cursor-pointer"
                          onClick={() => {
                  setSelectedRun(run)
                  setActiveRunId(
                    run.status === 'running' || run.status === 'queued' ? run.id : null,
                  )
                  setActiveTab('logs')
                          }}
                        >
                          <TableCell className="font-mono text-xs">{run.id}</TableCell>
                          <TableCell>
                            <RunStatusBadge status={run.status} />
                          </TableCell>
                          <TableCell className="hidden font-mono text-xs sm:table-cell">
                            {run.stepsPassed}/{run.stepsTotal}
                          </TableCell>
                          <TableCell className="hidden font-mono text-xs sm:table-cell">
                            {formatDuration(run.durationMs)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {formatDateTime(run.startedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ------------------------------ Логи ------------------------------ */}
          <TabsContent value="logs" className="flex flex-col gap-4">
            {liveRun ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {isRunning ? <Spinner className="size-4 text-primary" /> : null}
                    {isRunning ? 'Живой прогон' : 'Прогон завершён'}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {bot.targetUrl.replace('https://', '')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isRunning ? <RunLog steps={liveRun.steps} /> : <RunReport run={liveRun} />}
                </CardContent>
              </Card>
            ) : selectedRun ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="font-mono">{selectedRun.id}</CardTitle>
                    <RunStatusBadge status={selectedRun.status} />
                  </div>
                  <CardDescription className="font-mono text-xs">
                    {bot.targetUrl.replace('https://', '')} ·{' '}
                    {formatDateTime(selectedRun.startedAt)} ·{' '}
                    {formatDuration(selectedRun.durationMs)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RunReport run={selectedRun} />
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col items-center gap-1 rounded-md border border-dashed py-10 text-center">
                <span className="text-sm font-medium">Логов пока нет</span>
                <span className="text-xs text-muted-foreground">
                  Запустите проверку или выберите прогон во вкладке «Прогоны»
                </span>
              </div>
            )}
          </TabsContent>

          {/* ----------------------------- Реф-пул ----------------------------- */}
          <TabsContent value="database">
            <RefPoolManager botId={bot.id} refs={bot.refs} />
          </TabsContent>

          {/* ---------------------------- Настройки ---------------------------- */}
          <TabsContent value="settings">
            <BotSettingsForm bot={bot} />
          </TabsContent>
        </Tabs>
      </main>
    </>
  )
}
