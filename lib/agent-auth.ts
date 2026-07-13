import 'server-only'

import { createHash, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { agents } from '@/lib/db/schema'

export interface AuthedAgent { id: string; name: string; workspaceId: string }
function hash(value: string) { return createHash('sha256').update(value).digest() }

export async function authenticateAgent(req: Request): Promise<AuthedAgent | null> {
  const header = req.headers.get('authorization') ?? ''
  const apiKey = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : req.headers.get('x-api-key')?.trim()
  if (!apiKey) return null
  const digest = hash(apiKey); const hex = digest.toString('hex')
  const [agent] = await db.select().from(agents).where(eq(agents.apiKeyHash, hex)).limit(1)
  if (!agent || !agent.workspaceId || agent.status === 'disabled' || !agent.apiKeyHash) return null
  const stored = Buffer.from(agent.apiKeyHash, 'hex')
  if (stored.length !== digest.length || !timingSafeEqual(stored, digest)) return null
  await db.update(agents).set({ lastSeenAt: new Date() }).where(eq(agents.id, agent.id))
  return { id: agent.id, name: agent.name, workspaceId: agent.workspaceId }
}

export function unauthorized() { return Response.json({ error: 'Неверный или отсутствующий API-ключ' }, { status: 401 }) }
