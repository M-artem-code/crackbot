import { db } from "@/lib/db"
import { botRefs, bots, runs } from "@/lib/db/schema"
import { authenticateAgent, unauthorized } from "@/lib/agent-auth"
import { eq, sql } from "drizzle-orm"

export const dynamic = "force-dynamic"

interface CompleteBody {
  status?: "success" | "failed"
  successCount?: number
  failedCount?: number
  durationMs?: number
  error?: string
  refId?: number
}

/**
 * Агент вызывает по завершении прогона.
 * Пишет финальный статус + счётчики, обновляет реф-пул и статус бота.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(req)
  if (!agent) return unauthorized()

  const { id: runId } = await params
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  if (!run) {
    return Response.json({ error: "Прогон не найден" }, { status: 404 })
  }
  if (run.agentId && run.agentId !== agent.id) {
    return Response.json({ error: "Прогон принадлежит другому агенту" }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as CompleteBody
  const status = body.status === "failed" ? "failed" : "success"
  const successCount = Math.max(0, body.successCount ?? (status === "success" ? 1 : 0))
  const failedCount = Math.max(0, body.failedCount ?? (status === "failed" ? 1 : 0))

  await db
    .update(runs)
    .set({
      status,
      successCount,
      failedCount,
      durationMs: body.durationMs ?? 0,
      error: body.error ?? null,
      finishedAt: new Date(),
    })
    .where(eq(runs.id, runId))

  // Обновляем счётчики реф-ссылки и исчерпываем её при достижении лимита.
  if (body.refId != null && (successCount > 0 || failedCount > 0)) {
    await db
      .update(botRefs)
      .set({
        successCount: sql`${botRefs.successCount} + ${successCount}`,
        failedCount: sql`${botRefs.failedCount} + ${failedCount}`,
        lastUsedAt: new Date(),
        status: sql`CASE WHEN ${botRefs.successCount} + ${successCount} >= ${botRefs.successLimit} THEN 'exhausted' ELSE ${botRefs.status} END`,
      })
      .where(eq(botRefs.id, body.refId))
  }

  // Возвращаем бота в состояние покоя.
  await db
    .update(bots)
    .set({ status: "idle", updatedAt: new Date() })
    .where(eq(bots.id, run.botId))

  return Response.json({ ok: true })
}
