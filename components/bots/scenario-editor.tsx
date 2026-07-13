'use client'

import * as React from 'react'
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, PlayIcon, PlusIcon, SaveIcon, SendIcon, TrashIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { publishScenario, saveScenarioDraft, testScenarioStep } from '@/app/actions/bots'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { LOCATOR_KINDS, STEP_TYPES, validateScenarioDefinition, type LocatorKind, type ScenarioDefinition, type ScenarioStepDefinition, type ScenarioStepType } from '@/lib/scenario/schema'

const NEEDS_LOCATOR = new Set<ScenarioStepType>(['fill', 'click', 'waitForElement', 'fillOtp', 'assertVisible'])
const NEEDS_VALUE = new Set<ScenarioStepType>(['fill', 'assertText', 'assertUrl'])
const LABELS: Record<ScenarioStepType, string> = {
  navigate: 'Открыть URL', fill: 'Заполнить поле', click: 'Нажать', waitForElement: 'Ждать элемент',
  waitForEmail: 'Ждать письмо', extractOtp: 'Извлечь OTP', fillOtp: 'Ввести OTP', assertText: 'Проверить текст',
  assertVisible: 'Проверить видимость', assertUrl: 'Проверить URL', screenshot: 'Скриншот',
}

export function ScenarioEditor({ botId, initial, status }: { botId: string; initial: ScenarioDefinition; status: 'draft' | 'published' }) {
  const router = useRouter()
  const [scenario, setScenario] = React.useState(initial)
  const [selected, setSelected] = React.useState(0)
  const [busy, setBusy] = React.useState<'save' | 'publish' | 'test' | null>(null)
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const validation = React.useMemo(() => validateScenarioDefinition(scenario), [scenario])
  const step = scenario.steps[selected]

  function setSteps(steps: ScenarioStepDefinition[], nextSelected = selected) {
    setScenario((value) => ({ ...value, steps }))
    setSelected(Math.min(Math.max(0, nextSelected), Math.max(0, steps.length - 1)))
    setFeedback(null)
  }
  function patchStep(patch: Partial<ScenarioStepDefinition>) {
    setSteps(scenario.steps.map((item, index) => index === selected ? { ...item, ...patch } : item))
  }
  function move(direction: -1 | 1) {
    const target = selected + direction
    if (target < 0 || target >= scenario.steps.length) return
    const steps = [...scenario.steps]
    ;[steps[selected], steps[target]] = [steps[target], steps[selected]]
    setSteps(steps, target)
  }
  function addStep() {
    const id = `step-${Date.now().toString(36)}`
    const next: ScenarioStepDefinition = { id, name: 'Новый шаг', type: 'click', timeoutMs: 10000, retry: { maxAttempts: 1, delayMs: 500 }, enabled: true, locator: { strategies: [{ kind: 'text', value: 'Кнопка' }] } }
    setSteps([...scenario.steps, next], scenario.steps.length)
  }
  function duplicate() {
    if (!step) return
    const copy = structuredClone(step)
    copy.id = `${step.id}-copy-${Date.now().toString(36)}`
    copy.name = `${step.name} (копия)`
    const steps = [...scenario.steps]
    steps.splice(selected + 1, 0, copy)
    setSteps(steps, selected + 1)
  }
  function remove() {
    if (scenario.steps.length <= 1) return setFeedback('Сценарий должен содержать хотя бы один шаг')
    setSteps(scenario.steps.filter((_, index) => index !== selected), selected - 1)
  }
  async function submit(kind: 'save' | 'publish' | 'test') {
    if (!validation.success) return setFeedback(validation.errors[0])
    setBusy(kind)
    setFeedback(null)
    try {
      if (kind === 'save') await saveScenarioDraft(botId, scenario)
      if (kind === 'publish') await publishScenario(botId, scenario)
      if (kind === 'test') await testScenarioStep(botId, scenario, selected)
      setFeedback(kind === 'save' ? 'Черновик сохранён' : kind === 'publish' ? 'Сценарий опубликован' : 'Тест поставлен в очередь')
      router.refresh()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Операция не выполнена')
    } finally { setBusy(null) }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2"><CardTitle>Редактор сценария</CardTitle><Badge variant={status === 'draft' ? 'outline' : 'secondary'}>{status === 'draft' ? 'Черновик' : 'Опубликован'}</Badge></div>
            <CardDescription>Соберите проверку из безопасных команд DSL без Python и ручного JSON.</CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => submit('save')} disabled={busy !== null}>{busy === 'save' ? <Spinner /> : <SaveIcon />}Сохранить</Button>
            <Button onClick={() => submit('publish')} disabled={busy !== null}>{busy === 'publish' ? <Spinner /> : <SendIcon />}Опубликовать</Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input aria-label="Название сценария" value={scenario.name} onChange={(event) => setScenario({ ...scenario, name: event.target.value })} />
            <Button variant="outline" onClick={addStep}><PlusIcon />Добавить шаг</Button>
          </div>
          {feedback ? <p role="status" className={cn('text-sm', validation.success ? 'text-muted-foreground' : 'text-destructive')}>{feedback}</p> : null}
          {!validation.success ? <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><strong>{validation.errors.length} ошибок:</strong> {validation.errors.slice(0, 3).join('; ')}</div> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(24rem,1.2fr)]">
        <Card>
          <CardHeader><CardTitle>Шаги</CardTitle><CardDescription>{scenario.steps.length} команд · нажмите для настройки</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {scenario.steps.map((item, index) => (
              <button key={item.id} type="button" onClick={() => setSelected(index)} className={cn('flex items-center gap-3 rounded-md border p-3 text-left transition-colors', index === selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50', item.enabled === false && 'opacity-50')}>
                <span className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.name}</span><span className="block text-xs text-muted-foreground">{LABELS[item.type]}</span></span>
                {item.continueOnError ? <Badge variant="outline">continue</Badge> : null}
              </button>
            ))}
          </CardContent>
        </Card>

        {step ? <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div><CardTitle>Шаг {selected + 1}</CardTitle><CardDescription className="font-mono">{step.id}</CardDescription></div>
            <div className="flex gap-1"><Button size="icon-sm" variant="outline" aria-label="Выше" onClick={() => move(-1)} disabled={selected === 0}><ArrowUpIcon /></Button><Button size="icon-sm" variant="outline" aria-label="Ниже" onClick={() => move(1)} disabled={selected === scenario.steps.length - 1}><ArrowDownIcon /></Button><Button size="icon-sm" variant="outline" aria-label="Дублировать" onClick={duplicate}><CopyIcon /></Button><Button size="icon-sm" variant="outline" aria-label="Удалить" onClick={remove}><TrashIcon /></Button></div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-1.5 text-sm font-medium">Название<Input value={step.name} onChange={(event) => patchStep({ name: event.target.value })} /></label><label className="flex flex-col gap-1.5 text-sm font-medium">Команда<select className="h-9 rounded-md border bg-background px-3 text-sm" value={step.type} onChange={(event) => patchStep({ type: event.target.value as ScenarioStepType })}>{STEP_TYPES.map((type) => <option key={type} value={type}>{LABELS[type]}</option>)}</select></label></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-1.5 text-sm font-medium">Таймаут, мс<Input type="number" min={100} max={300000} value={step.timeoutMs ?? 10000} onChange={(event) => patchStep({ timeoutMs: Number(event.target.value) })} /></label><label className="flex flex-col gap-1.5 text-sm font-medium">Попытки<Input type="number" min={1} max={5} value={step.retry?.maxAttempts ?? 1} onChange={(event) => patchStep({ retry: { maxAttempts: Number(event.target.value), delayMs: step.retry?.delayMs ?? 500 } })} /></label></div>
            <div className="flex flex-wrap gap-5 rounded-md border p-3"><label className="flex items-center gap-2 text-sm"><Switch checked={step.enabled !== false} onCheckedChange={(enabled) => patchStep({ enabled })} />Включён</label><label className="flex items-center gap-2 text-sm"><Switch checked={Boolean(step.continueOnError)} onCheckedChange={(continueOnError) => patchStep({ continueOnError })} />Продолжать при ошибке</label><label className="flex items-center gap-2 text-sm"><Switch checked={Boolean(step.secret)} onCheckedChange={(secret) => patchStep({ secret })} />Секретное значение</label></div>
            {step.type === 'navigate' ? <label className="flex flex-col gap-1.5 text-sm font-medium">URL<Input className="font-mono" value={step.url ?? ''} onChange={(event) => patchStep({ url: event.target.value })} placeholder="{{baseUrl}}/register" /></label> : null}
            {NEEDS_VALUE.has(step.type) ? <label className="flex flex-col gap-1.5 text-sm font-medium">Значение<Input className="font-mono" type={step.secret ? 'password' : 'text'} value={step.value ?? ''} onChange={(event) => patchStep({ value: event.target.value })} placeholder="{{generated.email}}" /></label> : null}
            {NEEDS_LOCATOR.has(step.type) ? <LocatorEditor step={step} patchStep={patchStep} /> : null}
            <div className="flex justify-end"><Button variant="outline" onClick={() => submit('test')} disabled={busy !== null}>{busy === 'test' ? <Spinner /> : <PlayIcon />}Тест до этого шага</Button></div>
          </CardContent>
        </Card> : null}
      </div>
      <Card><CardHeader><CardTitle>JSON preview</CardTitle><CardDescription>Точный DSL, который получит локальный агент после публикации.</CardDescription></CardHeader><CardContent><pre className="max-h-80 overflow-auto rounded-md border bg-muted/30 p-4 font-mono text-xs leading-relaxed">{JSON.stringify(scenario, null, 2)}</pre></CardContent></Card>
    </div>
  )
}

function LocatorEditor({ step, patchStep }: { step: ScenarioStepDefinition; patchStep: (patch: Partial<ScenarioStepDefinition>) => void }) {
  const strategies = step.locator?.strategies ?? [{ kind: 'text' as const, value: '' }]
  function patch(index: number, next: Record<string, unknown>) {
    patchStep({ locator: { strategies: strategies.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item) } })
  }
  function add() { patchStep({ locator: { strategies: [...strategies, { kind: 'text', value: '' }] } }) }
  function remove(index: number) {
    if (strategies.length > 1) patchStep({ locator: { strategies: strategies.filter((_, itemIndex) => itemIndex !== index) } })
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">Fallback-локаторы</span><Button size="sm" variant="ghost" onClick={add}><PlusIcon />Добавить</Button></div>
      {strategies.map((strategy, index) => <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[8rem_1fr_auto]">
        <select aria-label={`Тип локатора ${index + 1}`} className="h-9 rounded-md border bg-background px-2 text-sm" value={strategy.kind} onChange={(event) => patch(index, { kind: event.target.value as LocatorKind, value: '', role: '', name: '' })}>{LOCATOR_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select>
        {strategy.kind === 'role' ? <div className="grid gap-2 sm:grid-cols-2"><Input aria-label="ARIA role" value={strategy.role ?? ''} onChange={(event) => patch(index, { role: event.target.value })} placeholder="button" /><Input aria-label="Accessible name" value={strategy.name ?? ''} onChange={(event) => patch(index, { name: event.target.value })} placeholder="Зарегистрироваться" /></div> : <Input aria-label="Значение локатора" className="font-mono" value={strategy.value ?? ''} onChange={(event) => patch(index, { value: event.target.value })} placeholder={strategy.kind === 'css' ? '[data-field=email]' : 'Email'} />}
        <Button size="icon-sm" variant="ghost" aria-label="Удалить локатор" onClick={() => remove(index)} disabled={strategies.length === 1}><TrashIcon /></Button>
      </div>)}
      <p className="text-xs leading-relaxed text-muted-foreground">Стратегии проверяются сверху вниз. Предпочитайте role, label и testId перед CSS.</p>
    </div>
  )
}

