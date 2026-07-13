import { db } from "@/lib/db"
import { botRefs, bots, runs, templates } from "@/lib/db/schema"
import { authenticateAgent, unauthorized } from "@/lib/agent-auth"
import { and, asc, eq, sql } from "drizzle-orm"

export const dynamic = "force-dynamic"

/**
 * Агент опрашивает этот эндпоинт: "есть ли для меня задание?"
 * Атомарно захватывает один run в статусе 'queued', переводит в 'running'
 * и возвращает полный пакет для запуска: шаблон, конфиг бота и активный реф.
 */
export async function GET(req: Request) {
  const agent = await authenticateAgent(req)
  if (!agent) return unauthorized()

  // Атомарный захват одного queued-прогона именно этим агентом.
  const claimed = await db.execute(sql`
    UPDATE runs
    SET status = 'running',
        agent_id = ${agent.id},
        started_at = now()
    WHERE id = (
      SELECT id FROM runs
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, bot_id
  `)

  const row = (claimed.rows?.[0] ?? null) as { id: string; bot_id: string } | null
  if (!row) {
    return Response.json({ job: null })
  }

  const [botRow] = await db.select().from(bots).where(eq(bots.id, row.bot_id)).limit(1)
  const [tplRow] = botRow
    ? await db.select().from(templates).where(eq(templates.id, botRow.templateId)).limit(1)
    : []

  // Берём активный реф с наименьшим прогрессом (round-robin по нагрузке).
  const [refRow] = await db
    .select()
    .from(botRefs)
    .where(and(eq(botRefs.botId, row.bot_id), eq(botRefs.status, "active")))
    .orderBy(asc(botRefs.successCount))
    .limit(1)

  return Response.json({
    job: {
      runId: row.id,
      bot: botRow
        ? {
            id: botRow.id,
            name: botRow.name,
            targetUrl: botRow.targetUrl,
            workers: botRow.workers,
            config: botRow.config,
          }
        : null,
      template: tplRow
        ? {
            slug: tplRow.slug,
            engine: tplRow.engine,
            flowType: tplRow.flowType,
            fields: tplRow.fields,
            defaultConfig: tplRow.defaultConfig,
            scenarioSteps: tplRow.scenarioSteps,
          }
        : null,
      ref: refRow
        ? {
            id: refRow.id,
            url: refRow.url,
            successLimit: refRow.successLimit,
            successCount: refRow.successCount,
          }
        : null,
    },
  })
}
