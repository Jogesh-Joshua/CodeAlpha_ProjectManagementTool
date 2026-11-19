'use strict';

/**
 * Standardised JSON API Response Envelope Helpers
 *
 * Success envelope:
 * { "success": true, "data": { ... }, "message": "..." }
 *
 * Error envelope:
 * { "success": false, "data": null, "error": { "code": "ERROR_CODE" }, "message": "..." }
 */

function sendSuccess(res, data = {}, message = 'Operation successful', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  });
}

function sendCreated(res, data = {}, message = 'Resource created successfully') {
  return sendSuccess(res, data, message, 201);
}

function sendDeleted(res, data = {}, message = 'Resource deleted successfully') {
  return sendSuccess(res, data, message, 200);
}

function sendError(res, statusCode, errorCode, message, details = null) {
  const payload = {
    success: false,
    data: null,
    error: {
      code: errorCode,
      ...(details ? { details } : {}),
    },
    message,
  };
  return res.status(statusCode).json(payload);
}

module.exports = {
  sendSuccess,
  sendCreated,
  sendDeleted,
  sendError,
};
