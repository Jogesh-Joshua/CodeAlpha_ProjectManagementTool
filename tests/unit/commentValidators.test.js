'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateCreateComment,
  validateUpdateComment,
  validateCommentIdParam,
} = require('../../src/validators/commentValidators');

describe('Comment Validators Unit Tests (Phase 5)', () => {
  describe('validateCreateComment', () => {
    it('accepts valid comment payload', () => {
      const req = {
        body: {
          body: 'This is a valid comment with some helpful context.',
        },
      };
      const result = validateCreateComment(req);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors, undefined);
    });

    it('rejects missing or undefined body', () => {
      const req = { body: {} };
      const result = validateCreateComment(req);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.body);
    });

    it('rejects whitespace-only body', () => {
      const req = { body: { body: '   \n  \t  ' } };
      const result = validateCreateComment(req);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.body);
    });

    it('rejects non-string body', () => {
      const req = { body: { body: 12345 } };
      const result = validateCreateComment(req);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.body);
    });

    it('rejects body exceeding 10,000 characters', () => {
      const req = { body: { body: 'a'.repeat(10001) } };
      const result = validateCreateComment(req);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.body);
    });

    it('accepts body of exactly 10,000 characters', () => {
      const req = { body: { body: 'a'.repeat(10000) } };
      const result = validateCreateComment(req);
      assert.strictEqual(result.isValid, true);
    });
  });

  describe('validateUpdateComment', () => {
    it('accepts valid update comment payload', () => {
      const req = {
        body: {
          body: 'Updated comment text here.',
        },
      };
      const result = validateUpdateComment(req);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors, undefined);
    });

    it('rejects missing body in update', () => {
      const req = { body: {} };
      const result = validateUpdateComment(req);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.body);
    });

    it('rejects empty or whitespace body in update', () => {
      const req = { body: { body: '   ' } };
      const result = validateUpdateComment(req);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.body);
    });

    it('rejects update body exceeding 10,000 characters', () => {
      const req = { body: { body: 'x'.repeat(10001) } };
      const result = validateUpdateComment(req);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.body);
    });
  });

  describe('validateCommentIdParam', () => {
    it('accepts valid UUID v4 commentId', () => {
      const req = { params: { commentId: 'c1111111-1111-4111-8111-111111111111' } };
      const result = validateCommentIdParam(req);
      assert.strictEqual(result.isValid, true);
    });

    it('rejects non-UUID commentId', () => {
      const req = { params: { commentId: 'invalid-comment-id' } };
      const result = validateCommentIdParam(req);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.commentId);
    });

    it('rejects missing commentId', () => {
      const req = { params: {} };
      const result = validateCommentIdParam(req);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.commentId);
    });
  });
});
