'use client'

import * as React from 'react'
import { CheckCircle2Icon, KeyRoundIcon, Loader2Icon, PlugZapIcon, Trash2Icon } from 'lucide-react'

import { activateAiProvider, deleteAiProvider, saveAiProvider, testAiProvider } from '@/app/actions/ai-providers'
import type { AiProviderSummary } from '@/lib/ai-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const presets = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', modelId: 'gpt-4.1-mini' },
  { label: 'OpenCode Zen', baseUrl: 'https://opencode.ai/zen/v1', modelId: 'claude-sonnet-4-6' },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', modelId: 'openai/gpt-4.1-mini' },
  { label: 'Groq compatible', baseUrl: 'https://api.groq.com/openai/v1', modelId: 'llama-3.3-70b-versatile' },
  { label: 'Другой OpenAI-compatible', baseUrl: '', modelId: '' },
]

export function AiProviderSettings({ providers }: { providers: AiProviderSummary[] }) {
  const [pending, startTransition] = React.useTransition()
  const [message, setMessage] = React.useState('')
  const [preset, setPreset] = React.useState(presets[0])

  function run(action: () => Promise<unknown>, success: string) {
    setMessage('')
    startTransition(async () => {
      try {
        await action()
        setMessage(success)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Операция не выполнена')
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border bg-card p-5 text-card-foreground">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><KeyRoundIcon className="size-4" /></div>
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold">Подключить свой AI API</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">Ключ шифруется перед сохранением и никогда не возвращается в браузер. Поддерживаются OpenAI, OpenCode Zen и сервисы с OpenAI-compatible Chat Completions API.</p>
          </div>
        </div>

        <form action={(formData) => run(() => saveAiProvider(formData), 'Провайдер сохранён. Теперь проверьте соединение.')} className="mt-5 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2" aria-label="Шаблоны провайдеров">
            {presets.map((item) => <Button key={item.label} type="button" size="sm" variant={preset.label === item.label ? 'default' : 'outline'} onClick={() => setPreset(item)}>{item.label}</Button>)}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2"><Label htmlFor="provider-name">Название</Label><Input id="provider-name" name="name" defaultValue={preset.label} key={`name-${preset.label}`} required maxLength={60} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="provider-model">ID модели</Label><Input id="provider-model" name="modelId" defaultValue={preset.modelId} key={`model-${preset.label}`} placeholder="gpt-4.1-mini" required maxLength={120} /></div>
          </div>
          <div className="flex flex-col gap-2"><Label htmlFor="provider-url">Base URL API</Label><Input id="provider-url" name="baseUrl" type="url" defaultValue={preset.baseUrl} key={`url-${preset.label}`} placeholder="https://api.example.com/v1" required /></div>
          <div className="flex flex-col gap-2"><Label htmlFor="provider-key">API-ключ</Label><Input id="provider-key" name="apiKey" type="password" autoComplete="off" placeholder="sk-••••••••••••" required minLength={8} />{preset.label === 'OpenCode Zen' ? <p className="text-xs leading-relaxed text-muted-foreground">Используйте ключ из OpenCode Zen. Модель можно заменить на любой ID из каталога Zen, например <span className="font-mono">deepseek-v4-flash-free</span>.</p> : null}</div>
          <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Сохранённый провайдер автоматически становится активным.</p><Button type="submit" disabled={pending}>{pending ? <Loader2Icon className="size-4 animate-spin" /> : <PlugZapIcon className="size-4" />}Подключить</Button></div>
        </form>
        {message ? <p className="mt-4 rounded-lg border bg-muted p-3 text-sm" role="status">{message}</p> : null}
      </section>

      <section className="flex flex-col gap-3">
        <div><h2 className="font-semibold">Подключённые провайдеры</h2><p className="text-sm text-muted-foreground">AI Studio и общий ассистент используют активного провайдера.</p></div>
        {providers.length ? providers.map((provider) => (
          <article key={provider.id} className="flex flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{provider.name}</h3>{provider.isActive ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Активен</span> : null}{provider.lastTestStatus === 'success' ? <CheckCircle2Icon className="size-4 text-primary" aria-label="Соединение проверено" /> : null}</div>
              <p className="truncate font-mono text-xs text-muted-foreground">{provider.modelId} · {provider.keyPrefix}</p>
              {provider.lastTestMessage ? <p className="mt-1 text-xs text-muted-foreground">{provider.lastTestMessage}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {!provider.isActive ? <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => activateAiProvider(provider.id), 'Провайдер активирован')}>Активировать</Button> : null}
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => testAiProvider(provider.id), 'Проверка завершена')}>Проверить</Button>
              <Button size="icon-sm" variant="ghost" disabled={pending} aria-label={`Удалить ${provider.name}`} onClick={() => run(() => deleteAiProvider(provider.id), 'Провайдер удалён')}><Trash2Icon /></Button>
            </div>
          </article>
        )) : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Провайдер пока не подключён. Без него AI-функции недоступны.</div>}
      </section>
    </div>
  )
}
