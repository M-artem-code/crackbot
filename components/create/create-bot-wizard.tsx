'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckIcon,
  DatabaseIcon,
  FormInputIcon,
  RocketIcon,
} from 'lucide-react'

import { createBot } from '@/app/actions/bots'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { TemplateInfo } from '@/lib/mock-data'

export function CreateBotWizard({ templates }: { templates: TemplateInfo[] }) {
  const router = useRouter()
  const [name, setName] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [templateId, setTemplateId] = React.useState(templates[0]?.id ?? '')
  const [workers, setWorkers] = React.useState('2')
  const [seedRefs, setSeedRefs] = React.useState('')
  const [creating, setCreating] = React.useState(false)
  const [created, setCreated] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const selected = templates.find((t) => t.id === templateId) ?? templates[0]
  const canSubmit = name.trim().length > 0 && url.trim().length > 0 && !!selected

  async function handleCreate() {
    if (!canSubmit || creating || !selected) return
    setCreating(true)
    setError(null)
    try {
      const { id } = await createBot({
        name,
        targetUrl: url,
        templateId: selected.id,
        workers: Number(workers) || 1,
        seedRefs: seedRefs.split('\n'),
      })
      setCreated(true)
      setTimeout(() => router.push(`/bots/${id}`), 1000)
    } catch (e) {
      setCreating(false)
      setError(e instanceof Error ? e.message : 'Не удалось создать бота')
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
      {/* Форма */}
      <div className="flex flex-col gap-4 lg:col-span-3">
        {/* Шаг 1: шаблон */}
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="mr-2 font-mono text-muted-foreground">01</span>
              Выбор шаблона
            </CardTitle>
            <CardDescription>
              Бот собирается из проверенного сценария — не с нуля
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className={cn(
                    'flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors',
                    templateId === t.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-accent',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                      <FormInputIcon className="size-4" />
                    </div>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {t.flowType === 'otp' ? 'OTP-код' : 'ссылка из письма'}
                    </Badge>
                  </div>
                  <span className="text-sm font-semibold">{t.name}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {t.description}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Шаг 2: основное */}
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="mr-2 font-mono text-muted-foreground">02</span>
              Основные параметры
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-name">Имя бота</FieldLabel>
                <Input
                  id="new-name"
                  placeholder="Например: Landing Signup Checker"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-url">URL деплоя</FieldLabel>
                <Input
                  id="new-url"
                  placeholder="https://my-app-git-main.vercel.app"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="font-mono"
                />
                <FieldDescription>
                  Свежий деплой на Vercel или любой другой адрес для проверки
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-workers">Воркеры</FieldLabel>
                <Input
                  id="new-workers"
                  type="number"
                  min={1}
                  max={10}
                  value={workers}
                  onChange={(e) => setWorkers(e.target.value)}
                  className="max-w-24 font-mono"
                />
                <FieldDescription>
                  Сколько браузеров запускать параллельно на локальном раннере
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Шаг 3: реф-пул */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground">03</span>
              <DatabaseIcon className="size-4" />
              Реф-пул бота
            </CardTitle>
            <CardDescription>
              У каждого бота свой пул реф-ссылок для регистраций
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-seeds">
                  Реф-ссылки (по одной на строку)
                </FieldLabel>
                <Textarea
                  id="new-seeds"
                  placeholder={
                    'https://my-app.vercel.app/?ref=alpha01\nhttps://my-app.vercel.app/?ref=alpha02'
                  }
                  value={seedRefs}
                  onChange={(e) => setSeedRefs(e.target.value)}
                  className="min-h-24 font-mono text-xs"
                />
                <FieldDescription>
                  Ссылки, которые бот будет использовать по очереди при регистрациях
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          {error ? (
            <span className="text-sm text-destructive">{error}</span>
          ) : null}
          {created ? (
            <span className="flex items-center gap-1.5 text-sm text-primary">
              <CheckIcon className="size-4" />
              Бот создан! Перенаправляю...
            </span>
          ) : null}
          <Button
            size="lg"
            onClick={handleCreate}
            disabled={!canSubmit || creating || created}
          >
            {creating ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RocketIcon data-icon="inline-start" />
            )}
            {creating ? 'Создаю бота...' : 'Создать бота'}
          </Button>
        </div>
      </div>

      {/* Превью сценария */}
      <div className="lg:col-span-2">
        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Превью сценария</CardTitle>
            <CardDescription>
              {selected ? `${selected.scenarioSteps.length} шагов` : 'выберите шаблон'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col rounded-md border bg-background p-3 font-mono text-xs">
              <div className="mb-2 flex flex-col gap-0.5 border-b pb-2 text-muted-foreground">
                <span>
                  bot: <span className="text-foreground">{name || '—'}</span>
                </span>
                <span>
                  target: <span className="text-foreground">{url || '—'}</span>
                </span>
                <span>
                  template:{' '}
                  <span className="text-foreground">{selected?.slug ?? '—'}</span>
                </span>
              </div>
              <ol className="flex flex-col gap-1.5">
                {selected?.scenarioSteps.map((step, i) => (
                  <li key={step.step} className="flex items-center gap-2.5">
                    <span className="text-muted-foreground/60">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>{step.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
