import type { ScenarioDefinition } from "@/lib/scenario/schema"

// ---------------------------------------------------------------------------
// Общие типы и клиент-безопасные хелперы.
// Реальные данные приходят из БД через lib/queries.ts (server-only).
// ---------------------------------------------------------------------------

export type BotStatus = "active" | "paused" | "error" | "idle"
export type RunStatus = "success" | "failed" | "cancelled" | "running" | "queued"
export type StepStatus = "success" | "failed" | "running" | "pending"
export type RefStatus = "active" | "exhausted" | "disabled"
export type AgentStatus = "online" | "offline" | "disabled"

// Агент считается онлайн, если присылал heartbeat за последние 90 секунд.
export const AGENT_ONLINE_THRESHOLD_MS = 90_000

export interface LogStep {
  id: string
  label: string
  detail?: string
  status: StepStatus
  durationMs: number
  stepId?: string
  attempt?: number
  metadata?: Record<string, unknown>
}

export interface RunArtifact {
  id: string
  kind: "screenshot" | "dom" | "report"
  worker: number
  stepId: string | null
  contentType: string
  byteSize: number
  createdAt: string
  url: string
}

export interface Run {
  id: string
  botId: string
  status: RunStatus
  startedAt: string | null
  durationMs: number
  stepsTotal: number
  stepsPassed: number
  targetUrl: string
  steps: LogStep[]
  error?: string | null
  successCount?: number
  failedCount?: number
  agentId?: string | null
  scenarioName?: string
  scenarioVersion?: number
  scenarioVersionId?: string | null
  artifacts?: RunArtifact[]
}

export interface BotRef {
  id: string
  url: string
  successLimit: number
  successCount: number
  failedCount: number
  status: RefStatus
  lastUsedAt: string | null
}

export interface TemplateField {
  key: string
  label: string
  source: string
  required: boolean
}

export interface ScenarioStep {
  step: string
  label: string
}

export interface TemplateInfo {
  id: string
  slug: string
  name: string
  description: string
  engine: string
  flowType: string
  fields: TemplateField[]
  scenarioSteps: ScenarioStep[]
}

export interface ScenarioVersionInfo {
  id: string
  version: number
  snapshot: ScenarioDefinition
  author: string
  changeSummary: string
  sourceVersionId: string | null
  createdAt: string
  isCurrent: boolean
}

export interface Bot {
  id: string
  name: string
  description: string
  targetUrl: string
  status: BotStatus
  template: string
  templateSlug: string
  flowType: string
  totalRuns: number
  successRate: number
  lastRunAt: string | null
  avgDurationMs: number
  workers: number
  refs: BotRef[]
  scenarioSteps: ScenarioStep[]
  scenarioDraft: ScenarioDefinition | null
  scenarioPublished: ScenarioDefinition
  scenarioStatus: "draft" | "published"
  publishedScenarioVersionId: string | null
  scenarioVersions: ScenarioVersionInfo[]
  config: Record<string, unknown>
}

export interface RecentRun {
  id: string
  botId: string
  botName: string
  status: RunStatus
  startedAt: string | null
  durationMs: number
}

export interface DailyStat {
  date: string
  success: number
  failed: number
}

export interface DashboardStats {
  totalRuns: number
  successRate: number
  totalErrors: number
  hoursSaved: number
}

export interface AgentInfo {
  id: string
  name: string
  os: string
  keyPrefix: string
  status: AgentStatus
  disabled: boolean
  activeRuns: number
  lastSeenAt: string | null
  createdAt: string | null
}

// ---------------------------------------------------------------------------
// Пул-шаги живого прогона в UI (используется в мастере и на детальной странице)
// ---------------------------------------------------------------------------

export const REGISTRATION_TEMPLATE_STEPS = [
  "Открываю целевую страницу",
  "Ищу форму регистрации",
  "Нахожу поле email",
  "Ввожу тестовый email",
  "Нахожу поле пароля",
  "Генерирую и ввожу пароль",
  "Нажимаю кнопку «Зарегистрироваться»",
  "Жду письмо с кодом подтверждения",
  "Получаю код из почтового ящика",
  "Ввожу код подтверждения",
  "Проверяю успешное создание аккаунта",
] as const

// ---------------------------------------------------------------------------
// Форматирование
// ---------------------------------------------------------------------------

export function formatDuration(ms: number): string {
  if (!ms || ms < 1000) return `${ms || 0} мс`
  return `${(ms / 1000).toFixed(1)} с`
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Относительное время «N назад» для отображения последнего heartbeat.
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "никогда"
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return "только что"
  const sec = Math.floor(diff / 1000)
  if (sec < 10) return "только что"
  if (sec < 60) return `${sec} с назад`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} мин назад`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs} ч назад`
  const days = Math.floor(hrs / 24)
  return `${days} дн назад`
}

// ---------------------------------------------------------------------------
// AI-ассистент (заглушка)
// ---------------------------------------------------------------------------

export const assistantSuggestions = [
  "Как создать бота для проверки регистрации?",
  "Почему упал прогон на checkout-flow?",
  "Как привязать базу данных к боту?",
  "Что делать, если сайт поменял вёрстку?",
]

export function getAssistantReply(input: string): string {
  const q = input.toLowerCase()

  if (q.includes("созда") || q.includes("регистрац")) {
    return "Чтобы создать бота для проверки регистрации:\n\n1. Перейдите в раздел «Создать бота»\n2. Выберите шаблон «Проверка регистрации» — он уже умеет искать поля email/пароль, нажимать кнопки разными способами и проверять код подтверждения на почте\n3. Укажите URL вашего деплоя (например, ссылку с Vercel)\n4. Привяжите базу данных с целевыми URL и тестовыми аккаунтами\n\nШаблон сам адаптируется под структуру вашей формы. Если что-то не найдётся — я помогу подправить сценарий."
  }
  if (q.includes("упал") || q.includes("ошибк") || q.includes("почему")) {
    return "Смотрю последний прогон… Похоже, ошибка на шаге поиска кнопки: селектор не найден. Обычно это значит, что на сайте изменилась вёрстка формы.\n\nРекомендую:\n1. Открыть логи прогона и найти шаг с ошибкой\n2. Проверить, не переименовали ли кнопку отправки\n3. Обновить селектор в настройках бота — обычно это занимает пару минут\n\nМогу предложить новый селектор на основе текущей структуры страницы."
  }
  if (q.includes("баз") || q.includes("бд") || q.includes("привяза") || q.includes("реф")) {
    return "У каждого бота — своя отдельная база данных (реф-пул). Она хранит:\n\n• Реф-ссылки для регистраций\n• Лимит успешных регистраций на каждую ссылку\n• Счётчики успехов/ошибок и статус ссылки\n\nКогда лимит достигнут, ссылка помечается как «исче��пана», и агент берёт следующую активную. Управлять пулом можно на вкладке «База данных» бота."
  }
  if (q.includes("вёрстк") || q.includes("верстк") || q.includes("селектор") || q.includes("поменял")) {
    return "Если сайт поменял вёрстку и бот перестал находить элементы:\n\n1. Откройте логи упавшего прогона — там видно, на каком шаге и какой селектор не сработал\n2. Шаблон пробует несколько стратегий поиска (по тексту, placeholder, атрибутам), поэтому мелкие изменения он переживает сам\n3. Если не помогло — обновите селектор в настройках бота\n\nОбычно починка занимает 10–15 минут."
  }
  return "Хороший вопрос! В текущей версии я помогаю с созданием ботов, разбором логов и ошибок, привязкой реф-пулов и починкой селекторов.\n\n��опробуйте один из вариантов ниже или опишите задачу подробнее — например, какой сайт хотите проверять и что должен делать бот."
}
