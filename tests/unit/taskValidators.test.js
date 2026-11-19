'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateCreateTask,
  validateUpdateTask,
  validateMoveTask,
  validateTaskIdParam,
} = require('../../src/validators/taskValidators');

describe('Task Validators Unit Tests (Phase 4)', () => {
  it('validateCreateTask accepts valid task payload', () => {
    const req = {
      body: {
        title: 'Design Kanban Board',
        description: 'Prepare columns, cards, and drag-and-drop',
        priority: 'high',
        due_date: '2026-12-01',
        assignee_ids: ['a1111111-1111-4111-8111-111111111111'],
      },
    };
    const result = validateCreateTask(req);
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.errors, undefined);
  });

  it('validateCreateTask rejects missing or empty title', () => {
    const req = { body: { title: '   ' } };
    const result = validateCreateTask(req);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.title);
  });

  it('validateCreateTask rejects invalid priority', () => {
    const req = { body: { title: 'Valid Title', priority: 'super-urgent' } };
    const result = validateCreateTask(req);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.priority);
  });

  it('validateCreateTask rejects invalid due date format', () => {
    const req = { body: { title: 'Valid Title', due_date: 'not-a-date' } };
    const result = validateCreateTask(req);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.due_date);
  });

  it('validateCreateTask rejects non-array assignee_ids or invalid UUID in assignees', () => {
    const nonArrayReq = { body: { title: 'Valid', assignee_ids: 'not-array' } };
    assert.strictEqual(validateCreateTask(nonArrayReq).isValid, false);

    const badUuidReq = { body: { title: 'Valid', assignee_ids: ['invalid-uuid'] } };
    assert.strictEqual(validateCreateTask(badUuidReq).isValid, false);
  });

  it('validateUpdateTask requires at least one field', () => {
    const req = { body: {} };
    const result = validateUpdateTask(req);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors._general);
  });

  it('validateUpdateTask accepts valid update payload', () => {
    const req = {
      body: {
        title: 'Updated title',
        status: 'in_progress',
        priority: 'critical',
      },
    };
    const result = validateUpdateTask(req);
    assert.strictEqual(result.isValid, true);
  });

  it('validateUpdateTask rejects invalid status', () => {
    const req = { body: { status: 'flying' } };
    const result = validateUpdateTask(req);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.status);
  });

  it('validateMoveTask accepts valid status and non-negative integer position', () => {
    const req = { body: { status: 'in_progress', position: 2 } };
    const result = validateMoveTask(req);
    assert.strictEqual(result.isValid, true);
  });

  it('validateMoveTask rejects negative position or float position', () => {
    const negReq = { body: { status: 'in_progress', position: -1 } };
    assert.strictEqual(validateMoveTask(negReq).isValid, false);

    const floatReq = { body: { status: 'in_progress', position: 2.5 } };
    assert.strictEqual(validateMoveTask(floatReq).isValid, false);
  });

  it('validateMoveTask rejects invalid status', () => {
    const req = { body: { status: 'archive', position: 0 } };
    assert.strictEqual(validateMoveTask(req).isValid, false);
  });

  it('validateTaskIdParam validates UUID format', () => {
    const validReq = { params: { taskId: 'd0000000-0000-4000-8000-000000000001' } };
    assert.strictEqual(validateTaskIdParam(validReq).isValid, true);

    const invalidReq = { params: { taskId: 'not-a-uuid' } };
    assert.strictEqual(validateTaskIdParam(invalidReq).isValid, false);
  });
});
