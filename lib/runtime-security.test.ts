import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { decryptRuntimeSecret, encryptRuntimeSecret } from './runtime-secrets'
import { hashLeaseToken, isAgentCompatible, issueLeaseToken, leaseTokenFromRequest } from './run-leases'

const originalRuntimeKey = process.env.RUNTIME_SECRETS_KEY
const originalAuthSecret = process.env.BETTER_AUTH_SECRET

beforeEach(() => {
  process.env.RUNTIME_SECRETS_KEY = 'test-runtime-key-with-enough-entropy'
  delete process.env.BETTER_AUTH_SECRET
})

afterEach(() => {
  if (originalRuntimeKey === undefined) delete process.env.RUNTIME_SECRETS_KEY
  else process.env.RUNTIME_SECRETS_KEY = originalRuntimeKey
  if (originalAuthSecret === undefined) delete process.env.BETTER_AUTH_SECRET
  else process.env.BETTER_AUTH_SECRET = originalAuthSecret
})

describe('runtime secrets', () => {
  it('encrypts with randomized authenticated ciphertext', () => {
    const secret = 'http://user:password@proxy.example:3128'
    const first = encryptRuntimeSecret(secret)
    const second = encryptRuntimeSecret(secret)

    expect(first).not.toBe(second)
    expect(first).not.toContain('password')
    expect(decryptRuntimeSecret(first)).toBe(secret)
    expect(decryptRuntimeSecret(second)).toBe(secret)
  })

  it('rejects tampered and legacy plaintext values', () => {
    const encrypted = encryptRuntimeSecret('sensitive')
    const index = Math.floor(encrypted.length / 2)
    const replacement = encrypted[index] === 'A' ? 'B' : 'A'
    expect(decryptRuntimeSecret(`${encrypted.slice(0, index)}${replacement}${encrypted.slice(index + 1)}`)).toBeUndefined()
    expect(decryptRuntimeSecret('http://plaintext-proxy')).toBeUndefined()
  })

  it('requires an explicit encryption key', () => {
    delete process.env.RUNTIME_SECRETS_KEY
    delete process.env.BETTER_AUTH_SECRET
    expect(() => encryptRuntimeSecret('secret')).toThrow(/RUNTIME_SECRETS_KEY/)
  })
})

describe('run leases', () => {
  it('issues high-entropy tokens and stable hashes', () => {
    const first = issueLeaseToken()
    const second = issueLeaseToken()
    expect(first.token).not.toBe(second.token)
    expect(first.hash).toBe(hashLeaseToken(first.token))
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('reads trimmed lease headers and rejects old protocols', () => {
    const request = new Request('https://example.test', { headers: { 'x-run-lease': '  lease-token  ' } })
    expect(leaseTokenFromRequest(request)).toBe('lease-token')
    expect(isAgentCompatible({ id: 'a', workspaceId: 'w', protocolVersion: 2 })).toBe(true)
    expect(isAgentCompatible({ id: 'a', workspaceId: 'w', protocolVersion: 1 })).toBe(false)
  })
})
