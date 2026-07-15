'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon, FormInputIcon, LinkIcon, PlusIcon, RocketIcon, Trash2Icon } from 'lucide-react'

import { createBot } from '@/app/actions/bots'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { TemplateInfo } from '@/lib/mock-data'

type LinkRow = { id: string; url: string; limit: string }
const newLink = (): LinkRow => ({ id: crypto.randomUUID(), url: '', limit: '10' })

function validUrl(value: string) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}

export function CreateBotWizard({ templates }: { templates: TemplateInfo[] }) {
  const router = useRouter()
  const [name, setName] = React.useState('')
  const [templateId, setTemplateId] = React.useState(templates[0]?.id ?? '')
  const [workers, setWorkers] = React.useState('2')
  const [links, setLinks] = React.useState<LinkRow[]>([newLink()])
  const [creating, setCreating] = React.useState(false)
  const [created, setCreated] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const selected = templates.find((t) => t.id === templateId) ?? templates[0]
  const normalized = links.map((link) => link.url.trim()).filter(Boolean)
  const hasDuplicates = new Set(normalized).size !== normalized.length
  const linksValid = links.length > 0 && links.every((link) => validUrl(link.url.trim()) && Number(link.limit) >= 1) && !hasDuplicates
  const canSubmit = name.trim().length > 0 && linksValid && !!selected
  const totalGoal = links.reduce((sum, link) => sum + (Number(link.limit) || 0), 0)

  function updateLink(id: string, patch: Partial<LinkRow>) { setLinks((current) => current.map((link) => link.id === id ? { ...link, ...patch } : link)) }
  async function handleCreate() {
    if (!canSubmit || creating || !selected) return
    setCreating(true); setError(null)
    try {
      const { id } = await createBot({ name, templateId: selected.id, workers: Number(workers) || 1, targetLinks: links.map((link) => ({ url: link.url, successLimit: Number(link.limit) })) })
      setCreated(true); setTimeout(() => router.push(`/bots/${id}`), 700)
    } catch (e) { setCreating(false); setError(e instanceof Error ? e.message : 'Не удалось создать бота') }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
      <div className="flex flex-col gap-4 lg:col-span-3">
        <Card><CardHeader><CardTitle><span className="mr-2 font-mono text-muted-foreground">01</span>Выбор сценария</CardTitle><CardDescription>v0 и AdFlex уже готовы; после создания сценарий можно изменить под свой сайт</CardDescription></CardHeader><CardContent><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{templates.map((t) => <button key={t.id} type="button" onClick={() => setTemplateId(t.id)} className={cn('flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors', templateId === t.id ? 'border-primary bg-primary/5' : 'hover:bg-accent')}><div className="flex items-center justify-between gap-2"><div className="flex size-8 items-center justify-center rounded-md bg-muted"><FormInputIcon className="size-4" /></div><Badge variant="secondary" className="font-mono text-[10px]">{t.flowType === 'otp' ? 'OTP-код' : 'ссылка из письма'}</Badge></div><span className="text-sm font-semibold">{t.name}</span><span className="text-xs leading-relaxed text-muted-foreground">{t.description}</span></button>)}</div></CardContent></Card>

        <Card><CardHeader><CardTitle><span className="mr-2 font-mono text-muted-foreground">02</span>Основные параметры</CardTitle></CardHeader><CardContent><FieldGroup><Field><FieldLabel htmlFor="new-name">Имя бота</FieldLabel><Input id="new-name" placeholder="Например: V0 registrations" value={name} onChange={(e) => setName(e.target.value)} /></Field><Field><FieldLabel htmlFor="new-workers">Воркеры</FieldLabel><Input id="new-workers" type="number" min={1} max={10} value={workers} onChange={(e) => setWorkers(e.target.value)} className="max-w-24 font-mono" /><FieldDescription>Параллельные браузеры внутри текущей целевой ссылки</FieldDescription></Field></FieldGroup></CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><span className="font-mono text-muted-foreground">03</span><LinkIcon className="size-4" />Пул целевых ссылок</CardTitle><CardDescription>Бот выполнит сценарий на каждой активной ссылке и перейдёт дальше после достижения лимита успешных регистраций.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4"><div className="flex flex-col gap-3">{links.map((link, index) => { const invalid = link.url.length > 0 && !validUrl(link.url.trim()); return <div key={link.id} className="grid grid-cols-[1fr_88px_36px] items-start gap-2"><Field><FieldLabel htmlFor={`link-${link.id}`} className="sr-only">Целевая ссылка {index + 1}</FieldLabel><Input id={`link-${link.id}`} value={link.url} onChange={(e) => updateLink(link.id, { url: e.target.value })} placeholder="https://app.example.com/register" className="font-mono text-xs" aria-invalid={invalid} />{invalid ? <span className="text-xs text-destructive">Нужен полный http/https URL</span> : null}</Field><Field><FieldLabel htmlFor={`limit-${link.id}`} className="sr-only">Лимит успехов</FieldLabel><Input id={`limit-${link.id}`} type="number" min={1} max={10000} value={link.limit} onChange={(e) => updateLink(link.id, { limit: e.target.value })} aria-label="Лимит успешных регистраций" className="font-mono" /></Field><Button type="button" variant="ghost" size="icon" onClick={() => setLinks((current) => current.filter((row) => row.id !== link.id))} disabled={links.length === 1} aria-label={`Удалить ссылку ${index + 1}`}><Trash2Icon className="size-4" /></Button></div> })}</div>{hasDuplicates ? <p role="alert" className="text-sm text-destructive">Одинаковую ссылку нельзя добавлять дважды</p> : null}<div className="flex items-center justify-between gap-3"><Button type="button" variant="outline" size="sm" onClick={() => setLinks((current) => [...current, newLink()])}><PlusIcon data-icon="inline-start" />Добавить ссылку</Button><span className="text-xs text-muted-foreground">URL · лимит успехов</span></div></CardContent></Card>

        <div className="flex items-center justify-end gap-3">{error ? <span className="text-sm text-destructive">{error}</span> : null}{created ? <span className="flex items-center gap-1.5 text-sm text-primary"><CheckIcon className="size-4" />Бот создан</span> : null}<Button size="lg" onClick={handleCreate} disabled={!canSubmit || creating || created}>{creating ? <Spinner data-icon="inline-start" /> : <RocketIcon data-icon="inline-start" />}{creating ? 'Создаю бота...' : 'Создать бота'}</Button></div>
      </div>

      <div className="lg:col-span-2"><Card className="lg:sticky lg:top-6"><CardHeader><CardTitle>Итог настройки</CardTitle><CardDescription>{selected ? `${selected.scenarioSteps.length} шагов сценария` : 'Выберите сценарий'}</CardDescription></CardHeader><CardContent><div className="flex flex-col gap-3 rounded-md border bg-background p-3 font-mono text-xs"><div className="flex flex-col gap-1 border-b pb-3"><span>bot: <span className="text-foreground">{name || '—'}</span></span><span>scenario: <span className="text-foreground">{selected?.slug ?? '—'}</span></span><span>links: <span className="text-foreground">{links.filter((link) => validUrl(link.url)).length}</span></span><span>success goal: <span className="text-foreground">{totalGoal}</span></span><span>workers: <span className="text-foreground">{workers || '1'}</span></span></div><ol className="flex flex-col gap-1.5">{selected?.scenarioSteps.map((step, i) => <li key={step.step} className="flex items-center gap-2.5"><span className="text-muted-foreground/60">{String(i + 1).padStart(2, '0')}</span><span>{step.label}</span></li>)}</ol></div></CardContent></Card></div>
    </div>
  )
}
