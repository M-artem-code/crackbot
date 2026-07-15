'use server'

import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { botRefs, bots, pythonVersions, pythonWorkspaces, runs, templates } from '@/lib/db/schema'
import { validatePythonRequirements } from '@/lib/python-requirements'
import { DEFAULT_PYTHON_REQUIREMENTS, pythonTemplateAssetsFor, pythonTemplateFor } from '@/lib/python-templates'
import { requireWorkspace } from '@/lib/workspace'

const MAX_CODE_BYTES = 250_000
const MAX_REQUIREMENTS_BYTES = 32_000
const id = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

function validateFiles(code: string, requirements: string) {
  if (!code.trim()) throw new Error('bot.py не может быть пустым')
  if (Buffer.byteLength(code) > MAX_CODE_BYTES) throw new Error('bot.py превышает лимит 250 KB')
  if (Buffer.byteLength(requirements) > MAX_REQUIREMENTS_BYTES) throw new Error('requirements.txt превышает лимит 32 KB')
  validatePythonRequirements(requirements)
}

async function ownedBot(workspaceId: string, botId: string) {
  const [bot] = await db.select().from(bots).where(and(eq(bots.id, botId), eq(bots.workspaceId, workspaceId))).limit(1)
  if (!bot) throw new Error('Бот не найден')
  return bot
}

export async function ensurePythonWorkspace(botId: string) {
  const { workspace } = await requireWorkspace()
  const bot = await ownedBot(workspace.id, botId)
  const [existing] = await db.select().from(pythonWorkspaces).where(and(eq(pythonWorkspaces.botId, botId), eq(pythonWorkspaces.workspaceId, workspace.id))).limit(1)
  if (existing?.publishedVersionId) return existing
  if (existing) {
    const versionId = id('pyv')
    await db.transaction(async (tx) => {
      await tx.insert(pythonVersions).values({ id: versionId, workspaceId: workspace.id, botId, version: 1, code: existing.publishedCode, requirements: existing.publishedRequirements, author: 'system', changeSummary: 'Импорт исходной опубликованной версии' })
      await tx.update(pythonWorkspaces).set({ publishedVersionId: versionId, updatedAt: new Date() }).where(and(eq(pythonWorkspaces.botId, botId), eq(pythonWorkspaces.workspaceId, workspace.id)))
    })
    return { ...existing, publishedVersionId: versionId }
  }
  const [template] = await db.select().from(templates).where(eq(templates.id, bot.templateId)).limit(1)
  const code = pythonTemplateFor(template?.slug ?? 'v0-app')
  const versionId = id('pyv')
  const [created] = await db.transaction(async (tx) => {
    await tx.insert(pythonVersions).values({ id: versionId, workspaceId: workspace.id, botId, version: 1, code, requirements: DEFAULT_PYTHON_REQUIREMENTS, author: 'system', changeSummary: 'Начальная версия из шаблона' })
    return tx.insert(pythonWorkspaces).values({ botId, workspaceId: workspace.id, draftCode: code, draftRequirements: DEFAULT_PYTHON_REQUIREMENTS, publishedCode: code, publishedRequirements: DEFAULT_PYTHON_REQUIREMENTS, status: 'published', publishedVersionId: versionId }).returning()
  })
  return created
}

export async function savePythonDraft(botId: string, code: string, requirements: string) {
  const { workspace } = await requireWorkspace(); await ownedBot(workspace.id, botId); validateFiles(code, requirements)
  await ensurePythonWorkspace(botId)
  await db.update(pythonWorkspaces).set({ draftCode: code, draftRequirements: requirements, status: 'draft', lastTestStatus: null, updatedAt: new Date() }).where(and(eq(pythonWorkspaces.botId, botId), eq(pythonWorkspaces.workspaceId, workspace.id)))
  revalidatePath(`/bots/${botId}`); return { ok: true as const }
}

export async function testPythonDraft(botId: string, code: string, requirements: string) {
  const { workspace } = await requireWorkspace(); const bot = await ownedBot(workspace.id, botId); validateFiles(code, requirements)
  const [target] = await db.select().from(botRefs).where(and(eq(botRefs.botId, botId), eq(botRefs.workspaceId, workspace.id), eq(botRefs.status, 'active'))).limit(1)
  if (!target) throw new Error('Для теста нужна активная целевая ссылка')
  const [template] = await db.select().from(templates).where(eq(templates.id, bot.templateId)).limit(1)
  if (!template) throw new Error('Шаблон бота не найден')
  await savePythonDraft(botId, code, requirements)
  const runId = id('run')
  await db.insert(runs).values({ id: runId, workspaceId: workspace.id, botId, status: 'queued', totalWorkers: 1, scenarioSnapshot: { name: 'Python draft test', version: 1, executionMode: 'python', testMode: true, templateSlug: template.slug, python: { code, requirements, assets: pythonTemplateAssetsFor(template.slug) }, targetId: target.id } })
  await db.update(bots).set({ status: 'active', updatedAt: new Date() }).where(and(eq(bots.id, bot.id), eq(bots.workspaceId, workspace.id)))
  revalidatePath(`/bots/${botId}`); return { runId }
}

export async function publishPythonDraft(botId: string, code: string, requirements: string, changeSummary = '') {
  const { workspace } = await requireWorkspace(); await ownedBot(workspace.id, botId); validateFiles(code, requirements)
  const ws = await ensurePythonWorkspace(botId)
  if (ws.lastTestStatus !== 'success' || ws.draftCode !== code || ws.draftRequirements !== requirements) throw new Error('Сначала успешно протестируйте текущий черновик')
  const [latest] = await db.select({ version: pythonVersions.version }).from(pythonVersions).where(and(eq(pythonVersions.botId, botId), eq(pythonVersions.workspaceId, workspace.id))).orderBy(desc(pythonVersions.version)).limit(1)
  const version = (latest?.version ?? 0) + 1; const versionId = id('pyv')
  await db.transaction(async (tx) => {
    await tx.insert(pythonVersions).values({ id: versionId, workspaceId: workspace.id, botId, version, code, requirements, changeSummary: changeSummary.trim() || `Опубликована Python-версия ${version}` })
    await tx.update(pythonWorkspaces).set({ publishedCode: code, publishedRequirements: requirements, publishedVersionId: versionId, status: 'published', updatedAt: new Date() }).where(and(eq(pythonWorkspaces.botId, botId), eq(pythonWorkspaces.workspaceId, workspace.id)))
  })
  revalidatePath(`/bots/${botId}`); return { version }
}

export async function rollbackPythonVersion(botId: string, versionId: string) {
  const { workspace } = await requireWorkspace(); await ownedBot(workspace.id, botId)
  const [source] = await db.select().from(pythonVersions).where(and(eq(pythonVersions.id, versionId), eq(pythonVersions.botId, botId), eq(pythonVersions.workspaceId, workspace.id))).limit(1)
  if (!source) throw new Error('Python-версия не найдена')
  await db.update(pythonWorkspaces).set({ draftCode: source.code, draftRequirements: source.requirements, status: 'draft', lastTestStatus: null, updatedAt: new Date() }).where(and(eq(pythonWorkspaces.botId, botId), eq(pythonWorkspaces.workspaceId, workspace.id)))
  revalidatePath(`/bots/${botId}`); return { ok: true as const }
}
