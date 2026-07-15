import "server-only"

import { db } from "@/lib/db"
import { botRefs, bots, logSteps, pythonVersions, pythonWorkspaces, runs, scenarioVersions, templates } from "@/lib/db/schema"
import { asc, desc, eq, inArray } from "drizzle-orm"
import { assertScenarioDefinition, type ScenarioDefinition } from "@/lib/scenario/schema"
import {
  type Bot,
  type BotStatus,
  type DailyStat,
  type DashboardStats,
  type LogStep,
  type RecentRun,
  type RefStatus,
  type Run,
  type RunStatus,
  type ScenarioStep,
  type StepStatus,
  type TemplateField,
  type TemplateInfo,
} from "@/lib/mock-data"

function iso(d: Date | null): string | null { return d ? new Date(d).toISOString() : null }
function stepStatusFromLevel(level: string): StepStatus { return level === "error" ? "failed" : level === "running" ? "running" : "success" }
function toTemplateInfo(row: typeof templates.$inferSelect): TemplateInfo {
  return { id: row.id, slug: row.slug, name: row.name, description: row.description, engine: row.engine, flowType: row.flowType, fields: (row.fields as TemplateField[]) ?? [], scenarioSteps: (row.scenarioSteps as ScenarioStep[]) ?? [] }
}

export async function getTemplates(): Promise<TemplateInfo[]> {
  return (await db.select().from(templates).orderBy(asc(templates.name))).map(toTemplateInfo)
}

export async function getBots(): Promise<Bot[]> {
  const [botRows, tplRows, refRows, runRows, versionRows, pythonRows, pythonVersionRows] = await Promise.all([
    db.select().from(bots).orderBy(desc(bots.createdAt)),
    db.select().from(templates),
    db.select().from(botRefs).orderBy(asc(botRefs.position), asc(botRefs.id)),
    db.select().from(runs),
    db.select().from(scenarioVersions).orderBy(desc(scenarioVersions.version)),
    db.select().from(pythonWorkspaces),
    db.select().from(pythonVersions).orderBy(desc(pythonVersions.version)),
  ])
  const groupByBotId = <T extends { botId: string }>(rows: T[]) => {
    const grouped = new Map<string, T[]>()
    for (const row of rows) {
      const group = grouped.get(row.botId)
      if (group) group.push(row)
      else grouped.set(row.botId, [row])
    }
    return grouped
  }
  const tplById = new Map(tplRows.map((t) => [t.id, t]))
  const runsByBot = groupByBotId(runRows)
  const refsByBot = groupByBotId(refRows)
  const versionsByBot = groupByBotId(versionRows)
  const pythonByBot = new Map(pythonRows.map((row) => [row.botId, row]))
  const pythonVersionsByBot = groupByBotId(pythonVersionRows)
  return botRows.map((b) => {
    const tpl = tplById.get(b.templateId)
    const botRuns = runsByBot.get(b.id) ?? []
    const finished = botRuns.filter((r) => r.status === "success" || r.status === "failed")
    const success = finished.filter((r) => r.status === "success")
    const lastRunAt = botRuns.reduce<Date | null>((latest, r) => { const started = r.startedAt ?? r.createdAt; return started && (!latest || started > latest) ? started : latest }, null)
    return {
      id: b.id, name: b.name, description: tpl?.description ?? "", targetUrl: b.targetUrl, status: b.status as BotStatus,
      template: tpl?.name ?? "—", templateSlug: tpl?.slug ?? "", flowType: tpl?.flowType ?? "otp", totalRuns: botRuns.length,
      successRate: finished.length ? Math.round((success.length / finished.length) * 100) : 0, lastRunAt: iso(lastRunAt),
      avgDurationMs: finished.length ? Math.round(finished.reduce((a, r) => a + r.durationMs, 0) / finished.length) : 0, workers: b.workers,
      refs: (refsByBot.get(b.id) ?? []).map((r) => ({ id: String(r.id), url: r.url, successLimit: r.successLimit, successCount: r.successCount, failedCount: r.failedCount, status: r.status as RefStatus, lastUsedAt: iso(r.lastUsedAt) })),
      scenarioSteps: (tpl?.scenarioSteps as ScenarioStep[]) ?? [], scenarioDraft: b.scenarioDraft ? assertScenarioDefinition(b.scenarioDraft) : null,
      scenarioPublished: assertScenarioDefinition(b.scenarioPublished ?? tpl?.scenarioDefinition) as ScenarioDefinition,
      scenarioStatus: b.scenarioStatus as "draft" | "published", publishedScenarioVersionId: b.publishedScenarioVersionId,
      scenarioVersions: (versionsByBot.get(b.id) ?? []).map((v) => ({ id: v.id, version: v.version, snapshot: assertScenarioDefinition(v.snapshot), author: v.author, changeSummary: v.changeSummary, sourceVersionId: v.sourceVersionId, createdAt: iso(v.createdAt) ?? "", isCurrent: v.id === b.publishedScenarioVersionId })),
      pythonWorkspace: (() => { const row = pythonByBot.get(b.id); return row ? { draftCode: row.draftCode, draftRequirements: row.draftRequirements, publishedCode: row.publishedCode, publishedRequirements: row.publishedRequirements, status: row.status as 'draft' | 'published', lastTestStatus: row.lastTestStatus, lastTestOutput: row.lastTestOutput, lastTestedAt: iso(row.lastTestedAt), versions: (pythonVersionsByBot.get(b.id) ?? []).map((v) => ({ id: v.id, version: v.version, changeSummary: v.changeSummary, createdAt: iso(v.createdAt) ?? '', isCurrent: v.id === row.publishedVersionId })) } : null })(),
      config: (() => { const stored = (b.config as Record<string, unknown>) ?? {}; const { proxySecret, passwordSecret, proxy, password, ...safe } = stored; return { ...safe, proxyConfigured: Boolean(proxySecret || proxy), passwordConfigured: Boolean(passwordSecret || password) } })(),
    }
  })
}

export async function getBot(id: string) { return (await getBots()).find((b) => b.id === id) ?? null }

export async function getRunsForBot(botId: string): Promise<Run[]> {
  const runRows = await db.select().from(runs).where(eq(runs.botId, botId)).orderBy(desc(runs.createdAt))
  if (!runRows.length) return []
  const ids = runRows.map((r) => r.id)
  const stepRows = await db.select().from(logSteps).where(inArray(logSteps.runId, ids)).orderBy(asc(logSteps.ts))
  return runRows.map((r) => {
    const steps: LogStep[] = stepRows.filter((s) => s.runId === r.id).map((s) => ({ id: String(s.id), label: s.message, detail: s.level === "error" ? s.message : undefined, status: stepStatusFromLevel(s.level), durationMs: s.durationMs, stepId: s.step, attempt: s.attempt, metadata: (s.metadata as Record<string, unknown>) ?? {} }))
    const snap = typeof r.scenarioSnapshot === "object" && r.scenarioSnapshot ? r.scenarioSnapshot as Record<string, unknown> : {}
    return { id: r.id, botId: r.botId, status: r.status as RunStatus, startedAt: iso(r.startedAt ?? r.createdAt), durationMs: r.durationMs, stepsTotal: steps.length, stepsPassed: steps.filter((s) => s.status === "success").length, targetUrl: "", steps, error: r.error, successCount: r.successCount, failedCount: r.failedCount, agentId: null, scenarioName: String(snap.name ?? "Scenario"), scenarioVersion: Number(snap.version ?? 1), scenarioVersionId: r.scenarioVersionId, artifacts: [] }
  })
}

export async function getRunDetail(runId: string) {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  if (!run) return null
  return (await getRunsForBot(run.botId)).find((item) => item.id === runId) ?? null
}

export async function getRecentRuns(limit = 8): Promise<RecentRun[]> {
  const [runRows, botRows] = await Promise.all([db.select().from(runs).orderBy(desc(runs.createdAt)).limit(limit), db.select().from(bots)])
  const names = new Map(botRows.map((b) => [b.id, b.name]))
  return runRows.map((r) => ({ id: r.id, botId: r.botId, botName: names.get(r.botId) ?? "—", status: r.status as RunStatus, startedAt: iso(r.startedAt ?? r.createdAt), durationMs: r.durationMs }))
}

export async function getDailyStats(): Promise<DailyStat[]> {
  const rows = await db.select().from(runs)
  return Array.from({ length: 14 }, (_, index) => {
    const day = new Date(); day.setDate(day.getDate() - (13 - index)); const key = day.toISOString().slice(0, 10)
    const same = rows.filter((r) => new Date(r.startedAt ?? r.createdAt).toISOString().slice(0, 10) === key)
    return { date: day.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }), success: same.filter((r) => r.status === "success").length, failed: same.filter((r) => r.status === "failed").length }
  })
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const daily = await getDailyStats(); const ok = daily.reduce((a, d) => a + d.success, 0); const failed = daily.reduce((a, d) => a + d.failed, 0); const total = ok + failed
  return { totalRuns: total, successRate: total ? Math.round((ok / total) * 100) : 0, totalErrors: failed, hoursSaved: Math.round((ok * 3) / 60) }
}
