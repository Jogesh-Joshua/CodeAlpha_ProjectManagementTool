'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const env = require('../config/env');
const { sendError } = require('../utils/response');
const { validate } = require('../middleware/validate');
const { validateRegister, validateLogin } = require('../validators/authValidators');
const { requireAuth } = require('../middleware/auth');
const { validateOrigin, validateCsrf } = require('../middleware/csrf');
const authController = require('../controllers/authController');

// ── Rate Limiter for Authentication Endpoints ─────────────────
const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS, // 15 minutes
  max: env.AUTH_RATE_LIMIT_MAX, // 100 requests
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(
      res,
      429,
      'TOO_MANY_REQUESTS',
      'Too many authentication attempts. Please try again later.'
    );
  },
});

// ── Public Routes ─────────────────────────────────────────────
// CSRF token retrieval
router.get('/csrf', authController.getCsrf);

// Registration: Rate limited, origin-validated, CSRF-validated, input-validated
router.post(
  '/register',
  authLimiter,
  validateOrigin,
  validateCsrf,
  validate(validateRegister),
  authController.register
);

// Login: Rate limited, origin-validated, CSRF-validated, input-validated
router.post(
  '/login',
  authLimiter,
  validateOrigin,
  validateCsrf,
  validate(validateLogin),
  authController.login
);

// ── Protected Routes ──────────────────────────────────────────
// Session restoration (GET /api/auth/me)
router.get('/me', requireAuth, authController.me);

// Logout: Protected, origin-validated, CSRF-validated
router.post(
  '/logout',
  requireAuth,
  validateOrigin,
  validateCsrf,
  authController.logout
);

module.exports = router;
