import type { ScenarioDefinition, ScenarioStepDefinition } from '@/lib/scenario/schema'

export interface ScenarioDiff {
  added: string[]
  removed: string[]
  changed: Array<{ id: string; fields: string[] }>
  reordered: boolean
  summary: string
}

function changedFields(before: ScenarioStepDefinition, after: ScenarioStepDefinition): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter((key) => {
    if (key === 'id') return false
    return JSON.stringify(before[key as keyof ScenarioStepDefinition]) !== JSON.stringify(after[key as keyof ScenarioStepDefinition])
  })
}

export function diffScenarios(before: ScenarioDefinition, after: ScenarioDefinition): ScenarioDiff {
  const beforeById = new Map(before.steps.map((step) => [step.id, step]))
  const afterById = new Map(after.steps.map((step) => [step.id, step]))
  const added = after.steps.filter((step) => !beforeById.has(step.id)).map((step) => step.id)
  const removed = before.steps.filter((step) => !afterById.has(step.id)).map((step) => step.id)
  const changed = after.steps
    .filter((step) => beforeById.has(step.id))
    .map((step) => ({ id: step.id, fields: changedFields(beforeById.get(step.id)!, step) }))
    .filter((item) => item.fields.length > 0)
  const sharedBefore = before.steps.filter((step) => afterById.has(step.id)).map((step) => step.id)
  const sharedAfter = after.steps.filter((step) => beforeById.has(step.id)).map((step) => step.id)
  const reordered = sharedBefore.join('\u0000') !== sharedAfter.join('\u0000')
  const parts = [
    added.length ? `+${added.length}` : '',
    removed.length ? `−${removed.length}` : '',
    changed.length ? `~${changed.length}` : '',
    reordered ? 'порядок изменён' : '',
  ].filter(Boolean)
  return { added, removed, changed, reordered, summary: parts.join(' · ') || 'Без изменений' }
}
