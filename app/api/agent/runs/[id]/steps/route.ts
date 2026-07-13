import { db } from "@/lib/db"
import { logSteps, runs } from "@/lib/db/schema"
import { authenticateAgent, unauthorized } from "@/lib/agent-auth"
import { eq } from "drizzle-orm"

export const dynamic = "force-dynamic"

interface IncomingStep {
  worker?: number
  level?: string
  step?: string
  message?: string
  durationMs?: number
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

  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  if (!run) {
    return Response.json({ error: "Прогон не найден" }, { status: 404 })
  }
  if (run.agentId && run.agentId !== agent.id) {
    return Response.json({ error: "Прогон принадлежит другому агенту" }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    steps?: IncomingStep[]
  } & IncomingStep

  const incoming: IncomingStep[] = Array.isArray(body.steps)
    ? body.steps
    : [body]

  const rows = incoming
    .filter((s) => s && (s.step || s.message))
    .map((s) => ({
      runId,
      worker: s.worker ?? 0,
      level: s.level ?? "info",
      step: s.step ?? "",
      message: s.message ?? "",
      durationMs: s.durationMs ?? 0,
    }))

  if (rows.length > 0) {
    await db.insert(logSteps).values(rows)
  }

  return Response.json({ ok: true, inserted: rows.length })
}
