'use strict';

const http = require('http');
const app = require('./src/app');
const env = require('./src/config/env');
const { closePool } = require('./src/config/db');

const server = http.createServer(app);

server.listen(env.PORT, () => {
  console.log(`\n🌌 Orbit Project Management Server (Express 5 & Node ${process.version})`);
  console.log(`   Running on   : http://localhost:${env.PORT}`);
  console.log(`   Environment  : ${env.NODE_ENV}`);
  console.log(`   Database URL : ${env.DATABASE_URL ? 'Configured' : 'Not configured'}\n`);
});

// ── Graceful Shutdown Handling ────────────────────────────────
function shutdown(signal) {
  console.log(`\n[Shutdown] Received ${signal}. Closing HTTP server and database pool...`);
  server.close(async () => {
    try {
      await closePool();
      console.log('[Shutdown] Resources released cleanly. Exiting.');
      process.exit(0);
    } catch (err) {
      console.error('[Shutdown Error]:', err.message);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
