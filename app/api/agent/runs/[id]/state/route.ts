import { authenticateAgent, unauthorized } from "@/lib/agent-auth"
import { isLeaseError, requireActiveLease } from "@/lib/run-leases"

export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(req)
  if (!agent) return unauthorized()

  const { id } = await params
  const run = await requireActiveLease(req, id, agent)
  if (isLeaseError(run)) return run

  return Response.json({
    status: run.status,
    cancelRequested: run.cancelRequestedAt !== null,
  })
}
