'use strict';

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../../src/app');
const db = require('../../src/config/db');

describe('E2E Authentication & Session API Tests (Phase 2)', () => {
  let server;
  let baseUrl;

  let usersStore = [];
  let sessionsStore = [];

  before(async () => {
    db.withTransaction = async (callback) => {
      const mockClient = {
        query: async (text, params) => {
          const sql = text.replace(/\s+/g, ' ').trim();
          if (sql.includes('SELECT id FROM users WHERE LOWER(email) = $1')) {
            const found = usersStore.filter((u) => u.email.toLowerCase() === params[0].toLowerCase());
            return { rows: found };
          }
          if (sql.includes('INSERT INTO users')) {
            const newUser = {
              id: 'user-' + (usersStore.length + 1),
              name: params[0],
              email: params[1],
              password_hash: params[2],
              avatar_color: params[3],
              created_at: new Date(),
            };
            usersStore.push(newUser);
            return { rows: [newUser] };
          }
          if (sql.includes('INSERT INTO sessions')) {
            sessionsStore.push({
              id: params[0],
              user_id: params[1],
              data: params[2],
              expires_at: params[3],
            });
            return { rowCount: 1 };
          }
          return { rows: [] };
        },
      };
      return callback(mockClient);
    };

    db.query = async (text, params) => {
      const sql = text.replace(/\s+/g, ' ').trim();
      if (sql.includes('SELECT id, name, email, password_hash, avatar_color FROM users WHERE LOWER(email) = $1')) {
        const found = usersStore.filter((u) => u.email.toLowerCase() === params[0].toLowerCase());
        return { rows: found };
      }
      if (sql.includes('INSERT INTO sessions')) {
        sessionsStore.push({
          id: params[0],
          user_id: params[1],
          data: params[2],
          expires_at: params[3],
        });
        return { rowCount: 1 };
      }
      if (sql.includes('DELETE FROM sessions WHERE id = $1')) {
        sessionsStore = sessionsStore.filter((s) => s.id !== params[0]);
        return { rowCount: 1 };
      }
      if (sql.includes('SELECT s.id AS session_id')) {
        const session = sessionsStore.find((s) => s.id === params[0]);
        if (!session || new Date(session.expires_at) <= new Date()) {
          return { rows: [] };
        }
        const user = usersStore.find((u) => u.id === session.user_id);
        if (!user) return { rows: [] };
        return {
          rows: [
            {
              session_id: session.id,
              expires_at: session.expires_at,
              data: session.data,
              user_id: user.id,
              name: user.name,
              email: user.email,
              avatar_color: user.avatar_color,
            },
          ],
        };
      }
      if (sql.includes('UPDATE sessions SET last_seen')) {
        return { rowCount: 1 };
      }
      return { rows: [] };
    };

    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    usersStore = [];
    sessionsStore = [];
  });

  function extractCookie(res, cookieName) {
    const raw = res.headers.get('set-cookie');
    if (!raw) return null;
    const cookies = raw.split(/,(?=\s*\w+=)/);
    for (const c of cookies) {
      if (c.trim().startsWith(`${cookieName}=`)) {
        return c.split(';')[0].trim();
      }
    }
    return null;
  }

  test('GET /api/auth/csrf issues pre-auth token and signed cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/csrf`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.csrfToken);

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie.includes('orbit_csrf_pre=s%3A'));
  });

  test('POST /api/auth/register fails without CSRF token (403)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        name: 'Alice Johnson',
        email: 'alice@example.com',
        password: 'Password123!',
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'CSRF_TOKEN_MISSING');
  });

  test('POST /api/auth/register fails with untrusted origin (403)', async () => {
    const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
    const { data } = await csrfRes.json();
    const preCookie = extractCookie(csrfRes, 'orbit_csrf_pre');

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': data.csrfToken,
        Cookie: preCookie,
        origin: 'https://malicious-site.com',
      },
      body: JSON.stringify({
        name: 'Alice Johnson',
        email: 'alice@example.com',
        password: 'Password123!',
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'CSRF_ORIGIN_INVALID');
  });

  test('POST /api/auth/register successfully creates user, session, and sets signed cookie', async () => {
    const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
    const { data } = await csrfRes.json();
    const preCookie = extractCookie(csrfRes, 'orbit_csrf_pre');

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': data.csrfToken,
        Cookie: preCookie,
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        name: 'Alice Johnson',
        email: 'alice@example.com',
        password: 'Password123!',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.user.email, 'alice@example.com');
    assert.ok(body.data.csrfToken);

    // Verify signed session cookie
    const sessionCookie = extractCookie(res, 'orbit_sid');
    assert.ok(sessionCookie);
    assert.ok(sessionCookie.startsWith('orbit_sid=s%3A'));
  });

  test('Full authentication lifecycle: Register -> Me -> Logout -> Me (401)', async () => {
    // 1. Get CSRF token
    const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
    const { data: csrfData } = await csrfRes.json();
    const preCookie = extractCookie(csrfRes, 'orbit_csrf_pre');

    // 2. Register
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfData.csrfToken,
        Cookie: preCookie,
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        name: 'Bob User',
        email: 'bob@example.com',
        password: 'Password123!',
      }),
    });
    assert.equal(regRes.status, 201);
    const regBody = await regRes.json();
    const sessionCookie = extractCookie(regRes, 'orbit_sid');
    const sessionCsrfToken = regBody.data.csrfToken;

    // 3. Verify session via GET /api/auth/me
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: sessionCookie,
      },
    });
    assert.equal(meRes.status, 200);
    const meBody = await meRes.json();
    assert.equal(meBody.success, true);
    assert.equal(meBody.data.user.email, 'bob@example.com');
    assert.equal(meBody.data.csrfToken, sessionCsrfToken);

    // 4. Logout via POST /api/auth/logout with session CSRF token
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': sessionCsrfToken,
        Cookie: sessionCookie,
        origin: 'http://localhost:3000',
      },
    });
    assert.equal(logoutRes.status, 200);
    const rawSetCookie = logoutRes.headers.get('set-cookie');
    assert.ok(rawSetCookie.includes('orbit_sid=;')); // verified cleared

    // 5. Subsequent GET /api/auth/me with old cookie fails with 401
    const finalMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: sessionCookie,
      },
    });
    assert.equal(finalMeRes.status, 401);
  });

  test('POST /api/auth/login succeeds with valid credentials and fails with invalid credentials', async () => {
    // Register user first
    const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
    const { data: csrfData } = await csrfRes.json();
    const preCookie = extractCookie(csrfRes, 'orbit_csrf_pre');

    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfData.csrfToken,
        Cookie: preCookie,
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        name: 'Carol User',
        email: 'carol@example.com',
        password: 'Password123!',
      }),
    });

    // Fresh pre-auth CSRF token for login
    const loginCsrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
    const { data: loginCsrfData } = await loginCsrfRes.json();
    const loginPreCookie = extractCookie(loginCsrfRes, 'orbit_csrf_pre');

    // Test failed login: wrong password
    const failRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': loginCsrfData.csrfToken,
        Cookie: loginPreCookie,
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        email: 'carol@example.com',
        password: 'WrongPassword!',
      }),
    });
    assert.equal(failRes.status, 401);
    const failBody = await failRes.json();
    assert.equal(failBody.error.code, 'INVALID_CREDENTIALS');

    // Test successful login
    const successRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': loginCsrfData.csrfToken,
        Cookie: loginPreCookie,
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        email: 'carol@example.com',
        password: 'Password123!',
      }),
    });
    assert.equal(successRes.status, 200);
    const successBody = await successRes.json();
    assert.equal(successBody.success, true);
    assert.equal(successBody.data.user.email, 'carol@example.com');
    assert.ok(extractCookie(successRes, 'orbit_sid'));
  });

  test('GET /api/auth/me rejects tampered or unsigned cookie with 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: 'orbit_sid=tampered_unsigned_token_value',
      },
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'NOT_AUTHENTICATED');
  });
});
