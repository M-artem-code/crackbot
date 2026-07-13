import "server-only"

import { db } from "@/lib/db"
import { agents } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export interface AuthedAgent {
  id: string
  name: string
}

/**
 * Достаёт API-ключ из заголовка Authorization: Bearer <key> (или X-Api-Key),
 * проверяет его в таблице agents и обновляет heartbeat (last_seen_at).
 * Онлайн-статус вычисляется по last_seen_at, а колонка status хранит только
 * признак «disabled». Отключённые агенты не аутентифицируются.
 * Возвращает агента или null, если ключ невалиден или агент отключён.
 */
export async function authenticateAgent(req: Request): Promise<AuthedAgent | null> {
  const header = req.headers.get("authorization") ?? ""
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : null
  const apiKey = bearer ?? req.headers.get("x-api-key")?.trim() ?? null
  if (!apiKey) return null

  const rows = await db
    .select()
    .from(agents)
    .where(eq(agents.apiKey, apiKey))
    .limit(1)
  if (rows.length === 0) return null

  const agent = rows[0]
  if (agent.status === "disabled") return null

  await db
    .update(agents)
    .set({ lastSeenAt: new Date() })
    .where(eq(agents.id, agent.id))

  return { id: agent.id, name: agent.name }
}

export function unauthorized(): Response {
  return Response.json({ error: "Неверный или отсутствующий API-ключ" }, { status: 401 })
}
