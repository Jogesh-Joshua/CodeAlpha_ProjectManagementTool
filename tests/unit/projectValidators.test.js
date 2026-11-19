'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateCreateProject,
  validateUpdateProject,
  validateProjectIdParam,
  validateAddMember,
  validateUpdateMemberRole,
  validateMemberIdParam,
  validateSearchUsers,
  validateUpdateProfile,
  validateChangePassword,
} = require('../../src/validators/projectValidators');

describe('Project Validators Unit Tests (Phase 3)', () => {
  it('validateCreateProject accepts valid payload', () => {
    const req = {
      body: {
        name: 'Website Redesign',
        description: 'Overhaul brand website and design system.',
        color: '#6366F1',
      },
    };
    const result = validateCreateProject(req);
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.errors, undefined);
  });

  it('validateCreateProject rejects missing or empty name', () => {
    const req = { body: { name: '   ', color: '#6366F1' } };
    const result = validateCreateProject(req);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.name);
  });

  it('validateCreateProject rejects invalid hex color', () => {
    const req = { body: { name: 'Alpha', color: 'not-a-color' } };
    const result = validateCreateProject(req);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.color);
  });

  it('validateUpdateProject requires at least one field', () => {
    const req = { body: {} };
    const result = validateUpdateProject(req);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors._general);
  });

  it('validateUpdateProject validates fields when present', () => {
    const req = {
      body: {
        name: 'Updated Name',
        color: '#10B981',
        is_archived: false,
      },
    };
    const result = validateUpdateProject(req);
    assert.strictEqual(result.isValid, true);
  });

  it('validateProjectIdParam checks UUID format', () => {
    const validReq = { params: { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' } };
    assert.strictEqual(validateProjectIdParam(validReq).isValid, true);

    const invalidReq = { params: { id: 'invalid-id-123' } };
    assert.strictEqual(validateProjectIdParam(invalidReq).isValid, false);
  });

  it('validateAddMember accepts valid email and role', () => {
    const req = { body: { email: 'bob@example.com', role: 'admin' } };
    const result = validateAddMember(req);
    assert.strictEqual(result.isValid, true);
  });

  it('validateAddMember rejects invalid email and invalid role', () => {
    const req = { body: { email: 'bad-email', role: 'superhero' } };
    const result = validateAddMember(req);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.email);
    assert.ok(result.errors.role);
  });

  it('validateUpdateMemberRole checks valid project roles', () => {
    const validReq = {
      params: { userId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' },
      body: { role: 'admin' },
    };
    assert.strictEqual(validateUpdateMemberRole(validReq).isValid, true);

    const invalidRoleReq = {
      params: { userId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' },
      body: { role: 'guest' },
    };
    assert.strictEqual(validateUpdateMemberRole(invalidRoleReq).isValid, false);
  });

  it('validateSearchUsers validates search query parameter', () => {
    assert.strictEqual(validateSearchUsers({ query: { q: 'alice' } }).isValid, true);
    assert.strictEqual(validateSearchUsers({ query: { q: '' } }).isValid, false);
    assert.strictEqual(validateSearchUsers({ query: {} }).isValid, false);
  });

  it('validateUpdateProfile enforces name length constraints', () => {
    assert.strictEqual(validateUpdateProfile({ body: { name: 'Bob Smith' } }).isValid, true);
    assert.strictEqual(validateUpdateProfile({ body: { name: 'B' } }).isValid, false);
  });

  it('validateChangePassword enforces current password and new password complexity', () => {
    assert.strictEqual(
      validateChangePassword({
        body: { currentPassword: 'OldPassword1', newPassword: 'NewSecurePassword1' },
      }).isValid,
      true
    );

    assert.strictEqual(
      validateChangePassword({
        body: { currentPassword: 'OldPassword1', newPassword: 'short' },
      }).isValid,
      false
    );
  });
});
