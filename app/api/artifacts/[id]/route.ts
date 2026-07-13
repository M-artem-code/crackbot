import { get } from '@vercel/blob'
import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { runArtifacts } from '@/lib/db/schema'
import { requireWorkspace } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspace } = await requireWorkspace()
  const { id } = await params
  const [artifact] = await db
    .select()
    .from(runArtifacts)
    .where(and(eq(runArtifacts.id, id), eq(runArtifacts.workspaceId, workspace.id)))
    .limit(1)
  if (!artifact) return Response.json({ error: 'Артефакт не найден' }, { status: 404 })

  const result = await get(artifact.pathname, {
    access: 'private',
    ifNoneMatch: req.headers.get('if-none-match') ?? undefined,
  })
  if (!result) return Response.json({ error: 'Файл не найден' }, { status: 404 })
  if (result.statusCode === 304) {
    return new Response(null, {
      status: 304,
      headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' },
    })
  }

  return new Response(result.stream, {
    headers: {
      'Content-Type': artifact.contentType,
      'Content-Length': String(artifact.byteSize),
      ETag: result.blob.etag,
      'Cache-Control': 'private, no-cache',
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': artifact.kind === 'screenshot' ? 'inline' : `attachment; filename="${artifact.kind}-${artifact.id}"`,
    },
  })
}
