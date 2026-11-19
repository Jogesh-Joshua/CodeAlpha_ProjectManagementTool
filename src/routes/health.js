'use strict';

const express = require('express');
const router = express.Router();
const { checkConnection } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const env = require('../config/env');

/**
 * GET /api/health
 * Public health & readiness probe for Vercel, uptime monitors, and container probes.
 */
router.get('/', async (req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  const dbStatus = await checkConnection();

  const healthData = {
    status: dbStatus.ok ? 'healthy' : 'degraded',
    uptime: `${uptimeSeconds}s`,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    nodeVersion: process.version,
    database: {
      connected: dbStatus.ok,
      latencyMs: dbStatus.latencyMs,
      ...(dbStatus.error ? { error: dbStatus.error } : {}),
    },
  };

  if (!dbStatus.ok && env.isProduction) {
    return sendError(res, 503, 'SERVICE_DEGRADED', 'Database connectivity issue', healthData);
  }

  return sendSuccess(res, healthData, 'Orbit API is operational', 200);
});

module.exports = router;
