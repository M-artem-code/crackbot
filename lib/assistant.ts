import 'server-only'

import { desc } from 'drizzle-orm'

import { db } from '@/lib/db'
import { assistantMessages } from '@/lib/db/schema'

export type AssistantMessage = { id: string; role: 'user' | 'assistant'; content: string }

export async function getAssistantHistory(): Promise<AssistantMessage[]> {
  const rows = await db.select().from(assistantMessages).orderBy(desc(assistantMessages.createdAt)).limit(40)
  return rows.reverse().map((row) => ({ id: row.id, role: row.role === 'user' ? 'user' : 'assistant', content: row.content }))
}
