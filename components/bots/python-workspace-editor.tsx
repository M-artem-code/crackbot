'use client'

import * as React from 'react'
import { CheckCircle2Icon, FlaskConicalIcon, HistoryIcon, RotateCcwIcon, SaveIcon, ShieldCheckIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { ensurePythonWorkspace, publishPythonDraft, rollbackPythonVersion, savePythonDraft, testPythonDraft } from '@/app/actions/python-workspace'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { PythonWorkspaceInfo } from '@/lib/mock-data'

export function PythonWorkspaceEditor({ botId, workspace }: { botId: string; workspace: PythonWorkspaceInfo | null }) {
  const router = useRouter()
  const [code, setCode] = React.useState(workspace?.draftCode ?? '')
  const [requirements, setRequirements] = React.useState(workspace?.draftRequirements ?? '')
  const [summary, setSummary] = React.useState('')
  const [busy, setBusy] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [savedCode, setSavedCode] = React.useState(workspace?.draftCode ?? '')
  const [savedRequirements, setSavedRequirements] = React.useState(workspace?.draftRequirements ?? '')
  const [testStatus, setTestStatus] = React.useState(workspace?.lastTestStatus ?? null)
  const dirty = Boolean(workspace && (code !== savedCode || requirements !== savedRequirements))
  const tested = testStatus === 'success' && !dirty

  React.useEffect(() => {
    if (!workspace) return
    setCode(workspace.draftCode)
    setRequirements(workspace.draftRequirements)
    setSavedCode(workspace.draftCode)
    setSavedRequirements(workspace.draftRequirements)
    setTestStatus(workspace.lastTestStatus)
  }, [workspace])

  React.useEffect(() => {
    if (workspace) return
    let active = true
    setBusy('init')
    ensurePythonWorkspace(botId)
      .then(() => { if (active) router.refresh() })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : 'Не удалось создать bot.py') })
      .finally(() => { if (active) setBusy(null) })
    return () => { active = false }
  }, [botId, router, workspace])

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label); setMessage(null)
    try {
      await fn()
      if (label === 'save' || label === 'test') {
        setSavedCode(code)
        setSavedRequirements(requirements)
        if (label === 'save') setTestStatus(null)
      }
      setMessage('Готово')
      router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Неизвестная ошибка') }
    finally { setBusy(null) }
  }

  async function handleTest() {
    setBusy('test'); setMessage(null); setTestStatus('pending')
    try {
      const { runId } = await testPythonDraft(botId, code, requirements)
      setSavedCode(code); setSavedRequirements(requirements)
      setMessage('Тест в очереди — ожидаем локальный Runner')
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500))
        const response = await fetch(`/api/runs/${runId}`, { cache: 'no-store' })
        if (!response.ok) continue
        const run = await response.json() as { status: string; error?: string }
        if (run.status === 'success') { setTestStatus('success'); setMessage('Тест успешно завершён. Публикация доступна.'); router.refresh(); return }
        if (['failed', 'cancelled', 'partial'].includes(run.status)) { setTestStatus('failed'); setMessage(run.error || 'Тест завершился с ошибкой'); router.refresh(); return }
        setMessage(run.status === 'running' ? 'Runner выполняет тест...' : 'Тест в очереди — ожидаем локальный Runner')
      }
      setMessage('Runner не завершил тест. Проверьте его подключение и повторите попытку.')
    } catch (error) { setTestStatus('failed'); setMessage(error instanceof Error ? error.message : 'Не удалось запустить тест') }
    finally { setBusy(null) }
  }

  if (!workspace) return <Card><CardHeader><CardTitle>Создаём bot.py</CardTitle><CardDescription>Готовим личный черновик из шаблона этого бота.</CardDescription></CardHeader><CardContent><div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner />Инициализация редактора...</div>{message ? <p className="mt-3 text-sm text-destructive">{message}</p> : null}</CardContent></Card>

  return <div className="flex flex-col gap-4">
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5"><CardTitle className="flex items-center gap-2"><ShieldCheckIcon className="size-5 text-primary" />Python workspace</CardTitle><CardDescription>Полный Python и любые PyPI-пакеты исполняются только внутри одноразового sandbox-контейнера.</CardDescription></div>
        <Badge variant={workspace.status === 'draft' ? 'secondary' : 'outline'}>{workspace.status === 'draft' ? 'Черновик' : 'Опубликовано'}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs defaultValue="code">
          <TabsList><TabsTrigger value="code">bot.py</TabsTrigger><TabsTrigger value="requirements">requirements.txt</TabsTrigger><TabsTrigger value="console">Тест-консоль</TabsTrigger></TabsList>
          <TabsContent value="code"><label className="sr-only" htmlFor="python-code">Код bot.py</label><textarea id="python-code" value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} className="min-h-[460px] w-full resize-y rounded-md border bg-muted/30 p-4 font-mono text-sm leading-6 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" /></TabsContent>
          <TabsContent value="requirements"><label className="sr-only" htmlFor="python-requirements">Python зависимости</label><textarea id="python-requirements" value={requirements} onChange={(event) => setRequirements(event.target.value)} spellCheck={false} className="min-h-56 w-full resize-y rounded-md border bg-muted/30 p-4 font-mono text-sm leading-6 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" /><p className="mt-2 text-xs text-muted-foreground">Один пакет на строку с точной версией, например requests==2.32.3. Диапазоны версий и пакеты вне безопасного списка не поддерживаются.</p></TabsContent>
          <TabsContent value="console"><pre className="min-h-56 overflow-auto rounded-md border bg-muted/30 p-4 font-mono text-xs leading-5 text-foreground">{workspace.lastTestOutput || 'Запустите тест черновика, чтобы увидеть stdout, stderr и результат sandbox.'}</pre></TabsContent>
        </Tabs>
        <div className="flex flex-col gap-3 border-t pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => run('save', () => savePythonDraft(botId, code, requirements))} disabled={Boolean(busy)}>{busy === 'save' ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}Сохранить черновик</Button><Button variant="outline" onClick={handleTest} disabled={Boolean(busy)}>{busy === 'test' ? <Spinner data-icon="inline-start" /> : <FlaskConicalIcon data-icon="inline-start" />}{busy === 'test' ? 'Тест выполняется' : 'Тест в sandbox'}</Button></div>
          <div className="flex flex-col gap-2 sm:flex-row"><Input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Что изменилось" className="sm:w-64" /><Button onClick={() => run('publish', () => publishPythonDraft(botId, code, requirements, summary))} disabled={Boolean(busy) || !tested}>{busy === 'publish' ? <Spinner data-icon="inline-start" /> : <CheckCircle2Icon data-icon="inline-start" />}Опубликовать</Button></div>
        </div>
        {!tested ? <p className="text-xs text-muted-foreground">{dirty ? 'Сохраните и успешно протестируйте текущие изменения, чтобы опубликовать их.' : testStatus === 'pending' ? 'Публикация станет доступна после успешного завершения теста.' : testStatus === 'failed' ? 'Исправьте ошибку и повторите тест перед публикацией.' : 'Успешно протестируйте текущий черновик перед публикацией.'}</p> : null}
        {message ? <p role="status" className={testStatus === 'failed' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>{message}</p> : null}
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><HistoryIcon className="size-4" />История Python-версий</CardTitle><CardDescription>Откат создаёт безопасный черновик и не меняет активную версию до теста и публикации.</CardDescription></CardHeader><CardContent className="flex flex-col gap-2">{workspace.versions.length ? workspace.versions.map((version) => <div key={version.id} className="flex items-center justify-between gap-3 rounded-md border p-3"><div><p className="text-sm font-medium">v{version.version} {version.isCurrent ? <Badge className="ml-2" variant="outline">Активна</Badge> : null}</p><p className="text-xs text-muted-foreground">{version.changeSummary}</p></div><Button size="sm" variant="ghost" disabled={Boolean(busy) || version.isCurrent} onClick={() => run('rollback', () => rollbackPythonVersion(botId, version.id))}><RotateCcwIcon data-icon="inline-start" />В черновик</Button></div>) : <p className="text-sm text-muted-foreground">Опубликованных пользовательских версий пока нет.</p>}</CardContent></Card>
  </div>
}
