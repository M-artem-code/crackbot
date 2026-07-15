'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq, inArray, and } from 'drizzle-orm'

import { db } from '@/lib/db'
import { bots, runs } from '@/lib/db/schema'
import { startLocalRun } from '@/lib/local-runner'

export async function retryRun(runId: string) {
  const [source] = await db.select().from(runs).where(and(eq(runs.id, runId), inArray(runs.status, ['failed', 'cancelled']))).limit(1)
  if (!source) throw new Error('Этот прогон нельзя повторить')

  const id = `run_${randomUUID().replaceAll('-', '')}`
  await db.insert(runs).values({
    id,
    botId: source.botId,
    status: 'queued',
    source: 'retry',
    retryOfRunId: source.id,
    totalWorkers: source.totalWorkers,
    scenarioVersionId: source.scenarioVersionId,
    scenarioSnapshot: source.scenarioSnapshot,
  })
  await db.update(bots).set({ status: 'active', updatedAt: new Date() }).where(eq(bots.id, source.botId))
  startLocalRun(id)
  revalidatePath('/runs')
  redirect(`/runs/${id}`)
}
