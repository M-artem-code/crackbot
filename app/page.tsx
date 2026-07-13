import Link from 'next/link'
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ClockIcon,
} from 'lucide-react'

import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { RunsChart } from '@/components/dashboard/runs-chart'
import { BotStatusBadge, RunStatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  bots,
  formatDateTime,
  formatDuration,
  getBot,
  runs,
  totalStats,
} from '@/lib/mock-data'

const statCards = [
  {
    label: 'Всего прогонов',
    value: String(totalStats.totalRuns),
    sub: 'за 14 дней',
    icon: ActivityIcon,
    accent: 'text-foreground',
  },
  {
    label: 'Успешных',
    value: `${totalStats.successRate}%`,
    sub: 'средний success rate',
    icon: CheckCircle2Icon,
    accent: 'text-primary',
  },
  {
    label: 'Ошибок',
    value: String(totalStats.totalErrors),
    sub: 'требуют внимания',
    icon: AlertTriangleIcon,
    accent: 'text-destructive',
  },
  {
    label: 'Сэкономлено',
    value: `${totalStats.hoursSaved} ч`,
    sub: 'ручного тестирования',
    icon: ClockIcon,
    accent: 'text-warning',
  },
]

export default function DashboardPage() {
  const recentRuns = runs.slice(0, 6)
  const activeBots = bots.filter((b) => b.status === 'active')

  return (
    <AppShell>
      <PageHeader
        title="Дашборд"
        description="общая статистика по всем ботам"
        actions={
          <Button size="sm" render={<Link href="/create" />}>
            Создать бота
          </Button>
        }
      />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                  <span className={`font-mono text-2xl font-semibold ${stat.accent}`}>
                    {stat.value}
                  </span>
                  <span className="text-xs text-muted-foreground">{stat.sub}</span>
                </div>
                <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                  <stat.icon className={`size-4 ${stat.accent}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart + active bots */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          <div className="lg:col-span-2">
            <RunsChart />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Активные боты</CardTitle>
              <CardDescription>
                {activeBots.length} из {bots.length} работают
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {activeBots.map((bot) => (
                <Link
                  key={bot.id}
                  href={`/bots/${bot.id}`}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2.5 transition-colors hover:bg-accent"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{bot.name}</span>
                    <span className="truncate font-mono text-[11px] text-muted-foreground">
                      {bot.targetUrl.replace('https://', '')}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-primary">
                    {bot.successRate}%
                  </span>
                </Link>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                render={<Link href="/bots" />}
              >
                Все боты
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent runs */}
        <Card>
          <CardHeader>
            <CardTitle>Последние прогоны</CardTitle>
            <CardDescription>Свежие проверки по всем ботам</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Бот</TableHead>
                  <TableHead className="hidden md:table-cell">Целевой URL</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="hidden sm:table-cell">Шаги</TableHead>
                  <TableHead className="hidden sm:table-cell">Время</TableHead>
                  <TableHead className="text-right">Запущен</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRuns.map((run) => {
                  const bot = getBot(run.botId)
                  return (
                    <TableRow key={run.id}>
                      <TableCell>
                        <Link
                          href={`/bots/${run.botId}`}
                          className="font-medium hover:underline"
                        >
                          {bot?.name}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden max-w-[260px] md:table-cell">
                        <span className="block truncate font-mono text-xs text-muted-foreground">
                          {run.targetUrl.replace('https://', '')}
                        </span>
                      </TableCell>
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
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Bot status strip */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {bots.slice(0, 3).map((bot) => (
            <Card key={bot.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{bot.name}</span>
                  <BotStatusBadge status={bot.status} />
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {bot.description}
                </p>
                <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
                  <span>{bot.totalRuns} прогонов</span>
                  <span
                    className={bot.successRate >= 90 ? 'text-primary' : 'text-warning'}
                  >
                    {bot.successRate}% успех
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </AppShell>
  )
}
