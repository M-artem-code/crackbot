import { and, eq, lte, lt, sql } from 'drizzle-orm'
import { Resend } from 'resend'

import { db } from '@/lib/db'
import { notificationDeliveries, notifications } from '@/lib/db/schema'

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFICATION_FROM_EMAIL) return Response.json({ error: 'Email is not configured' }, { status: 503 })
  const resend = new Resend(process.env.RESEND_API_KEY)
  const pending = await db.select({ delivery: notificationDeliveries, notification: notifications }).from(notificationDeliveries).innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId)).where(and(eq(notificationDeliveries.status, 'pending'), lte(notificationDeliveries.nextAttemptAt, new Date()), lt(notificationDeliveries.attempts, 5))).limit(50)
  let sent = 0
  let failed = 0
  for (const item of pending) {
    const claimed = await db.update(notificationDeliveries).set({ status: 'sending', attempts: sql`${notificationDeliveries.attempts} + 1`, updatedAt: new Date() }).where(and(eq(notificationDeliveries.id, item.delivery.id), eq(notificationDeliveries.status, 'pending'))).returning({ id: notificationDeliveries.id })
    if (!claimed.length) continue
    const result = await resend.emails.send({ from: process.env.NOTIFICATION_FROM_EMAIL, to: item.delivery.recipient, subject: `[BotForge] ${item.notification.title}`, text: `${item.notification.message}\n\nОткройте BotForge, чтобы посмотреть детали прогона.` })
    if (result.error) {
      const attempts = item.delivery.attempts + 1
      await db.update(notificationDeliveries).set({ status: attempts >= 5 ? 'failed' : 'pending', nextAttemptAt: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000), lastError: result.error.message.slice(0, 500), updatedAt: new Date() }).where(eq(notificationDeliveries.id, item.delivery.id))
      failed += 1
    } else {
      await db.update(notificationDeliveries).set({ status: 'sent', providerMessageId: result.data?.id ?? null, lastError: null, updatedAt: new Date() }).where(eq(notificationDeliveries.id, item.delivery.id))
      sent += 1
    }
  }
  return Response.json({ processed: pending.length, sent, failed })
}
