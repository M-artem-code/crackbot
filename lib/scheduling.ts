export type ScheduleKind = 'interval' | 'daily' | 'weekly'

export function getNextRunAt(input: {
  kind: ScheduleKind
  intervalMinutes?: number | null
  timeOfDay?: string | null
  weekdays?: number[]
  timezone: string
  from?: Date
}) {
  const from = input.from ?? new Date()
  if (input.kind === 'interval') {
    const minutes = Math.max(5, Math.min(input.intervalMinutes ?? 60, 10_080))
    return new Date(from.getTime() + minutes * 60_000)
  }

  const [hour, minute] = (input.timeOfDay ?? '09:00').split(':').map(Number)
  const weekdays = input.kind === 'weekly' ? input.weekdays ?? [1] : [0, 1, 2, 3, 4, 5, 6]
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: input.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  })
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  for (let offset = 1; offset <= 8 * 24 * 60; offset += 1) {
    const candidate = new Date(from.getTime() + offset * 60_000)
    const parts = Object.fromEntries(formatter.formatToParts(candidate).map((part) => [part.type, part.value]))
    if (Number(parts.hour) === hour && Number(parts.minute) === minute && weekdays.includes(dayNames.indexOf(parts.weekday))) return candidate
  }
  throw new Error('Не удалось рассчитать следующее срабатывание')
}

export function assertTimeZone(value: string) {
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format() } catch { throw new Error('Некорректный часовой пояс') }
  return value
}
