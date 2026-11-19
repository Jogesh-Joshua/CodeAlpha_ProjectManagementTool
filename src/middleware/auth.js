'use strict';

const env = require('../config/env');
const constants = require('../config/constants');
const { sendError } = require('../utils/response');
const { hashSessionToken } = require('../utils/crypto');
const authService = require('../services/authService');

/**
 * Authentication Middleware
 * Validates the signed orbit_sid cookie, checks the database session by HMAC digest,
 * verifies session expiry, and attaches req.user and req.session.
 */
async function requireAuth(req, res, next) {
  const rawSessionToken = req.signedCookies ? req.signedCookies[constants.SESSION_COOKIE_NAME] : null;

  if (!rawSessionToken) {
    return sendError(
      res,
      401,
      'NOT_AUTHENTICATED',
      'Authentication required. Please log in.'
    );
  }

  try {
    // Compute HMAC-SHA256 digest to look up session in database
    const sessionDigest = hashSessionToken(rawSessionToken);
    const authData = await authService.getUserFromSession(sessionDigest);

    if (!authData) {
      res.clearCookie(constants.SESSION_COOKIE_NAME, {
        path: '/',
        httpOnly: true,
        secure: env.isProduction,
        sameSite: 'strict',
      });
      return sendError(
        res,
        401,
        'SESSION_EXPIRED',
        'Your session has expired or is invalid. Please log in again.'
      );
    }

    req.user = authData.user;
    req.session = authData.session;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Project Role Authorization Middleware (Prepared for Phase 3)
 */
const ROLE_RANK = { owner: 3, admin: 2, member: 1 };

function requireProjectRole(minRole) {
  return async (req, res, next) => {
    const projectId = req.params.projectId || req.params.id;
    if (!projectId) return next();

    try {
      const db = require('../config/db');
      const { rows } = await db.query(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, req.user.id]
      );

      if (!rows.length) {
        return sendError(res, 403, 'NOT_A_MEMBER', 'You are not a member of this project.');
      }

      const userRank = ROLE_RANK[rows[0].role] || 0;
      const minRank = ROLE_RANK[minRole] || 0;

      if (userRank < minRank) {
        return sendError(
          res,
          403,
          'INSUFFICIENT_ROLE',
          `This action requires ${minRole} role or higher.`
        );
      }

      req.projectRole = rows[0].role;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  requireAuth,
  requireProjectRole,
};
