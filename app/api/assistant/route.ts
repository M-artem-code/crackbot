import { randomUUID } from 'node:crypto'

import { streamText, type ModelMessage } from 'ai'
import { and, asc, desc, eq } from 'drizzle-orm'

import { getActiveAiProvider } from '@/lib/ai-provider'
import { db } from '@/lib/db'
import { assistantMessages, bots, runs, templates } from '@/lib/db/schema'
import { requireWorkspace } from '@/lib/workspace'

export const maxDuration = 60

const SYSTEM_PROMPT = `Ты AI-ассистент BotForge — senior-инженер по QA automation и Python browser automation.
Ты уже знаешь платформу: боты создаются из шаблонов, сценарии исполняются nodriver/CDP-агентами, у ботов есть ref-пулы, версии bot.py, прогоны, логи и артефакты. AI Studio анализирует и изменяет bot.py через review/apply flow.
Отвечай по-русски, конкретно и практически. Обычно давай 2–4 варианта решения, помечай рекомендуемый, объясняй компромиссы и следующие шаги. Учитывай реальный контекст workspace ниже и предыдущую историю. Не выдумывай статусы, логи, ботов или возможности. Не обещай, что выполнил действие, если у тебя нет инструмента. Никогда не раскрывай ключи и секреты.`

type ClientMessage = { role: 'user' | 'assistant'; content: string }

export async function POST(request: Request) {
  try {
    const { workspace } = await requireWorkspace()
    const body = await request.json() as { messages?: ClientMessage[] }
    const messages = (body.messages ?? []).filter((item) => (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string' && item.content.trim()).slice(-20)
    const latestUser = [...messages].reverse().find((item) => item.role === 'user')
    if (!latestUser || latestUser.content.length > 8_000) return Response.json({ error: 'Сообщение пустое или слишком длинное' }, { status: 400 })

    const [{ config, model }, botRows, runRows, templateRows] = await Promise.all([
      getActiveAiProvider(workspace.id),
      db.select({ name: bots.name, status: bots.status, targetUrl: bots.targetUrl }).from(bots).where(eq(bots.workspaceId, workspace.id)).orderBy(desc(bots.updatedAt)).limit(12),
      db.select({ status: runs.status, error: runs.error, createdAt: runs.createdAt }).from(runs).where(eq(runs.workspaceId, workspace.id)).orderBy(desc(runs.createdAt)).limit(12),
      db.select({ name: templates.name, description: templates.description }).from(templates).orderBy(asc(templates.name)).limit(20),
    ])

    const context = JSON.stringify({ provider: { name: config.name, model: config.modelId }, bots: botRows, recentRuns: runRows, templates: templateRows })
    await db.insert(assistantMessages).values({ id: `msg_${randomUUID().replaceAll('-', '')}`, workspaceId: workspace.id, role: 'user', content: latestUser.content.slice(0, 8_000) })

    const result = streamText({
      model,
      system: `${SYSTEM_PROMPT}\n\nТекущий контекст workspace:\n${context}`,
      messages: messages.map((item): ModelMessage => ({ role: item.role, content: item.content })),
      maxOutputTokens: 2_000,
      onFinish: async ({ text }) => {
        if (text.trim()) await db.insert(assistantMessages).values({ id: `msg_${randomUUID().replaceAll('-', '')}`, workspaceId: workspace.id, role: 'assistant', content: text.slice(0, 20_000) })
      },
    })
    return result.toTextStreamResponse()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось запустить AI-ассистента'
    return Response.json({ error: message }, { status: /не настроен/i.test(message) ? 412 : 500 })
  }
}
