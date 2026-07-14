import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const recovered = await db.execute(sql`
    WITH expired AS (
      SELECT id, workspace_id, attempt
      FROM runs
      WHERE status = 'running' AND lease_expires_at < now() AND cancel_requested_at IS NULL
      ORDER BY lease_expires_at ASC
      LIMIT 50
      FOR UPDATE SKIP LOCKED
    ), attempts AS (
      UPDATE run_attempts ra
      SET finished_at = now(), outcome = 'recovered', failure_kind = 'infrastructure',
          failure_code = 'LEASE_EXPIRED', recovery_reason = 'agent_heartbeat_timeout'
      FROM expired e
      WHERE ra.run_id = e.id AND ra.workspace_id = e.workspace_id AND ra.attempt = e.attempt AND ra.finished_at IS NULL
      RETURNING ra.run_id
    )
    UPDATE runs r
    SET status = CASE WHEN r.attempt < r.max_infra_attempts THEN 'queued' ELSE 'failed' END,
        available_at = CASE WHEN r.attempt < r.max_infra_attempts THEN now() + (LEAST(300, 15 * power(2, GREATEST(0, r.attempt - 1))) * interval '1 second') ELSE r.available_at END,
        recovered_count = r.recovered_count + 1,
        failure_kind = 'infrastructure', failure_code = 'LEASE_EXPIRED',
        error = CASE WHEN r.attempt < r.max_infra_attempts THEN NULL ELSE 'Агент потерял соединение, лимит восстановлений исчерпан' END,
        finished_at = CASE WHEN r.attempt < r.max_infra_attempts THEN NULL ELSE now() END,
        expires_at = CASE WHEN r.attempt < r.max_infra_attempts THEN r.expires_at ELSE now() + interval '30 days' END,
        agent_id = NULL, lease_owner_agent_id = NULL, lease_token_hash = NULL,
        leased_at = NULL, lease_expires_at = NULL, last_heartbeat_at = NULL
    FROM expired e
    WHERE r.id = e.id AND r.workspace_id = e.workspace_id
    RETURNING r.id, r.status, r.attempt
  `)

  return Response.json({ ok: true, recovered: recovered.rowCount ?? 0, runs: recovered.rows })
}
