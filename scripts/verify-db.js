'use strict';

require('dotenv').config();
const { query, closePool } = require('../src/config/db');

async function verifySchema() {
  console.log('=== Neon Database Schema Verification ===');

  const tablesRes = await query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  console.log('\n[Tables in public schema]:');
  tablesRes.rows.forEach(r => console.log(' - ' + r.table_name));

  const migrationsRes = await query(`SELECT version, name, applied_at FROM schema_migrations ORDER BY id`);
  console.log('\n[Applied Migrations]:');
  migrationsRes.rows.forEach(r => console.log(` - ${r.version}: ${r.name} (applied ${r.applied_at})`));

  const enumsRes = await query(`
    SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
  `);
  console.log('\n[Custom Enums]:');
  enumsRes.rows.forEach(r => {
    const valStr = Array.isArray(r.values) ? r.values.join(', ') : String(r.values);
    console.log(` - ${r.typname}: [${valStr}]`);
  });

  const constraintsRes = await query(`
    SELECT conname, contype, conrelid::regclass as table_name
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' AND (conname LIKE '%owner%' OR conname LIKE '%assignee%' OR conname LIKE '%task%')
    ORDER BY table_name, conname
  `);
  console.log('\n[Key Integrity Constraints]:');
  constraintsRes.rows.forEach(r => console.log(` - ${r.table_name}: ${r.conname} (type: ${r.contype})`));

  await closePool();
  console.log('\n=== Database verification complete! ===');
}

verifySchema().catch(err => {
  console.error('[Error verifying database]:', err);
  process.exit(1);
});
