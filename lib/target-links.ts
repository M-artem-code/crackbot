export const MAX_TARGET_LINKS = 1000
export const MAX_SUCCESS_LIMIT = 10_000

export function normalizeTargetUrl(value: string) {
  const raw = value.trim()
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`Некорректная целевая ссылка: ${raw || "пустая строка"}`)
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Целевые ссылки должны начинаться с http:// или https://")
  }
  url.hash = ""
  url.hostname = url.hostname.toLowerCase()
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = ""
  return url.toString()
}

export function normalizeSuccessLimit(value: number) {
  if (!Number.isFinite(value)) throw new Error("Лимит успешных регистраций должен быть числом")
  return Math.min(MAX_SUCCESS_LIMIT, Math.max(1, Math.trunc(value)))
}

export function normalizeTargetLabel(value: string) {
  return value.trim().slice(0, 120)
}
