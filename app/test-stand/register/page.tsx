import { notFound } from 'next/navigation'

import { RegistrationFlow } from '@/components/test-stand/registration-flow'
import { isTestStandEnabled } from '@/lib/test-stand-otp'

export default function TestRegistrationPage() {
  if (!isTestStandEnabled()) notFound()

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <section className="flex w-full max-w-2xl flex-col items-center gap-6" aria-labelledby="test-stand-title">
        <header className="flex max-w-lg flex-col gap-2 text-center">
          <p className="font-mono text-xs uppercase tracking-wider text-primary">Crackbot QA fixture</p>
          <h1 id="test-stand-title" className="text-balance text-2xl font-semibold tracking-tight">
            Безопасный OTP-стенд
          </h1>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Этот маршрут существует только для разрешённых автоматизированных проверок Crackbot.
          </p>
        </header>
        <RegistrationFlow />
      </section>
    </main>
  )
}
