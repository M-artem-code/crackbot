import { createHash, randomBytes } from 'node:crypto'

import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { runs, type Run } from '@/lib/db/schema'

type LeaseAgent = { id: string; workspaceId: string; protocolVersion: number }

export const AGENT_PROTOCOL_VERSION = 2
export const LEASE_TTL_SECONDS = 75

export function issueLeaseToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashLeaseToken(token) }
}

export function hashLeaseToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function leaseTokenFromRequest(request: Request) {
  return request.headers.get('x-run-lease')?.trim() ?? ''
}

export function isAgentCompatible(agent: LeaseAgent) {
  return agent.protocolVersion >= AGENT_PROTOCOL_VERSION
}

export async function requireActiveLease(request: Request, runId: string, agent: LeaseAgent): Promise<Run | Response> {
  const token = leaseTokenFromRequest(request)
  if (!token) return Response.json({ error: 'Требуется run lease' }, { status: 401 })

  const [run] = await db.select().from(runs).where(and(eq(runs.id, runId), eq(runs.workspaceId, agent.workspaceId))).limit(1)
  if (!run) return Response.json({ error: 'Прогон не найден' }, { status: 404 })
  if (run.leaseOwnerAgentId !== agent.id || run.leaseTokenHash !== hashLeaseToken(token)) {
    return Response.json({ error: 'Lease отозван или принадлежит другой попытке', code: 'STALE_LEASE' }, { status: 409 })
  }
  if (!run.leaseExpiresAt || run.leaseExpiresAt <= new Date()) {
    return Response.json({ error: 'Lease истёк', code: 'LEASE_EXPIRED' }, { status: 409 })
  }
  return run
}

export function isLeaseError(value: Run | Response): value is Response {
  return value instanceof Response
}
