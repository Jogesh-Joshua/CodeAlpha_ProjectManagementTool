'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { sendError } = require('../../src/utils/response');

describe('Rate Limiter Unit Tests (Phase 2)', () => {
  let server;
  let baseUrl;

  before(async () => {
    const testApp = express();

    const testLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        return sendError(
          res,
          429,
          'TOO_MANY_REQUESTS',
          'Too many authentication attempts. Please try again later.'
        );
      },
    });

    testApp.post('/test-limit', testLimiter, (req, res) => {
      res.status(200).json({ success: true });
    });

    server = http.createServer(testApp);
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

  test('rate limiter returns 429 and standard error envelope when threshold exceeded', async () => {
    // Request 1: OK
    const res1 = await fetch(`${baseUrl}/test-limit`, { method: 'POST' });
    assert.equal(res1.status, 200);

    // Request 2: OK
    const res2 = await fetch(`${baseUrl}/test-limit`, { method: 'POST' });
    assert.equal(res2.status, 200);

    // Request 3: Exceeded -> 429
    const res3 = await fetch(`${baseUrl}/test-limit`, { method: 'POST' });
    assert.equal(res3.status, 429);

    const body = await res3.json();
    assert.equal(body.success, false);
    assert.equal(body.data, null);
    assert.equal(body.error.code, 'TOO_MANY_REQUESTS');
    assert.ok(body.message.includes('Too many authentication attempts'));
  });
});
