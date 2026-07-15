'use server'

import { randomUUID } from 'node:crypto'

import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { getActiveAiProvider, normalizeProviderBaseUrl, providerModel, toProviderSummary } from '@/lib/ai-provider'
import { db } from '@/lib/db'
import { workspaceAiProviders } from '@/lib/db/schema'
import { encryptRuntimeSecret } from '@/lib/runtime-secrets'
import { requireWorkspace } from '@/lib/workspace'

const MAX_NAME = 60
const MAX_MODEL = 120

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value ?? '').trim().slice(0, max)
}

function keyPrefix(key: string) {
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 5)}••••${key.slice(-3)}`
}

function safeProviderError(error: unknown, secret?: string) {
  let message = error instanceof Error ? error.message : 'Провайдер отклонил запрос'
  if (secret) message = message.replaceAll(secret, '[REDACTED]')
  return message.replace(/(?:sk|key|token)-[A-Za-z0-9_-]{8,}/gi, '[REDACTED]').slice(0, 240)
}

export async function getAiProviders() {
  const { workspace } = await requireWorkspace()
  const rows = await db.select().from(workspaceAiProviders).where(eq(workspaceAiProviders.workspaceId, workspace.id)).orderBy(desc(workspaceAiProviders.createdAt))
  return rows.map(toProviderSummary)
}

export async function getActiveAiProviderSummary() {
  const { workspace } = await requireWorkspace()
  try {
    const { config } = await getActiveAiProvider(workspace.id)
    return toProviderSummary(config)
  } catch {
    return null
  }
}

export async function saveAiProvider(formData: FormData) {
  const { workspace } = await requireWorkspace()
  const name = clean(formData.get('name'), MAX_NAME)
  const baseUrl = normalizeProviderBaseUrl(clean(formData.get('baseUrl'), 300))
  const modelId = clean(formData.get('modelId'), MAX_MODEL)
  const apiKey = clean(formData.get('apiKey'), 500)
  if (!name || !modelId || apiKey.length < 8) throw new Error('Заполните название, модель и корректный API-ключ')

  try {
    const provider = createOpenAICompatible({ name: 'workspace-preflight', baseURL: baseUrl, apiKey })
    await generateText({ model: provider(modelId), prompt: 'Ответь только словом OK', maxOutputTokens: 8 })
  } catch (error) {
    throw new Error(`Не удалось проверить ключ или модель: ${safeProviderError(error, apiKey)}`)
  }

  const id = `aip_${randomUUID().replaceAll('-', '')}`
  await db.transaction(async (tx) => {
    await tx.update(workspaceAiProviders).set({ isActive: false, updatedAt: new Date() }).where(eq(workspaceAiProviders.workspaceId, workspace.id))
    await tx.insert(workspaceAiProviders).values({
      id,
      workspaceId: workspace.id,
      name,
      providerType: 'openai-compatible',
      baseUrl,
      modelId,
      encryptedApiKey: encryptRuntimeSecret(apiKey),
      keyPrefix: keyPrefix(apiKey),
      isActive: true,
      lastTestStatus: null,
      lastTestMessage: '',
    })
  })
  revalidatePath('/settings/ai')
  revalidatePath('/assistant')
  return { id }
}

export async function activateAiProvider(id: string) {
  const { workspace } = await requireWorkspace()
  const [owned] = await db.select({ id: workspaceAiProviders.id }).from(workspaceAiProviders).where(and(eq(workspaceAiProviders.id, id), eq(workspaceAiProviders.workspaceId, workspace.id))).limit(1)
  if (!owned) throw new Error('AI-провайдер не найден')
  await db.transaction(async (tx) => {
    await tx.update(workspaceAiProviders).set({ isActive: false, updatedAt: new Date() }).where(eq(workspaceAiProviders.workspaceId, workspace.id))
    await tx.update(workspaceAiProviders).set({ isActive: true, updatedAt: new Date() }).where(and(eq(workspaceAiProviders.id, id), eq(workspaceAiProviders.workspaceId, workspace.id)))
  })
  revalidatePath('/settings/ai')
  revalidatePath('/assistant')
}

export async function testAiProvider(id: string) {
  const { workspace } = await requireWorkspace()
  const [config] = await db.select().from(workspaceAiProviders).where(and(eq(workspaceAiProviders.id, id), eq(workspaceAiProviders.workspaceId, workspace.id))).limit(1)
  if (!config) throw new Error('AI-провайдер не найден')
  try {
    const result = await generateText({ model: providerModel(config), prompt: 'Ответь только словом OK', maxOutputTokens: 8 })
    const message = result.text.trim() || 'Соединение установлено'
    await db.update(workspaceAiProviders).set({ lastTestStatus: 'success', lastTestMessage: message, lastTestedAt: new Date(), updatedAt: new Date() }).where(and(eq(workspaceAiProviders.id, id), eq(workspaceAiProviders.workspaceId, workspace.id)))
    revalidatePath('/settings/ai')
    return { ok: true, message }
  } catch (error) {
    const message = safeProviderError(error)
    await db.update(workspaceAiProviders).set({ lastTestStatus: 'failed', lastTestMessage: message, lastTestedAt: new Date(), updatedAt: new Date() }).where(and(eq(workspaceAiProviders.id, id), eq(workspaceAiProviders.workspaceId, workspace.id)))
    revalidatePath('/settings/ai')
    return { ok: false, message }
  }
}

export async function deleteAiProvider(id: string) {
  const { workspace } = await requireWorkspace()
  await db.delete(workspaceAiProviders).where(and(eq(workspaceAiProviders.id, id), eq(workspaceAiProviders.workspaceId, workspace.id)))
  revalidatePath('/settings/ai')
  revalidatePath('/assistant')
}
