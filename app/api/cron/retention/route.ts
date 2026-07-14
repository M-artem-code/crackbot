import { del } from '@vercel/blob'
import { and, eq, isNull, lt } from 'drizzle-orm'

import { db } from '@/lib/db'
import { logSteps, runArtifacts, runs } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const now = new Date()
  const expired = await db.select().from(runArtifacts).where(and(lt(runArtifacts.expiresAt, now), eq(runArtifacts.retentionHold, false), isNull(runArtifacts.deletedAt))).limit(100)

  let artifactsDeleted = 0
  for (const artifact of expired) {
    try {
      await del(artifact.pathname)
      await db.update(runArtifacts).set({ deletedAt: now, pathname: `expired/${artifact.id}` }).where(and(eq(runArtifacts.id, artifact.id), eq(runArtifacts.workspaceId, artifact.workspaceId!)))
      artifactsDeleted += 1
    } catch {
      // Идемпотентный следующий cron повторит частично завершённую очистку.
    }
  }

  const deletedLogs = await db.delete(logSteps).where(lt(logSteps.expiresAt, now)).returning({ id: logSteps.id })
  await db.update(runs).set({ scenarioSnapshot: { version: 1, name: 'Expired run', steps: [] } }).where(and(lt(runs.expiresAt, now), eq(runs.retentionHold, false)))

  return Response.json({ ok: true, artifactsDeleted, logsDeleted: deletedLogs.length })
}
