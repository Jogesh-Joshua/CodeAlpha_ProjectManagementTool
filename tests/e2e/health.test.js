'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../../src/app');

describe('E2E HTTP Server & Health Check Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('GET /api/health is publicly accessible and returns 200 with standard envelope', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(typeof body.data, 'object');
    assert.ok(body.data.status === 'healthy' || body.data.status === 'degraded');
    assert.ok(typeof body.data.uptime === 'string');
    assert.ok(typeof body.data.database === 'object');
    assert.equal(body.message, 'Orbit API is operational');
  });

  test('GET /api/health includes security headers from Helmet', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.ok(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('content-security-policy'));
  });

  test('GET /api/nonexistent returns standard 404 error envelope', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.data, null);
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.ok(body.message.includes('Route not found'));
  });

  test('GET / serves the canonical frontend index.html from public/', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Orbit'));
    assert.ok(text.includes('Plan together. Build better. Move forward.'));
  });
});
