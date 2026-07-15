import 'server-only'

import { and, asc, desc, eq, gte, ilike, lte, type SQL } from 'drizzle-orm'

import { db } from '@/lib/db'
import { bots, logSteps, runs } from '@/lib/db/schema'

export interface RunFilters { status?: string; source?: string; botId?: string; query?: string; from?: string; to?: string; page?: number }

export async function getRunsPage(filters: RunFilters) {
  const conditions: SQL[] = []
  if (filters.status && filters.status !== 'all') conditions.push(eq(runs.status, filters.status))
  if (filters.source && filters.source !== 'all') conditions.push(eq(runs.source, filters.source))
  if (filters.botId && filters.botId !== 'all') conditions.push(eq(runs.botId, filters.botId))
  if (filters.query) conditions.push(ilike(runs.id, `%${filters.query.slice(0, 80)}%`))
  if (filters.from) conditions.push(gte(runs.createdAt, new Date(`${filters.from}T00:00:00Z`)))
  if (filters.to) conditions.push(lte(runs.createdAt, new Date(`${filters.to}T23:59:59Z`)))
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = 25
  const [items, botRows] = await Promise.all([
    db.select({ run: runs, botName: bots.name }).from(runs).innerJoin(bots, eq(bots.id, runs.botId)).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(runs.createdAt)).limit(pageSize + 1).offset((page - 1) * pageSize),
    db.select({ id: bots.id, name: bots.name }).from(bots).orderBy(asc(bots.name)),
  ])
  return { items: items.slice(0, pageSize), bots: botRows, page, hasNext: items.length > pageSize }
}

export async function getRunObservability(runId: string) {
  const [summary] = await db.select({ run: runs, botName: bots.name }).from(runs).innerJoin(bots, eq(bots.id, runs.botId)).where(eq(runs.id, runId)).limit(1)
  if (!summary) return null
  const logs = await db.select().from(logSteps).where(eq(logSteps.runId, runId)).orderBy(asc(logSteps.ts)).limit(1000)
  return { ...summary, logs }
}
