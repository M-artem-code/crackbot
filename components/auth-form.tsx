'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShieldCheckIcon, TerminalIcon } from 'lucide-react'

import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter(); const signUp = mode === 'sign-up'
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false)
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(null); setLoading(true); const result = signUp ? await authClient.signUp.email({ name, email, password }) : await authClient.signIn.email({ email, password }); setLoading(false); if (result.error) { setError(result.error.message ?? 'Не удалось продолжить'); return } router.push('/'); router.refresh() }
  return <main className="flex min-h-svh items-center justify-center bg-background p-4">
    <div className="flex w-full max-w-4xl overflow-hidden rounded-xl border bg-card shadow-2xl shadow-background md:min-h-[520px]">
      <section className="hidden flex-1 flex-col justify-between border-r bg-sidebar p-8 md:flex">
        <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><TerminalIcon className="size-5" /></div><div><p className="font-semibold">BotForge</p><p className="font-mono text-xs text-muted-foreground">qa automation workspace</p></div></div>
        <div className="flex max-w-sm flex-col gap-4"><ShieldCheckIcon className="size-9 text-primary" /><h1 className="text-balance text-3xl font-semibold tracking-tight">Ваши боты, прогоны и агенты изолированы в личном workspace.</h1><p className="text-pretty text-sm leading-relaxed text-muted-foreground">Управляйте автоматизацией, сценариями и приватными артефактами из единой защищённой панели.</p></div>
        <p className="font-mono text-xs text-muted-foreground">secure by default · private artifacts</p>
      </section>
      <section className="flex flex-1 items-center justify-center p-5 sm:p-8"><Card className="w-full max-w-sm border-0 bg-transparent shadow-none"><CardHeader className="px-0"><CardTitle className="text-2xl">{signUp ? 'Создать аккаунт' : 'Войти в BotForge'}</CardTitle><p className="text-sm text-muted-foreground">{signUp ? 'Создайте личный workspace для автоматизаций.' : 'Продолжите работу с вашими ботами.'}</p></CardHeader><CardContent className="px-0"><form onSubmit={submit} className="flex flex-col gap-4">
        {signUp && <div className="flex flex-col gap-2"><Label htmlFor="name">Имя</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></div>}
        <div className="flex flex-col gap-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="password">Пароль</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={signUp ? 'new-password' : 'current-password'} /><p className="text-xs text-muted-foreground">Минимум 8 символов.</p></div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">{loading && <Spinner data-icon="inline-start" />}{signUp ? 'Создать workspace' : 'Войти'}</Button>
      </form><p className="mt-6 text-center text-sm text-muted-foreground">{signUp ? 'Уже есть аккаунт? ' : 'Нет аккаунта? '}<Link className="font-medium text-foreground underline-offset-4 hover:underline" href={signUp ? '/sign-in' : '/sign-up'}>{signUp ? 'Войти' : 'Зарегистрироваться'}</Link></p></CardContent></Card></section>
    </div>
  </main>
}
