import { and, eq } from 'drizzle-orm'

import { authenticateAgent, unauthorized } from '@/lib/agent-auth'
import { db } from '@/lib/db'
import { runAttempts, runs } from '@/lib/db/schema'
import { isLeaseError, LEASE_TTL_SECONDS, requireActiveLease } from '@/lib/run-leases'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const agent = await authenticateAgent(req)
  if (!agent) return unauthorized()
  const { id } = await params
  const run = await requireActiveLease(req, id, agent)
  if (isLeaseError(run)) return run
  if (run.status !== 'running') return Response.json({ error: 'Прогон уже завершён', code: 'RUN_TERMINAL' }, { status: 409 })

  const now = new Date()
  const leaseExpiresAt = new Date(now.getTime() + LEASE_TTL_SECONDS * 1000)
  await db.transaction(async (tx) => {
    await tx.update(runs).set({ lastHeartbeatAt: now, leaseExpiresAt }).where(and(eq(runs.id, id), eq(runs.workspaceId, agent.workspaceId), eq(runs.leaseTokenHash, run.leaseTokenHash!)))
    await tx.update(runAttempts).set({ lastHeartbeatAt: now }).where(and(eq(runAttempts.runId, id), eq(runAttempts.attempt, run.attempt), eq(runAttempts.workspaceId, agent.workspaceId)))
  })

  return Response.json({ ok: true, cancelRequested: Boolean(run.cancelRequestedAt), leaseExpiresAt })
}
