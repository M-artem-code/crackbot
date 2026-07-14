import { randomUUID } from 'node:crypto'

import { and, asc, eq, sql } from 'drizzle-orm'

import { authenticateAgent, unauthorized } from '@/lib/agent-auth'
import { db } from '@/lib/db'
import { botRefs, bots, runs, templates } from '@/lib/db/schema'
import { AGENT_PROTOCOL_VERSION, isAgentCompatible, issueLeaseToken, LEASE_TTL_SECONDS } from '@/lib/run-leases'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const agent = await authenticateAgent(req)
  if (!agent) return unauthorized()
  if (!isAgentCompatible(agent)) {
    return Response.json({ error: 'Обновите агент для поддержки lease protocol', code: 'UPGRADE_REQUIRED', requiredProtocol: AGENT_PROTOCOL_VERSION }, { status: 426 })
  }

  const lease = issueLeaseToken()
  const attemptId = `att_${randomUUID().replaceAll('-', '')}`
  const claimed = await db.execute(sql`
    WITH candidate AS (
      SELECT id FROM runs
      WHERE status = 'queued'
        AND workspace_id = ${agent.workspaceId}
        AND available_at <= now()
      ORDER BY available_at ASC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    ), updated AS (
      UPDATE runs
      SET status = 'running', agent_id = ${agent.id}, lease_owner_agent_id = ${agent.id},
          lease_token_hash = ${lease.hash}, leased_at = now(), last_heartbeat_at = now(),
          lease_expires_at = now() + (${LEASE_TTL_SECONDS} * interval '1 second'),
          started_at = COALESCE(started_at, now()), attempt = attempt + 1
      WHERE id = (SELECT id FROM candidate)
      RETURNING id, bot_id, scenario_snapshot, attempt, workspace_id
    )
    INSERT INTO run_attempts (id, workspace_id, run_id, agent_id, attempt, lease_token_hash, claimed_at, started_at, last_heartbeat_at)
    SELECT ${attemptId}, workspace_id, id, ${agent.id}, attempt, ${lease.hash}, now(), now(), now() FROM updated
    RETURNING run_id, attempt
  `)

  const attemptRow = (claimed.rows?.[0] ?? null) as { run_id: string; attempt: number } | null
  if (!attemptRow) return Response.json({ job: null })

  const [run] = await db.select().from(runs).where(and(eq(runs.id, attemptRow.run_id), eq(runs.workspaceId, agent.workspaceId))).limit(1)
  if (!run) return Response.json({ job: null })
  const [botRow] = await db.select().from(bots).where(and(eq(bots.id, run.botId), eq(bots.workspaceId, agent.workspaceId))).limit(1)
  const [tplRow] = botRow ? await db.select().from(templates).where(eq(templates.id, botRow.templateId)).limit(1) : []
  const targetRows = await db.select().from(botRefs).where(and(eq(botRefs.botId, run.botId), eq(botRefs.workspaceId, agent.workspaceId), eq(botRefs.status, 'active'), sql`${botRefs.successCount} < ${botRefs.successLimit}`)).orderBy(asc(botRefs.id))

  return Response.json({
    job: {
      runId: run.id,
      attempt: attemptRow.attempt,
      leaseToken: lease.token,
      leaseExpiresInSeconds: LEASE_TTL_SECONDS,
      protocolVersion: AGENT_PROTOCOL_VERSION,
      scenario: run.scenarioSnapshot,
      bot: botRow ? { id: botRow.id, name: botRow.name, targetUrl: botRow.targetUrl, workers: botRow.workers, config: botRow.config } : null,
      template: tplRow ? { slug: tplRow.slug, engine: tplRow.engine, flowType: tplRow.flowType, fields: tplRow.fields, defaultConfig: tplRow.defaultConfig, scenarioSteps: tplRow.scenarioSteps } : null,
      targets: targetRows.map((target) => ({ id: target.id, url: target.url, successLimit: target.successLimit, successCount: target.successCount, remaining: Math.max(0, target.successLimit - target.successCount) })),
    },
  })
}
