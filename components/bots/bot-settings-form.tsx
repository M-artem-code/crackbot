'use client'

import * as React from 'react'
import { CheckIcon, TriangleAlertIcon } from 'lucide-react'

import { useRouter } from 'next/navigation'

import { updateBotSettings } from '@/app/actions/bots'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import type { Bot } from '@/lib/mock-data'

function numFromConfig(
  config: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const v = config[key]
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function BotSettingsForm({ bot }: { bot: Bot }) {
  const router = useRouter()
  const cfg = bot.config ?? {}

  const [name, setName] = React.useState(bot.name)
  const [targetUrl, setTargetUrl] = React.useState(bot.targetUrl)
  const [workers, setWorkers] = React.useState(bot.workers)
  const [proxy, setProxy] = React.useState(String(cfg.proxy ?? ''))
  const [password, setPassword] = React.useState(String(cfg.password ?? ''))
  const [headless, setHeadless] = React.useState(
    cfg.headless === undefined ? true : Boolean(cfg.headless),
  )
  const [pageTimeout, setPageTimeout] = React.useState(
    numFromConfig(cfg, 'page_timeout', 45),
  )
  const [otpTimeout, setOtpTimeout] = React.useState(
    numFromConfig(cfg, 'otp_timeout', 120),
  )
  const [delayMin, setDelayMin] = React.useState(
    numFromConfig(cfg, 'action_delay_min', 0.4),
  )
  const [delayMax, setDelayMax] = React.useState(
    numFromConfig(cfg, 'action_delay_max', 1.4),
  )

  const [isSaving, startSaving] = React.useTransition()
  const [feedback, setFeedback] = React.useState<
    { type: 'success' | 'error'; message: string } | null
  >(null)

  function handleSave() {
    setFeedback(null)
    startSaving(async () => {
      try {
        await updateBotSettings(bot.id, {
          name,
          targetUrl,
          workers,
          config: {
            proxy,
            password,
            headless,
            page_timeout: pageTimeout,
            otp_timeout: otpTimeout,
            action_delay_min: delayMin,
            action_delay_max: delayMax,
          },
        })
        setFeedback({ type: 'success', message: 'Настройки сохранены' })
        router.refresh()
      } catch (err) {
        setFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : 'Не удалось сохранить',
        })
      }
    })
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Настройки бота</CardTitle>
        <CardDescription>
          Параметры прогона. Их читает локальный агент при выполнении задания.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="bot-name">Имя бота</FieldLabel>
            <Input
              id="bot-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bot-url">Целевой URL</FieldLabel>
            <Input
              id="bot-url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="font-mono"
            />
            <FieldDescription>
              Базовый адрес, который проверяет бот, если у реф-ссылки нет своего URL
            </FieldDescription>
          </Field>

          <FieldSeparator>Параллелизм</FieldSeparator>

          <Field>
            <FieldLabel htmlFor="workers">Воркеры (параллельные браузеры)</FieldLabel>
            <Input
              id="workers"
              type="number"
              min={1}
              max={10}
              value={workers}
              onChange={(e) => setWorkers(Number(e.target.value))}
              className="max-w-24 font-mono"
            />
            <FieldDescription>
              Сколько браузеров агент запускает одновременно (1–10)
            </FieldDescription>
          </Field>

          <FieldSeparator>Браузер и сеть</FieldSeparator>

          <Field orientation="horizontal">
            <div className="flex flex-col gap-0.5">
              <FieldLabel htmlFor="headless">Headless-режим</FieldLabel>
              <FieldDescription>
                Запускать браузер без окна (быстрее, меньше ресурсов)
              </FieldDescription>
            </div>
            <Switch id="headless" checked={headless} onCheckedChange={setHeadless} />
          </Field>
          <Field>
            <FieldLabel htmlFor="proxy">Прокси</FieldLabel>
            <Input
              id="proxy"
              value={proxy}
              onChange={(e) => setProxy(e.target.value)}
              placeholder="host:port или http://user:pass@host:port"
              className="font-mono"
            />
            <FieldDescription>
              Необязательно. Применяется ко всем воркерам бота
            </FieldDescription>
          </Field>

          <FieldSeparator>Тайминги и OTP</FieldSeparator>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="page-timeout">Таймаут страницы, с</FieldLabel>
              <Input
                id="page-timeout"
                type="number"
                min={1}
                value={pageTimeout}
                onChange={(e) => setPageTimeout(Number(e.target.value))}
                className="font-mono"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="otp-timeout">Ожидание OTP-кода, с</FieldLabel>
              <Input
                id="otp-timeout"
                type="number"
                min={1}
                value={otpTimeout}
                onChange={(e) => setOtpTimeout(Number(e.target.value))}
                className="font-mono"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="delay-min">Задержка действий min, с</FieldLabel>
              <Input
                id="delay-min"
                type="number"
                min={0}
                step={0.1}
                value={delayMin}
                onChange={(e) => setDelayMin(Number(e.target.value))}
                className="font-mono"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="delay-max">Задержка действий max, с</FieldLabel>
              <Input
                id="delay-max"
                type="number"
                min={0}
                step={0.1}
                value={delayMax}
                onChange={(e) => setDelayMax(Number(e.target.value))}
                className="font-mono"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="password">Пароль для регистраций</FieldLabel>
            <Input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Оставьте пустым для случайного пароля"
              className="font-mono"
            />
            <FieldDescription>
              Если задан — используется для всех аккаунтов; иначе агент генерирует случайный
            </FieldDescription>
          </Field>

          <div className="flex items-center justify-end gap-3">
            {feedback ? (
              <span
                className={`flex items-center gap-1.5 text-xs ${
                  feedback.type === 'success' ? 'text-primary' : 'text-destructive'
                }`}
                role="status"
              >
                {feedback.type === 'success' ? (
                  <CheckIcon className="size-3.5" />
                ) : (
                  <TriangleAlertIcon className="size-3.5" />
                )}
                {feedback.message}
              </span>
            ) : null}
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Spinner data-icon="inline-start" /> : null}
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
