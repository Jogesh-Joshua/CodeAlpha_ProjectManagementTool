'use strict';

const env = require('../config/env');
const { sendError } = require('../utils/response');

/**
 * Global Express Error Handling Middleware (Express 5 compatible)
 * Formats errors into the canonical Orbit JSON error envelope.
 * Stack traces are omitted in production.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');

  // In production, generic message for 500s to avoid leaking internals
  const message = env.isProduction && statusCode >= 500
    ? 'An unexpected internal server error occurred.'
    : err.message || 'An error occurred processing your request.';

  if (!env.isTest) {
    console.error(`[Error] [${req.method} ${req.originalUrl}] ${statusCode} - ${errorCode}:`, err.message);
    if (!env.isProduction && err.stack) {
      console.error(err.stack);
    }
  }

  return sendError(res, statusCode, errorCode, message, !env.isProduction && err.details ? err.details : null);
}

module.exports = { errorHandler };
