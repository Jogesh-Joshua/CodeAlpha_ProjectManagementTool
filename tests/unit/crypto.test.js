'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  generateCsrfToken,
  verifyCsrfToken,
} = require('../../src/utils/crypto');

describe('Cryptographic Utilities Unit Tests (Phase 2)', () => {
  test('hashPassword generates bcrypt hash with cost factor 12', async () => {
    const password = 'TestSecurePassword1!';
    const hash = await hashPassword(password);

    assert.ok(typeof hash === 'string');
    // Bcrypt format: $2a$12$ or $2b$12$
    assert.ok(
      hash.startsWith('$2a$12$') || hash.startsWith('$2b$12$'),
      'Password hash must use bcrypt with cost factor 12'
    );
    assert.notEqual(hash, password, 'Plaintext password must never be retained');
  });

  test('verifyPassword correctly validates matching and non-matching passwords', async () => {
    const password = 'MySecretPassword1!';
    const hash = await hashPassword(password);

    const isMatch = await verifyPassword(password, hash);
    assert.equal(isMatch, true);

    const isWrong = await verifyPassword('WrongPassword1!', hash);
    assert.equal(isWrong, false);
  });

  test('generateSessionToken generates a 256-bit cryptographically random token (64 hex chars)', () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();

    assert.equal(typeof token1, 'string');
    assert.equal(token1.length, 64);
    assert.equal(token2.length, 64);
    assert.notEqual(token1, token2, 'Consecutive tokens must be cryptographically distinct');
    assert.ok(/^[0-9a-f]{64}$/.test(token1), 'Token must be valid hexadecimal string');
  });

  test('hashSessionToken computes HMAC-SHA256 digest (64 hex chars) deterministically', () => {
    const token = generateSessionToken();
    const digest1 = hashSessionToken(token);
    const digest2 = hashSessionToken(token);

    assert.equal(typeof digest1, 'string');
    assert.equal(digest1.length, 64);
    assert.equal(digest1, digest2, 'HMAC digest must be deterministic for identical token');
    assert.notEqual(digest1, token, 'Digest must not match raw token');
  });

  test('generateCsrfToken and verifyCsrfToken enforce constant-time matching', () => {
    const csrfToken = generateCsrfToken();
    assert.equal(csrfToken.length, 64);

    // Matching token
    assert.equal(verifyCsrfToken(csrfToken, csrfToken), true);

    // Mismatched token
    const wrongToken = generateCsrfToken();
    assert.equal(verifyCsrfToken(wrongToken, csrfToken), false);

    // Invalid/malformed input
    assert.equal(verifyCsrfToken(null, csrfToken), false);
    assert.equal(verifyCsrfToken('short', csrfToken), false);
    assert.equal(verifyCsrfToken(csrfToken, undefined), false);
  });
});
