'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool, withTransaction, closePool } = require('../src/config/db');

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'src', 'config', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error(`[migrate] Migrations directory not found at: ${migrationsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('[migrate] No migration files found.');
    return;
  }

  console.log(`[migrate] Found ${files.length} migration file(s). Connecting to database...`);

  try {
    await withTransaction(async (client) => {
      await ensureMigrationTable(client);

      const { rows } = await client.query('SELECT version FROM schema_migrations');
      const applied = new Set(rows.map((r) => r.version));

      let newlyApplied = 0;

      for (const file of files) {
        const version = file.split('_')[0];
        if (applied.has(version)) {
          console.log(`[migrate] Skipping already applied: ${file}`);
          continue;
        }

        console.log(`[migrate] Executing migration: ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);

        await client.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [version, file]
        );

        console.log(`[migrate] Successfully applied: ${file}`);
        newlyApplied++;
      }

      console.log(`[migrate] Migration complete. ${newlyApplied} new migration(s) applied.`);
    });
  } catch (err) {
    console.error('[migrate] Migration failed with error:', err.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
