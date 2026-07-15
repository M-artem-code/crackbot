export interface PythonJobPayload {
  code: string
  requirements: string
}

interface PythonWorkspacePayload {
  publishedCode: string
  publishedRequirements: string
}

interface RunSnapshot {
  testMode?: unknown
  python?: unknown
}

function snapshotPython(snapshot: RunSnapshot): PythonJobPayload | null {
  if (snapshot.testMode !== true || !snapshot.python || typeof snapshot.python !== 'object') return null
  const python = snapshot.python as Record<string, unknown>
  if (typeof python.code !== 'string' || python.code.length === 0) return null
  return {
    code: python.code,
    requirements: typeof python.requirements === 'string' ? python.requirements : '',
  }
}

export function selectPythonJobPayload(
  scenarioSnapshot: unknown,
  workspace: PythonWorkspacePayload | null | undefined,
): PythonJobPayload | null {
  if (scenarioSnapshot && typeof scenarioSnapshot === 'object') {
    const testPayload = snapshotPython(scenarioSnapshot as RunSnapshot)
    if (testPayload) return testPayload
  }

  if (!workspace?.publishedCode) return null
  return {
    code: workspace.publishedCode,
    requirements: workspace.publishedRequirements,
  }
}
