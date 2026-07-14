import { and, count, eq, isNull } from 'drizzle-orm'

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { requireWorkspace } from '@/lib/workspace'

export async function AppShell({ children }: { children: React.ReactNode }) {
  const { user, workspace } = await requireWorkspace()
  const [unread] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.workspaceId, workspace.id), eq(notifications.userId, user.id), isNull(notifications.readAt)))
  return (
    <SidebarProvider>
      <AppSidebar user={{ name: user.name, email: user.email }} workspaceName={workspace.name} unreadNotifications={unread?.value ?? 0} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
