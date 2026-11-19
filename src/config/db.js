'use strict';

const { Pool } = require('pg');
const env = require('./env');

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = env.DATABASE_URL;
    const isSslRequired = env.isProduction || connectionString.includes('sslmode=require') || connectionString.includes('neon.tech');

    pool = new Pool({
      connectionString,
      ssl: isSslRequired ? { rejectUnauthorized: false } : false,
      max: env.isProduction ? 10 : 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[Database Pool Error]:', err.message);
    });
  }
  return pool;
}

/**
 * Execute a parameterized query with query timing in development.
 * @param {string} text - SQL statement with $1...$n placeholders
 * @param {Array} params - Array of parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = []) {
  const p = getPool();
  const start = Date.now();
  const res = await p.query(text, params);
  const duration = Date.now() - start;

  if (!env.isProduction && !env.isTest) {
    const sanitizedQuery = text.replace(/\s+/g, ' ').trim().slice(0, 100);
    console.log(`[db] (${duration}ms) ${sanitizedQuery}`);
  }

  return res;
}

/**
 * Execute a transaction using a dedicated client.
 * Automatically performs BEGIN, COMMIT, and ROLLBACK on error.
 * @param {(client: import('pg').PoolClient) => Promise<any>} callback
 * @returns {Promise<any>}
 */
async function withTransaction(callback) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Database connectivity readiness check.
 * @returns {Promise<{ ok: boolean, latencyMs: number, error?: string }>}
 */
async function checkConnection() {
  if (!env.DATABASE_URL) {
    return { ok: false, latencyMs: 0, error: 'DATABASE_URL not configured' };
  }
  const start = Date.now();
  try {
    await query('SELECT 1 AS readiness');
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err.message };
  }
}

/**
 * Close the connection pool gracefully.
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  query,
  withTransaction,
  checkConnection,
  closePool,
};
