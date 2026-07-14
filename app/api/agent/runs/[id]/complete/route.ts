import { randomUUID } from "node:crypto"

import { db } from "@/lib/db"
import { botRefs, bots, notificationDeliveries, notifications, runAttempts, runs, user, workspaces } from "@/lib/db/schema"
import { isLeaseError, requireActiveLease } from "@/lib/run-leases"
import { authenticateAgent, unauthorized } from "@/lib/agent-auth"
import { and, eq, sql } from "drizzle-orm"

export const dynamic = "force-dynamic"

interface CompleteBody {
  status?: "success" | "failed" | "cancelled"
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
  const run = await requireActiveLease(req, runId, agent)
  if (isLeaseError(run)) return run
  if (run.status !== "running") {
    return Response.json({ error: "Прогон уже завершён" }, { status: 409 })
  }

  const body = (await req.json().catch(() => ({}))) as CompleteBody
  const status = run.cancelRequestedAt
    ? "cancelled"
    : body.status === "success"
      ? "success"
      : body.status === "cancelled"
        ? "cancelled"
        : "failed"
  const successCount = Math.max(0, Math.trunc(body.successCount ?? (status === "success" ? 1 : 0)))
  const failedCount = Math.max(0, Math.trunc(body.failedCount ?? (status === "failed" ? 1 : 0)))

  await db
    .update(runs)
    .set({
      status,
      successCount,
      failedCount,
      durationMs: body.durationMs ?? 0,
      error: body.error?.slice(0, 2000) ?? null,
      failureKind: status === "failed" ? "business" : null,
      failureCode: status === "failed" ? "SCENARIO_FAILED" : null,
      finishedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      leaseOwnerAgentId: null,
      leaseTokenHash: null,
      leaseExpiresAt: null,
    })
    .where(and(eq(runs.id, runId), eq(runs.workspaceId, agent.workspaceId), eq(runs.leaseTokenHash, run.leaseTokenHash!)))

  await db.update(runAttempts).set({ finishedAt: new Date(), outcome: status, failureKind: status === "failed" ? "business" : null, failureCode: status === "failed" ? "SCENARIO_FAILED" : null }).where(and(eq(runAttempts.runId, runId), eq(runAttempts.attempt, run.attempt), eq(runAttempts.workspaceId, agent.workspaceId)))

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
      .where(and(eq(botRefs.id, body.refId), eq(botRefs.workspaceId, agent.workspaceId), eq(botRefs.botId, run.botId)))
  }

  // Возвращаем бота в состояние покоя.
  await db
    .update(bots)
    .set({ status: "idle", updatedAt: new Date() })
    .where(and(eq(bots.id, run.botId), eq(bots.workspaceId, agent.workspaceId)))

  if (status === "failed" && run.scheduleId) {
    const [owner] = await db
      .select({ userId: workspaces.ownerUserId, email: user.email, botName: bots.name })
      .from(workspaces)
      .innerJoin(user, eq(user.id, workspaces.ownerUserId))
      .innerJoin(bots, and(eq(bots.id, run.botId), eq(bots.workspaceId, workspaces.id)))
      .where(eq(workspaces.id, agent.workspaceId))
      .limit(1)
    if (owner) {
      const notificationId = `ntf_${randomUUID().replaceAll('-', '')}`
      const safeError = (body.error ?? 'Прогон завершился с ошибкой').slice(0, 500)
      await db.transaction(async (tx) => {
        await tx.insert(notifications).values({ id: notificationId, workspaceId: agent.workspaceId, userId: owner.userId, runId, scheduleId: run.scheduleId, kind: 'scheduled_run_failed', title: `Ошибка: ${owner.botName}`, message: safeError })
        await tx.insert(notificationDeliveries).values({ id: `ndl_${randomUUID().replaceAll('-', '')}`, workspaceId: agent.workspaceId, notificationId, recipient: owner.email })
      })
    }
  }

  return Response.json({ ok: true })
}
