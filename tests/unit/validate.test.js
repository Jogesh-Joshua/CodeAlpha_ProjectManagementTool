'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validate, validators } = require('../../src/middleware/validate');

describe('Validation Middleware & Helpers Unit Tests', () => {
  test('validators.isValidEmail checks email validity correctly', () => {
    assert.equal(validators.isValidEmail('user@orbit.app'), true);
    assert.equal(validators.isValidEmail('  TEST.user+sub@DOMAIN.COM  '), true);
    assert.equal(validators.isValidEmail('invalid-email'), false);
    assert.equal(validators.isValidEmail('@domain.com'), false);
    assert.equal(validators.isValidEmail(null), false);
  });

  test('validators.isValidUUID checks UUID format', () => {
    assert.equal(validators.isValidUUID('123e4567-e89b-12d3-a456-426614174000'), true);
    assert.equal(validators.isValidUUID('invalid-uuid'), false);
  });

  test('validators.isValidColorHex checks 3 and 6 digit hex colors', () => {
    assert.equal(validators.isValidColorHex('#5B5BD6'), true);
    assert.equal(validators.isValidColorHex('#fff'), true);
    assert.equal(validators.isValidColorHex('5B5BD6'), false);
    assert.equal(validators.isValidColorHex('red'), false);
  });

  test('validators.isInEnum checks allowed array values', () => {
    const roles = ['owner', 'admin', 'member'];
    assert.equal(validators.isInEnum('owner', roles), true);
    assert.equal(validators.isInEnum('viewer', roles), false);
  });

  test('validate middleware allows valid requests and rejects invalid requests', () => {
    const schemaValidator = (req) => {
      const errors = {};
      if (!validators.isNonEmptyString(req.body.name, 2, 100)) {
        errors.name = 'Name must be between 2 and 100 chars.';
      }
      return { isValid: Object.keys(errors).length === 0, errors };
    };

    const middleware = validate(schemaValidator);

    // Test valid request
    let nextCalled = false;
    const validReq = { body: { name: 'Valid Project' } };
    const mockRes = {
      statusCode: null,
      body: null,
      status(c) { this.statusCode = c; return this; },
      json(b) { this.body = b; return this; },
    };

    middleware(validReq, mockRes, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(mockRes.statusCode, null);

    // Test invalid request
    nextCalled = false;
    const invalidReq = { body: { name: ' ' } };
    middleware(invalidReq, mockRes, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(mockRes.statusCode, 400);
    assert.equal(mockRes.body.success, false);
    assert.equal(mockRes.body.error.code, 'VALIDATION_ERROR');
    assert.ok(mockRes.body.error.details.name);
  });
});
