'use strict';

const env = require('../config/env');
const { sendError } = require('../utils/response');
const { verifyCsrfToken, generateCsrfToken } = require('../utils/crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

/**
 * Validate that incoming state-changing requests come from an authorized origin.
 */
function validateOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin) {
    const isAllowed = allowedOrigins.includes(origin) || (!env.isProduction && origin.includes('localhost'));
    if (!isAllowed) {
      return sendError(res, 403, 'CSRF_ORIGIN_INVALID', 'Untrusted request origin.');
    }
  } else if (referer && env.isProduction) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!allowedOrigins.includes(refererOrigin)) {
        return sendError(res, 403, 'CSRF_REFERER_INVALID', 'Untrusted request referer.');
      }
    } catch {
      return sendError(res, 403, 'CSRF_REFERER_INVALID', 'Malformed request referer.');
    }
  }

  next();
}

/**
 * Validate CSRF token on state-changing requests.
 * Uses session-bound token for authenticated requests and signed pre-auth cookie for register/login.
 */
function validateCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const providedToken = req.headers['x-csrf-token'];
  if (!providedToken) {
    return sendError(res, 403, 'CSRF_TOKEN_MISSING', 'CSRF token is required in X-CSRF-Token header.');
  }

  let expectedToken = null;

  // 1. If user is authenticated, use the session-bound token
  if (req.session && req.session.csrfToken) {
    expectedToken = req.session.csrfToken;
  } else if (req.signedCookies && req.signedCookies['orbit_csrf_pre']) {
    // 2. Pre-authentication flow (register/login)
    expectedToken = req.signedCookies['orbit_csrf_pre'];
  }

  if (!expectedToken) {
    return sendError(
      res,
      403,
      'CSRF_TOKEN_INVALID',
      'No valid CSRF token context found. Please refresh the page.'
    );
  }

  const isValid = verifyCsrfToken(providedToken, expectedToken);
  if (!isValid) {
    return sendError(res, 403, 'CSRF_TOKEN_INVALID', 'Invalid or expired CSRF token.');
  }

  next();
}

/**
 * Helper to issue pre-auth CSRF token cookie.
 */
function issuePreAuthCsrfCookie(res) {
  const token = generateCsrfToken();
  res.cookie('orbit_csrf_pre', token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    path: '/',
    signed: true,
    maxAge: 60 * 60 * 1000, // 1 hour
  });
  return token;
}

module.exports = {
  validateOrigin,
  validateCsrf,
  issuePreAuthCsrfCookie,
};
