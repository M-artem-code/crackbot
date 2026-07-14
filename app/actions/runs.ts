'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { runs } from '@/lib/db/schema'
import { requireWorkspace } from '@/lib/workspace'

export async function retryRun(runId: string) {
  const { workspace } = await requireWorkspace()
  const [source] = await db.select().from(runs).where(and(eq(runs.id, runId), eq(runs.workspaceId, workspace.id), inArray(runs.status, ['failed', 'cancelled']))).limit(1)
  if (!source) throw new Error('Этот прогон нельзя повторить')

  const id = `run_${randomUUID().replaceAll('-', '')}`
  await db.insert(runs).values({
    id,
    workspaceId: workspace.id,
    botId: source.botId,
    status: 'queued',
    source: 'retry',
    retryOfRunId: source.id,
    totalWorkers: source.totalWorkers,
    scenarioVersionId: source.scenarioVersionId,
    scenarioSnapshot: source.scenarioSnapshot,
    maxInfraAttempts: source.maxInfraAttempts,
    availableAt: new Date(),
  })
  revalidatePath('/runs')
  redirect(`/runs/${id}`)
}
