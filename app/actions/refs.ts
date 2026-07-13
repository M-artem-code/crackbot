"use server"

import { db } from "@/lib/db"
import { botRefs, bots } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// Реф-пул полностью на сервере: сервер выдаёт активные рефы агенту в задании
// и обновляет счётчики в /complete. Эти экшены управляют пулом из дашборда.

async function assertBot(botId: string) {
  const [bot] = await db.select().from(bots).where(eq(bots.id, botId)).limit(1)
  if (!bot) throw new Error("Бот не найден")
  return bot
}

function revalidateBot(botId: string) {
  revalidatePath("/bots")
  revalidatePath(`/bots/${botId}`)
  revalidatePath("/")
}

function normalizeUrl(raw: string): string {
  let url = raw.trim()
  if (!url) return ""
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  return url
}

export async function addRef(
  botId: string,
  url: string,
  successLimit: number,
): Promise<{ ok: true }> {
  await assertBot(botId)
  const normalized = normalizeUrl(url)
  if (!normalized) throw new Error("Укажите реф-ссылку")
  const limit = Math.min(10000, Math.max(1, Math.round(successLimit || 10)))

  await db.insert(botRefs).values({
    botId,
    url: normalized,
    successLimit: limit,
    status: "active",
  })
  revalidateBot(botId)
  return { ok: true }
}

// Массовый импорт: по одной ссылке в строке, опционально «url,лимит» через запятую/таб/;.
export async function importRefs(
  botId: string,
  text: string,
  defaultLimit: number,
): Promise<{ ok: true; added: number }> {
  await assertBot(botId)
  const fallback = Math.min(10000, Math.max(1, Math.round(defaultLimit || 10)))

  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawUrl, rawLimit] = line.split(/[,;\t]/).map((p) => p?.trim())
      const url = normalizeUrl(rawUrl ?? "")
      const parsed = Number.parseInt(rawLimit ?? "", 10)
      const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(10000, parsed) : fallback
      return url ? { botId, url, successLimit: limit, status: "active" as const } : null
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (rows.length === 0) throw new Error("Не найдено ни одной ссылки")

  await db.insert(botRefs).values(rows)
  revalidateBot(botId)
  return { ok: true, added: rows.length }
}

export async function deleteRef(botId: string, refId: number): Promise<{ ok: true }> {
  await db.delete(botRefs).where(and(eq(botRefs.id, refId), eq(botRefs.botId, botId)))
  revalidateBot(botId)
  return { ok: true }
}

// Включение/выключение рефа. Выключенный (disabled) не выдаётся агенту.
export async function toggleRef(
  botId: string,
  refId: number,
  enabled: boolean,
): Promise<{ ok: true }> {
  const [ref] = await db
    .select()
    .from(botRefs)
    .where(and(eq(botRefs.id, refId), eq(botRefs.botId, botId)))
    .limit(1)
  if (!ref) throw new Error("Реф не найден")

  let status: string
  if (enabled) {
    // При включении возвращаем в active, но уважаем достигнутый лимит.
    status = ref.successCount >= ref.successLimit ? "exhausted" : "active"
  } else {
    status = "disabled"
  }

  await db.update(botRefs).set({ status }).where(eq(botRefs.id, refId))
  revalidateBot(botId)
  return { ok: true }
}

export async function updateRefLimit(
  botId: string,
  refId: number,
  successLimit: number,
): Promise<{ ok: true }> {
  const limit = Math.min(10000, Math.max(1, Math.round(successLimit || 1)))
  const [ref] = await db
    .select()
    .from(botRefs)
    .where(and(eq(botRefs.id, refId), eq(botRefs.botId, botId)))
    .limit(1)
  if (!ref) throw new Error("Реф не найден")

  // Пересчитываем статус относительно нового лимита (кроме отключённых вручную).
  let status = ref.status
  if (ref.status !== "disabled") {
    status = ref.successCount >= limit ? "exhausted" : "active"
  }

  await db
    .update(botRefs)
    .set({ successLimit: limit, status })
    .where(eq(botRefs.id, refId))
  revalidateBot(botId)
  return { ok: true }
}

// Сброс счётчиков: обнуляет успехи/ошибки и делает реф снова активным.
export async function resetRefCounters(
  botId: string,
  refId: number,
): Promise<{ ok: true }> {
  const [ref] = await db
    .select()
    .from(botRefs)
    .where(and(eq(botRefs.id, refId), eq(botRefs.botId, botId)))
    .limit(1)
  if (!ref) throw new Error("Реф не найден")

  await db
    .update(botRefs)
    .set({
      successCount: 0,
      failedCount: 0,
      lastUsedAt: null,
      status: ref.status === "disabled" ? "disabled" : "active",
    })
    .where(eq(botRefs.id, refId))
  revalidateBot(botId)
  return { ok: true }
}
