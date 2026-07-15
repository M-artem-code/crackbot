import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const client = await pool.connect()

async function run(label, sql, params = []) {
  await client.query(sql, params)
  console.log('[v0] ok:', label)
}

try {
  await client.query('BEGIN')

  // 1) Drop NOT NULL on workspace_id columns we no longer populate (keep data, just relax the constraint).
  for (const table of ['assistant_messages', 'ai_code_proposals', 'python_workspaces', 'python_versions']) {
    await run(`relax ${table}.workspace_id`, `ALTER TABLE ${table} ALTER COLUMN workspace_id DROP NOT NULL`)
  }

  // 2) Create the new single-user ai_providers table and migrate the active provider over.
  await run('create ai_providers', `
    CREATE TABLE IF NOT EXISTS ai_providers (
      id text PRIMARY KEY,
      name text NOT NULL,
      provider_type text NOT NULL DEFAULT 'openai-compatible',
      base_url text NOT NULL,
      model_id text NOT NULL,
      encrypted_api_key text NOT NULL,
      key_prefix text NOT NULL DEFAULT '',
      is_active boolean NOT NULL DEFAULT false,
      last_test_status text,
      last_test_message text NOT NULL DEFAULT '',
      last_tested_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`)

  const hasOld = await client.query(`SELECT to_regclass('public.workspace_ai_providers') AS t`)
  if (hasOld.rows[0].t) {
    await run('migrate providers', `
      INSERT INTO ai_providers (id, name, provider_type, base_url, model_id, encrypted_api_key, key_prefix, is_active, last_test_status, last_test_message, last_tested_at, created_at, updated_at)
      SELECT id, name, provider_type, base_url, model_id, encrypted_api_key, key_prefix, is_active, last_test_status, last_test_message, last_tested_at, created_at, updated_at
      FROM workspace_ai_providers
      ON CONFLICT (id) DO NOTHING`)
    // Keep only one active provider.
    await run('single active provider', `
      UPDATE ai_providers SET is_active = false
      WHERE id <> (SELECT id FROM ai_providers WHERE is_active ORDER BY updated_at DESC LIMIT 1)`)
  }

  // 3) Drop tables that belonged to the removed auth / workspace / agent / queue / schedule / notification layers.
  const deadTables = [
    'workspace_ai_providers',
    'agent_pairing_tokens', 'agents',
    'run_artifacts', 'run_attempts',
    'schedule_firings', 'schedules',
    'notification_deliveries', 'notifications',
    'test_otp_challenges',
    'account', 'session', 'verification', 'user',
    'workspaces',
  ]
  for (const t of deadTables) {
    await run(`drop ${t}`, `DROP TABLE IF EXISTS ${t} CASCADE`)
  }

  await client.query('COMMIT')
  console.log('[v0] migration committed')
} catch (err) {
  await client.query('ROLLBACK')
  console.error('[v0] migration rolled back:', err.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
