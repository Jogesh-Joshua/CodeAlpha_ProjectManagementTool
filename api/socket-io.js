'use strict';

/**
 * Orbit — Dedicated Socket.IO WebSocket Function for Vercel
 * (Full realtime functionality is activated in Phase 9)
 *
 * Official Reference: https://vercel.com/docs/functions/websockets
 * Dedicated endpoint path: /api/socket-io/socket.io
 */

module.exports = (req, res) => {
  if (req.method === 'GET' && !req.headers.upgrade) {
    res.status(200).json({
      success: true,
      message: 'Orbit Socket.IO endpoint ready. WebSocket connection expected.',
      path: '/api/socket-io/socket.io',
    });
    return;
  }

  // Realtime WebSocket upgrade handler will be wired with Socket.IO server in Phase 9
  res.status(501).json({
    success: false,
    error: { code: 'NOT_IMPLEMENTED' },
    message: 'Socket.IO realtime server is scheduled for activation in Phase 9.',
  });
};
