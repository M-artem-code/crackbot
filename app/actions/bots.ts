'use server'

import { db } from '@/lib/db'
import { botRefs, bots, runs, templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export interface CreateBotInput {
  name: string
  targetUrl: string
  templateId: string
  workers?: number
  config?: Record<string, unknown>
  seedRefs?: string[]
}

export async function createBot(input: CreateBotInput): Promise<{ id: string }> {
  const name = input.name.trim()
  const targetUrl = input.targetUrl.trim()
  if (!name) throw new Error('Имя бота обязательно')
  if (!targetUrl) throw new Error('URL деплоя обязателен')

  const tpl = await db
    .select()
    .from(templates)
    .where(eq(templates.id, input.templateId))
    .limit(1)
  if (tpl.length === 0) throw new Error('Шаблон не найден')

  const botId = genId('bot')
  const mergedConfig = {
    ...(tpl[0].defaultConfig as Record<string, unknown>),
    ...(input.config ?? {}),
  }

  await db.insert(bots).values({
    id: botId,
    name,
    templateId: input.templateId,
    targetUrl,
    status: 'idle',
    workers: input.workers ?? 1,
    config: mergedConfig,
  })

  const seeds = (input.seedRefs ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (seeds.length > 0) {
    await db.insert(botRefs).values(
      seeds.map((url) => ({
        botId,
        url,
        successLimit: 10,
        successCount: 0,
        failedCount: 0,
        status: 'active' as const,
      })),
    )
  }

  revalidatePath('/bots')
  revalidatePath('/')
  return { id: botId }
}

export async function enqueueRun(botId: string): Promise<{ runId: string }> {
  const [bot] = await db.select().from(bots).where(eq(bots.id, botId)).limit(1)
  if (!bot) throw new Error('Бот не найден')

  const runId = genId('run')
  await db.insert(runs).values({
    id: runId,
    botId,
    status: 'queued',
    totalWorkers: bot.workers,
  })
  await db
    .update(bots)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(bots.id, botId))

  revalidatePath(`/bots/${botId}`)
  revalidatePath('/bots')
  revalidatePath('/')
  return { runId }
}

export async function updateBotStatus(
  botId: string,
  status: 'idle' | 'active' | 'paused' | 'error',
): Promise<void> {
  await db
    .update(bots)
    .set({ status, updatedAt: new Date() })
    .where(eq(bots.id, botId))
  revalidatePath('/bots')
  revalidatePath(`/bots/${botId}`)
}
