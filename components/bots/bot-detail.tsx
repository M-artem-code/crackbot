'use client'

import * as React from 'react'
import {
  DatabaseIcon,
  DownloadIcon,
  ExternalLinkIcon,
  PlayIcon,
  PlusIcon,
} from 'lucide-react'

import { PageHeader } from '@/components/page-header'
import { RunLog } from '@/components/bots/run-log'
import {
  BotStatusBadge,
  DbRecordStatusBadge,
  RunStatusBadge,
} from '@/components/status-badge'
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
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  formatDateTime,
  formatDuration,
  getBot,
  getRunsForBot,
  REGISTRATION_TEMPLATE_STEPS,
  type LogStep,
  type Run,
} from '@/lib/mock-data'

const LIVE_DURATIONS = [1240, 380, 210, 460, 180, 520, 640, 2600, 940, 720, 1100]

function makePendingSteps(): LogStep[] {
  return REGISTRATION_TEMPLATE_STEPS.map((label, i) => ({
    id: `live-${i}`,
    label,
    status: 'pending' as const,
    durationMs: 0,
  }))
}

export function BotDetail({ botId }: { botId: string }) {
  const bot = getBot(botId)!
  const botRuns = getRunsForBot(botId)

  const [liveSteps, setLiveSteps] = React.useState<LogStep[] | null>(null)
  const [isRunning, setIsRunning] = React.useState(false)
  const [selectedRun, setSelectedRun] = React.useState<Run | null>(
    botRuns[0] ?? null,
  )
  const [activeTab, setActiveTab] = React.useState('overview')
  const timeoutsRef = React.useRef<ReturnType<typeof setTimeout>[]>([])

  React.useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout)
    }
  }, [])

  function startLiveRun() {
    if (isRunning) return
    setIsRunning(true)
    setActiveTab('logs')
    const steps = makePendingSteps()
    setLiveSteps([...steps])

    let elapsed = 300
    steps.forEach((_, i) => {
      // Шаг переходит в running
      timeoutsRef.current.push(
        setTimeout(() => {
          setLiveSteps((prev) =>
            prev
              ? prev.map((s, j) => (j === i ? { ...s, status: 'running' } : s))
              : prev,
          )
        }, elapsed),
      )
      elapsed += LIVE_DURATIONS[i] ?? 500
      // Шаг завершается успехом
      timeoutsRef.current.push(
        setTimeout(() => {
          setLiveSteps((prev) =>
            prev
              ? prev.map((s, j) =>
                  j === i
                    ? {
                        ...s,
                        status: 'success',
                        durationMs: LIVE_DURATIONS[i] ?? 500,
                      }
                    : s,
                )
              : prev,
          )
          if (i === steps.length - 1) {
            setIsRunning(false)
          }
        }, elapsed),
      )
    })
  }

  return (
    <>
      <PageHeader
        title={bot.name}
        description={bot.targetUrl.replace('https://', '')}
        actions={
          <>
            <BotStatusBadge status={bot.status} />
            <Button size="sm" onClick={startLiveRun} disabled={isRunning}>
              {isRunning ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <PlayIcon data-icon="inline-start" />
              )}
              {isRunning ? 'Выполняется...' : 'Запустить проверку'}
            </Button>
          </>
        }
      />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as string)}>
          <TabsList>
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="runs">Прогоны</TabsTrigger>
            <TabsTrigger value="logs">Логи</TabsTrigger>
            <TabsTrigger value="database">База данных</TabsTrigger>
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
                  <span className="text-xs text-muted-foreground">Расписание</span>
                  <span className="text-sm font-medium leading-relaxed">
                    {bot.settings.schedule}
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
                    <span className="text-xs text-muted-foreground">База данных</span>
                    <span className="flex items-center gap-1.5 font-mono text-xs">
                      <DatabaseIcon className="size-3" />
                      {bot.database.name}
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Сценарий шаблона</CardTitle>
                  <CardDescription>
                    {REGISTRATION_TEMPLATE_STEPS.length} шагов проверки регистрации
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ol className="flex flex-col gap-1.5 font-mono text-xs">
                    {REGISTRATION_TEMPLATE_STEPS.map((step, i) => (
                      <li key={step} className="flex items-center gap-2.5">
                        <span className="text-muted-foreground/60">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span>{step}</span>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="hidden md:table-cell">URL</TableHead>
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
                          setLiveSteps(null)
                          setActiveTab('logs')
                        }}
                      >
                        <TableCell className="font-mono text-xs">{run.id}</TableCell>
                        <TableCell>
                          <RunStatusBadge status={run.status} />
                        </TableCell>
                        <TableCell className="hidden max-w-[240px] md:table-cell">
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            {run.targetUrl.replace('https://', '')}
                          </span>
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* ------------------------------ Логи ------------------------------ */}
          <TabsContent value="logs" className="flex flex-col gap-4">
            {liveSteps ? (
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
                  <RunLog steps={liveSteps} />
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
                    {selectedRun.targetUrl.replace('https://', '')} ·{' '}
                    {formatDateTime(selectedRun.startedAt)} ·{' '}
                    {formatDuration(selectedRun.durationMs)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RunLog steps={selectedRun.steps} />
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          {/* --------------------------- База данных --------------------------- */}
          <TabsContent value="database">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-1.5">
                    <CardTitle className="flex items-center gap-2">
                      <DatabaseIcon className="size-4" />
                      <span className="font-mono">{bot.database.name}</span>
                    </CardTitle>
                    <CardDescription>
                      Привязанная база данных бота: целевые URL и тестовые аккаунты
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        bot.database.connected
                          ? 'gap-1.5 border-primary/40 text-primary'
                          : 'gap-1.5 border-destructive/40 text-destructive'
                      }
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          bot.database.connected
                            ? 'bg-primary animate-status-pulse'
                            : 'bg-destructive'
                        }`}
                      />
                      {bot.database.connected ? 'Подключена' : 'Нет связи'}
                    </Badge>
                    <Badge variant="secondary" className="font-mono">
                      {bot.database.records.length} записей
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline">
                    <PlusIcon data-icon="inline-start" />
                    Добавить запись
                  </Button>
                  <Button size="sm" variant="outline">
                    <DownloadIcon data-icon="inline-start" />
                    Импорт CSV
                  </Button>
                </div>
                {bot.database.records.length === 0 ? (
                  <div className="flex flex-col items-center gap-1 rounded-md border border-dashed py-10 text-center">
                    <span className="text-sm font-medium">База пуста</span>
                    <span className="text-xs text-muted-foreground">
                      Добавьте первую запись с целевым URL для проверки
                    </span>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Целевой URL</TableHead>
                        <TableHead className="hidden md:table-cell">
                          Тестовый email
                        </TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead className="hidden sm:table-cell text-right">
                          Добавлена
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bot.database.records.map((rec) => (
                        <TableRow key={rec.id}>
                          <TableCell className="max-w-[280px]">
                            <span className="block truncate font-mono text-xs">
                              {rec.targetUrl.replace('https://', '')}
                            </span>
                          </TableCell>
                          <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                            {rec.testEmail}
                          </TableCell>
                          <TableCell>
                            <DbRecordStatusBadge status={rec.status} />
                          </TableCell>
                          <TableCell className="hidden text-right font-mono text-xs text-muted-foreground sm:table-cell">
                            {formatDateTime(rec.addedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------------------- Настройки ---------------------------- */}
          <TabsContent value="settings">
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle>Настройки бота</CardTitle>
                <CardDescription>
                  Параметры сценария и поведения при ошибках
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="bot-name">Имя бота</FieldLabel>
                    <Input id="bot-name" defaultValue={bot.name} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="bot-url">Целевой URL</FieldLabel>
                    <Input id="bot-url" defaultValue={bot.targetUrl} className="font-mono" />
                    <FieldDescription>
                      Базовый адрес деплоя, который проверяет бот
                    </FieldDescription>
                  </Field>
                  <Field orientation="horizontal">
                    <div className="flex flex-col gap-0.5">
                      <FieldLabel htmlFor="check-email">
                        Проверять email-код
                      </FieldLabel>
                      <FieldDescription>
                        Бот дождётся письма и введёт код подтверждения
                      </FieldDescription>
                    </div>
                    <Switch id="check-email" defaultChecked={bot.settings.checkEmailCode} />
                  </Field>
                  <Field orientation="horizontal">
                    <div className="flex flex-col gap-0.5">
                      <FieldLabel htmlFor="screenshots">
                        Скриншоты при ошибках
                      </FieldLabel>
                      <FieldDescription>
                        Сохранять снимок страницы в момент падения шага
                      </FieldDescription>
                    </div>
                    <Switch
                      id="screenshots"
                      defaultChecked={bot.settings.screenshotsOnError}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="parallel">Параллельные прогоны</FieldLabel>
                    <Input
                      id="parallel"
                      type="number"
                      min={1}
                      max={5}
                      defaultValue={bot.settings.parallelRuns}
                      className="max-w-24 font-mono"
                    />
                    <FieldDescription>
                      Количество одновременных браузеров на локальном раннере
                    </FieldDescription>
                  </Field>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline">Отмена</Button>
                    <Button>Сохранить</Button>
                  </div>
                </FieldGroup>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  )
}
