'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  DatabaseIcon,
  PauseIcon,
  PlayIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

import { deleteBot, updateBotStatus } from '@/app/actions/bots'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { BotStatusBadge } from '@/components/status-badge'
import { formatDateTime, type Bot, type BotStatus } from '@/lib/mock-data'

type Filter = 'all' | BotStatus

export function BotsGrid({ bots }: { bots: Bot[] }) {
  const router = useRouter()
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState<Filter>('all')
  const [localBots, setLocalBots] = React.useState(bots)
  const [pendingBotId, setPendingBotId] = React.useState<string | null>(null)
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null)

  React.useEffect(() => setLocalBots(bots), [bots])

  async function togglePause(bot: Bot) {
    const nextStatus = bot.status === 'paused' ? 'idle' : 'paused'
    setPendingBotId(bot.id)
    setFeedback(null)
    setLocalBots((current) => current.map((item) => item.id === bot.id ? { ...item, status: nextStatus } : item))
    try {
      await updateBotStatus(bot.id, nextStatus)
      setFeedback({ type: 'success', text: nextStatus === 'paused' ? 'Бот поставлен на паузу' : 'Бот готов к запуску' })
      router.refresh()
    } catch (error) {
      setLocalBots((current) => current.map((item) => item.id === bot.id ? { ...item, status: bot.status } : item))
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось изменить статус' })
    } finally {
      setPendingBotId(null)
    }
  }

  async function removeBot(bot: Bot) {
    if (!window.confirm(`Удалить бота «${bot.name}» и все его прогоны? Это действие нельзя отменить.`)) return
    setPendingBotId(bot.id)
    setFeedback(null)
    try {
      await deleteBot(bot.id)
      setLocalBots((current) => current.filter((item) => item.id !== bot.id))
      setFeedback({ type: 'success', text: 'Бот удалён' })
      router.refresh()
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось удалить бота' })
      setPendingBotId(null)
    }
  }

  const filtered = localBots.filter((bot) => {
    const matchesFilter = filter === 'all' || bot.status === filter
    const q = query.trim().toLowerCase()
    const matchesQuery =
      q.length === 0 ||
      bot.name.toLowerCase().includes(q) ||
      bot.targetUrl.toLowerCase().includes(q)
    return matchesFilter && matchesQuery
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="sm:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Поиск по имени или URL..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </InputGroup>
        <ToggleGroup
          value={[filter]}
          onValueChange={(groupValue) => {
            const next = (groupValue[0] as Filter | undefined) ?? 'all'
            setFilter(next)
          }}
        >
          <ToggleGroupItem value="all">Все</ToggleGroupItem>
          <ToggleGroupItem value="idle">Готовы</ToggleGroupItem>
          <ToggleGroupItem value="active">Активные</ToggleGroupItem>
          <ToggleGroupItem value="paused">Пауза</ToggleGroupItem>
          <ToggleGroupItem value="error">Ошибки</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {feedback ? <p role="status" className={feedback.type === 'error' ? 'text-sm text-destructive' : 'text-sm text-primary'}>{feedback.text}</p> : null}

      {/* Grid */}
      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Ничего не найдено</EmptyTitle>
            <EmptyDescription>
              Попробуйте изменить фильтр или поисковый запрос
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((bot) => (
            <Card key={bot.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/bots/${bot.id}`}
                    className="min-w-0 hover:underline"
                  >
                    <span className="block truncate text-sm font-semibold">
                      {bot.name}
                    </span>
                  </Link>
                  <BotStatusBadge status={bot.status} />
                </div>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">
                  {bot.targetUrl.replace('https://', '')}
                </span>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {bot.description}
                </p>
                <div className="grid grid-cols-3 gap-2 rounded-md border p-2.5">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-mono text-sm font-semibold">
                      {bot.totalRuns}
                    </span>
                    <span className="text-[10px] text-muted-foreground">прогонов</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 border-x">
                    <span
                      className={`font-mono text-sm font-semibold ${
                        bot.successRate >= 90 ? 'text-primary' : 'text-warning'
                      }`}
                    >
                      {bot.successRate}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">успех</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-mono text-sm font-semibold">
                      {bot.refs.length}
                    </span>
                    <span className="text-[10px] text-muted-foreground">реф-ссылок</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                  <DatabaseIcon className="size-3" />
                  <span className="truncate">{bot.template}</span>
                  <span className="ml-auto shrink-0 text-primary">
                    {bot.refs.filter((r) => r.status === 'active').length} активных
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">
                  Запуск: {formatDateTime(bot.lastRunAt)}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pendingBotId === bot.id}
                    onClick={() => removeBot(bot)}
                    aria-label={`Удалить бота ${bot.name}`}
                  >
                    <Trash2Icon />
                  </Button>
                  {bot.status === 'paused' ? (
                    <Button variant="outline" size="sm" disabled={pendingBotId === bot.id} onClick={() => togglePause(bot)}>
                      <PlayIcon data-icon="inline-start" />
                      Продолжить
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled={pendingBotId === bot.id} onClick={() => togglePause(bot)}>
                      <PauseIcon data-icon="inline-start" />
                      Пауза
                    </Button>
                  )}
                  <Button size="sm" nativeButton={false} render={<Link href={`/bots/${bot.id}`} />}>
                    Открыть
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
