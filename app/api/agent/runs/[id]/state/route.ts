import { and, eq } from "drizzle-orm"

import { authenticateAgent, unauthorized } from "@/lib/agent-auth"
import { db } from "@/lib/db"
import { runs } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(req)
  if (!agent) return unauthorized()

  const { id } = await params
  const [run] = await db
    .select({ status: runs.status, cancelRequestedAt: runs.cancelRequestedAt })
    .from(runs)
    .where(and(eq(runs.id, id), eq(runs.agentId, agent.id), eq(runs.workspaceId, agent.workspaceId)))
    .limit(1)

  if (!run) {
    return Response.json({ error: "Прогон не найден или принадлежит другому агенту" }, { status: 404 })
  }

  return Response.json({
    status: run.status,
    cancelRequested: run.cancelRequestedAt !== null,
  })
}
