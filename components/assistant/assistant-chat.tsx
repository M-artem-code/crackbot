"use client"

import * as React from "react"
import Link from "next/link"
import { BotIcon, SendIcon, SparklesIcon, UserIcon } from "lucide-react"

import { assistantSuggestions } from "@/lib/mock-data"
import type { AiProviderSummary } from "@/lib/ai-provider"
import type { AssistantMessage } from "@/lib/assistant"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Kbd } from "@/components/ui/kbd"

type ChatMessage = AssistantMessage

const initialMessages: ChatMessage[] = [
  {
    id: "m-0",
    role: "assistant",
    content:
      "Привет! Я ассистент BotForge. Помогу создать бота, разобраться с логами или адаптировать шаблон «Проверка регистрации» под ваш сайт. С чего начнём?",
  },
]

export function AssistantChat({ initialHistory, provider }: { initialHistory: ChatMessage[]; provider: AiProviderSummary | null }) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialHistory.length ? initialHistory : initialMessages)
  const [input, setInput] = React.useState("")
  const [isTyping, setIsTyping] = React.useState(false)
  const [error, setError] = React.useState("")

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isTyping || !provider) return

    const userMessage: ChatMessage = { id: `m-${Date.now()}-u`, role: "user", content: trimmed }
    const assistantId = `m-${Date.now()}-a`
    const nextMessages = [...messages, userMessage]
    setMessages([...nextMessages, { id: assistantId, role: "assistant", content: "" }])
    setInput("")
    setError("")
    setIsTyping(true)

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.map(({ role, content }) => ({ role, content })) }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error || 'AI-провайдер не ответил')
      }
      if (!response.body) throw new Error('Пустой поток ответа')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let content = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content } : item))
      }
    } catch (cause) {
      setMessages((current) => current.filter((item) => item.id !== assistantId))
      setError(cause instanceof Error ? cause.message : 'Не удалось получить ответ')
    } finally {
      setIsTyping(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex h-svh flex-col">
      <div className="flex items-center gap-2 border-b px-6 py-4">
        <SparklesIcon className="size-4 text-primary" aria-hidden="true" />
        <div>
          <h1 className="text-sm font-semibold">AI-ассистент</h1>
          <p className="text-xs text-muted-foreground">
            {provider ? `${provider.name} · ${provider.modelId}` : "Нужен ваш AI API-ключ"}
          </p>
        </div>
      </div>

      <MessageScrollerProvider>
      <MessageScroller className="flex-1">
        <MessageScrollerViewport>
          <MessageScrollerContent className="mx-auto w-full max-w-2xl px-6 py-6">
            {messages.map((message) => (
              <MessageScrollerItem key={message.id}>
                <Message align={message.role === "user" ? "end" : "start"}>
                  <MessageAvatar className="size-8">
                    {message.role === "user" ? (
                      <UserIcon className="size-4" aria-hidden="true" />
                    ) : (
                      <BotIcon className="size-4 text-primary" aria-hidden="true" />
                    )}
                  </MessageAvatar>
                  <MessageContent>
                    <MessageHeader>
                      {message.role === "user" ? "Вы" : "Ассистент"}
                    </MessageHeader>
                    <Bubble
                      variant={message.role === "user" ? "default" : "muted"}
                      align={message.role === "user" ? "end" : "start"}
                    >
                      <BubbleContent className="whitespace-pre-line">
                        {message.content}
                      </BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            ))}
            {isTyping && (
              <MessageScrollerItem>
                <Message align="start">
                  <MessageAvatar className="size-8">
                    <BotIcon className="size-4 text-primary" aria-hidden="true" />
                  </MessageAvatar>
                  <MessageContent>
                    <Bubble variant="muted">
                      <BubbleContent>
                        <span className="text-muted-foreground">Печатает…</span>
                      </BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
      </MessageScrollerProvider>

      <div className="border-t px-6 py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {!provider ? <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted p-3 text-sm"><span>Подключите OpenAI или другой совместимый API, чтобы разблокировать ассистента.</span><Button size="sm" render={<Link href="/settings/ai" />}>Настроить AI</Button></div> : null}
          {error ? <p className="rounded-lg border bg-muted p-3 text-sm" role="alert">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            {assistantSuggestions.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                onClick={() => sendMessage(suggestion)}
                disabled={isTyping || !provider}
              >
                {suggestion}
              </Button>
            ))}
          </div>
          <InputGroup>
            <InputGroupTextarea
              placeholder="Спросите про ботов, шаблоны или логи…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              aria-label="Сообщение ассистенту"
            />
            <InputGroupAddon align="block-end">
              <span className="text-xs text-muted-foreground">
                <Kbd>Enter</Kbd> — отправить
              </span>
              <Button
                size="icon-sm"
                className="ms-auto"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping || !provider}
                aria-label="Отправить сообщение"
              >
                <SendIcon />
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>
    </div>
  )
}
