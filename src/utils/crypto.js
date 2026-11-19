'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../config/env');

/**
 * Hash a plaintext password using bcryptjs.
 * @param {string} password
 * @returns {Promise<string>} bcrypt hash
 */
async function hashPassword(password) {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

/**
 * Compare a plaintext password against a bcrypt hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a cryptographically random 256-bit (32 bytes) session token in hex.
 * @returns {string} 64-character hex string
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Compute the HMAC-SHA256 digest of a session token using SESSION_SECRET.
 * This digest is the only session representation stored in the database.
 * @param {string} token
 * @returns {string} 64-character hex digest
 */
function hashSessionToken(token) {
  return crypto
    .createHmac('sha256', env.SESSION_SECRET)
    .update(token)
    .digest('hex');
}

/**
 * Generate a random CSRF token (32 bytes in hex).
 * @returns {string}
 */
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify a CSRF token using constant-time comparison to protect against timing attacks.
 * @param {string} providedToken
 * @param {string} expectedToken
 * @returns {boolean}
 */
function verifyCsrfToken(providedToken, expectedToken) {
  if (typeof providedToken !== 'string' || typeof expectedToken !== 'string') {
    return false;
  }
  const providedBuffer = Buffer.from(providedToken, 'utf8');
  const expectedBuffer = Buffer.from(expectedToken, 'utf8');

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  generateCsrfToken,
  verifyCsrfToken,
};
