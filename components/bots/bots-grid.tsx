'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  DatabaseIcon,
  PauseIcon,
  PlayIcon,
  SearchIcon,
} from 'lucide-react'

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
import { bots, formatDateTime, type BotStatus } from '@/lib/mock-data'

type Filter = 'all' | BotStatus

export function BotsGrid() {
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState<Filter>('all')

  const filtered = bots.filter((bot) => {
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
          <ToggleGroupItem value="active">Активные</ToggleGroupItem>
          <ToggleGroupItem value="paused">Пауза</ToggleGroupItem>
          <ToggleGroupItem value="error">Ошибки</ToggleGroupItem>
        </ToggleGroup>
      </div>

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
                      {bot.database.records.length}
                    </span>
                    <span className="text-[10px] text-muted-foreground">записей БД</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                  <DatabaseIcon className="size-3" />
                  <span className="truncate">{bot.database.name}</span>
                  <span
                    className={`ml-auto shrink-0 ${
                      bot.database.connected ? 'text-primary' : 'text-destructive'
                    }`}
                  >
                    {bot.database.connected ? 'подключена' : 'нет связи'}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">
                  Запуск: {formatDateTime(bot.lastRunAt)}
                </span>
                <div className="flex items-center gap-1.5">
                  {bot.status === 'paused' ? (
                    <Button variant="outline" size="sm">
                      <PlayIcon data-icon="inline-start" />
                      Запустить
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm">
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
