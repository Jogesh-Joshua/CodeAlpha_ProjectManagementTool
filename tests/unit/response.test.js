'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { sendSuccess, sendCreated, sendDeleted, sendError } = require('../../src/utils/response');

describe('Response Utility Unit Tests', () => {
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

  test('sendSuccess formats standard success envelope with 200 default status', () => {
    const res = createMockRes();
    const data = { id: 123, name: 'Orbit' };
    sendSuccess(res, data, 'Item retrieved');

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      success: true,
      data: { id: 123, name: 'Orbit' },
      message: 'Item retrieved',
    });
  });

  test('sendCreated formats standard created envelope with 201 status', () => {
    const res = createMockRes();
    const data = { id: 'task-1' };
    sendCreated(res, data, 'Task created');

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, {
      success: true,
      data: { id: 'task-1' },
      message: 'Task created',
    });
  });

  test('sendDeleted formats standard success envelope with 200 status (no empty 204)', () => {
    const res = createMockRes();
    sendDeleted(res, { id: 'task-1' }, 'Task deleted');

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, { id: 'task-1' });
    assert.equal(res.body.message, 'Task deleted');
  });

  test('sendError formats standard error envelope with code and data=null', () => {
    const res = createMockRes();
    sendError(res, 404, 'NOT_FOUND', 'Item does not exist', { field: 'id' });

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, {
      success: false,
      data: null,
      error: {
        code: 'NOT_FOUND',
        details: { field: 'id' },
      },
      message: 'Item does not exist',
    });
  });
});
