export const SCENARIO_VERSION = 1 as const

export const STEP_TYPES = [
  "navigate",
  "fill",
  "click",
  "waitForElement",
  "waitForEmail",
  "extractOtp",
  "fillOtp",
  "assertText",
  "assertVisible",
  "assertUrl",
  "screenshot",
] as const

export const LOCATOR_KINDS = [
  "role",
  "label",
  "placeholder",
  "testId",
  "text",
  "css",
] as const

export type ScenarioStepType = (typeof STEP_TYPES)[number]
export type LocatorKind = (typeof LOCATOR_KINDS)[number]

export interface LocatorStrategy {
  kind: LocatorKind
  value?: string
  role?: string
  name?: string
  exact?: boolean
}

export interface LocatorDefinition {
  strategies: LocatorStrategy[]
}

export interface RetryPolicy {
  maxAttempts: number
  delayMs: number
}

export interface ScenarioStepDefinition {
  id: string
  name: string
  type: ScenarioStepType
  timeoutMs?: number
  retry?: RetryPolicy
  continueOnError?: boolean
  enabled?: boolean
  secret?: boolean
  url?: string
  value?: string
  locator?: LocatorDefinition
  fileName?: string
}

export interface ScenarioDefinition {
  version: typeof SCENARIO_VERSION
  name: string
  variables?: Record<string, string>
  steps: ScenarioStepDefinition[]
}

const STEP_SET = new Set<string>(STEP_TYPES)
const LOCATOR_SET = new Set<string>(LOCATOR_KINDS)
const NEEDS_LOCATOR = new Set<ScenarioStepType>([
  "fill",
  "click",
  "waitForElement",
  "fillOtp",
  "assertVisible",
])

export interface ScenarioValidationResult {
  success: boolean
  errors: string[]
  scenario?: ScenarioDefinition
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validateLocator(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value) || !Array.isArray(value.strategies) || value.strategies.length === 0) {
    errors.push(`${path}.strategies должен содержать хотя бы одну стратегию`)
    return
  }

  value.strategies.forEach((raw, index) => {
    const strategyPath = `${path}.strategies[${index}]`
    if (!isRecord(raw)) {
      errors.push(`${strategyPath} должен быть объектом`)
      return
    }
    if (typeof raw.kind !== "string" || !LOCATOR_SET.has(raw.kind)) {
      errors.push(`${strategyPath}.kind не поддерживается`)
      return
    }
    if (raw.kind === "role") {
      if (typeof raw.role !== "string" || !raw.role.trim()) {
        errors.push(`${strategyPath}.role обязателен для role-локатора`)
      }
      if (typeof raw.name !== "string" || !raw.name.trim()) {
        errors.push(`${strategyPath}.name обязателен для role-локатора`)
      }
    } else if (typeof raw.value !== "string" || !raw.value.trim()) {
      errors.push(`${strategyPath}.value обязателен`)
    }
  })
}

export function validateScenarioDefinition(value: unknown): ScenarioValidationResult {
  const errors: string[] = []
  if (!isRecord(value)) return { success: false, errors: ["Сценарий должен быть объектом"] }

  if (value.version !== SCENARIO_VERSION) {
    errors.push(`Поддерживается только версия ${SCENARIO_VERSION}`)
  }
  if (typeof value.name !== "string" || !value.name.trim()) {
    errors.push("name обязателен")
  }
  if (!Array.isArray(value.steps) || value.steps.length === 0) {
    errors.push("steps должен содержать хотя бы один шаг")
  }
  if (value.variables !== undefined && !isRecord(value.variables)) {
    errors.push("variables должен быть объектом строк")
  }

  const ids = new Set<string>()
  if (Array.isArray(value.steps)) {
    value.steps.forEach((rawStep, index) => {
      const path = `steps[${index}]`
      if (!isRecord(rawStep)) {
        errors.push(`${path} должен быть объектом`)
        return
      }
      if (typeof rawStep.id !== "string" || !rawStep.id.trim()) {
        errors.push(`${path}.id обязателен`)
      } else if (ids.has(rawStep.id)) {
        errors.push(`${path}.id должен быть уникальным`)
      } else {
        ids.add(rawStep.id)
      }
      if (typeof rawStep.name !== "string" || !rawStep.name.trim()) {
        errors.push(`${path}.name обязателен`)
      }
      if (typeof rawStep.type !== "string" || !STEP_SET.has(rawStep.type)) {
        errors.push(`${path}.type не поддерживается`)
        return
      }

      const type = rawStep.type as ScenarioStepType
      if (NEEDS_LOCATOR.has(type)) validateLocator(rawStep.locator, `${path}.locator`, errors)
      if (type === "navigate" && (typeof rawStep.url !== "string" || !rawStep.url.trim())) {
        errors.push(`${path}.url обязателен для navigate`)
      }
      if (["fill", "assertText", "assertUrl"].includes(type) && typeof rawStep.value !== "string") {
        errors.push(`${path}.value обязателен для ${type}`)
      }
      if (rawStep.timeoutMs !== undefined) {
        const timeoutMs = Number(rawStep.timeoutMs)
        if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300_000) {
          errors.push(`${path}.timeoutMs должен быть от 100 до 300000`)
        }
      }
      if (rawStep.retry !== undefined) {
        if (!isRecord(rawStep.retry) ||
            !Number.isInteger(rawStep.retry.maxAttempts) ||
            Number(rawStep.retry.maxAttempts) < 1 ||
            Number(rawStep.retry.maxAttempts) > 5 ||
            !Number.isInteger(rawStep.retry.delayMs) ||
            Number(rawStep.retry.delayMs) < 0 ||
            Number(rawStep.retry.delayMs) > 30_000) {
          errors.push(`${path}.retry содержит недопустимые значения`)
        }
      }
    })
  }

  return errors.length
    ? { success: false, errors }
    : { success: true, errors: [], scenario: value as unknown as ScenarioDefinition }
}

export function assertScenarioDefinition(value: unknown): ScenarioDefinition {
  const result = validateScenarioDefinition(value)
  if (!result.success || !result.scenario) {
    throw new Error(`Некорректный сценарий: ${result.errors.join("; ")}`)
  }
  return result.scenario
}
