import { describe, expect, it } from 'vitest'

import { validatePythonRequirements } from './python-requirements'

describe('validatePythonRequirements', () => {
  it('accepts the pinned BotForge template dependencies', () => {
    expect(() => validatePythonRequirements('nodriver==0.48.1\nrequests==2.32.3\nrich==13.9.4\n')).not.toThrow()
  })

  it('rejects version ranges before a job reaches the runner', () => {
    expect(() => validatePythonRequirements('requests>=2.32,<3')).toThrow('package==version')
  })

  it('rejects packages outside the runner allowlist', () => {
    expect(() => validatePythonRequirements('unknown-package==1.0.0')).toThrow('не поддерживается')
  })
})
