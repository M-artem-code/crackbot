'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckIcon,
  DatabaseIcon,
  FormInputIcon,
  RocketIcon,
  SparklesIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { REGISTRATION_TEMPLATE_STEPS } from '@/lib/mock-data'

const templates = [
  {
    id: 'registration',
    name: 'Проверка регистрации',
    description:
      'Флагманский шаблон: полный цикл от поиска формы до кода из письма',
    badge: 'Флагман',
    icon: FormInputIcon,
    available: true,
  },
  {
    id: 'custom',
    name: 'Свой сценарий',
    description: 'Соберите сценарий с нуля вместе с AI-ассистентом',
    badge: 'Скоро',
    icon: SparklesIcon,
    available: false,
  },
]

export function CreateBotWizard() {
  const router = useRouter()
  const [name, setName] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [template, setTemplate] = React.useState('registration')
  const [dbName, setDbName] = React.useState('')
  const [seedRecords, setSeedRecords] = React.useState('')
  const [checkEmail, setCheckEmail] = React.useState(true)
  const [screenshots, setScreenshots] = React.useState(true)
  const [parallel, setParallel] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [created, setCreated] = React.useState(false)

  const canSubmit = name.trim().length > 0 && url.trim().length > 0

  function handleCreate() {
    if (!canSubmit || creating) return
    setCreating(true)
    setTimeout(() => {
      setCreating(false)
      setCreated(true)
      setTimeout(() => router.push('/bots'), 1400)
    }, 1800)
  }

  const previewSteps = REGISTRATION_TEMPLATE_STEPS.filter(
    (step) =>
      checkEmail ||
      !(
        step.includes('письмо') ||
        step.includes('код') ||
        step.includes('Код') ||
        step.includes('почтового')
      ),
  )

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
                  disabled={!t.available}
                  onClick={() => setTemplate(t.id)}
                  className={cn(
                    'flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors',
                    template === t.id && t.available
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-accent',
                    !t.available && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                      <t.icon className="size-4" />
                    </div>
                    <Badge variant={t.available ? 'default' : 'secondary'}>
                      {t.badge}
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
              <FieldSet>
                <FieldLegend>Настройки сценария</FieldLegend>
                <Field orientation="horizontal">
                  <Checkbox
                    id="opt-email"
                    checked={checkEmail}
                    onCheckedChange={(v) => setCheckEmail(v === true)}
                  />
                  <div className="flex flex-col gap-0.5">
                    <FieldLabel htmlFor="opt-email">Проверять email-код</FieldLabel>
                    <FieldDescription>
                      Дождаться письма и ввести код подтверждения
                    </FieldDescription>
                  </div>
                </Field>
                <Field orientation="horizontal">
                  <Checkbox
                    id="opt-screens"
                    checked={screenshots}
                    onCheckedChange={(v) => setScreenshots(v === true)}
                  />
                  <div className="flex flex-col gap-0.5">
                    <FieldLabel htmlFor="opt-screens">
                      Скриншоты при ошибках
                    </FieldLabel>
                    <FieldDescription>
                      Снимок страницы в момент падения шага
                    </FieldDescription>
                  </div>
                </Field>
                <Field orientation="horizontal">
                  <Checkbox
                    id="opt-parallel"
                    checked={parallel}
                    onCheckedChange={(v) => setParallel(v === true)}
                  />
                  <div className="flex flex-col gap-0.5">
                    <FieldLabel htmlFor="opt-parallel">
                      Параллельные прогоны
                    </FieldLabel>
                    <FieldDescription>
                      Несколько браузеров одновременно (нагрузка на ПК выше)
                    </FieldDescription>
                  </div>
                </Field>
              </FieldSet>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Шаг 3: база данных */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground">03</span>
              <DatabaseIcon className="size-4" />
              Привязка базы данных
            </CardTitle>
            <CardDescription>
              Каждому боту создаётся своя отдельная БД для целевых URL и тестовых
              аккаунтов
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-db">Имя базы данных</FieldLabel>
                <Input
                  id="new-db"
                  placeholder="my_bot_targets"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  className="font-mono"
                />
                <FieldDescription>
                  Если оставить пустым — имя сгенерируется автоматически
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-seeds">
                  Начальные записи (по одной на строку)
                </FieldLabel>
                <Textarea
                  id="new-seeds"
                  placeholder={
                    'https://my-app-git-main.vercel.app/signup\nhttps://my-app-git-feat.vercel.app/signup'
                  }
                  value={seedRecords}
                  onChange={(e) => setSeedRecords(e.target.value)}
                  className="min-h-24 font-mono text-xs"
                />
                <FieldDescription>
                  URL страниц регистрации, которые бот добавит в очередь проверки
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
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
              {previewSteps.length} шагов, которые выполнит бот
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
                  db:{' '}
                  <span className="text-foreground">
                    {dbName || 'auto_generated_db'}
                  </span>
                </span>
              </div>
              <ol className="flex flex-col gap-1.5">
                {previewSteps.map((step, i) => (
                  <li key={step} className="flex items-center gap-2.5">
                    <span className="text-muted-foreground/60">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
                {screenshots ? (
                  <li className="flex items-center gap-2.5 text-muted-foreground">
                    <span className="text-muted-foreground/60">--</span>
                    <span>+ скриншот при любой ошибке</span>
                  </li>
                ) : null}
                {parallel ? (
                  <li className="flex items-center gap-2.5 text-muted-foreground">
                    <span className="text-muted-foreground/60">--</span>
                    <span>+ параллельный режим</span>
                  </li>
                ) : null}
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
