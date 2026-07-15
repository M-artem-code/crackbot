'use server'

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { agentPairingTokens, agents } from '@/lib/db/schema'
import { requireWorkspace } from '@/lib/workspace'

function genApiKey() { return `agt_${randomBytes(32).toString('hex')}` }
function hashApiKey(value: string) { return createHash('sha256').update(value).digest('hex') }
function keyPrefix(value: string) { return `${value.slice(0, 12)}••••` }

export interface CreateAgentInput { name: string; os?: string }

async function issuePairingToken(agentId: string, workspaceId: string, userId: string) {
  const token = `pair_${randomBytes(32).toString('base64url')}`
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
  await db.transaction(async (tx) => {
    await tx.update(agentPairingTokens).set({ usedAt: new Date() }).where(and(eq(agentPairingTokens.agentId, agentId), eq(agentPairingTokens.workspaceId, workspaceId), isNull(agentPairingTokens.usedAt)))
    await tx.insert(agentPairingTokens).values({
      id: `pair_${randomUUID().replaceAll('-', '')}`,
      agentId,
      workspaceId,
      tokenHash: hashApiKey(token),
      expiresAt,
      createdBy: userId,
    })
  })
  return { token, expiresAt: expiresAt.toISOString() }
}

export async function createAgent(input: CreateAgentInput): Promise<{ id: string; pairingToken: string; pairingExpiresAt: string }> {
  const { workspace, user } = await requireWorkspace()
  const name = input.name.trim()
  if (!name) throw new Error('Имя агента обязательно')
  const id = `agt_${randomUUID().replaceAll('-', '')}`
  await db.insert(agents).values({ id, workspaceId: workspace.id, name, apiKey: null, apiKeyHash: null, keyPrefix: null, keyCreatedAt: null, os: input.os?.trim() || 'Windows 10/11', status: 'offline', protocolVersion: 2, capabilities: [] })
  const pairing = await issuePairingToken(id, workspace.id, user.id)
  revalidatePath('/agents')
  return { id, pairingToken: pairing.token, pairingExpiresAt: pairing.expiresAt }
}

export async function createAgentPairingToken(id: string) {
  const { workspace, user } = await requireWorkspace()
  const [existing] = await db.select({ id: agents.id }).from(agents).where(and(eq(agents.id, id), eq(agents.workspaceId, workspace.id))).limit(1)
  if (!existing) throw new Error('Агент не найден')
  const pairing = await issuePairingToken(id, workspace.id, user.id)
  revalidatePath('/agents')
  return { agentId: id, pairingToken: pairing.token, pairingExpiresAt: pairing.expiresAt }
}

export async function rotateApiKey(id: string): Promise<{ apiKey: string }> {
  const { workspace } = await requireWorkspace()
  const [existing] = await db.select({ id: agents.id }).from(agents).where(and(eq(agents.id, id), eq(agents.workspaceId, workspace.id))).limit(1)
  if (!existing) throw new Error('Агент не найден')
  const apiKey = genApiKey()
  await db.update(agents).set({ apiKeyHash: hashApiKey(apiKey), keyPrefix: keyPrefix(apiKey), keyCreatedAt: new Date() }).where(and(eq(agents.id, id), eq(agents.workspaceId, workspace.id)))
  revalidatePath('/agents')
  return { apiKey }
}

export async function renameAgent(id: string, name: string) {
  const { workspace } = await requireWorkspace(); const value = name.trim(); if (!value) throw new Error('Имя агента обязательно')
  await db.update(agents).set({ name: value }).where(and(eq(agents.id, id), eq(agents.workspaceId, workspace.id))); revalidatePath('/agents')
}
export async function setAgentDisabled(id: string, disabled: boolean) {
  const { workspace } = await requireWorkspace(); await db.update(agents).set({ status: disabled ? 'disabled' : 'offline' }).where(and(eq(agents.id, id), eq(agents.workspaceId, workspace.id))); revalidatePath('/agents')
}
export async function deleteAgent(id: string) {
  const { workspace } = await requireWorkspace(); await db.delete(agents).where(and(eq(agents.id, id), eq(agents.workspaceId, workspace.id))); revalidatePath('/agents')
}
