import { createHash, randomBytes } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { agentPairingTokens, agents } from '@/lib/db/schema'

export const runtime = 'nodejs'

const TOKEN_PATTERN = /^pair_[A-Za-z0-9_-]{40,60}$/

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function newAgentKey() {
  return `agt_${randomBytes(32).toString('hex')}`
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { token?: unknown; runnerVersion?: unknown } | null
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const runnerVersion = typeof body?.runnerVersion === 'string' ? body.runnerVersion.slice(0, 40) : 'unknown'
  if (!TOKEN_PATTERN.test(token)) return NextResponse.json({ error: 'PAIRING_FAILED' }, { status: 401 })

  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${digest(token)}))`)
      const [pairing] = await tx.select().from(agentPairingTokens).where(eq(agentPairingTokens.tokenHash, digest(token))).limit(1)
      if (!pairing || pairing.usedAt || pairing.expiresAt.getTime() <= Date.now()) return null

      const [agent] = await tx.select({ id: agents.id, workspaceId: agents.workspaceId }).from(agents).where(eq(agents.id, pairing.agentId)).limit(1)
      if (!agent || agent.workspaceId !== pairing.workspaceId) return null

      const apiKey = newAgentKey()
      await tx.update(agents).set({
        apiKey: null,
        apiKeyHash: digest(apiKey),
        keyPrefix: `${apiKey.slice(0, 12)}••••`,
        keyCreatedAt: new Date(),
        protocolVersion: 2,
        capabilities: ['python-docker-v1'],
        status: 'offline',
      }).where(eq(agents.id, agent.id))
      await tx.update(agentPairingTokens).set({ usedAt: new Date() }).where(eq(agentPairingTokens.id, pairing.id))
      return { agentId: agent.id, apiKey }
    })

    if (!result) return NextResponse.json({ error: 'PAIRING_FAILED' }, { status: 401 })
    return NextResponse.json({ ...result, protocolVersion: 2, runnerVersion })
  } catch {
    return NextResponse.json({ error: 'PAIRING_FAILED' }, { status: 401 })
  }
}
