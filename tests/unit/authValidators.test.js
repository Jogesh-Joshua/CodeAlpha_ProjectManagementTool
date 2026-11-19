'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validateRegister, validateLogin } = require('../../src/validators/authValidators');

describe('Auth Validators Unit Tests (Phase 2)', () => {
  test('validateRegister accepts valid registration payload', () => {
    const req = {
      body: {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        password: 'SecurePassword1!',
      },
    };
    const result = validateRegister(req);
    assert.equal(result.isValid, true);
    assert.deepEqual(result.errors, {});
  });

  test('validateRegister rejects invalid or short name', () => {
    const req1 = { body: { name: 'A', email: 'alice@example.com', password: 'SecurePassword1!' } };
    assert.equal(validateRegister(req1).isValid, false);
    assert.ok(validateRegister(req1).errors.name);

    const req2 = { body: { name: '   ', email: 'alice@example.com', password: 'SecurePassword1!' } };
    assert.equal(validateRegister(req2).isValid, false);
  });

  test('validateRegister rejects invalid email formats', () => {
    const invalidEmails = ['not-an-email', '@domain.com', 'user@', 'user@domain'];
    for (const email of invalidEmails) {
      const req = { body: { name: 'Alice Johnson', email, password: 'SecurePassword1!' } };
      const res = validateRegister(req);
      assert.equal(res.isValid, false, `Expected ${email} to be rejected`);
      assert.ok(res.errors.email);
    }
  });

  test('validateRegister enforces password complexity rules', () => {
    // Too short (< 8 chars)
    const shortReq = { body: { name: 'Alice', email: 'alice@test.com', password: 'Ab1!' } };
    const shortRes = validateRegister(shortReq);
    assert.equal(shortRes.isValid, false);
    assert.ok(shortRes.errors.password.includes('at least 8'));

    // No uppercase letter
    const noUpperReq = { body: { name: 'Alice', email: 'alice@test.com', password: 'password123' } };
    const noUpperRes = validateRegister(noUpperReq);
    assert.equal(noUpperRes.isValid, false);
    assert.ok(noUpperRes.errors.password.includes('uppercase'));

    // No number
    const noNumReq = { body: { name: 'Alice', email: 'alice@test.com', password: 'PasswordOnly' } };
    const noNumRes = validateRegister(noNumReq);
    assert.equal(noNumRes.isValid, false);
    assert.ok(noNumRes.errors.password.includes('number'));
  });

  test('validateLogin accepts valid login payload', () => {
    const req = { body: { email: 'alice@example.com', password: 'AnyPassword' } };
    assert.equal(validateLogin(req).isValid, true);
  });

  test('validateLogin rejects missing or invalid fields', () => {
    const req1 = { body: { email: 'invalid-email', password: 'pass' } };
    assert.equal(validateLogin(req1).isValid, false);
    assert.ok(validateLogin(req1).errors.email);

    const req2 = { body: { email: 'alice@example.com', password: '' } };
    assert.equal(validateLogin(req2).isValid, false);
    assert.ok(validateLogin(req2).errors.password);
  });
});
