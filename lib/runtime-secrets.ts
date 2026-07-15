import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const PREFIX = 'crackbot:v1:'

function encryptionKey(): Buffer {
  const source = process.env.RUNTIME_SECRETS_KEY || process.env.BETTER_AUTH_SECRET
  if (!source) throw new Error('RUNTIME_SECRETS_KEY or BETTER_AUTH_SECRET is required')
  return createHash('sha256').update(source, 'utf8').digest()
}

export function encryptRuntimeSecret(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${Buffer.concat([iv, tag, encrypted]).toString('base64url')}`
}

export function decryptRuntimeSecret(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return undefined
  try {
    const payload = Buffer.from(value.slice(PREFIX.length), 'base64url')
    if (payload.length < 29) return undefined
    const iv = payload.subarray(0, 12)
    const tag = payload.subarray(12, 28)
    const encrypted = payload.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch {
    return undefined
  }
}
