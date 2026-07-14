'use server'

import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { botRefs, bots, runs, scenarioVersions, templates } from '@/lib/db/schema'
import { assertScenarioDefinition } from '@/lib/scenario/schema'
import { requireWorkspace } from '@/lib/workspace'

function genId(prefix: string) { return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` }
function scopedBot(workspaceId: string, botId: string) { return and(eq(bots.id, botId), eq(bots.workspaceId, workspaceId)) }

export interface TargetLinkInput { url: string; successLimit: number }
export interface CreateBotInput { name: string; templateId: string; workers?: number; config?: Record<string, unknown>; targetLinks: TargetLinkInput[] }

function normalizeTargetLinks(links: TargetLinkInput[]) {
  const seen = new Set<string>()
  return links.map((link) => {
    const raw = link.url.trim()
    let url: URL
    try { url = new URL(raw) } catch { throw new Error(`Некорректная целевая ссылка: ${raw || 'пустая строка'}`) }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Целевые ссылки должны начинаться с http:// или https://')
    const normalized = url.toString()
    if (seen.has(normalized)) throw new Error(`Ссылка добавлена дважды: ${normalized}`)
    seen.add(normalized)
    return { url: normalized, successLimit: Math.min(10000, Math.max(1, Math.round(link.successLimit || 1))) }
  })
}

export async function createBot(input: CreateBotInput) {
  const { workspace } = await requireWorkspace(); const name = input.name.trim()
  if (!name) throw new Error('Имя бота обязательно')
  const targetLinks = normalizeTargetLinks(input.targetLinks ?? [])
  if (!targetLinks.length) throw new Error('Добавьте хотя бы одну целевую ссылку')
  const [tpl] = await db.select().from(templates).where(eq(templates.id, input.templateId)).limit(1); if (!tpl) throw new Error('Шаблон не найден')
  const botId = genId('bot'); const versionId = genId('sv'); const scenario = assertScenarioDefinition(tpl.scenarioDefinition)
  await db.transaction(async (tx) => {
    await tx.insert(scenarioVersions).values({ id: versionId, workspaceId: workspace.id, botId, version: 1, snapshot: scenario, author: 'system', changeSummary: 'Начальная версия из шаблона' })
    await tx.insert(bots).values({ id: botId, workspaceId: workspace.id, name, templateId: input.templateId, targetUrl: '', status: 'idle', workers: Math.min(10, Math.max(1, Math.round(input.workers ?? 1))), config: { ...(tpl.defaultConfig as Record<string, unknown>), ...(input.config ?? {}) }, scenarioPublished: scenario, scenarioStatus: 'published', publishedScenarioVersionId: versionId })
    await tx.insert(botRefs).values(targetLinks.map((link) => ({ workspaceId: workspace.id, botId, ...link, status: 'active' as const })))
  })
  revalidatePath('/'); revalidatePath('/bots'); return { id: botId }
}

export async function enqueueRun(botId: string) {
  const { workspace } = await requireWorkspace(); const [bot] = await db.select().from(bots).where(scopedBot(workspace.id, botId)).limit(1); if (!bot) throw new Error('Бот не найден')
  const [template] = await db.select().from(templates).where(eq(templates.id, bot.templateId)).limit(1); if (!template) throw new Error('Шаблон бота не найден')
  const existingTargets = await db.select({ id: botRefs.id }).from(botRefs).where(and(eq(botRefs.botId, botId), eq(botRefs.workspaceId, workspace.id))).limit(1)
  if (!existingTargets.length && bot.targetUrl.trim()) {
    await db.insert(botRefs).values({ workspaceId: workspace.id, botId, url: bot.targetUrl.trim(), successLimit: 10, status: 'active' })
  }
  const activeTargets = await db.select({ id: botRefs.id }).from(botRefs).where(and(eq(botRefs.botId, botId), eq(botRefs.workspaceId, workspace.id), eq(botRefs.status, 'active'))).limit(1)
  if (!activeTargets.length) throw new Error('В пуле нет активных целевых ссылок с незавершённым лимитом')
  const runId = genId('run'); await db.insert(runs).values({ id: runId, workspaceId: workspace.id, botId, status: 'queued', totalWorkers: bot.workers, scenarioVersionId: bot.publishedScenarioVersionId, scenarioSnapshot: assertScenarioDefinition(bot.scenarioPublished ?? template.scenarioDefinition) })
  await db.update(bots).set({ status: 'active', updatedAt: new Date() }).where(scopedBot(workspace.id, botId)); revalidatePath(`/bots/${botId}`); revalidatePath('/bots'); revalidatePath('/'); return { runId }
}

export async function saveScenarioDraft(botId: string, value: unknown) {
  const { workspace } = await requireWorkspace(); const scenario = assertScenarioDefinition(value)
  const [bot] = await db.select({ id: bots.id }).from(bots).where(scopedBot(workspace.id, botId)).limit(1); if (!bot) throw new Error('Бот не найден')
  await db.update(bots).set({ scenarioDraft: scenario, scenarioStatus: 'draft', updatedAt: new Date() }).where(scopedBot(workspace.id, botId)); revalidatePath(`/bots/${botId}`); return { ok: true as const }
}

export async function publishScenario(botId: string, value: unknown, changeSummary = '') {
  const { workspace } = await requireWorkspace(); const scenario = assertScenarioDefinition(value)
  const [bot] = await db.select({ id: bots.id }).from(bots).where(scopedBot(workspace.id, botId)).limit(1); if (!bot) throw new Error('Бот не найден')
  const [latest] = await db.select({ version: scenarioVersions.version }).from(scenarioVersions).where(and(eq(scenarioVersions.botId, botId), eq(scenarioVersions.workspaceId, workspace.id))).orderBy(desc(scenarioVersions.version)).limit(1)
  const version = (latest?.version ?? 0) + 1; const versionId = genId('sv')
  await db.transaction(async (tx) => { await tx.insert(scenarioVersions).values({ id: versionId, workspaceId: workspace.id, botId, version, snapshot: scenario, author: 'dashboard', changeSummary: changeSummary.trim() || `Опубликована версия ${version}` }); await tx.update(bots).set({ scenarioPublished: scenario, scenarioDraft: null, scenarioStatus: 'published', publishedScenarioVersionId: versionId, updatedAt: new Date() }).where(scopedBot(workspace.id, botId)) })
  revalidatePath(`/bots/${botId}`); return { ok: true as const, version }
}

export async function rollbackScenario(botId: string, sourceVersionId: string) {
  const { workspace } = await requireWorkspace(); const [source] = await db.select().from(scenarioVersions).where(and(eq(scenarioVersions.id, sourceVersionId), eq(scenarioVersions.botId, botId), eq(scenarioVersions.workspaceId, workspace.id))).limit(1); if (!source) throw new Error('Версия сценария не найдена')
  return publishScenario(botId, source.snapshot, `Rollback к версии ${source.version}`)
}

export async function testScenarioStep(botId: string, value: unknown, stepIndex: number) {
  const { workspace } = await requireWorkspace(); const scenario = assertScenarioDefinition(value); if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= scenario.steps.length) throw new Error('Шаг для теста не найден')
  const [bot] = await db.select({ id: bots.id }).from(bots).where(scopedBot(workspace.id, botId)).limit(1); if (!bot) throw new Error('Бот не найден')
  const snapshot = assertScenarioDefinition({ ...scenario, name: `${scenario.name} · test step ${stepIndex + 1}`, steps: scenario.steps.slice(0, stepIndex + 1) }); const runId = genId('run')
  await db.insert(runs).values({ id: runId, workspaceId: workspace.id, botId, status: 'queued', totalWorkers: 1, scenarioSnapshot: snapshot }); revalidatePath(`/bots/${botId}`); return { runId }
}

export async function cancelRun(runId: string) {
  const { workspace } = await requireWorkspace(); const runScope = and(eq(runs.id, runId), eq(runs.workspaceId, workspace.id)); const [run] = await db.select().from(runs).where(runScope).limit(1); if (!run) throw new Error('Прогон не найден'); if (['success', 'failed', 'cancelled'].includes(run.status)) return { cancelled: false }
  if (run.status === 'queued') { await db.update(runs).set({ status: 'cancelled', cancelRequestedAt: new Date(), finishedAt: new Date() }).where(runScope); await db.update(bots).set({ status: 'idle', updatedAt: new Date() }).where(scopedBot(workspace.id, run.botId)) } else await db.update(runs).set({ cancelRequestedAt: new Date() }).where(runScope)
  revalidatePath(`/bots/${run.botId}`); return { cancelled: true }
}

export async function updateBotStatus(botId: string, status: 'idle' | 'active' | 'paused' | 'error') { const { workspace } = await requireWorkspace(); await db.update(bots).set({ status, updatedAt: new Date() }).where(scopedBot(workspace.id, botId)); revalidatePath('/bots'); revalidatePath(`/bots/${botId}`) }

export interface UpdateBotSettingsInput { name: string; workers: number; config: { proxy?: string; headless?: boolean; page_timeout?: number; otp_timeout?: number; action_delay_min?: number; action_delay_max?: number; password?: string } }
export async function updateBotSettings(botId: string, input: UpdateBotSettingsInput) {
  const { workspace } = await requireWorkspace(); const name = input.name.trim(); if (!name) throw new Error('Имя бота обязательно')
  const [bot] = await db.select().from(bots).where(scopedBot(workspace.id, botId)).limit(1); if (!bot) throw new Error('Бот не найден')
  const config: Record<string, unknown> = { ...(bot.config as Record<string, unknown>), headless: Boolean(input.config.headless) }; const setNum = (key: string, value?: number) => { if (typeof value === 'number' && Number.isFinite(value) && value > 0) config[key] = value }
  setNum('page_timeout', input.config.page_timeout); setNum('otp_timeout', input.config.otp_timeout); setNum('action_delay_min', input.config.action_delay_min); setNum('action_delay_max', input.config.action_delay_max)
  for (const key of ['proxy', 'password'] as const) { const value = (input.config[key] ?? '').trim(); if (value) config[key] = value; else delete config[key] }
  await db.update(bots).set({ name, workers: Math.min(10, Math.max(1, Math.round(input.workers || 1))), config, updatedAt: new Date() }).where(scopedBot(workspace.id, botId)); revalidatePath('/bots'); revalidatePath(`/bots/${botId}`); revalidatePath('/'); return { ok: true as const }
}
