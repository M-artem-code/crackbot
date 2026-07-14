import { BellIcon, CheckIcon, CircleAlertIcon } from 'lucide-react'

import { getNotifications, markNotificationRead } from '@/app/actions/notifications'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const items = await getNotifications()
  return <AppShell><main className="flex flex-col gap-8 p-6 lg:p-8"><header className="flex flex-col gap-2"><p className="font-mono text-xs uppercase tracking-widest text-primary">Inbox</p><h1 className="text-balance text-3xl font-semibold tracking-tight">Уведомления</h1><p className="text-sm text-muted-foreground">Ошибки автоматических прогонов и статус email-доставки.</p></header><section className="flex flex-col gap-3">{items.length ? items.map((item) => <article key={item.id} className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/5 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3">{item.readAt ? <BellIcon className="mt-0.5 size-5 text-muted-foreground" /> : <CircleAlertIcon className="mt-0.5 size-5 text-destructive" />}<div className="flex flex-col gap-1"><h2 className="font-medium">{item.title}</h2><p className="text-sm leading-relaxed text-muted-foreground">{item.message}</p><p className="font-mono text-xs text-muted-foreground">{item.createdAt.toLocaleString('ru-RU')}</p></div></div>{!item.readAt && <form action={markNotificationRead.bind(null, item.id)}><Button type="submit" variant="outline"><CheckIcon data-icon="inline-start" />Прочитано</Button></form>}</article>) : <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center"><BellIcon className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">Новых уведомлений нет.</p></div>}</section></main></AppShell>
}
