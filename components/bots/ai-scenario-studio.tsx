'use client'

import * as React from 'react'
import { AlertTriangleIcon, BotIcon, CheckIcon, Code2Icon, GitCompareIcon, SendIcon, SparklesIcon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'

import { analyzePythonBot, applyAiProposal, proposePythonChange, rejectAiProposal } from '@/app/actions/ai-scenario'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { PythonWorkspaceInfo } from '@/lib/mock-data'

type Step = { id: string; title: string; summary: string; functions: string[]; dependencies: string[]; risk: 'low' | 'medium' | 'high' }
type Proposal = { id: string; explanation: string; proposedCode: string; proposedRequirements: string; steps: Step[]; warnings: string[] }

function CodeDiff({ before, after }: { before: string; after: string }) {
  const oldLines = before.split('\n')
  const newLines = after.split('\n')
  const count = Math.max(oldLines.length, newLines.length)
  return (
    <div className="grid min-w-4xl grid-cols-2 divide-x font-mono text-xs leading-5">
      <div>
        <div className="sticky top-0 border-b bg-muted px-3 py-2 font-sans font-medium">Текущий черновик</div>
        {Array.from({ length: count }, (_, index) => {
          const changed = oldLines[index] !== newLines[index]
          return <div key={`old-${index}`} className={cn('flex min-h-5 px-2', changed && 'bg-destructive/10')}><span className="w-10 shrink-0 select-none text-right text-muted-foreground">{index + 1}</span><span className="pl-3 whitespace-pre">{oldLines[index] ?? ''}</span></div>
        })}
      </div>
      <div>
        <div className="sticky top-0 border-b bg-muted px-3 py-2 font-sans font-medium">Предложение AI</div>
        {Array.from({ length: count }, (_, index) => {
          const changed = oldLines[index] !== newLines[index]
          return <div key={`new-${index}`} className={cn('flex min-h-5 px-2', changed && 'bg-primary/10')}><span className="w-10 shrink-0 select-none text-right text-muted-foreground">{index + 1}</span><span className="pl-3 whitespace-pre">{newLines[index] ?? ''}</span></div>
        })}
      </div>
    </div>
  )
}

export function AiScenarioStudio({ botId, workspace, onOpenPython }: { botId: string; workspace: PythonWorkspaceInfo | null; onOpenPython: () => void }) {
  const router = useRouter()
  const [selectedStepId, setSelectedStepId] = React.useState<string | undefined>()
  const [request, setRequest] = React.useState('')
  const [proposal, setProposal] = React.useState<Proposal | null>(null)
  const [busy, setBusy] = React.useState<'propose' | 'apply' | 'reject' | null>(null)
  const [error, setError] = React.useState('')
  const { data: analysis, error: analysisError, isLoading, mutate } = useSWR(
    workspace ? ['python-analysis', botId, workspace.draftCode.length, workspace.status] : null,
    async () => {
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Анализ занял слишком много времени')), 20_000))
      return Promise.race([analyzePythonBot(botId), timeout])
    },
    { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 60_000 },
  )

  if (!workspace) {
    return <Alert><Code2Icon /><AlertTitle>Сначала создайте Python workspace</AlertTitle><AlertDescription>Откройте вкладку bot.py и создайте исходный код. После этого AI сможет разобрать реальные шаги.</AlertDescription></Alert>
  }

  async function createProposal() {
    setBusy('propose'); setError(''); setProposal(null)
    try { setProposal(await proposePythonChange(botId, request, selectedStepId)); setRequest('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось подготовить изменение') }
    finally { setBusy(null) }
  }

  async function applyProposal() {
    if (!proposal) return
    setBusy('apply'); setError('')
    try { await applyAiProposal(botId, proposal.id); setProposal(null); await mutate(); router.refresh(); onOpenPython() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось применить diff') }
    finally { setBusy(null) }
  }

  async function rejectProposal() {
    if (!proposal) return
    setBusy('reject'); setError('')
    try { await rejectAiProposal(botId, proposal.id); setProposal(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось отклонить diff') }
    finally { setBusy(null) }
  }

  const steps = proposal?.steps ?? analysis?.steps ?? []
  const selectedStep = steps.find((step) => step.id === selectedStepId)

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <BotIcon />
        <AlertTitle>bot.py — единственный источник истины</AlertTitle>
        <AlertDescription>AI читает реальный nodriver/CDP-код и только предлагает diff. Рабочая версия не изменится, пока вы явно не примените, не протестируете и не опубликуете черновик.</AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="min-h-150">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><SparklesIcon />Карта автоматики</CardTitle>
            <CardDescription>Шаги извлечены из текущего bot.py и служат контекстом для AI.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner />Анализируем код...</div> : analysisError ? (
              <div className="flex flex-col gap-3"><p className="text-sm text-destructive">Не удалось проанализировать bot.py.</p><Button size="sm" variant="outline" onClick={() => mutate()}>Повторить анализ</Button></div>
            ) : steps.length === 0 ? (
              <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
                <p className="text-sm font-medium">Шаги не найдены</p>
                <p className="text-sm leading-relaxed text-muted-foreground">Проверьте, что bot.py содержит функции сценария, или повторите анализ.</p>
                <Button size="sm" variant="outline" onClick={() => mutate()}>Повторить анализ</Button>
              </div>
            ) : (
              <ScrollArea className="h-110 pr-3">
                <div className="flex flex-col gap-2">
                  {steps.map((step, index) => (
                    <button key={step.id} type="button" onClick={() => setSelectedStepId(step.id === selectedStepId ? undefined : step.id)} className={cn('flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60', step.id === selectedStepId && 'border-primary bg-primary/5')}>
                      <span className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{index + 1}. {step.title}</span><Badge variant={step.risk === 'high' ? 'destructive' : step.risk === 'medium' ? 'secondary' : 'outline'}>{step.risk}</Badge></span>
                      <span className="text-xs leading-relaxed text-muted-foreground">{step.summary}</span>
                      {step.functions.length ? <span className="font-mono text-xs text-muted-foreground">{step.functions.join(', ')}</span> : null}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Изменить логику с AI</CardTitle>
              <CardDescription>{selectedStep ? `Контекст: ${selectedStep.title}` : 'Контекст: весь bot.py'}</CardDescription>
            </CardHeader>
            <CardContent>
              <Field>
                <FieldLabel htmlFor="ai-change-request">Что нужно изменить?</FieldLabel>
                <Textarea id="ai-change-request" value={request} onChange={(event) => setRequest(event.target.value)} rows={5} maxLength={4000} placeholder="Например: если форма не найдена за 60 секунд, обнови страницу один раз и повтори поиск, не меняя остальную nodriver/CDP-логику." onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing && event.keyCode !== 229) void createProposal() }} />
                <FieldDescription>AI не получает runtime-секреты. Ctrl/⌘ + Enter — подготовить предложение.</FieldDescription>
              </Field>
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedStepId(undefined); onOpenPython() }}><Code2Icon data-icon="inline-start" />Открыть bot.py</Button>
              <Button size="sm" disabled={!request.trim() || busy !== null} onClick={createProposal}>{busy === 'propose' ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}{busy === 'propose' ? 'Готовим diff...' : 'Предложить изменение'}</Button>
            </CardFooter>
          </Card>

          {error ? <Alert variant="destructive"><AlertTriangleIcon /><AlertTitle>Операция не выполнена</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

          {proposal ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><GitCompareIcon />Предложение к черновику</CardTitle>
                <CardDescription>{proposal.explanation}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {proposal.warnings.map((warning) => <Alert key={warning}><AlertTriangleIcon /><AlertTitle>Проверьте изменение</AlertTitle><AlertDescription>{warning}</AlertDescription></Alert>)}
                <ScrollArea className="h-120 rounded-lg border"><CodeDiff before={workspace.draftCode} after={proposal.proposedCode} /></ScrollArea>
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <Button variant="outline" disabled={busy !== null} onClick={rejectProposal}>{busy === 'reject' ? <Spinner data-icon="inline-start" /> : <XIcon data-icon="inline-start" />}Отклонить</Button>
                <Button disabled={busy !== null} onClick={applyProposal}>{busy === 'apply' ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}{busy === 'apply' ? 'Применяем...' : 'Применить в черновик'}</Button>
              </CardFooter>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
