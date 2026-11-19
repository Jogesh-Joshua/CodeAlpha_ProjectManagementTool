'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Database Schema Reconciliation Unit Tests', () => {
  const schemaPath = path.join(__dirname, '..', '..', 'src', 'config', 'migrations', '001_initial_schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  test('Migration file exists and is readable', () => {
    assert.ok(sql.length > 500);
  });

  test('Does not use invalid "CREATE TYPE IF NOT EXISTS" syntax', () => {
    assert.equal(/CREATE\s+TYPE\s+IF\s+NOT\s+EXISTS/i.test(sql), false, 'Must not use non-standard CREATE TYPE IF NOT EXISTS');
    assert.ok(sql.includes('IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname ='));
  });

  test('Tasks created_by enforces ON DELETE RESTRICT (no contradictory SET NULL)', () => {
    assert.ok(/created_by\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+RESTRICT/i.test(sql));
    assert.equal(/created_by.*ON\s+DELETE\s+SET\s+NULL/i.test(sql), false);
  });

  test('Task assignees enforces cross-table project integrity', () => {
    assert.ok(sql.includes('CONSTRAINT uq_tasks_id_project UNIQUE (id, project_id)'));
    assert.ok(/FOREIGN\s+KEY\s*\(\s*task_id\s*,\s*project_id\s*\)\s+REFERENCES\s+tasks\s*\(\s*id\s*,\s*project_id\s*\)\s+ON\s+DELETE\s+CASCADE/i.test(sql));
    assert.ok(/FOREIGN\s+KEY\s*\(\s*project_id\s*,\s*user_id\s*\)\s+REFERENCES\s+project_members\s*\(\s*project_id\s*,\s*user_id\s*\)\s+ON\s+DELETE\s+CASCADE/i.test(sql));
  });

  test('Users table enforces case-insensitive email uniqueness', () => {
    assert.ok(sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email))'));
  });

  test('Sessions table stores 64-char HMAC-SHA256 digest', () => {
    assert.ok(/id\s+VARCHAR\(64\)\s+PRIMARY\s+KEY/i.test(sql));
  });

  test('Notifications table has explicit foreign keys for task_id and project_id (not polymorphic)', () => {
    assert.ok(/project_id\s+UUID\s+REFERENCES\s+projects\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i.test(sql));
    assert.ok(/task_id\s+UUID\s+REFERENCES\s+tasks\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i.test(sql));
  });
});
