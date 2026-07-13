'use server'

import { db } from '@/lib/db'
import { botRefs, bots, runs, templates } from '@/lib/db/schema'
import { assertScenarioDefinition } from '@/lib/scenario/schema'
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

  const [template] = await db
    .select()
    .from(templates)
    .where(eq(templates.id, bot.templateId))
    .limit(1)
  if (!template) throw new Error('Шаблон бота не найден')

  const scenarioSnapshot = assertScenarioDefinition(template.scenarioDefinition)
  const runId = genId('run')
  await db.insert(runs).values({
    id: runId,
    botId,
    status: 'queued',
    totalWorkers: bot.workers,
    scenarioSnapshot,
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

export async function cancelRun(runId: string): Promise<{ cancelled: boolean }> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  if (!run) throw new Error('Прогон не найден')
  if (['success', 'failed', 'cancelled'].includes(run.status)) return { cancelled: false }

  if (run.status === 'queued') {
    await db
      .update(runs)
      .set({ status: 'cancelled', cancelRequestedAt: new Date(), finishedAt: new Date() })
      .where(eq(runs.id, runId))
    await db
      .update(bots)
      .set({ status: 'idle', updatedAt: new Date() })
      .where(eq(bots.id, run.botId))
  } else {
    await db
      .update(runs)
      .set({ cancelRequestedAt: new Date() })
      .where(eq(runs.id, runId))
  }

  revalidatePath(`/bots/${run.botId}`)
  return { cancelled: true }
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

export interface UpdateBotSettingsInput {
  name: string
  targetUrl: string
  workers: number
  config: {
    proxy?: string
    headless?: boolean
    page_timeout?: number
    otp_timeout?: number
    action_delay_min?: number
    action_delay_max?: number
    password?: string
  }
}

// Сохранение настроек бота. Ключи config совпадают с тем, что читает
// Python-агент (agent/runner.py и agent/browser.py): page_timeout, otp_timeout,
// action_delay_min/max, proxy, headless, password.
export async function updateBotSettings(
  botId: string,
  input: UpdateBotSettingsInput,
): Promise<{ ok: true }> {
  const name = input.name.trim()
  const targetUrl = input.targetUrl.trim()
  if (!name) throw new Error('Имя бота обязательно')
  if (!targetUrl) throw new Error('URL деплоя обязателен')

  const [bot] = await db.select().from(bots).where(eq(bots.id, botId)).limit(1)
  if (!bot) throw new Error('Бот не найден')

  const workers = Math.min(10, Math.max(1, Math.round(input.workers || 1)))

  // Мержим поверх существующего config, чтобы не потерять поля шаблона.
  const prev = (bot.config as Record<string, unknown>) ?? {}
  const c = input.config
  const nextConfig: Record<string, unknown> = { ...prev }

  const setNum = (key: string, val: number | undefined) => {
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) nextConfig[key] = val
  }
  setNum('page_timeout', c.page_timeout)
  setNum('otp_timeout', c.otp_timeout)
  setNum('action_delay_min', c.action_delay_min)
  setNum('action_delay_max', c.action_delay_max)

  nextConfig.headless = Boolean(c.headless)

  const proxy = (c.proxy ?? '').trim()
  if (proxy) nextConfig.proxy = proxy
  else delete nextConfig.proxy

  const password = (c.password ?? '').trim()
  if (password) nextConfig.password = password
  else delete nextConfig.password

  await db
    .update(bots)
    .set({ name, targetUrl, workers, config: nextConfig, updatedAt: new Date() })
    .where(eq(bots.id, botId))

  revalidatePath('/bots')
  revalidatePath(`/bots/${botId}`)
  revalidatePath('/')
  return { ok: true }
}
