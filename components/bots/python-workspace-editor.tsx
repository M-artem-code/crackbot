'use client'

import * as React from 'react'
import { CheckCircle2Icon, FlaskConicalIcon, HistoryIcon, PlayIcon, RotateCcwIcon, SaveIcon, ShieldCheckIcon } from 'lucide-react'
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
  const dirty = Boolean(workspace && (code !== workspace.draftCode || requirements !== workspace.draftRequirements))
  const tested = workspace?.lastTestStatus === 'success' && !dirty

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label); setMessage(null)
    try { await fn(); setMessage(label === 'test' ? 'Тест поставлен в очередь агента' : 'Готово'); router.refresh() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Неизвестная ошибка') }
    finally { setBusy(null) }
  }

  if (!workspace) return <Card><CardHeader><CardTitle>Python workspace</CardTitle><CardDescription>Создайте личную копию bot.py из шаблона этого бота.</CardDescription></CardHeader><CardContent><Button onClick={() => run('init', () => ensurePythonWorkspace(botId))} disabled={Boolean(busy)}>{busy ? <Spinner data-icon="inline-start" /> : <PlayIcon data-icon="inline-start" />}Открыть исходный код</Button>{message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}</CardContent></Card>

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
          <TabsContent value="requirements"><label className="sr-only" htmlFor="python-requirements">Python зависимости</label><textarea id="python-requirements" value={requirements} onChange={(event) => setRequirements(event.target.value)} spellCheck={false} className="min-h-56 w-full resize-y rounded-md border bg-muted/30 p-4 font-mono text-sm leading-6 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" /><p className="mt-2 text-xs text-muted-foreground">Один пакет на строку. Установка выполняется внутри нового контейнера и не меняет агент.</p></TabsContent>
          <TabsContent value="console"><pre className="min-h-56 overflow-auto rounded-md border bg-muted/30 p-4 font-mono text-xs leading-5 text-foreground">{workspace.lastTestOutput || 'Запустите тест черновика, чтобы увидеть stdout, stderr и результат sandbox.'}</pre></TabsContent>
        </Tabs>
        <div className="flex flex-col gap-3 border-t pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => run('save', () => savePythonDraft(botId, code, requirements))} disabled={Boolean(busy)}>{busy === 'save' ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}Сохранить черновик</Button><Button variant="outline" onClick={() => run('test', () => testPythonDraft(botId, code, requirements))} disabled={Boolean(busy)}>{busy === 'test' ? <Spinner data-icon="inline-start" /> : <FlaskConicalIcon data-icon="inline-start" />}Тест в sandbox</Button></div>
          <div className="flex flex-col gap-2 sm:flex-row"><Input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Что изменилось" className="sm:w-64" /><Button onClick={() => run('publish', () => publishPythonDraft(botId, code, requirements, summary))} disabled={Boolean(busy) || !tested}>{busy === 'publish' ? <Spinner data-icon="inline-start" /> : <CheckCircle2Icon data-icon="inline-start" />}Опубликовать</Button></div>
        </div>
        {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><HistoryIcon className="size-4" />История Python-версий</CardTitle><CardDescription>Откат создаёт безопасный черновик и не меняет активную версию до теста и публикации.</CardDescription></CardHeader><CardContent className="flex flex-col gap-2">{workspace.versions.length ? workspace.versions.map((version) => <div key={version.id} className="flex items-center justify-between gap-3 rounded-md border p-3"><div><p className="text-sm font-medium">v{version.version} {version.isCurrent ? <Badge className="ml-2" variant="outline">Активна</Badge> : null}</p><p className="text-xs text-muted-foreground">{version.changeSummary}</p></div><Button size="sm" variant="ghost" disabled={Boolean(busy) || version.isCurrent} onClick={() => run('rollback', () => rollbackPythonVersion(botId, version.id))}><RotateCcwIcon data-icon="inline-start" />В черновик</Button></div>) : <p className="text-sm text-muted-foreground">Опубликованных пользовательских версий пока нет.</p>}</CardContent></Card>
  </div>
}
