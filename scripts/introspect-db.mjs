import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const { rows: tables } = await pool.query(`
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name
`)
console.log('[v0] TABLES:', tables.map((t) => t.table_name).join(', '))

for (const { table_name } of tables) {
  const { rows: cols } = await pool.query(
    `select column_name, data_type from information_schema.columns
     where table_schema = 'public' and table_name = $1 order by ordinal_position`,
    [table_name],
  )
  console.log(`\n[v0] ${table_name}:`)
  for (const c of cols) console.log(`   - ${c.column_name} (${c.data_type})`)
}

await pool.end()
