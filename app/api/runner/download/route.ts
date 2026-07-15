import { createHash } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { agentPairingTokens, workspaces } from '@/lib/db/schema'

export const runtime = 'nodejs'

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const body = await request.json().catch(() => null) as { pairingToken?: unknown } | null
  const token = typeof body?.pairingToken === 'string' ? body.pairingToken : ''
  if (!/^pair_[A-Za-z0-9_-]{40,60}$/.test(token)) return Response.json({ error: 'INVALID_PAIRING' }, { status: 400 })

  const [workspace] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.ownerUserId, session.user.id)).limit(1)
  if (!workspace) return Response.json({ error: 'WORKSPACE_NOT_FOUND' }, { status: 404 })
  const [pairing] = await db.select({ id: agentPairingTokens.id }).from(agentPairingTokens).where(and(
    eq(agentPairingTokens.workspaceId, workspace.id),
    eq(agentPairingTokens.tokenHash, digest(token)),
    isNull(agentPairingTokens.usedAt),
    gt(agentPairingTokens.expiresAt, new Date()),
  )).limit(1)
  if (!pairing) return Response.json({ error: 'PAIRING_EXPIRED' }, { status: 410 })

  const defaultInstallerUrl = 'https://github.com/M-artem-code/crackbot/releases/download/runner-v0.1.0-beta.6/BotForgeRunner-Setup.exe'
  const installerUrl = process.env.RUNNER_INSTALLER_URL?.startsWith('https://')
    ? process.env.RUNNER_INSTALLER_URL
    : defaultInstallerUrl
  return Response.json(
    { downloadUrl: installerUrl },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  )
}
