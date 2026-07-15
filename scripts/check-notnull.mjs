import { Pool } from 'pg'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
// Columns we NO LONGER insert but that exist in DB. If any are NOT NULL without a default, inserts break.
const targets = {
  runs: ['workspace_id','agent_id','schedule_id','schedule_firing_id','attempt','max_infra_attempts','recovered_count','retention_hold','available_at'],
  bot_refs: ['workspace_id'],
  log_steps: ['workspace_id','metadata'],
  bots: ['workspace_id'],
  assistant_messages: ['workspace_id'],
  ai_code_proposals: ['workspace_id'],
  python_workspaces: ['workspace_id'],
  python_versions: ['workspace_id'],
  scenario_versions: ['workspace_id'],
}
for (const [table, cols] of Object.entries(targets)) {
  const { rows } = await pool.query(
    `select column_name, is_nullable, column_default from information_schema.columns
     where table_schema='public' and table_name=$1 and column_name = any($2)`, [table, cols])
  const problems = rows.filter(r => r.is_nullable === 'NO' && r.column_default === null)
  if (problems.length) console.log(`[v0] ${table} BLOCKING (NOT NULL, no default):`, problems.map(p=>p.column_name).join(', '))
  else console.log(`[v0] ${table}: OK`)
}
const { rows: wap } = await pool.query(`select column_name, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='workspace_ai_providers' order by ordinal_position`)
console.log('\n[v0] workspace_ai_providers cols:', wap.map(c=>c.column_name).join(', '))
const { rows: aip } = await pool.query(`select to_regclass('public.ai_providers') as t`)
console.log('[v0] ai_providers exists:', aip[0].t)
await pool.end()
