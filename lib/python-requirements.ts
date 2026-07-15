const MAX_REQUIREMENTS_BYTES = 8_192

export const ALLOWED_PYTHON_PACKAGES = new Set([
  'beautifulsoup4',
  'httpx',
  'lxml',
  'nodriver',
  'pydantic',
  'python-dateutil',
  'python-telegram-bot',
  'requests',
  'rich',
  'tenacity',
])

const PINNED_REQUIREMENT = /^([a-zA-Z0-9][a-zA-Z0-9._-]*)==([a-zA-Z0-9][a-zA-Z0-9._+-]*)$/

export function validatePythonRequirements(raw: string) {
  if (Buffer.byteLength(raw) > MAX_REQUIREMENTS_BYTES) {
    throw new Error('requirements.txt превышает лимит 8 KB')
  }

  for (const [index, original] of raw.split('\n').entries()) {
    const line = original.trim()
    if (!line || line.startsWith('#')) continue
    if (['--', ';', '@', '://', '../', '\\', '#'].some((marker) => line.includes(marker))) {
      throw new Error(`requirements.txt, строка ${index + 1}: URL, options и markers запрещены`)
    }
    const match = PINNED_REQUIREMENT.exec(line)
    if (!match) {
      throw new Error(`requirements.txt, строка ${index + 1}: укажите точную версию package==version`)
    }
    const packageName = match[1].toLowerCase().replaceAll('_', '-')
    if (!ALLOWED_PYTHON_PACKAGES.has(packageName)) {
      throw new Error(`requirements.txt, строка ${index + 1}: пакет ${packageName} не поддерживается`)
    }
  }
}
