import { db } from "@/lib/db"
import { agents } from "@/lib/db/schema"
import { authenticateAgent, unauthorized } from "@/lib/agent-auth"
import { and, eq } from "drizzle-orm"

export const dynamic = "force-dynamic"

/**
 * Периодический heartbeat агента. authenticateAgent уже обновляет last_seen_at,
 * здесь дополнительно принимаем метаданные (ОС), чтобы показать их в UI.
 */
export async function POST(req: Request) {
  const agent = await authenticateAgent(req)
  if (!agent) return unauthorized()

  let os: string | null = null
  let protocolVersion = agent.protocolVersion
  let capabilities: string[] = []
  try {
    const body = (await req.json()) as { os?: unknown; protocolVersion?: unknown; capabilities?: unknown }
    if (typeof body?.os === "string" && body.os.trim()) os = body.os.trim().slice(0, 120)
    if (Number.isInteger(body.protocolVersion)) protocolVersion = Math.max(1, Math.min(100, Number(body.protocolVersion)))
    if (Array.isArray(body.capabilities)) capabilities = body.capabilities.filter((item): item is string => typeof item === "string").slice(0, 30)
  } catch {
    // тело необязательно
  }

  await db.update(agents).set({ ...(os ? { os } : {}), protocolVersion, capabilities, status: "online" }).where(and(eq(agents.id, agent.id), eq(agents.workspaceId, agent.workspaceId)))

  return Response.json({ ok: true, agentId: agent.id })
}
