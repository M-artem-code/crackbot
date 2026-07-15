import { randomUUID } from 'node:crypto'
import { and, eq, lte, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { bots, runs, scheduleFirings, schedules, templates } from '@/lib/db/schema'
import { getNextRunAt, type ScheduleKind } from '@/lib/scheduling'

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const created = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(71824006)`)
    const due = await tx.select().from(schedules).where(and(eq(schedules.enabled, true), lte(schedules.nextRunAt, new Date()))).limit(100)
    const runIds: string[] = []
    for (const schedule of due) {
      const [bot] = await tx.select().from(bots).where(and(eq(bots.id, schedule.botId), eq(bots.workspaceId, schedule.workspaceId))).limit(1)
      if (!bot) { await tx.update(schedules).set({ enabled: false, updatedAt: new Date() }).where(eq(schedules.id, schedule.id)); continue }
      const [template] = await tx.select().from(templates).where(eq(templates.id, bot.templateId)).limit(1)
      if (!template) continue
      const plannedAt = schedule.nextRunAt
      const firingId = `fir_${randomUUID().replaceAll('-', '')}`
      const runId = `run_${randomUUID().replaceAll('-', '')}`
      await tx.insert(scheduleFirings).values({ id: firingId, scheduleId: schedule.id, workspaceId: schedule.workspaceId, plannedAt, runId, status: 'dispatched' }).onConflictDoNothing()
      const [firing] = await tx.select({ runId: scheduleFirings.runId }).from(scheduleFirings).where(and(eq(scheduleFirings.scheduleId, schedule.id), eq(scheduleFirings.plannedAt, plannedAt))).limit(1)
      if (firing?.runId !== runId) continue
      await tx.insert(runs).values({ id: runId, workspaceId: schedule.workspaceId, botId: bot.id, scheduleId: schedule.id, scheduleFiringId: firingId, source: 'scheduled', scheduledFor: plannedAt, status: 'queued', totalWorkers: bot.workers, scenarioVersionId: bot.publishedScenarioVersionId, scenarioSnapshot: bot.scenarioPublished ?? template.scenarioDefinition })
      await tx.update(bots).set({ status: 'active', updatedAt: new Date() }).where(and(eq(bots.id, bot.id), eq(bots.workspaceId, schedule.workspaceId)))
      const nextRunAt = getNextRunAt({ kind: schedule.kind as ScheduleKind, intervalMinutes: schedule.intervalMinutes, timeOfDay: schedule.timeOfDay, weekdays: schedule.weekdays as number[], timezone: schedule.timezone, from: plannedAt })
      await tx.update(schedules).set({ lastRunAt: new Date(), nextRunAt, updatedAt: new Date() }).where(eq(schedules.id, schedule.id))
      runIds.push(runId)
    }
    return runIds
  })
  return Response.json({ created: created.length, runIds: created })
}
