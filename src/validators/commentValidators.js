'use strict';

const { validators } = require('../middleware/validate');
const constants = require('../config/constants');

/**
 * Validates creating a task comment.
 */
function validateCreateComment(req) {
  const errors = {};
  const { body } = req.body || {};

  const maxLength = constants.COMMENT_MAX_LENGTH || 10000;

  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    errors.body = 'Comment body cannot be empty.';
  } else if (body.length > maxLength) {
    errors.body = `Comment body cannot exceed ${maxLength} characters.`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Validates updating an existing task comment.
 */
function validateUpdateComment(req) {
  const errors = {};
  const { body } = req.body || {};

  const maxLength = constants.COMMENT_MAX_LENGTH || 10000;

  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    errors.body = 'Comment body cannot be empty.';
  } else if (body.length > maxLength) {
    errors.body = `Comment body cannot exceed ${maxLength} characters.`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Validates comment UUID parameter (:commentId).
 */
function validateCommentIdParam(req) {
  const errors = {};
  const { commentId } = req.params;

  if (!commentId || !validators.isValidUUID(commentId)) {
    errors.commentId = 'Invalid comment ID format (UUID expected).';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

module.exports = {
  validateCreateComment,
  validateUpdateComment,
  validateCommentIdParam,
};
