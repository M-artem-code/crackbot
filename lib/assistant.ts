import 'server-only'

import { desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { assistantMessages } from '@/lib/db/schema'
import { requireWorkspace } from '@/lib/workspace'

export type AssistantMessage = { id: string; role: 'user' | 'assistant'; content: string }

export async function getAssistantHistory(): Promise<AssistantMessage[]> {
  const { workspace } = await requireWorkspace()
  const rows = await db.select().from(assistantMessages).where(eq(assistantMessages.workspaceId, workspace.id)).orderBy(desc(assistantMessages.createdAt)).limit(40)
  return rows.reverse().map((row) => ({ id: row.id, role: row.role === 'user' ? 'user' : 'assistant', content: row.content }))
}
