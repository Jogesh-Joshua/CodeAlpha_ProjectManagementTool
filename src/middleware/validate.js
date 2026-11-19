'use strict';

const { sendError } = require('../utils/response');

/**
 * Validation middleware factory.
 * @param {(req: import('express').Request) => { isValid: boolean, errors?: Record<string, string> }} validatorFn
 */
function validate(validatorFn) {
  return (req, res, next) => {
    try {
      const result = validatorFn(req);
      if (!result.isValid) {
        return sendError(
          res,
          400,
          'VALIDATION_ERROR',
          'Validation failed for one or more fields.',
          result.errors
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Common sanitizers and validators
 */
const validators = {
  isValidEmail(email) {
    if (typeof email !== 'string') return false;
    // Standard RFC 5322 simplified email check
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  },

  isValidUUID(id) {
    if (typeof id !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
  },

  isValidColorHex(hex) {
    if (typeof hex !== 'string') return false;
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex.trim());
  },

  isNonEmptyString(str, minLength = 1, maxLength = 255) {
    if (typeof str !== 'string') return false;
    const trimmed = str.trim();
    return trimmed.length >= minLength && trimmed.length <= maxLength;
  },

  isInEnum(val, allowedValues) {
    return allowedValues.includes(val);
  },

  isValidDateString(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime());
  },
};

module.exports = {
  validate,
  validators,
};
