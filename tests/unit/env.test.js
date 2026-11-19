'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const env = require('../../src/config/env');

describe('Environment Configuration Unit Tests', () => {
  test('env exports expected defaults for development environment', () => {
    assert.ok(typeof env.PORT === 'number');
    assert.ok(typeof env.BCRYPT_ROUNDS === 'number');
    assert.equal(env.BCRYPT_ROUNDS, 12);
    assert.ok(typeof env.COOKIE_SECRET === 'string');
    assert.ok(env.COOKIE_SECRET.length >= 32);
    assert.ok(typeof env.SESSION_SECRET === 'string');
    assert.ok(env.SESSION_SECRET.length >= 32);
    assert.ok(typeof env.CORS_ORIGIN === 'string');
    assert.ok(typeof env.AUTH_RATE_LIMIT_WINDOW_MS === 'number');
    assert.ok(typeof env.AUTH_RATE_LIMIT_MAX === 'number');
  });

  test('env flags production vs test vs development accurately', () => {
    assert.equal(typeof env.isProduction, 'boolean');
    assert.equal(typeof env.isTest, 'boolean');
  });
});
