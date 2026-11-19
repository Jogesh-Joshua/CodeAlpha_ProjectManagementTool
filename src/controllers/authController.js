'use strict';

const env = require('../config/env');
const constants = require('../config/constants');
const authService = require('../services/authService');
const { sendSuccess, sendCreated } = require('../utils/response');
const { hashSessionToken } = require('../utils/crypto');
const { issuePreAuthCsrfCookie } = require('../middleware/csrf');

/**
 * Attach the secure, signed session cookie to the response.
 */
function setSessionCookie(res, rawToken) {
  res.cookie(constants.SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    path: '/',
    signed: true,
    maxAge: constants.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

/**
 * Clear the session cookie with matching attributes.
 */
function clearSessionCookie(res) {
  res.clearCookie(constants.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    path: '/',
  });
}

/**
 * POST /api/auth/register
 */
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const { user, rawSessionToken, csrfToken } = await authService.register({
      name,
      email,
      password,
    });

    setSessionCookie(res, rawSessionToken);
    res.clearCookie('orbit_csrf_pre', { path: '/' });

    return sendCreated(
      res,
      { user, csrfToken },
      'Account created successfully.'
    );
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const { user, rawSessionToken, csrfToken } = await authService.login({
      email,
      password,
    });

    setSessionCookie(res, rawSessionToken);
    res.clearCookie('orbit_csrf_pre', { path: '/' });

    return sendSuccess(
      res,
      { user, csrfToken },
      'Logged in successfully.'
    );
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 */
async function logout(req, res, next) {
  try {
    const rawToken = req.signedCookies ? req.signedCookies[constants.SESSION_COOKIE_NAME] : null;
    if (rawToken) {
      const digest = hashSessionToken(rawToken);
      await authService.logout(digest);
    }

    clearSessionCookie(res);
    return sendSuccess(res, {}, 'Logged out successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 */
async function me(req, res) {
  return sendSuccess(
    res,
    {
      user: req.user,
      csrfToken: req.session ? req.session.csrfToken : null,
    },
    'Session active.'
  );
}

/**
 * GET /api/auth/csrf
 * Issues or returns a CSRF token for the frontend.
 */
async function getCsrf(req, res, next) {
  try {
    // If user is already authenticated, return their session-bound CSRF token
    const rawToken = req.signedCookies ? req.signedCookies[constants.SESSION_COOKIE_NAME] : null;
    if (rawToken) {
      const digest = hashSessionToken(rawToken);
      const authData = await authService.getUserFromSession(digest);
      if (authData && authData.session && authData.session.csrfToken) {
        return sendSuccess(
          res,
          { csrfToken: authData.session.csrfToken },
          'Session CSRF token returned.'
        );
      }
    }

    // Otherwise issue a signed pre-auth CSRF cookie
    const token = issuePreAuthCsrfCookie(res);
    return sendSuccess(res, { csrfToken: token }, 'Pre-auth CSRF token issued.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  logout,
  me,
  getCsrf,
};
