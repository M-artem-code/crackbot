import 'server-only'

import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { workspaceAiProviders } from '@/lib/db/schema'
import { decryptRuntimeSecret } from '@/lib/runtime-secrets'

export type AiProviderSummary = {
  id: string
  name: string
  providerType: string
  baseUrl: string
  modelId: string
  keyPrefix: string
  isActive: boolean
  lastTestStatus: string | null
  lastTestMessage: string
  lastTestedAt: string | null
}

export function normalizeProviderBaseUrl(value: string): string {
  const url = new URL(value.trim())
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV === 'development' && url.protocol === 'http:')) {
    throw new Error('Base URL должен использовать HTTPS')
  }
  if (url.username || url.password) throw new Error('Base URL не должен содержать логин или пароль')
  return url.toString().replace(/\/$/, '')
}

export function providerModel(config: { name: string; baseUrl: string; modelId: string; encryptedApiKey: string }) {
  const apiKey = decryptRuntimeSecret(config.encryptedApiKey)
  if (!apiKey) throw new Error('Не удалось расшифровать API-ключ. Сохраните ключ повторно')
  const provider = createOpenAICompatible({
    name: `workspace-${config.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'ai'}`,
    baseURL: normalizeProviderBaseUrl(config.baseUrl),
    apiKey,
    supportsStructuredOutputs: true,
  })
  return provider.chatModel(config.modelId)
}

export async function getActiveAiProvider(workspaceId: string) {
  const [config] = await db.select().from(workspaceAiProviders).where(and(eq(workspaceAiProviders.workspaceId, workspaceId), eq(workspaceAiProviders.isActive, true))).limit(1)
  if (!config) throw new Error('AI-провайдер не настроен. Откройте «Настройки AI» и подключите свой API-ключ')
  return { config, model: providerModel(config) }
}

export function toProviderSummary(row: typeof workspaceAiProviders.$inferSelect): AiProviderSummary {
  return {
    id: row.id,
    name: row.name,
    providerType: row.providerType,
    baseUrl: row.baseUrl,
    modelId: row.modelId,
    keyPrefix: row.keyPrefix,
    isActive: row.isActive,
    lastTestStatus: row.lastTestStatus,
    lastTestMessage: row.lastTestMessage,
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
  }
}
