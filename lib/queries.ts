import "server-only"

import { db } from "@/lib/db"
import { botRefs, bots, logSteps, runs, templates } from "@/lib/db/schema"
import { asc, desc, eq, inArray } from "drizzle-orm"
import type {
  Bot,
  BotStatus,
  DailyStat,
  DashboardStats,
  LogStep,
  RecentRun,
  RefStatus,
  Run,
  RunStatus,
  ScenarioStep,
  StepStatus,
  TemplateField,
  TemplateInfo,
} from "@/lib/mock-data"

function iso(d: Date | null): string | null {
  return d ? new Date(d).toISOString() : null
}

function stepStatusFromLevel(level: string): StepStatus {
  if (level === "error") return "failed"
  if (level === "running") return "running"
  return "success"
}

function toTemplateInfo(row: typeof templates.$inferSelect): TemplateInfo {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    engine: row.engine,
    flowType: row.flowType,
    fields: (row.fields as TemplateField[]) ?? [],
    scenarioSteps: (row.scenarioSteps as ScenarioStep[]) ?? [],
  }
}

export async function getTemplates(): Promise<TemplateInfo[]> {
  const rows = await db.select().from(templates).orderBy(asc(templates.name))
  return rows.map(toTemplateInfo)
}

// Собирает полную view-модель ботов с агрегатами по прогонам и реф-пулом.
export async function getBots(): Promise<Bot[]> {
  const [botRows, tplRows, refRows, runRows] = await Promise.all([
    db.select().from(bots).orderBy(desc(bots.createdAt)),
    db.select().from(templates),
    db.select().from(botRefs).orderBy(asc(botRefs.id)),
    db.select().from(runs),
  ])

  const tplById = new Map(tplRows.map((t) => [t.id, t]))

  return botRows.map((b) => {
    const tpl = tplById.get(b.templateId)
    const botRunRows = runRows.filter((r) => r.botId === b.id)
    const finished = botRunRows.filter((r) => r.status === "success" || r.status === "failed")
    const successful = finished.filter((r) => r.status === "success")
    const successRate = finished.length
      ? Math.round((successful.length / finished.length) * 100)
      : 0
    const avgDurationMs = finished.length
      ? Math.round(finished.reduce((a, r) => a + r.durationMs, 0) / finished.length)
      : 0
    const lastRunAt = botRunRows.reduce<Date | null>((latest, r) => {
      const started = r.startedAt ?? r.createdAt
      if (!started) return latest
      if (!latest || started > latest) return started
      return latest
    }, null)

    const refs = refRows
      .filter((r) => r.botId === b.id)
      .map((r) => ({
        id: String(r.id),
        url: r.url,
        successLimit: r.successLimit,
        successCount: r.successCount,
        failedCount: r.failedCount,
        status: r.status as RefStatus,
        lastUsedAt: iso(r.lastUsedAt),
      }))

    return {
      id: b.id,
      name: b.name,
      description: tpl?.description ?? "",
      targetUrl: b.targetUrl,
      status: b.status as BotStatus,
      template: tpl?.name ?? "—",
      templateSlug: tpl?.slug ?? "",
      flowType: tpl?.flowType ?? "otp",
      totalRuns: botRunRows.length,
      successRate,
      lastRunAt: iso(lastRunAt),
      avgDurationMs,
      workers: b.workers,
      refs,
      scenarioSteps: (tpl?.scenarioSteps as ScenarioStep[]) ?? [],
      config: (b.config as Record<string, unknown>) ?? {},
    }
  })
}

export async function getBot(id: string): Promise<Bot | null> {
  const all = await getBots()
  return all.find((b) => b.id === id) ?? null
}

export async function getRunsForBot(botId: string): Promise<Run[]> {
  const runRows = await db
    .select()
    .from(runs)
    .where(eq(runs.botId, botId))
    .orderBy(desc(runs.createdAt))

  if (runRows.length === 0) return []

  const runIds = runRows.map((r) => r.id)
  const stepRows = await db
    .select()
    .from(logSteps)
    .where(inArray(logSteps.runId, runIds))
    .orderBy(asc(logSteps.ts))

  const stepsByRun = new Map<string, LogStep[]>()
  for (const s of stepRows) {
    const list = stepsByRun.get(s.runId) ?? []
    list.push({
      id: String(s.id),
      label: s.message,
      detail: s.level === "error" ? s.message : undefined,
      status: stepStatusFromLevel(s.level),
      durationMs: s.durationMs,
    })
    stepsByRun.set(s.runId, list)
  }

  return runRows.map((r) => {
    const steps = stepsByRun.get(r.id) ?? []
    return {
      id: r.id,
      botId: r.botId,
      status: r.status as RunStatus,
      startedAt: iso(r.startedAt ?? r.createdAt),
      durationMs: r.durationMs,
      stepsTotal: steps.length,
      stepsPassed: steps.filter((s) => s.status === "success").length,
      targetUrl: "",
      steps,
    }
  })
}

export async function getRecentRuns(limit = 8): Promise<RecentRun[]> {
  const [runRows, botRows] = await Promise.all([
    db.select().from(runs).orderBy(desc(runs.createdAt)).limit(limit),
    db.select().from(bots),
  ])
  const nameById = new Map(botRows.map((b) => [b.id, b.name]))
  return runRows.map((r) => ({
    id: r.id,
    botId: r.botId,
    botName: nameById.get(r.botId) ?? "—",
    status: r.status as RunStatus,
    startedAt: iso(r.startedAt ?? r.createdAt),
    durationMs: r.durationMs,
  }))
}

export async function getDailyStats(): Promise<DailyStat[]> {
  const runRows = await db.select().from(runs)
  const days: DailyStat[] = []
  const now = new Date()

  for (let i = 13; i >= 0; i--) {
    const day = new Date(now)
    day.setDate(now.getDate() - i)
    const key = day.toISOString().slice(0, 10)
    const label = day.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })

    let success = 0
    let failed = 0
    for (const r of runRows) {
      const started = r.startedAt ?? r.createdAt
      if (!started) continue
      if (new Date(started).toISOString().slice(0, 10) !== key) continue
      if (r.status === "success") success++
      else if (r.status === "failed") failed++
    }
    days.push({ date: label, success, failed })
  }
  return days
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const daily = await getDailyStats()
  const totalSuccess = daily.reduce((a, d) => a + d.success, 0)
  const totalFailed = daily.reduce((a, d) => a + d.failed, 0)
  const totalRuns = totalSuccess + totalFailed
  return {
    totalRuns,
    successRate: totalRuns ? Math.round((totalSuccess / totalRuns) * 100) : 0,
    totalErrors: totalFailed,
    hoursSaved: Math.round((totalSuccess * 3) / 60),
  }
}
