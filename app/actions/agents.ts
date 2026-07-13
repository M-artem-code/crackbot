'use server'

import { randomBytes } from 'node:crypto'

import { db } from '@/lib/db'
import { agents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

// Генерирует секретный API-ключ агента: agt_<64 hex-символа>.
function genApiKey(): string {
  return `agt_${randomBytes(32).toString('hex')}`
}

export interface CreateAgentInput {
  name: string
  os?: string
}

export async function createAgent(
  input: CreateAgentInput,
): Promise<{ id: string; apiKey: string }> {
  const name = input.name.trim()
  if (!name) throw new Error('Имя агента обязательно')

  const id = genId('agt')
  const apiKey = genApiKey()

  await db.insert(agents).values({
    id,
    name,
    apiKey,
    os: input.os?.trim() ?? '',
    status: 'offline',
  })

  revalidatePath('/agents')
  return { id, apiKey }
}

// Перевыпуск ключа: старый ключ мгновенно перестаёт работать.
export async function rotateApiKey(id: string): Promise<{ apiKey: string }> {
  const [existing] = await db.select().from(agents).where(eq(agents.id, id)).limit(1)
  if (!existing) throw new Error('Агент не найден')

  const apiKey = genApiKey()
  await db.update(agents).set({ apiKey }).where(eq(agents.id, id))

  revalidatePath('/agents')
  return { apiKey }
}

export async function renameAgent(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Имя агента обязательно')
  await db.update(agents).set({ name: trimmed }).where(eq(agents.id, id))
  revalidatePath('/agents')
}

// Отключение/включение агента. Отключённый агент не проходит аутентификацию
// и не получает новых заданий.
export async function setAgentDisabled(id: string, disabled: boolean): Promise<void> {
  await db
    .update(agents)
    .set({ status: disabled ? 'disabled' : 'offline' })
    .where(eq(agents.id, id))
  revalidatePath('/agents')
}

export async function deleteAgent(id: string): Promise<void> {
  await db.delete(agents).where(eq(agents.id, id))
  revalidatePath('/agents')
}
