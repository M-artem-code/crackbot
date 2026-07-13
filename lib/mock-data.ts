export type BotStatus = 'active' | 'paused' | 'error'
export type RunStatus = 'success' | 'failed' | 'running'
export type StepStatus = 'success' | 'failed' | 'running' | 'pending'
export type DbRecordStatus = 'queued' | 'processed' | 'error'

export interface LogStep {
  id: string
  label: string
  detail?: string
  status: StepStatus
  durationMs: number
}

export interface Run {
  id: string
  botId: string
  status: RunStatus
  startedAt: string
  durationMs: number
  stepsTotal: number
  stepsPassed: number
  targetUrl: string
  steps: LogStep[]
}

export interface DbRecord {
  id: string
  targetUrl: string
  testEmail: string
  status: DbRecordStatus
  addedAt: string
}

export interface BotDatabase {
  id: string
  name: string
  connected: boolean
  records: DbRecord[]
}

export interface Bot {
  id: string
  name: string
  description: string
  targetUrl: string
  status: BotStatus
  template: string
  totalRuns: number
  successRate: number
  lastRunAt: string
  avgDurationMs: number
  database: BotDatabase
  settings: {
    checkEmailCode: boolean
    screenshotsOnError: boolean
    parallelRuns: number
    schedule: string
  }
}

export interface DailyStat {
  date: string
  success: number
  failed: number
}

// ---------------------------------------------------------------------------
// Шаблон шагов флагманского сценария «Проверка регистрации»
// ---------------------------------------------------------------------------

export const REGISTRATION_TEMPLATE_STEPS = [
  'Открываю целевую страницу',
  'Ищу форму регистрации',
  'Нахожу поле email',
  'Ввожу тестовый email',
  'Нахожу поле пароля',
  'Генерирую и ввожу пароль',
  'Нажимаю кнопку «Зарегистрироваться»',
  'Жду письмо с кодом подтверждения',
  'Получаю код из почтового ящика',
  'Ввожу код подтверждения',
  'Проверяю успешное создание аккаунта',
] as const

function successSteps(): LogStep[] {
  const durations = [1240, 380, 210, 460, 180, 520, 640, 8200, 940, 720, 1100]
  return REGISTRATION_TEMPLATE_STEPS.map((label, i) => ({
    id: `s${i}`,
    label,
    status: 'success' as const,
    durationMs: durations[i] ?? 500,
  }))
}

function failedSteps(failIndex: number, failDetail: string): LogStep[] {
  const durations = [1240, 380, 210, 460, 180, 520, 640, 8200, 940, 720, 1100]
  return REGISTRATION_TEMPLATE_STEPS.map((label, i) => ({
    id: `s${i}`,
    label,
    detail: i === failIndex ? failDetail : undefined,
    status:
      i < failIndex
        ? ('success' as const)
        : i === failIndex
          ? ('failed' as const)
          : ('pending' as const),
    durationMs: i <= failIndex ? (durations[i] ?? 500) : 0,
  }))
}

// ---------------------------------------------------------------------------
// Боты
// ---------------------------------------------------------------------------

export const bots: Bot[] = [
  {
    id: 'bot-1',
    name: 'SaaS Landing Checker',
    description: 'Проверка регистрации на свежих деплоях лендинга',
    targetUrl: 'https://saas-landing-git-main.vercel.app',
    status: 'active',
    template: 'Проверка регистрации',
    totalRuns: 142,
    successRate: 94,
    lastRunAt: '2026-07-13T09:42:00',
    avgDurationMs: 14800,
    database: {
      id: 'db-1',
      name: 'saas_landing_targets',
      connected: true,
      records: [
        { id: 'r1', targetUrl: 'https://saas-landing-git-main.vercel.app/signup', testEmail: 'qa.bot.01@gmail.com', status: 'processed', addedAt: '2026-07-10T12:00:00' },
        { id: 'r2', targetUrl: 'https://saas-landing-git-feat-auth.vercel.app/signup', testEmail: 'qa.bot.02@gmail.com', status: 'processed', addedAt: '2026-07-11T15:20:00' },
        { id: 'r3', targetUrl: 'https://saas-landing-git-fix-form.vercel.app/signup', testEmail: 'qa.bot.03@gmail.com', status: 'queued', addedAt: '2026-07-13T08:10:00' },
        { id: 'r4', targetUrl: 'https://saas-landing-git-redesign.vercel.app/signup', testEmail: 'qa.bot.04@gmail.com', status: 'error', addedAt: '2026-07-12T18:45:00' },
      ],
    },
    settings: { checkEmailCode: true, screenshotsOnError: true, parallelRuns: 2, schedule: 'После каждого деплоя' },
  },
  {
    id: 'bot-2',
    name: 'CRM Signup Guard',
    description: 'E2E проверка онбординга CRM-платформы клиента',
    targetUrl: 'https://crm-preview.vercel.app',
    status: 'active',
    template: 'Проверка регистрации',
    totalRuns: 87,
    successRate: 88,
    lastRunAt: '2026-07-13T08:15:00',
    avgDurationMs: 18200,
    database: {
      id: 'db-2',
      name: 'crm_signup_targets',
      connected: true,
      records: [
        { id: 'r1', targetUrl: 'https://crm-preview.vercel.app/register', testEmail: 'qa.crm.01@gmail.com', status: 'processed', addedAt: '2026-07-09T10:00:00' },
        { id: 'r2', targetUrl: 'https://crm-staging.vercel.app/register', testEmail: 'qa.crm.02@gmail.com', status: 'processed', addedAt: '2026-07-11T09:30:00' },
        { id: 'r3', targetUrl: 'https://crm-preview-v2.vercel.app/register', testEmail: 'qa.crm.03@gmail.com', status: 'queued', addedAt: '2026-07-13T07:00:00' },
      ],
    },
    settings: { checkEmailCode: true, screenshotsOnError: true, parallelRuns: 1, schedule: 'Каждые 6 часов' },
  },
  {
    id: 'bot-3',
    name: 'Marketplace Reg Bot',
    description: 'Регрессия формы регистрации продавцов маркетплейса',
    targetUrl: 'https://market-seller-portal.vercel.app',
    status: 'error',
    template: 'Проверка регистрации',
    totalRuns: 64,
    successRate: 71,
    lastRunAt: '2026-07-13T06:50:00',
    avgDurationMs: 21500,
    database: {
      id: 'db-3',
      name: 'marketplace_targets',
      connected: true,
      records: [
        { id: 'r1', targetUrl: 'https://market-seller-portal.vercel.app/join', testEmail: 'qa.mkt.01@gmail.com', status: 'error', addedAt: '2026-07-12T14:00:00' },
        { id: 'r2', targetUrl: 'https://market-seller-git-new-form.vercel.app/join', testEmail: 'qa.mkt.02@gmail.com', status: 'queued', addedAt: '2026-07-13T06:00:00' },
      ],
    },
    settings: { checkEmailCode: true, screenshotsOnError: true, parallelRuns: 1, schedule: 'Ежедневно в 06:00' },
  },
  {
    id: 'bot-4',
    name: 'Beta Waitlist Tester',
    description: 'Проверка формы вейтлиста перед запуском беты',
    targetUrl: 'https://beta-waitlist-nine.vercel.app',
    status: 'paused',
    template: 'Проверка регистрации',
    totalRuns: 31,
    successRate: 97,
    lastRunAt: '2026-07-11T22:30:00',
    avgDurationMs: 9400,
    database: {
      id: 'db-4',
      name: 'waitlist_targets',
      connected: true,
      records: [
        { id: 'r1', targetUrl: 'https://beta-waitlist-nine.vercel.app', testEmail: 'qa.beta.01@gmail.com', status: 'processed', addedAt: '2026-07-08T11:00:00' },
      ],
    },
    settings: { checkEmailCode: false, screenshotsOnError: true, parallelRuns: 1, schedule: 'Вручную' },
  },
  {
    id: 'bot-5',
    name: 'Fintech Onboarding QA',
    description: 'Полный цикл: регистрация + код из письма + KYC-шаг',
    targetUrl: 'https://fintech-onboard-demo.vercel.app',
    status: 'active',
    template: 'Проверка регистрации',
    totalRuns: 118,
    successRate: 91,
    lastRunAt: '2026-07-13T09:10:00',
    avgDurationMs: 26700,
    database: {
      id: 'db-5',
      name: 'fintech_targets',
      connected: true,
      records: [
        { id: 'r1', targetUrl: 'https://fintech-onboard-demo.vercel.app/signup', testEmail: 'qa.fin.01@gmail.com', status: 'processed', addedAt: '2026-07-07T09:00:00' },
        { id: 'r2', targetUrl: 'https://fintech-onboard-git-kyc.vercel.app/signup', testEmail: 'qa.fin.02@gmail.com', status: 'processed', addedAt: '2026-07-10T16:40:00' },
        { id: 'r3', targetUrl: 'https://fintech-onboard-git-i18n.vercel.app/signup', testEmail: 'qa.fin.03@gmail.com', status: 'queued', addedAt: '2026-07-12T20:15:00' },
      ],
    },
    settings: { checkEmailCode: true, screenshotsOnError: true, parallelRuns: 3, schedule: 'После каждого деплоя' },
  },
  {
    id: 'bot-6',
    name: 'Agency Client Sites',
    description: 'Пакетная проверка форм на сайтах клиентов агентства',
    targetUrl: 'https://agency-batch.vercel.app',
    status: 'paused',
    template: 'Проверка регистрации',
    totalRuns: 46,
    successRate: 83,
    lastRunAt: '2026-07-12T13:05:00',
    avgDurationMs: 16300,
    database: {
      id: 'db-6',
      name: 'agency_clients',
      connected: false,
      records: [],
    },
    settings: { checkEmailCode: true, screenshotsOnError: false, parallelRuns: 2, schedule: 'Еженедельно' },
  },
]

// ---------------------------------------------------------------------------
// Прогоны
// ---------------------------------------------------------------------------

export const runs: Run[] = [
  {
    id: 'run-501',
    botId: 'bot-1',
    status: 'success',
    startedAt: '2026-07-13T09:42:00',
    durationMs: 14590,
    stepsTotal: 11,
    stepsPassed: 11,
    targetUrl: 'https://saas-landing-git-main.vercel.app/signup',
    steps: successSteps(),
  },
  {
    id: 'run-500',
    botId: 'bot-5',
    status: 'success',
    startedAt: '2026-07-13T09:10:00',
    durationMs: 25900,
    stepsTotal: 11,
    stepsPassed: 11,
    targetUrl: 'https://fintech-onboard-demo.vercel.app/signup',
    steps: successSteps(),
  },
  {
    id: 'run-499',
    botId: 'bot-2',
    status: 'success',
    startedAt: '2026-07-13T08:15:00',
    durationMs: 17840,
    stepsTotal: 11,
    stepsPassed: 11,
    targetUrl: 'https://crm-preview.vercel.app/register',
    steps: successSteps(),
  },
  {
    id: 'run-498',
    botId: 'bot-3',
    status: 'failed',
    startedAt: '2026-07-13T06:50:00',
    durationMs: 9120,
    stepsTotal: 11,
    stepsPassed: 6,
    targetUrl: 'https://market-seller-portal.vercel.app/join',
    steps: failedSteps(6, 'Селектор кнопки button[type="submit"] не найден. Вероятно, изменилась верстка формы.'),
  },
  {
    id: 'run-497',
    botId: 'bot-1',
    status: 'failed',
    startedAt: '2026-07-12T23:18:00',
    durationMs: 32400,
    stepsTotal: 11,
    stepsPassed: 7,
    targetUrl: 'https://saas-landing-git-redesign.vercel.app/signup',
    steps: failedSteps(7, 'Таймаут 30с: письмо с кодом подтверждения не пришло на qa.bot.04@gmail.com'),
  },
  {
    id: 'run-496',
    botId: 'bot-5',
    status: 'success',
    startedAt: '2026-07-12T21:02:00',
    durationMs: 27100,
    stepsTotal: 11,
    stepsPassed: 11,
    targetUrl: 'https://fintech-onboard-git-kyc.vercel.app/signup',
    steps: successSteps(),
  },
  {
    id: 'run-495',
    botId: 'bot-2',
    status: 'failed',
    startedAt: '2026-07-12T19:44:00',
    durationMs: 6800,
    stepsTotal: 11,
    stepsPassed: 2,
    targetUrl: 'https://crm-staging.vercel.app/register',
    steps: failedSteps(2, 'Поле input[name="email"] не найдено на странице. Форма могла не загрузиться.'),
  },
  {
    id: 'run-494',
    botId: 'bot-4',
    status: 'success',
    startedAt: '2026-07-11T22:30:00',
    durationMs: 9200,
    stepsTotal: 11,
    stepsPassed: 11,
    targetUrl: 'https://beta-waitlist-nine.vercel.app',
    steps: successSteps(),
  },
  {
    id: 'run-493',
    botId: 'bot-6',
    status: 'success',
    startedAt: '2026-07-12T13:05:00',
    durationMs: 15900,
    stepsTotal: 11,
    stepsPassed: 11,
    targetUrl: 'https://agency-batch.vercel.app/client/nova',
    steps: successSteps(),
  },
  {
    id: 'run-492',
    botId: 'bot-1',
    status: 'success',
    startedAt: '2026-07-12T11:37:00',
    durationMs: 13800,
    stepsTotal: 11,
    stepsPassed: 11,
    targetUrl: 'https://saas-landing-git-main.vercel.app/signup',
    steps: successSteps(),
  },
]

// ---------------------------------------------------------------------------
// Статистика за 14 дней
// ---------------------------------------------------------------------------

export const dailyStats: DailyStat[] = [
  { date: '30.06', success: 18, failed: 2 },
  { date: '01.07', success: 24, failed: 1 },
  { date: '02.07', success: 21, failed: 4 },
  { date: '03.07', success: 28, failed: 2 },
  { date: '04.07', success: 32, failed: 3 },
  { date: '05.07', success: 19, failed: 1 },
  { date: '06.07', success: 15, failed: 2 },
  { date: '07.07', success: 30, failed: 5 },
  { date: '08.07', success: 34, failed: 2 },
  { date: '09.07', success: 29, failed: 1 },
  { date: '10.07', success: 38, failed: 4 },
  { date: '11.07', success: 33, failed: 2 },
  { date: '12.07', success: 41, failed: 6 },
  { date: '13.07', success: 22, failed: 1 },
]

// ---------------------------------------------------------------------------
// Хелперы
// ---------------------------------------------------------------------------

export function getBot(id: string): Bot | undefined {
  return bots.find((b) => b.id === id)
}

export function getRunsForBot(botId: string): Run[] {
  return runs.filter((r) => r.botId === botId)
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} мс`
  return `${(ms / 1000).toFixed(1)} с`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// AI-ассистент (заглушка)
// ---------------------------------------------------------------------------

export const assistantSuggestions = [
  'Как создать бота для проверки регистрации?',
  'Почему упал прогон на checkout-flow?',
  'Как привязать базу данных к боту?',
  'Что делать, если сайт поменял вёрстку?',
]

export function getAssistantReply(input: string): string {
  const q = input.toLowerCase()

  if (q.includes('созда') || q.includes('регистрац')) {
    return 'Чтобы создать бота для проверки регистрации:\n\n1. Перейдите в раздел «Создать бота»\n2. Выберите шаблон «Проверка регистрации» — он уже умеет искать поля email/пароль, нажимать кнопки разными способами и проверять код подтверждения на почте\n3. Укажите URL вашего деплоя (например, ссылку с Vercel)\n4. Привяжите базу данных с целевыми URL и тестовыми аккаунтами\n\nШаблон сам адаптируется под структуру вашей формы. Если что-то не найдётся — я помогу подправить сценарий.'
  }
  if (q.includes('упал') || q.includes('ошибк') || q.includes('почему')) {
    return 'Смотрю последний прогон checkout-flow… Ошибка на шаге 4: «Селектор кнопки submit не найден». Похоже, на сайте изменилась вёрстка формы.\n\nРекомендую:\n1. Открыть логи прогона и найти скриншот ошибки\n2. Проверить, не переименовали ли кнопку отправки\n3. Обновить селектор в настройках бота — обычно это занимает пару минут\n\nМогу предложить новый селектор на основе текущей структуры страницы.'
  }
  if (q.includes('баз') || q.includes('бд') || q.includes('привяза')) {
    return 'У каждого бота — своя отдельная база данных. Она хранит:\n\n• Целевые URL для проверки (например, свежие деплои)\n• Тестовые email-аккаунты для регистраций\n• Статус обработки каждой записи: в очереди / обработано / ошибка\n\nПривязать БД можно на шаге «База данных» при создании бота или на вкладке «База данных» уже созданного бота. Добавляйте записи вручную или импортом.'
  }
  if (q.includes('вёрстк') || q.includes('верстк') || q.includes('селектор') || q.includes('поменял')) {
    return 'Если сайт поменял вёрстку и бот перестал находить элементы:\n\n1. Откройте логи упавшего прогона — там видно, на каком шаге и какой селектор не сработал\n2. Шаблон пробует несколько стратегий поиска (по тексту, placeholder, атрибутам), поэтому мелкие изменения он переживает сам\n3. Если не помогло — обновите селектор в настройках бота\n\nОбычно починка занимает 10–15 минут. Пришлите URL — подскажу конкретный селектор.'
  }
  return 'Хороший вопрос! В текущей версии я умею помогать с созданием ботов, разбором логов и ошибок, привязкой баз данных и починкой селекторов.\n\nПопробуйте один из вариантов ниже или опишите задачу подробнее — например, какой сайт хотите проверять и что должен делать бот.'
}

export const totalStats = {
  totalRuns: dailyStats.reduce((a, d) => a + d.success + d.failed, 0),
  successRate: Math.round(
    (dailyStats.reduce((a, d) => a + d.success, 0) /
      dailyStats.reduce((a, d) => a + d.success + d.failed, 0)) *
      100,
  ),
  totalErrors: dailyStats.reduce((a, d) => a + d.failed, 0),
  hoursSaved: 47,
}
