'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { requireWorkspace } from '@/lib/workspace'

export async function getNotifications() {
  const { user, workspace } = await requireWorkspace()
  return db.select().from(notifications).where(and(eq(notifications.workspaceId, workspace.id), eq(notifications.userId, user.id))).orderBy(desc(notifications.createdAt)).limit(100)
}

export async function getUnreadNotificationCount() {
  const { user, workspace } = await requireWorkspace()
  return (await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.workspaceId, workspace.id), eq(notifications.userId, user.id), isNull(notifications.readAt)))).length
}

export async function markNotificationRead(id: string) {
  const { user, workspace } = await requireWorkspace()
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.workspaceId, workspace.id), eq(notifications.userId, user.id)))
  revalidatePath('/notifications')
}

export async function markAllNotificationsRead() {
  const { user, workspace } = await requireWorkspace()
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.workspaceId, workspace.id), eq(notifications.userId, user.id), isNull(notifications.readAt)))
  revalidatePath('/notifications')
}
