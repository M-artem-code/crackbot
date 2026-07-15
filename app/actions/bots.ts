'use server'

import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { aiCodeProposals, botRefs, bots, logSteps, pythonVersions, pythonWorkspaces, runs, scenarioVersions, templates } from '@/lib/db/schema'
import { DEFAULT_PYTHON_REQUIREMENTS, pythonTemplateAssetsFor, pythonTemplateFor } from '@/lib/python-templates'
import { assertScenarioDefinition } from '@/lib/scenario/schema'
import { encryptRuntimeSecret } from '@/lib/runtime-secrets'
import { startLocalRun } from '@/lib/local-runner'
import { MAX_TARGET_LINKS, normalizeSuccessLimit, normalizeTargetLabel, normalizeTargetUrl } from '@/lib/target-links'

function genId(prefix: string) { return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` }

export interface TargetLinkInput { url: string; label?: string; successLimit: number }
export interface CreateBotInput { name: string; templateId: string; workers?: number; config?: Record<string, unknown>; targetLinks: TargetLinkInput[] }

function normalizeTargetLinks(links: TargetLinkInput[]) {
  if (links.length > MAX_TARGET_LINKS) throw new Error(`В одном пуле может быть не больше ${MAX_TARGET_LINKS} ссылок`)
  const seen = new Set<string>()
  return links.map((link, position) => {
    const url = normalizeTargetUrl(link.url)
    if (seen.has(url)) throw new Error(`Ссылка добавлена дважды: ${url}`)
    seen.add(url)
    return { url, label: normalizeTargetLabel(link.label ?? ''), position, successLimit: normalizeSuccessLimit(link.successLimit) }
  })
}

export async function createBot(input: CreateBotInput) {
  const name = input.name.trim()
  if (!name) throw new Error('Имя бота обязательно')
  const targetLinks = normalizeTargetLinks(input.targetLinks ?? [])
  if (!targetLinks.length) throw new Error('Добавьте хотя бы одну целевую ссылку')
  const [tpl] = await db.select().from(templates).where(eq(templates.id, input.templateId)).limit(1); if (!tpl) throw new Error('Шаблон не найден')
  const botId = genId('bot'); const versionId = genId('sv'); const scenario = assertScenarioDefinition(tpl.scenarioDefinition)
  await db.transaction(async (tx) => {
    await tx.insert(scenarioVersions).values({ id: versionId, botId, version: 1, snapshot: scenario, author: 'system', changeSummary: 'Начальная версия из шаблона' })
    await tx.insert(bots).values({ id: botId, name, templateId: input.templateId, targetUrl: '', status: 'idle', workers: Math.min(10, Math.max(1, Math.round(input.workers ?? 1))), config: { ...(tpl.defaultConfig as Record<string, unknown>), ...(input.config ?? {}) }, scenarioPublished: scenario, scenarioStatus: 'published', publishedScenarioVersionId: versionId })
    await tx.insert(botRefs).values(targetLinks.map((link) => ({ botId, ...link, status: 'active' as const })))
    const pythonCode = pythonTemplateFor(tpl.slug)
    const pythonVersionId = genId('pyv')
    await tx.insert(pythonVersions).values({ id: pythonVersionId, botId, version: 1, code: pythonCode, requirements: DEFAULT_PYTHON_REQUIREMENTS, author: 'system', changeSummary: 'Начальная версия из шаблона' })
    await tx.insert(pythonWorkspaces).values({ botId, draftCode: pythonCode, draftRequirements: DEFAULT_PYTHON_REQUIREMENTS, publishedCode: pythonCode, publishedRequirements: DEFAULT_PYTHON_REQUIREMENTS, status: 'published', publishedVersionId: pythonVersionId })
  })
  revalidatePath('/'); revalidatePath('/bots'); return { id: botId }
}

/** Create a run and execute it locally via `python bot.py`. */
export async function runBot(botId: string) {
  const [bot] = await db.select().from(bots).where(eq(bots.id, botId)).limit(1); if (!bot) throw new Error('Бот не найден')
  const [template] = await db.select().from(templates).where(eq(templates.id, bot.templateId)).limit(1); if (!template) throw new Error('Шаблон бота не найден')
  const activeTargets = await db.select({ id: botRefs.id }).from(botRefs).where(and(eq(botRefs.botId, botId), eq(botRefs.status, 'active'))).limit(1)
  if (!activeTargets.length) throw new Error('В пуле нет активных целевых ссылок с незавершённым лимитом')
  const [pythonWorkspace] = await db.select().from(pythonWorkspaces).where(eq(pythonWorkspaces.botId, botId)).limit(1)
  if (!pythonWorkspace?.publishedVersionId) throw new Error('Сначала опубликуй bot.py на вкладке bot.py')
  const scenarioSnapshot = { name: 'Published Python bot', version: 1, executionMode: 'python', templateSlug: template.slug, python: { code: pythonWorkspace.publishedCode, requirements: pythonWorkspace.publishedRequirements, assets: pythonTemplateAssetsFor(template.slug) } }
  const runId = genId('run')
  await db.insert(runs).values({ id: runId, botId, status: 'queued', totalWorkers: bot.workers, scenarioVersionId: bot.publishedScenarioVersionId, scenarioSnapshot })
  await db.update(bots).set({ status: 'active', updatedAt: new Date() }).where(eq(bots.id, botId))
  startLocalRun(runId)
  revalidatePath(`/bots/${botId}`); revalidatePath('/bots'); revalidatePath('/'); return { runId }
}

export async function saveScenarioDraft(botId: string, value: unknown) {
  const scenario = assertScenarioDefinition(value)
  const [bot] = await db.select({ id: bots.id }).from(bots).where(eq(bots.id, botId)).limit(1); if (!bot) throw new Error('Бот не найден')
  await db.update(bots).set({ scenarioDraft: scenario, scenarioStatus: 'draft', updatedAt: new Date() }).where(eq(bots.id, botId)); revalidatePath(`/bots/${botId}`); return { ok: true as const }
}

export async function publishScenario(botId: string, value: unknown, changeSummary = '') {
  const scenario = assertScenarioDefinition(value)
  const [bot] = await db.select({ id: bots.id }).from(bots).where(eq(bots.id, botId)).limit(1); if (!bot) throw new Error('Бот не найден')
  const [latest] = await db.select({ version: scenarioVersions.version }).from(scenarioVersions).where(eq(scenarioVersions.botId, botId)).orderBy(desc(scenarioVersions.version)).limit(1)
  const version = (latest?.version ?? 0) + 1; const versionId = genId('sv')
  await db.transaction(async (tx) => { await tx.insert(scenarioVersions).values({ id: versionId, botId, version, snapshot: scenario, author: 'dashboard', changeSummary: changeSummary.trim() || `Опубликована версия ${version}` }); await tx.update(bots).set({ scenarioPublished: scenario, scenarioDraft: null, scenarioStatus: 'published', publishedScenarioVersionId: versionId, updatedAt: new Date() }).where(eq(bots.id, botId)) })
  revalidatePath(`/bots/${botId}`); return { ok: true as const, version }
}

export async function rollbackScenario(botId: string, sourceVersionId: string) {
  const [source] = await db.select().from(scenarioVersions).where(and(eq(scenarioVersions.id, sourceVersionId), eq(scenarioVersions.botId, botId))).limit(1); if (!source) throw new Error('Версия сценария не найдена')
  return publishScenario(botId, source.snapshot, `Rollback к версии ${source.version}`)
}

export async function testScenarioStep(botId: string, value: unknown, stepIndex: number) {
  const scenario = assertScenarioDefinition(value); if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= scenario.steps.length) throw new Error('Шаг для теста не найден')
  const [bot] = await db.select({ id: bots.id }).from(bots).where(eq(bots.id, botId)).limit(1); if (!bot) throw new Error('Бот не найден')
  const snapshot = assertScenarioDefinition({ ...scenario, name: `${scenario.name} · test step ${stepIndex + 1}`, steps: scenario.steps.slice(0, stepIndex + 1) }); const runId = genId('run')
  await db.insert(runs).values({ id: runId, botId, status: 'queued', totalWorkers: 1, scenarioSnapshot: snapshot }); revalidatePath(`/bots/${botId}`); return { runId }
}

export async function cancelRun(runId: string) {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1); if (!run) throw new Error('Прогон не найден')
  if (['success', 'partial', 'failed', 'cancelled'].includes(run.status)) return { cancelled: false }
  await db.update(runs).set({ status: 'cancelled', finishedAt: new Date() }).where(eq(runs.id, runId))
  await db.update(bots).set({ status: 'idle', updatedAt: new Date() }).where(eq(bots.id, run.botId))
  revalidatePath(`/bots/${run.botId}`); return { cancelled: true }
}

export async function updateBotStatus(botId: string, status: 'idle' | 'active' | 'paused' | 'error') {
  const [bot] = await db.select({ id: bots.id }).from(bots).where(eq(bots.id, botId)).limit(1)
  if (!bot) throw new Error('Бот не найден')
  await db.update(bots).set({ status, updatedAt: new Date() }).where(eq(bots.id, botId))
  revalidatePath('/bots')
  revalidatePath(`/bots/${botId}`)
  return { status }
}

export async function deleteBot(botId: string) {
  const [bot] = await db.select({ id: bots.id }).from(bots).where(eq(bots.id, botId)).limit(1)
  if (!bot) throw new Error('Бот не найден')
  const runRows = await db.select({ id: runs.id }).from(runs).where(eq(runs.botId, botId))
  const runIds = runRows.map((run) => run.id)
  await db.transaction(async (tx) => {
    for (const runId of runIds) {
      await tx.delete(logSteps).where(eq(logSteps.runId, runId))
    }
    await tx.delete(runs).where(eq(runs.botId, botId))
    await tx.delete(aiCodeProposals).where(eq(aiCodeProposals.botId, botId))
    await tx.delete(pythonVersions).where(eq(pythonVersions.botId, botId))
    await tx.delete(pythonWorkspaces).where(eq(pythonWorkspaces.botId, botId))
    // Published scenario versions are an immutable audit log and intentionally remain orphaned.
    await tx.delete(botRefs).where(eq(botRefs.botId, botId))
    await tx.delete(bots).where(eq(bots.id, botId))
  })
  revalidatePath('/bots')
  revalidatePath('/')
  return { deleted: true }
}

export interface UpdateBotSettingsInput { name: string; workers: number; config: { proxy?: string; clearProxy?: boolean; allowDirectFallback?: boolean; headless?: boolean; page_timeout?: number; otp_timeout?: number; action_delay_min?: number; action_delay_max?: number; password?: string; clearPassword?: boolean } }
export async function updateBotSettings(botId: string, input: UpdateBotSettingsInput) {
  const name = input.name.trim(); if (!name) throw new Error('Имя бота обязательно')
  const [bot] = await db.select().from(bots).where(eq(bots.id, botId)).limit(1); if (!bot) throw new Error('Бот не найден')
  const config: Record<string, unknown> = { ...(bot.config as Record<string, unknown>), headless: Boolean(input.config.headless), allowDirectFallback: Boolean(input.config.allowDirectFallback) }; const setNum = (key: string, value?: number) => { if (typeof value === 'number' && Number.isFinite(value) && value > 0) config[key] = value }
  setNum('page_timeout', input.config.page_timeout); setNum('otp_timeout', input.config.otp_timeout); setNum('action_delay_min', input.config.action_delay_min); setNum('action_delay_max', input.config.action_delay_max)
  const proxy = (input.config.proxy ?? '').trim()
  const legacyProxy = typeof config.proxy === 'string' ? config.proxy.trim() : ''
  if (proxy) config.proxySecret = encryptRuntimeSecret(proxy)
  else if (input.config.clearProxy) delete config.proxySecret
  else if (!config.proxySecret && legacyProxy) config.proxySecret = encryptRuntimeSecret(legacyProxy)
  delete config.proxy
  const password = (input.config.password ?? '').trim()
  const legacyPassword = typeof config.password === 'string' ? config.password.trim() : ''
  if (password) config.passwordSecret = encryptRuntimeSecret(password)
  else if (input.config.clearPassword) delete config.passwordSecret
  else if (!config.passwordSecret && legacyPassword) config.passwordSecret = encryptRuntimeSecret(legacyPassword)
  delete config.password
  await db.update(bots).set({ name, workers: Math.min(10, Math.max(1, Math.round(input.workers || 1))), config, updatedAt: new Date() }).where(eq(bots.id, botId)); revalidatePath('/bots'); revalidatePath(`/bots/${botId}`); revalidatePath('/'); return { ok: true as const }
}
