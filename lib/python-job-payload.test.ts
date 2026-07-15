import { describe, expect, it } from 'vitest'

import { selectPythonJobPayload } from './python-job-payload'

describe('selectPythonJobPayload', () => {
  it('uses published code for a normal run even when the workspace has a draft', () => {
    expect(selectPythonJobPayload(
      { executionMode: 'python' },
      { publishedCode: 'print("published")', publishedRequirements: 'requests==2.32.0' },
    )).toEqual({ code: 'print("published")', requirements: 'requests==2.32.0' })
  })

  it('uses snapshot code for an explicit draft test', () => {
    expect(selectPythonJobPayload(
      { testMode: true, python: { code: 'print("draft")', requirements: 'httpx==0.28.0' } },
      { publishedCode: 'print("published")', publishedRequirements: '' },
    )).toEqual({ code: 'print("draft")', requirements: 'httpx==0.28.0' })
  })

  it('does not execute arbitrary snapshot code outside test mode', () => {
    expect(selectPythonJobPayload(
      { python: { code: 'print("untrusted")', requirements: '' } },
      { publishedCode: 'print("published")', publishedRequirements: '' },
    )).toEqual({ code: 'print("published")', requirements: '' })
  })

  it('returns null when neither test nor published code exists', () => {
    expect(selectPythonJobPayload({ executionMode: 'python' }, null)).toBeNull()
  })
})
