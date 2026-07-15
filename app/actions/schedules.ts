'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { bots, schedules } from '@/lib/db/schema'
import { assertTimeZone, getNextRunAt, type ScheduleKind } from '@/lib/scheduling'
import { requireWorkspace } from '@/lib/workspace'

export async function getSchedules() {
  const { workspace } = await requireWorkspace()
  return db.select().from(schedules).where(eq(schedules.workspaceId, workspace.id)).orderBy(desc(schedules.createdAt))
}

export async function createSchedule(formData: FormData) {
  const { workspace } = await requireWorkspace()
  const botId = String(formData.get('botId') ?? '')
  const kind = String(formData.get('kind') ?? 'interval') as ScheduleKind
  const timezone = assertTimeZone(String(formData.get('timezone') ?? 'UTC'))
  if (!['interval', 'daily', 'weekly'].includes(kind)) throw new Error('Некорректный тип расписания')
  const [bot] = await db.select({ id: bots.id }).from(bots).where(and(eq(bots.id, botId), eq(bots.workspaceId, workspace.id))).limit(1)
  if (!bot) throw new Error('Бот не найден')
  const intervalMinutes = kind === 'interval' ? Number(formData.get('intervalMinutes') ?? 60) : null
  const timeOfDay = kind === 'interval' ? null : String(formData.get('timeOfDay') ?? '09:00')
  const weekdays = kind === 'weekly' ? formData.getAll('weekdays').map(Number).filter((day) => day >= 0 && day <= 6) : []
  if (kind === 'weekly' && !weekdays.length) throw new Error('Выберите хотя бы один день')
  await db.insert(schedules).values({
    id: `sch_${randomUUID().replaceAll('-', '')}`, workspaceId: workspace.id, botId, kind,
    intervalMinutes, timeOfDay, weekdays, timezone,
    nextRunAt: getNextRunAt({ kind, intervalMinutes, timeOfDay, weekdays, timezone }),
  })
  revalidatePath('/schedules')
}

export async function toggleSchedule(id: string, enabled: boolean) {
  const { workspace } = await requireWorkspace()
  await db.update(schedules).set({ enabled, updatedAt: new Date() }).where(and(eq(schedules.id, id), eq(schedules.workspaceId, workspace.id)))
  revalidatePath('/schedules')
}
