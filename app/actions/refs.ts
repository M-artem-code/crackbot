'use server'

import { and, eq, max } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { botRefs, bots } from '@/lib/db/schema'
import { MAX_TARGET_LINKS, normalizeSuccessLimit, normalizeTargetLabel, normalizeTargetUrl } from '@/lib/target-links'

function revalidateBot(id: string) { revalidatePath('/'); revalidatePath('/bots'); revalidatePath(`/bots/${id}`) }
async function assertBot(botId: string) { const [bot] = await db.select({ id: bots.id }).from(bots).where(eq(bots.id, botId)).limit(1); if (!bot) throw new Error('Бот не найден') }
function scope(botId: string, refId: number) { return and(eq(botRefs.id, refId), eq(botRefs.botId, botId)) }

export async function addRef(botId: string, url: string, successLimit: number, label = '') {
  await assertBot(botId)
  const normalizedUrl = normalizeTargetUrl(url)
  const [existing, current, highest] = await Promise.all([
    db.select({ id: botRefs.id }).from(botRefs).where(and(eq(botRefs.botId, botId), eq(botRefs.url, normalizedUrl))).limit(1),
    db.select({ id: botRefs.id }).from(botRefs).where(eq(botRefs.botId, botId)),
    db.select({ value: max(botRefs.position) }).from(botRefs).where(eq(botRefs.botId, botId)),
  ])
  if (existing.length) throw new Error('Эта целевая ссылка уже есть в пуле')
  if (current.length >= MAX_TARGET_LINKS) throw new Error(`В одном пуле может быть не больше ${MAX_TARGET_LINKS} ссылок`)
  await db.insert(botRefs).values({ botId, url: normalizedUrl, label: normalizeTargetLabel(label), position: (highest[0]?.value ?? -1) + 1, successLimit: normalizeSuccessLimit(successLimit), status: 'active' })
  revalidateBot(botId)
  return { ok: true as const }
}

export async function importRefs(botId: string, text: string, defaultLimit: number) {
  await assertBot(botId)
  const fallback = normalizeSuccessLimit(defaultLimit)
  const parsed = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [raw, limitRaw, labelRaw] = line.split(/[,;\t]/).map((part) => part?.trim())
    const parsedLimit = Number.parseInt(limitRaw ?? '', 10)
    return { url: normalizeTargetUrl(raw ?? ''), successLimit: Number.isFinite(parsedLimit) ? normalizeSuccessLimit(parsedLimit) : fallback, label: normalizeTargetLabel(labelRaw ?? '') }
  })
  if (!parsed.length) throw new Error('Не найдено ни одной целевой ссылки')
  const urls = new Set(parsed.map((row) => row.url))
  if (urls.size !== parsed.length) throw new Error('В импортируемом списке есть повторяющиеся ссылки')
  const current = await db.select({ url: botRefs.url, position: botRefs.position }).from(botRefs).where(eq(botRefs.botId, botId))
  const existing = new Set(current.map((row) => row.url))
  const duplicates = parsed.filter((row) => existing.has(row.url))
  if (duplicates.length) throw new Error(`В пуле уже есть ${duplicates.length} из импортируемых ссылок`)
  if (current.length + parsed.length > MAX_TARGET_LINKS) throw new Error(`В одном пуле может быть не больше ${MAX_TARGET_LINKS} ссылок`)
  const start = current.reduce((highest, row) => Math.max(highest, row.position), -1) + 1
  await db.transaction(async (tx) => { await tx.insert(botRefs).values(parsed.map((row, index) => ({ botId, ...row, position: start + index, status: 'active' as const }))) })
  revalidateBot(botId)
  return { ok: true as const, added: parsed.length }
}

export async function deleteRef(botId: string, refId: number) { await assertBot(botId); const deleted = await db.delete(botRefs).where(scope(botId, refId)).returning({ id: botRefs.id }); if (!deleted.length) throw new Error('Целевая ссылка не найдена'); revalidateBot(botId); return { ok: true as const } }
export async function toggleRef(botId: string, refId: number, enabled: boolean) { await assertBot(botId); const where = scope(botId, refId); const [ref] = await db.select().from(botRefs).where(where).limit(1); if (!ref) throw new Error('Целевая ссылка не найдена'); await db.update(botRefs).set({ status: enabled ? (ref.successCount >= ref.successLimit ? 'exhausted' : 'active') : 'disabled' }).where(where); revalidateBot(botId); return { ok: true as const } }
export async function updateRefLimit(botId: string, refId: number, successLimit: number) { await assertBot(botId); const where = scope(botId, refId); const [ref] = await db.select().from(botRefs).where(where).limit(1); if (!ref) throw new Error('Целевая ссылка не найдена'); const limit = normalizeSuccessLimit(successLimit); await db.update(botRefs).set({ successLimit: limit, status: ref.status === 'disabled' ? 'disabled' : ref.successCount >= limit ? 'exhausted' : 'active' }).where(where); revalidateBot(botId); return { ok: true as const } }
export async function resetRefCounters(botId: string, refId: number) { await assertBot(botId); const where = scope(botId, refId); const [ref] = await db.select().from(botRefs).where(where).limit(1); if (!ref) throw new Error('Целевая ссылка не найдена'); await db.update(botRefs).set({ successCount: 0, failedCount: 0, lastUsedAt: null, status: ref.status === 'disabled' ? 'disabled' : 'active' }).where(where); revalidateBot(botId); return { ok: true as const } }
