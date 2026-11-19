'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const authService = require('../../src/services/authService');
const db = require('../../src/config/db');
const { hashSessionToken } = require('../../src/utils/crypto');

describe('Auth Service Business Logic Unit Tests (Phase 2)', () => {
  let usersStore = [];
  let sessionsStore = [];

  beforeEach(() => {
    usersStore = [];
    sessionsStore = [];

    // Mock db.withTransaction
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
              id: 'mock-user-uuid-' + (usersStore.length + 1),
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

    // Mock db.query
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
        const initialLen = sessionsStore.length;
        sessionsStore = sessionsStore.filter((s) => s.id !== params[0]);
        return { rowCount: initialLen - sessionsStore.length };
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
  });

  test('register successfully creates user and session in transaction', async () => {
    const payload = {
      name: 'Alice Johnson',
      email: '  Alice.Johnson@Example.com  ',
      password: 'SecurePassword1!',
    };

    const res = await authService.register(payload);

    assert.ok(res.user.id);
    assert.equal(res.user.name, 'Alice Johnson');
    assert.equal(res.user.email, 'alice.johnson@example.com', 'Email must be normalized to lowercase and trimmed');
    assert.ok(res.user.avatarColor);
    assert.equal(res.user.password, undefined, 'Plaintext password must not be returned');
    assert.equal(res.user.password_hash, undefined, 'Password hash must not be returned');

    // Verify session
    assert.equal(typeof res.rawSessionToken, 'string');
    assert.equal(res.rawSessionToken.length, 64);
    assert.equal(typeof res.csrfToken, 'string');

    // Verify database state: plaintext token is NEVER in database
    assert.equal(sessionsStore.length, 1);
    const expectedDigest = hashSessionToken(res.rawSessionToken);
    assert.equal(sessionsStore[0].id, expectedDigest);
    assert.notEqual(sessionsStore[0].id, res.rawSessionToken);
  });

  test('register rejects duplicate email (case-insensitive) with 409 Conflict', async () => {
    await authService.register({
      name: 'Bob Smith',
      email: 'bob@example.com',
      password: 'Password123!',
    });

    // Attempt second registration with mixed case
    await assert.rejects(
      async () => {
        await authService.register({
          name: 'Bob Duplicate',
          email: 'BOB@EXAMPLE.COM',
          password: 'AnotherPassword1!',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, 'EMAIL_ALREADY_EXISTS');
        return true;
      }
    );
  });

  test('login authenticates valid user, rotates session, and returns safe user profile', async () => {
    await authService.register({
      name: 'Charlie Brown',
      email: 'charlie@example.com',
      password: 'MyPassword1!',
    });

    const loginRes = await authService.login({
      email: '  CHARLIE@example.com  ',
      password: 'MyPassword1!',
    });

    assert.equal(loginRes.user.email, 'charlie@example.com');
    assert.equal(loginRes.user.name, 'Charlie Brown');
    assert.ok(loginRes.rawSessionToken);
    assert.ok(loginRes.csrfToken);

    // Verify fresh session was persisted
    const digest = hashSessionToken(loginRes.rawSessionToken);
    const sessionInDb = sessionsStore.find((s) => s.id === digest);
    assert.ok(sessionInDb);
  });

  test('login rejects unknown email with generic 401 INVALID_CREDENTIALS', async () => {
    await assert.rejects(
      async () => {
        await authService.login({
          email: 'unknown@example.com',
          password: 'AnyPassword1!',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, 'INVALID_CREDENTIALS');
        assert.equal(err.message, 'Invalid email or password.');
        return true;
      }
    );
  });

  test('login rejects incorrect password with generic 401 INVALID_CREDENTIALS', async () => {
    await authService.register({
      name: 'Dana Scully',
      email: 'dana@example.com',
      password: 'RealPassword1!',
    });

    await assert.rejects(
      async () => {
        await authService.login({
          email: 'dana@example.com',
          password: 'WrongPassword1!',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, 'INVALID_CREDENTIALS');
        assert.equal(err.message, 'Invalid email or password.');
        return true;
      }
    );
  });

  test('getUserFromSession returns user for active session and null for expired session', async () => {
    const reg = await authService.register({
      name: 'Fox Mulder',
      email: 'fox@example.com',
      password: 'IWantToBelieve1!',
    });

    const digest = hashSessionToken(reg.rawSessionToken);

    // Active session
    const activeData = await authService.getUserFromSession(digest);
    assert.ok(activeData);
    assert.equal(activeData.user.email, 'fox@example.com');
    assert.equal(activeData.session.csrfToken, reg.csrfToken);

    // Expire session artificially
    const sessionRecord = sessionsStore.find((s) => s.id === digest);
    sessionRecord.expires_at = new Date(Date.now() - 1000); // 1 sec in past

    const expiredData = await authService.getUserFromSession(digest);
    assert.equal(expiredData, null);
  });

  test('logout removes session from database', async () => {
    const reg = await authService.register({
      name: 'Walter Skinner',
      email: 'walter@example.com',
      password: 'DirectorPass1!',
    });

    const digest = hashSessionToken(reg.rawSessionToken);
    assert.ok(sessionsStore.some((s) => s.id === digest));

    await authService.logout(digest);
    assert.equal(sessionsStore.some((s) => s.id === digest), false);
  });
});
