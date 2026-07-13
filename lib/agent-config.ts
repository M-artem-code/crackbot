// Клиентские хелперы для работы с учётными данными агента-раннера.

// Маскирует ключ: agt_1a2b...ef90 -> agt_••••••ef90
export function maskApiKey(key: string): string {
  if (!key) return '—'
  const tail = key.slice(-4)
  const head = key.startsWith('agt_') ? 'agt_' : ''
  return `${head}${'•'.repeat(8)}${tail}`
}

// Формирует JSON-конфиг, который читает Python-агент при запуске.
export function buildAgentConfig(apiKey: string): {
  server_url: string
  api_key: string
  poll_interval_sec: number
} {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return {
    server_url: origin,
    api_key: apiKey,
    poll_interval_sec: 5,
  }
}

// Скачивает файл agent-config.json с адресом сервера и ключом.
export function downloadAgentConfig(agentName: string, apiKey: string): void {
  const config = buildAgentConfig(apiKey)
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const slug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent'
  const a = document.createElement('a')
  a.href = url
  a.download = `agent-config-${slug}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
