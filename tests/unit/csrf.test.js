'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validateOrigin, validateCsrf } = require('../../src/middleware/csrf');
const { generateCsrfToken } = require('../../src/utils/crypto');

describe('CSRF & Origin Protection Unit Tests (Phase 2)', () => {
  function createMockRes() {
    return {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };
  }

  test('validateOrigin allows safe HTTP methods without origin check', () => {
    let nextCalled = false;
    const req = { method: 'GET', headers: {} };
    const res = createMockRes();

    validateOrigin(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  test('validateOrigin rejects untrusted origin on state-changing requests', () => {
    let nextCalled = false;
    const req = { method: 'POST', headers: { origin: 'https://evil-attacker.com' } };
    const res = createMockRes();

    validateOrigin(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, 'CSRF_ORIGIN_INVALID');
  });

  test('validateOrigin accepts allowed origin', () => {
    let nextCalled = false;
    const req = { method: 'POST', headers: { origin: 'http://localhost:3000' } };
    const res = createMockRes();

    validateOrigin(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  test('validateCsrf rejects state-changing requests when X-CSRF-Token is missing', () => {
    let nextCalled = false;
    const req = { method: 'POST', headers: {} };
    const res = createMockRes();

    validateCsrf(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, 'CSRF_TOKEN_MISSING');
  });

  test('validateCsrf accepts matching session-bound CSRF token', () => {
    const token = generateCsrfToken();
    let nextCalled = false;
    const req = {
      method: 'POST',
      headers: { 'x-csrf-token': token },
      session: { csrfToken: token },
    };
    const res = createMockRes();

    validateCsrf(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  test('validateCsrf rejects invalid/mismatched session-bound CSRF token', () => {
    const token = generateCsrfToken();
    let nextCalled = false;
    const req = {
      method: 'POST',
      headers: { 'x-csrf-token': 'wrong-token' },
      session: { csrfToken: token },
    };
    const res = createMockRes();

    validateCsrf(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, 'CSRF_TOKEN_INVALID');
  });

  test('validateCsrf accepts matching pre-auth signed cookie CSRF token', () => {
    const token = generateCsrfToken();
    let nextCalled = false;
    const req = {
      method: 'POST',
      headers: { 'x-csrf-token': token },
      signedCookies: { orbit_csrf_pre: token },
    };
    const res = createMockRes();

    validateCsrf(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });
});
