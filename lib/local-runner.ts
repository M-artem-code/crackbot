import 'server-only'

import { spawn } from 'node:child_process'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { and, asc, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { botRefs, bots, logSteps, runs } from '@/lib/db/schema'
import { decryptRuntimeSecret } from '@/lib/runtime-secrets'

// Local execution engine. Replaces the whole agent + Docker + queue + lease stack.
// Runs `python bot.py` directly on this machine using the bot's managed entrypoint
// (crackbot_job_main, activated via the CRACKBOT_INPUT env var).

const PYTHON_BIN = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3')
// Work in the OS temp dir — always writable (unlike the app dir on some machines).
const RUN_ROOT = join(tmpdir(), 'botforge-runs')

// This tool spawns Python + Chrome, which serverless hosts (Vercel) cannot do:
// their filesystem is read-only and there is no Python/Chrome. Detect and fail clearly.
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
const SERVERLESS_MESSAGE =
  'Запуск ботов работает только локально на твоём компьютере (pnpm dev), где есть Python и Chrome. ' +
  'На Vercel это невозможно: файловая система только для чтения и нет Python. Открой проект локально и запусти оттуда.'

interface PythonSnapshot {
  executionMode?: string
  templateSlug?: string
  python?: { code: string; requirements: string; assets?: Record<string, string> }
}

interface WorkerResult {
  success: boolean
  status: string
  message?: string
  metrics?: { successCount?: number; failedCount?: number }
}

let seq = 0
async function appendLog(runId: string, worker: number, level: string, message: string) {
  seq += 1
  await db.insert(logSteps).values({ runId, worker, level, step: '', message: message.slice(0, 2000), runAttempt: 1, attempt: 1 })
}

function classifyLine(line: string): string {
  const l = line.toLowerCase()
  if (l.includes('success')) return 'running'
  if (l.startsWith('fail') || l.includes('error') || l.includes('traceback') || l.includes('exception')) return 'error'
  return 'info'
}

async function runWorker(opts: {
  runId: string
  worker: number
  code: string
  assets: Record<string, string>
  targetUrl: string
  proxy?: string
  password?: string
  allowDirectFallback: boolean
}): Promise<WorkerResult> {
  const dir = join(RUN_ROOT, opts.runId, `worker-${opts.worker}`)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'bot.py'), opts.code, 'utf8')
  for (const [name, content] of Object.entries(opts.assets)) {
    await writeFile(join(dir, name), content, 'utf8')
  }
  const input = {
    target: { url: opts.targetUrl },
    config: {
      runtimeProxy: opts.proxy ?? '',
      runtimePassword: opts.password ?? '',
      allowDirectFallback: opts.allowDirectFallback,
    },
  }
  const inputPath = join(dir, 'input.json')
  await writeFile(inputPath, JSON.stringify(input), 'utf8')

  return new Promise<WorkerResult>((resolve) => {
    const child = spawn(PYTHON_BIN, ['bot.py'], {
      cwd: dir,
      env: { ...process.env, CRACKBOT_INPUT: inputPath, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
    })
    let lastJson: WorkerResult | null = null
    let stdoutBuf = ''
    let stderrBuf = ''

    const handleLine = (line: string) => {
      const trimmed = line.trim()
      if (!trimmed) return
      // The final result is a single JSON object printed to stdout.
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed)
          if (typeof parsed === 'object' && parsed && 'success' in parsed) {
            lastJson = parsed as WorkerResult
            return
          }
        } catch {
          // not the result line — treat as a normal log
        }
      }
      void appendLog(opts.runId, opts.worker, classifyLine(trimmed), trimmed)
    }

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString('utf8')
      const parts = stdoutBuf.split(/\r?\n/)
      stdoutBuf = parts.pop() ?? ''
      for (const line of parts) handleLine(line)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString('utf8')
      const parts = stderrBuf.split(/\r?\n/)
      stderrBuf = parts.pop() ?? ''
      for (const line of parts) if (line.trim()) void appendLog(opts.runId, opts.worker, 'error', line.trim())
    })
    child.on('error', (err) => {
      void appendLog(opts.runId, opts.worker, 'error', `Не удалось запустить Python (${PYTHON_BIN}): ${err.message}`)
      resolve({ success: false, status: 'error', message: err.message })
    })
    child.on('close', () => {
      if (stdoutBuf.trim()) handleLine(stdoutBuf)
      if (stderrBuf.trim()) void appendLog(opts.runId, opts.worker, 'error', stderrBuf.trim())
      resolve(lastJson ?? { success: false, status: 'failed', message: 'Процесс завершился без результата' })
    })
  })
}

async function execute(runId: string) {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  if (!run) return
  const [bot] = await db.select().from(bots).where(eq(bots.id, run.botId)).limit(1)
  if (!bot) return

  const snapshot = (run.scenarioSnapshot ?? {}) as PythonSnapshot
  const started = Date.now()
  await db.update(runs).set({ status: 'running', startedAt: new Date() }).where(eq(runs.id, runId))

  try {
    if (IS_SERVERLESS) throw new Error(SERVERLESS_MESSAGE)

    if (snapshot.executionMode !== 'python' || !snapshot.python?.code) {
      throw new Error('У этого бота нет опубликованного Python-кода. Опубликуй bot.py и запусти снова.')
    }

    const [target] = await db
      .select()
      .from(botRefs)
      .where(and(eq(botRefs.botId, run.botId), eq(botRefs.status, 'active')))
      .orderBy(asc(botRefs.position), asc(botRefs.id))
      .limit(1)
    if (!target) throw new Error('В пуле нет активных целевых ссылок')

    const config = (bot.config ?? {}) as Record<string, unknown>
    const proxy = decryptRuntimeSecret(config.proxySecret)
    const password = decryptRuntimeSecret(config.passwordSecret)
    const allowDirectFallback = Boolean(config.allowDirectFallback) || !proxy

    await appendLog(runId, 0, 'info', `Запуск ${run.totalWorkers} воркер(ов) локально · цель: ${target.url}`)

    const results = await Promise.all(
      Array.from({ length: run.totalWorkers }, (_, i) =>
        runWorker({
          runId,
          worker: i + 1,
          code: snapshot.python!.code,
          assets: snapshot.python!.assets ?? {},
          targetUrl: target.url,
          proxy,
          password,
          allowDirectFallback,
        }),
      ),
    )

    const successCount = results.filter((r) => r.success).length
    const failedCount = results.length - successCount
    const status = successCount === 0 ? 'failed' : failedCount === 0 ? 'success' : 'partial'
    const durationMs = Date.now() - started

    await db.update(runs).set({ status, successCount, failedCount, durationMs, finishedAt: new Date() }).where(eq(runs.id, runId))

    if (successCount > 0) {
      const newCount = Math.min(target.successCount + successCount, target.successLimit)
      await db
        .update(botRefs)
        .set({
          successCount: newCount,
          failedCount: sql`${botRefs.failedCount} + ${failedCount}`,
          lastUsedAt: new Date(),
          status: newCount >= target.successLimit ? 'exhausted' : 'active',
        })
        .where(eq(botRefs.id, target.id))
    } else {
      await db
        .update(botRefs)
        .set({ failedCount: sql`${botRefs.failedCount} + ${failedCount}`, lastUsedAt: new Date() })
        .where(eq(botRefs.id, target.id))
    }

    await appendLog(runId, 0, successCount > 0 ? 'info' : 'error', `Готово: ${successCount} успешно, ${failedCount} неудачно`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await appendLog(runId, 0, 'error', message)
    await db.update(runs).set({ status: 'failed', error: message, durationMs: Date.now() - started, finishedAt: new Date() }).where(eq(runs.id, runId))
  } finally {
    await db.update(bots).set({ status: 'idle', updatedAt: new Date() }).where(eq(bots.id, run.botId))
    await rm(join(RUN_ROOT, runId), { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Fire-and-forget local execution. Returns immediately; the run progresses in the
 * background and the UI polls run state. Requires the Next.js app to run on the
 * same machine as Python (i.e. locally), which is the whole point of this tool.
 */
export function startLocalRun(runId: string) {
  void execute(runId).catch((err) => {
    console.error('[v0] local run failed', runId, err)
  })
}
