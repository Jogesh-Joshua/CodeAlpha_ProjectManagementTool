'use strict';

require('dotenv').config();
const http = require('http');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const { closePool } = require('../src/config/db');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outDir = path.join(__dirname, '..', 'docs', 'screenshots');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function runEdgeScreenshot(url, outputPath, width, height) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      `--window-size=${width},${height}`,
      `--screenshot=${outputPath}`,
      url,
    ];
    execFile(edgePath, args, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout, stderr, outputPath });
    });
  });
}

async function performBrowserAudit() {
  console.log('=== Orbit Real Browser UI & Responsiveness Audit ===\n');

  let server;
  try {
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`[Browser Audit] Server listening at ${baseUrl} with Neon DB`);

    // 1. Landing Desktop (1920x1080)
    console.log('\n[1/4] Capturing Desktop Landing View (1920x1080)...');
    const landingDesk = path.join(outDir, 'landing_desktop.png');
    await runEdgeScreenshot(`${baseUrl}/`, landingDesk, 1920, 1080);
    console.log(`  ✔ Captured: ${landingDesk} (${fs.statSync(landingDesk).size} bytes)`);

    // 2. Landing Mobile (390x844)
    console.log('\n[2/4] Capturing Mobile Landing View (390x844)...');
    const landingMob = path.join(outDir, 'landing_mobile.png');
    await runEdgeScreenshot(`${baseUrl}/`, landingMob, 390, 844);
    console.log(`  ✔ Captured: ${landingMob} (${fs.statSync(landingMob).size} bytes)`);

    // 3. Auth Page Desktop (1920x1080)
    console.log('\n[3/4] Capturing Auth Page Desktop View (1920x1080)...');
    const authDesk = path.join(outDir, 'auth_desktop.png');
    await runEdgeScreenshot(`${baseUrl}/login`, authDesk, 1920, 1080);
    console.log(`  ✔ Captured: ${authDesk} (${fs.statSync(authDesk).size} bytes)`);

    // 4. Auth Page Mobile (390x844)
    console.log('\n[4/4] Capturing Auth Page Mobile View (390x844)...');
    const authMob = path.join(outDir, 'auth_mobile.png');
    await runEdgeScreenshot(`${baseUrl}/login`, authMob, 390, 844);
    console.log(`  ✔ Captured: ${authMob} (${fs.statSync(authMob).size} bytes)`);

    console.log('\n=== Real browser audit completed successfully! ===');
  } catch (err) {
    console.error('[Browser Audit Error]:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closePool();
  }
}

performBrowserAudit();
