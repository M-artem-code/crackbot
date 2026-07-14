import "server-only"

import { db } from "@/lib/db"
import { agents, botRefs, bots, logSteps, runArtifacts, runs, scenarioVersions, templates } from "@/lib/db/schema"
import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { assertScenarioDefinition, type ScenarioDefinition } from "@/lib/scenario/schema"
import { requireWorkspace } from "@/lib/workspace"
import {
  AGENT_ONLINE_THRESHOLD_MS,
  type AgentInfo,
  type AgentStatus,
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
  await requireWorkspace()
  return (await db.select().from(templates).orderBy(asc(templates.name))).map(toTemplateInfo)
}

export async function getBots(): Promise<Bot[]> {
  const { workspace } = await requireWorkspace()
  const scope = workspace.id
  const [botRows, tplRows, refRows, runRows, versionRows] = await Promise.all([
    db.select().from(bots).where(eq(bots.workspaceId, scope)).orderBy(desc(bots.createdAt)),
    db.select().from(templates),
    db.select().from(botRefs).where(eq(botRefs.workspaceId, scope)).orderBy(asc(botRefs.position), asc(botRefs.id)),
    db.select().from(runs).where(eq(runs.workspaceId, scope)),
    db.select().from(scenarioVersions).where(eq(scenarioVersions.workspaceId, scope)).orderBy(desc(scenarioVersions.version)),
  ])
  const tplById = new Map(tplRows.map((t) => [t.id, t]))
  return botRows.map((b) => {
    const tpl = tplById.get(b.templateId)
    const botRuns = runRows.filter((r) => r.botId === b.id)
    const finished = botRuns.filter((r) => r.status === "success" || r.status === "failed")
    const success = finished.filter((r) => r.status === "success")
    const lastRunAt = botRuns.reduce<Date | null>((latest, r) => { const started = r.startedAt ?? r.createdAt; return started && (!latest || started > latest) ? started : latest }, null)
    return {
      id: b.id, name: b.name, description: tpl?.description ?? "", targetUrl: b.targetUrl, status: b.status as BotStatus,
      template: tpl?.name ?? "—", templateSlug: tpl?.slug ?? "", flowType: tpl?.flowType ?? "otp", totalRuns: botRuns.length,
      successRate: finished.length ? Math.round((success.length / finished.length) * 100) : 0, lastRunAt: iso(lastRunAt),
      avgDurationMs: finished.length ? Math.round(finished.reduce((a, r) => a + r.durationMs, 0) / finished.length) : 0, workers: b.workers,
      refs: refRows.filter((r) => r.botId === b.id).map((r) => ({ id: String(r.id), url: r.url, successLimit: r.successLimit, successCount: r.successCount, failedCount: r.failedCount, status: r.status as RefStatus, lastUsedAt: iso(r.lastUsedAt) })),
      scenarioSteps: (tpl?.scenarioSteps as ScenarioStep[]) ?? [], scenarioDraft: b.scenarioDraft ? assertScenarioDefinition(b.scenarioDraft) : null,
      scenarioPublished: assertScenarioDefinition(b.scenarioPublished ?? tpl?.scenarioDefinition) as ScenarioDefinition,
      scenarioStatus: b.scenarioStatus as "draft" | "published", publishedScenarioVersionId: b.publishedScenarioVersionId,
      scenarioVersions: versionRows.filter((v) => v.botId === b.id).map((v) => ({ id: v.id, version: v.version, snapshot: assertScenarioDefinition(v.snapshot), author: v.author, changeSummary: v.changeSummary, sourceVersionId: v.sourceVersionId, createdAt: iso(v.createdAt) ?? "", isCurrent: v.id === b.publishedScenarioVersionId })),
      config: (b.config as Record<string, unknown>) ?? {},
    }
  })
}

export async function getBot(id: string) { return (await getBots()).find((b) => b.id === id) ?? null }

export async function getRunsForBot(botId: string): Promise<Run[]> {
  const { workspace } = await requireWorkspace()
  const runRows = await db.select().from(runs).where(and(eq(runs.botId, botId), eq(runs.workspaceId, workspace.id))).orderBy(desc(runs.createdAt))
  if (!runRows.length) return []
  const ids = runRows.map((r) => r.id)
  const [stepRows, artifactRows] = await Promise.all([
    db.select().from(logSteps).where(and(inArray(logSteps.runId, ids), eq(logSteps.workspaceId, workspace.id))).orderBy(asc(logSteps.ts)),
    db.select().from(runArtifacts).where(and(inArray(runArtifacts.runId, ids), eq(runArtifacts.workspaceId, workspace.id))).orderBy(asc(runArtifacts.createdAt)),
  ])
  return runRows.map((r) => {
    const steps: LogStep[] = stepRows.filter((s) => s.runId === r.id).map((s) => ({ id: String(s.id), label: s.message, detail: s.level === "error" ? s.message : undefined, status: stepStatusFromLevel(s.level), durationMs: s.durationMs, stepId: s.step, attempt: s.attempt, metadata: (s.metadata as Record<string, unknown>) ?? {} }))
    const snap = typeof r.scenarioSnapshot === "object" && r.scenarioSnapshot ? r.scenarioSnapshot as Record<string, unknown> : {}
    return { id: r.id, botId: r.botId, status: r.status as RunStatus, startedAt: iso(r.startedAt ?? r.createdAt), durationMs: r.durationMs, stepsTotal: steps.length, stepsPassed: steps.filter((s) => s.status === "success").length, targetUrl: "", steps, error: r.error, successCount: r.successCount, failedCount: r.failedCount, agentId: r.agentId, scenarioName: String(snap.name ?? "Scenario"), scenarioVersion: Number(snap.version ?? 1), scenarioVersionId: r.scenarioVersionId, artifacts: artifactRows.filter((a) => a.runId === r.id).map((a) => ({ id: a.id, kind: a.kind as "screenshot" | "dom" | "report", worker: a.worker, stepId: a.stepId, contentType: a.contentType, byteSize: a.byteSize, createdAt: iso(a.createdAt) ?? "", url: `/api/artifacts/${a.id}` })) }
  })
}

export async function getRunDetail(runId: string) {
  const { workspace } = await requireWorkspace()
  const [run] = await db.select().from(runs).where(and(eq(runs.id, runId), eq(runs.workspaceId, workspace.id))).limit(1)
  if (!run) return null
  return (await getRunsForBot(run.botId)).find((item) => item.id === runId) ?? null
}

export async function getRecentRuns(limit = 8): Promise<RecentRun[]> {
  const { workspace } = await requireWorkspace()
  const [runRows, botRows] = await Promise.all([db.select().from(runs).where(eq(runs.workspaceId, workspace.id)).orderBy(desc(runs.createdAt)).limit(limit), db.select().from(bots).where(eq(bots.workspaceId, workspace.id))])
  const names = new Map(botRows.map((b) => [b.id, b.name]))
  return runRows.map((r) => ({ id: r.id, botId: r.botId, botName: names.get(r.botId) ?? "—", status: r.status as RunStatus, startedAt: iso(r.startedAt ?? r.createdAt), durationMs: r.durationMs }))
}

export async function getDailyStats(): Promise<DailyStat[]> {
  const { workspace } = await requireWorkspace()
  const rows = await db.select().from(runs).where(eq(runs.workspaceId, workspace.id))
  return Array.from({ length: 14 }, (_, index) => {
    const day = new Date(); day.setDate(day.getDate() - (13 - index)); const key = day.toISOString().slice(0, 10)
    const same = rows.filter((r) => new Date(r.startedAt ?? r.createdAt).toISOString().slice(0, 10) === key)
    return { date: day.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }), success: same.filter((r) => r.status === "success").length, failed: same.filter((r) => r.status === "failed").length }
  })
}

export async function getAgents(): Promise<AgentInfo[]> {
  const { workspace } = await requireWorkspace()
  const [agentRows, active] = await Promise.all([db.select().from(agents).where(eq(agents.workspaceId, workspace.id)).orderBy(desc(agents.createdAt)), db.select().from(runs).where(and(eq(runs.workspaceId, workspace.id), eq(runs.status, "running")))])
  return agentRows.map((a) => { const disabled = a.status === "disabled"; const seen = a.lastSeenAt?.getTime() ?? 0; const status: AgentStatus = disabled ? "disabled" : seen && Date.now() - seen < AGENT_ONLINE_THRESHOLD_MS ? "online" : "offline"; return { id: a.id, name: a.name, os: a.os, keyPrefix: a.keyPrefix ?? "agt_••••••••", status, disabled, activeRuns: active.filter((r) => r.agentId === a.id).length, lastSeenAt: iso(a.lastSeenAt), createdAt: iso(a.createdAt) } })
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const daily = await getDailyStats(); const ok = daily.reduce((a, d) => a + d.success, 0); const failed = daily.reduce((a, d) => a + d.failed, 0); const total = ok + failed
  return { totalRuns: total, successRate: total ? Math.round((ok / total) * 100) : 0, totalErrors: failed, hoursSaved: Math.round((ok * 3) / 60) }
}
