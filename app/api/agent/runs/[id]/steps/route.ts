import { db } from "@/lib/db"
import { logSteps } from "@/lib/db/schema"
import { authenticateAgent, unauthorized } from "@/lib/agent-auth"
import { isLeaseError, requireActiveLease } from "@/lib/run-leases"

export const dynamic = "force-dynamic"

interface IncomingStep {
  worker?: number
  level?: string
  step?: string
  message?: string
  durationMs?: number
  attempt?: number
  metadata?: Record<string, unknown>
}

/**
 * Агент стримит сюда шаги прогона в реальном времени.
 * Принимает как один шаг, так и массив шагов { steps: [...] }.
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
    return Response.json({ error: "Терминальный прогон нельзя изменять" }, { status: 409 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    steps?: IncomingStep[]
  } & IncomingStep

  const incoming: IncomingStep[] = Array.isArray(body.steps)
    ? body.steps
    : [body]

  const allowedLevels = new Set(["info", "running", "success", "warn", "error"])
  const rows = incoming
    .slice(0, 100)
    .filter((s) => s && (s.step || s.message))
    .map((s) => ({
      workspaceId: agent.workspaceId,
      runId,
      runAttempt: run.attempt,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      worker: Math.max(0, Math.min(100, Math.trunc(Number(s.worker) || 0))),
      level: allowedLevels.has(s.level ?? "") ? s.level! : "info",
      step: String(s.step ?? "").slice(0, 120),
      message: String(s.message ?? "").slice(0, 2000),
      durationMs: Math.max(0, Math.min(3_600_000, Math.trunc(Number(s.durationMs) || 0))),
      attempt: Math.max(1, Math.min(5, Math.trunc(Number(s.attempt) || 1))),
      metadata:
        s.metadata && typeof s.metadata === "object" && !Array.isArray(s.metadata)
          ? s.metadata
          : {},
    }))

  if (rows.length > 0) {
    await db.insert(logSteps).values(rows)
  }

  return Response.json({ ok: true, inserted: rows.length })
}
