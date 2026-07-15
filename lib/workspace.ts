import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { agents, botRefs, bots, logSteps, runArtifacts, runs, workspaces } from '@/lib/db/schema'

export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user ?? null
}

export async function requireUser() {
  const user = await getSessionUser()
  if (!user) redirect('/sign-in')
  return user
}

export async function requireWorkspace() {
  const user = await requireUser()
  const workspace = await ensurePersonalWorkspace(user.id, user.name)
  return { user, workspace }
}

export async function ensurePersonalWorkspace(userId: string, userName?: string | null) {
  const [existing] = await db.select().from(workspaces).where(eq(workspaces.ownerUserId, userId)).limit(1)
  if (existing) return existing

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(71824001)`)
    const [afterLock] = await tx.select().from(workspaces).where(eq(workspaces.ownerUserId, userId)).limit(1)
    if (afterLock) return afterLock

    const [claimed] = await tx.select({ id: workspaces.id }).from(workspaces).where(isNotNull(workspaces.legacyClaimedAt)).limit(1)
    const workspaceId = `ws_${randomUUID().replaceAll('-', '')}`
    const shouldClaimLegacy = !claimed
    const [workspace] = await tx.insert(workspaces).values({
      id: workspaceId,
      ownerUserId: userId,
      name: userName?.trim() ? `${userName.trim()} workspace` : 'Личный workspace',
      legacyClaimedAt: shouldClaimLegacy ? new Date() : null,
    }).returning()

    if (shouldClaimLegacy) {
      await tx.update(bots).set({ workspaceId }).where(isNull(bots.workspaceId))
      await tx.update(botRefs).set({ workspaceId }).where(isNull(botRefs.workspaceId))
      await tx.update(runs).set({ workspaceId }).where(isNull(runs.workspaceId))
      await tx.update(logSteps).set({ workspaceId }).where(isNull(logSteps.workspaceId))
      await tx.update(runArtifacts).set({ workspaceId }).where(isNull(runArtifacts.workspaceId))
      await tx.update(agents).set({ workspaceId }).where(isNull(agents.workspaceId))
    }
    return workspace
  })
}

export async function ownsBot(workspaceId: string, botId: string) {
  const [bot] = await db.select({ id: bots.id }).from(bots).where(and(eq(bots.id, botId), eq(bots.workspaceId, workspaceId))).limit(1)
  return Boolean(bot)
}
