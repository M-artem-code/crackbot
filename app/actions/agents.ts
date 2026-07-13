'use server'

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { agents } from '@/lib/db/schema'
import { requireWorkspace } from '@/lib/workspace'

function genApiKey() { return `agt_${randomBytes(32).toString('hex')}` }
function hashApiKey(value: string) { return createHash('sha256').update(value).digest('hex') }
function keyPrefix(value: string) { return `${value.slice(0, 12)}••••` }

export interface CreateAgentInput { name: string; os?: string }

export async function createAgent(input: CreateAgentInput): Promise<{ id: string; apiKey: string }> {
  const { workspace } = await requireWorkspace()
  const name = input.name.trim()
  if (!name) throw new Error('Имя агента обязательно')
  const id = `agt_${randomUUID().replaceAll('-', '')}`
  const apiKey = genApiKey()
  await db.insert(agents).values({ id, workspaceId: workspace.id, name, apiKey: null, apiKeyHash: hashApiKey(apiKey), keyPrefix: keyPrefix(apiKey), keyCreatedAt: new Date(), os: input.os?.trim() ?? '', status: 'offline' })
  revalidatePath('/agents')
  return { id, apiKey }
}

export async function rotateApiKey(id: string): Promise<{ apiKey: string }> {
  const { workspace } = await requireWorkspace()
  const [existing] = await db.select({ id: agents.id }).from(agents).where(and(eq(agents.id, id), eq(agents.workspaceId, workspace.id))).limit(1)
  if (!existing) throw new Error('Агент не найден')
  const apiKey = genApiKey()
  await db.update(agents).set({ apiKey: null, apiKeyHash: hashApiKey(apiKey), keyPrefix: keyPrefix(apiKey), keyCreatedAt: new Date() }).where(and(eq(agents.id, id), eq(agents.workspaceId, workspace.id)))
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
