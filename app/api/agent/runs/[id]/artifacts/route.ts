import { put } from '@vercel/blob'
import { authenticateAgent, unauthorized } from '@/lib/agent-auth'
import { db } from '@/lib/db'
import { runArtifacts } from '@/lib/db/schema'
import { isLeaseError, requireActiveLease } from '@/lib/run-leases'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = new Map([
  ['image/png', 'screenshot'],
  ['text/html', 'dom'],
  ['application/json', 'report'],
])
const MAX_BYTES = 10 * 1024 * 1024

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 100)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(req)
  if (!agent) return unauthorized()

  const { id: runId } = await params
  const run = await requireActiveLease(req, runId, agent)
  if (isLeaseError(run)) return run

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'Файл не передан' }, { status: 400 })
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return Response.json({ error: 'Размер файла недопустим' }, { status: 413 })
  }

  const baseType = file.type.split(';')[0].toLowerCase()
  const requestedKind = String(form.get('kind') ?? '')
  const inferredKind = ALLOWED_TYPES.get(baseType)
  if (!inferredKind || requestedKind !== inferredKind) {
    return Response.json({ error: 'Тип артефакта недопустим' }, { status: 415 })
  }

  const artifactId = crypto.randomUUID()
  const worker = Math.max(0, Math.min(100, Math.trunc(Number(form.get('worker')) || 0)))
  const stepId = String(form.get('stepId') ?? '').slice(0, 120) || null
  const filename = safeSegment(file.name || `${requestedKind}.bin`)
  const pathname = `runs/${safeSegment(runId)}/${artifactId}-${filename}`
  const blob = await put(pathname, file, {
    access: 'private',
    addRandomSuffix: false,
    contentType: baseType,
  })

  await db.insert(runArtifacts).values({
    id: artifactId,
    workspaceId: agent.workspaceId,
    runId,
    agentId: agent.id,
    worker,
    stepId,
    kind: requestedKind,
    pathname: blob.pathname,
    contentType: baseType,
    byteSize: file.size,
    redacted: true,
    metadata: {},
    runAttempt: run.attempt,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })

  return Response.json({ id: artifactId, kind: requestedKind })
}
