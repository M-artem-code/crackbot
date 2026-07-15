import 'server-only'

import { and, asc, desc, eq, gte, ilike, lte, type SQL } from 'drizzle-orm'

import { db } from '@/lib/db'
import { agents, bots, logSteps, runArtifacts, runAttempts, runs } from '@/lib/db/schema'
import { requireWorkspace } from '@/lib/workspace'

export interface RunFilters { status?: string; source?: string; failureKind?: string; botId?: string; query?: string; from?: string; to?: string; page?: number }

export async function getRunsPage(filters: RunFilters) {
  const { workspace } = await requireWorkspace()
  const conditions: SQL[] = [eq(runs.workspaceId, workspace.id)]
  if (filters.status && filters.status !== 'all') conditions.push(eq(runs.status, filters.status))
  if (filters.source && filters.source !== 'all') conditions.push(eq(runs.source, filters.source))
  if (filters.failureKind && filters.failureKind !== 'all') conditions.push(eq(runs.failureKind, filters.failureKind))
  if (filters.botId && filters.botId !== 'all') conditions.push(eq(runs.botId, filters.botId))
  if (filters.query) conditions.push(ilike(runs.id, `%${filters.query.slice(0, 80)}%`))
  if (filters.from) conditions.push(gte(runs.createdAt, new Date(`${filters.from}T00:00:00Z`)))
  if (filters.to) conditions.push(lte(runs.createdAt, new Date(`${filters.to}T23:59:59Z`)))
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = 25
  const [items, botRows] = await Promise.all([
    db.select({ run: runs, botName: bots.name, agentName: agents.name }).from(runs).innerJoin(bots, and(eq(bots.id, runs.botId), eq(bots.workspaceId, workspace.id))).leftJoin(agents, and(eq(agents.id, runs.agentId), eq(agents.workspaceId, workspace.id))).where(and(...conditions)).orderBy(desc(runs.createdAt)).limit(pageSize + 1).offset((page - 1) * pageSize),
    db.select({ id: bots.id, name: bots.name }).from(bots).where(eq(bots.workspaceId, workspace.id)).orderBy(asc(bots.name)),
  ])
  return { items: items.slice(0, pageSize), bots: botRows, page, hasNext: items.length > pageSize }
}

export async function getRunObservability(runId: string) {
  const { workspace } = await requireWorkspace()
  const [summary] = await db.select({ run: runs, botName: bots.name, agentName: agents.name }).from(runs).innerJoin(bots, and(eq(bots.id, runs.botId), eq(bots.workspaceId, workspace.id))).leftJoin(agents, and(eq(agents.id, runs.agentId), eq(agents.workspaceId, workspace.id))).where(and(eq(runs.id, runId), eq(runs.workspaceId, workspace.id))).limit(1)
  if (!summary) return null
  const [attempts, logs, artifacts] = await Promise.all([
    db.select().from(runAttempts).where(and(eq(runAttempts.runId, runId), eq(runAttempts.workspaceId, workspace.id))).orderBy(asc(runAttempts.attempt)),
    db.select().from(logSteps).where(and(eq(logSteps.runId, runId), eq(logSteps.workspaceId, workspace.id))).orderBy(asc(logSteps.ts)).limit(1000),
    db.select().from(runArtifacts).where(and(eq(runArtifacts.runId, runId), eq(runArtifacts.workspaceId, workspace.id))).orderBy(asc(runArtifacts.createdAt)),
  ])
  return { ...summary, attempts, logs, artifacts }
}
