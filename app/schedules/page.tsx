import { Clock3Icon, PauseCircleIcon, PlayCircleIcon } from 'lucide-react'

import { createSchedule, getSchedules, toggleSchedule } from '@/app/actions/schedules'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getBots } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function SchedulesPage() {
  const [items, bots] = await Promise.all([getSchedules(), getBots()])
  return <AppShell><main className="flex flex-col gap-8 p-6 lg:p-8">
    <header className="flex flex-col gap-2"><p className="font-mono text-xs uppercase tracking-widest text-primary">Automation</p><h1 className="text-balance text-3xl font-semibold tracking-tight">Расписания</h1><p className="text-sm text-muted-foreground">Запускайте опубликованные сценарии автоматически в нужном часовом поясе.</p></header>
    <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/5"><form action={createSchedule} className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <div className="flex flex-col gap-2"><Label htmlFor="botId">Бот</Label><select id="botId" name="botId" required className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="">Выберите бота</option>{bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name}</option>)}</select></div>
      <div className="flex flex-col gap-2"><Label htmlFor="kind">Режим</Label><select id="kind" name="kind" className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="interval">Интервал</option><option value="daily">Ежедневно</option><option value="weekly">По дням недели</option></select></div>
      <div className="flex flex-col gap-2"><Label htmlFor="intervalMinutes">Интервал, минут</Label><Input id="intervalMinutes" name="intervalMinutes" type="number" min="5" max="10080" defaultValue="60" /></div>
      <div className="flex flex-col gap-2"><Label htmlFor="timeOfDay">Время</Label><Input id="timeOfDay" name="timeOfDay" type="time" defaultValue="09:00" /></div>
      <div className="flex flex-col gap-2"><Label htmlFor="timezone">Timezone</Label><Input id="timezone" name="timezone" defaultValue="Europe/Moscow" /></div>
      <fieldset className="flex flex-wrap gap-3 md:col-span-2 lg:col-span-4"><legend className="mb-2 text-sm font-medium">Дни для недельного режима</legend>{[['1','Пн'],['2','Вт'],['3','Ср'],['4','Чт'],['5','Пт'],['6','Сб'],['0','Вс']].map(([value,label]) => <label key={value} className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" name="weekdays" value={value} />{label}</label>)}</fieldset>
      <Button type="submit" className="self-end">Добавить расписание</Button>
    </form></section>
    <section className="flex flex-col gap-3">{items.length ? items.map((item) => { const bot = bots.find((value) => value.id === item.botId); return <article key={item.id} className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><Clock3Icon className="mt-0.5 size-5 text-primary" /><div><h2 className="font-medium">{bot?.name ?? 'Бот'}</h2><p className="text-sm text-muted-foreground">{item.kind === 'interval' ? `Каждые ${item.intervalMinutes} мин.` : `${item.kind === 'daily' ? 'Ежедневно' : 'По выбранным дням'} в ${item.timeOfDay}`} · {item.timezone}</p><p className="mt-1 font-mono text-xs text-muted-foreground">Следующий запуск: {item.nextRunAt.toLocaleString('ru-RU', { timeZone: item.timezone })}</p></div></div><form action={toggleSchedule.bind(null, item.id, !item.enabled)}><Button type="submit" variant="outline">{item.enabled ? <PauseCircleIcon data-icon="inline-start" /> : <PlayCircleIcon data-icon="inline-start" />}{item.enabled ? 'Пауза' : 'Включить'}</Button></form></article> }) : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Расписаний пока нет.</p>}</section>
  </main></AppShell>
}
