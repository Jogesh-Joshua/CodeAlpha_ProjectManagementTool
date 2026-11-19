'use strict';

const { validators } = require('../middleware/validate');

/**
 * Validate registration request body.
 * Rules:
 * - name: 2-100 characters.
 * - email: valid RFC email format.
 * - password: min 8 characters, at least 1 uppercase letter, at least 1 digit.
 */
function validateRegister(req) {
  const errors = {};
  const { name, email, password } = req.body || {};

  if (!validators.isNonEmptyString(name, 2, 100)) {
    errors.name = 'Full name must be between 2 and 100 characters.';
  }

  if (!validators.isValidEmail(email)) {
    errors.email = 'Please provide a valid email address.';
  }

  if (typeof password !== 'string' || password.length < 8) {
    errors.password = 'Password must be at least 8 characters long.';
  } else if (!/[A-Z]/.test(password)) {
    errors.password = 'Password must contain at least one uppercase letter.';
  } else if (!/[0-9]/.test(password)) {
    errors.password = 'Password must contain at least one number.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate login request body.
 */
function validateLogin(req) {
  const errors = {};
  const { email, password } = req.body || {};

  if (!validators.isValidEmail(email)) {
    errors.email = 'Please provide a valid email address.';
  }

  if (typeof password !== 'string' || password.length === 0) {
    errors.password = 'Password is required.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

module.exports = {
  validateRegister,
  validateLogin,
};
