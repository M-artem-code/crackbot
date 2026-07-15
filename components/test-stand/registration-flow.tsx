'use client'

import * as React from 'react'
import { CheckCircle2Icon, KeyRoundIcon, ShieldCheckIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

type Stage = 'register' | 'verify' | 'success'

export function RegistrationFlow() {
  const [stage, setStage] = React.useState<Stage>('register')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [code, setCode] = React.useState('')
  const [challengeId, setChallengeId] = React.useState('')
  const [error, setError] = React.useState('')
  const [pending, setPending] = React.useState(false)

  async function submitRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/test-stand/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const result = (await response.json()) as { challengeId?: string; error?: string }
      if (!response.ok || !result.challengeId) throw new Error(result.error || 'Не удалось отправить форму')
      setChallengeId(result.challengeId)
      setStage('verify')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось отправить форму')
    } finally {
      setPending(false)
    }
  }

  async function submitOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/test-stand/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, code }),
      })
      const result = (await response.json()) as { verified?: boolean; error?: string }
      if (!response.ok || !result.verified) throw new Error(result.error || 'Код не подтверждён')
      setStage('success')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Код не подтверждён')
    } finally {
      setPending(false)
    }
  }

  if (stage === 'success') {
    return (
      <Card className="w-full max-w-md" data-testid="registration-success">
        <CardHeader className="items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2Icon className="size-6" aria-hidden="true" />
          </span>
          <CardTitle className="text-balance">Welcome to Crackbot Test</CardTitle>
          <CardDescription className="text-pretty">
            Тестовый аккаунт подтверждён. Сценарий регистрации завершён успешно.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <span className="flex size-10 items-center justify-center rounded-md border bg-muted text-foreground">
          {stage === 'register' ? <ShieldCheckIcon className="size-5" /> : <KeyRoundIcon className="size-5" />}
        </span>
        <CardTitle>{stage === 'register' ? 'Создать тестовый аккаунт' : 'Подтвердить email'}</CardTitle>
        <CardDescription>
          {stage === 'register'
            ? 'Изолированная форма для проверки Registration + Email OTP.'
            : `Шестизначный код отправлен на ${email}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stage === 'register' ? (
          <form className="flex flex-col gap-4" onSubmit={submitRegistration}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="test-email">Email</Label>
              <Input id="test-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" data-testid="registration-email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="test-password">Password</Label>
              <Input id="test-password" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" data-testid="registration-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
            </div>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={pending} data-testid="registration-submit">
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Create account
            </Button>
          </form>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={submitOtp}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="verification-code">Verification code</Label>
              <Input id="verification-code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" data-testid="verification-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} minLength={6} maxLength={6} required />
            </div>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={pending || code.length !== 6} data-testid="verification-submit">
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Verify
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
