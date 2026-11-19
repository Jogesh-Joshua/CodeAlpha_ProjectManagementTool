'use strict';

const db = require('../config/db');
const constants = require('../config/constants');
const {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  generateCsrfToken,
} = require('../utils/crypto');

/**
 * Custom application error with HTTP status code and error code.
 */
class AppError extends Error {
  constructor(message, statusCode, code, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Register a new user and generate their initial session within a single transaction.
 * @param {{ name: string, email: string, password: string }} data
 * @returns {Promise<{ user: object, rawSessionToken: string, csrfToken: string }>}
 */
async function register({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();

  const passwordHash = await hashPassword(password);
  const avatarColors = constants.AVATAR_COLORS;
  const avatarColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

  return db.withTransaction(async (client) => {
    // 1. Check if email already registered (case-insensitive)
    const existing = await client.query(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (existing.rows.length > 0) {
      throw new AppError(
        'An account with this email address already exists.',
        409,
        'EMAIL_ALREADY_EXISTS'
      );
    }

    // 2. Insert new user
    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash, avatar_color)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, avatar_color, created_at`,
      [trimmedName, normalizedEmail, passwordHash, avatarColor]
    );

    const newUser = userResult.rows[0];

    // 3. Generate cryptographic 256-bit session token & HMAC-SHA256 digest
    const rawSessionToken = generateSessionToken();
    const sessionDigest = hashSessionToken(rawSessionToken);
    const csrfToken = generateCsrfToken();
    const expiresAt = new Date(Date.now() + constants.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    // 4. Persist session digest and session-bound CSRF token
    await client.query(
      `INSERT INTO sessions (id, user_id, data, expires_at, created_at, last_seen)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [sessionDigest, newUser.id, JSON.stringify({ csrfToken }), expiresAt]
    );

    return {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        avatarColor: newUser.avatar_color,
      },
      rawSessionToken,
      csrfToken,
    };
  });
}

/**
 * Authenticate user with credentials and issue a fresh session token.
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ user: object, rawSessionToken: string, csrfToken: string }>}
 */
async function login({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Lookup user by normalized email
  const result = await db.query(
    `SELECT id, name, email, password_hash, avatar_color
     FROM users
     WHERE LOWER(email) = $1`,
    [normalizedEmail]
  );

  if (result.rows.length === 0) {
    // Generic error to prevent account enumeration
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  const user = result.rows[0];

  // 2. Verify password with bcrypt
  const isMatch = await verifyPassword(password, user.password_hash);
  if (!isMatch) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  // 3. Session rotation: issue fresh random session token
  const rawSessionToken = generateSessionToken();
  const sessionDigest = hashSessionToken(rawSessionToken);
  const csrfToken = generateCsrfToken();
  const expiresAt = new Date(Date.now() + constants.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  // 4. Persist session
  await db.query(
    `INSERT INTO sessions (id, user_id, data, expires_at, created_at, last_seen)
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    [sessionDigest, user.id, JSON.stringify({ csrfToken }), expiresAt]
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarColor: user.avatar_color,
    },
    rawSessionToken,
    csrfToken,
  };
}

/**
 * Invalidate a session server-side.
 * @param {string} sessionDigest
 */
async function logout(sessionDigest) {
  if (!sessionDigest) return;
  await db.query('DELETE FROM sessions WHERE id = $1', [sessionDigest]);
}

/**
 * Retrieve user and session details by HMAC session digest.
 * Verifies that the session has not expired and updates last_seen.
 * @param {string} sessionDigest
 * @returns {Promise<{ user: object, session: object } | null>}
 */
async function getUserFromSession(sessionDigest) {
  if (!sessionDigest) return null;

  const result = await db.query(
    `SELECT s.id AS session_id, s.expires_at, s.data,
            u.id AS user_id, u.name, u.email, u.avatar_color
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [sessionDigest]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  // Update last_seen asynchronously in the background
  db.query('UPDATE sessions SET last_seen = NOW() WHERE id = $1', [sessionDigest]).catch((err) => {
    console.error('[Session Update Error]:', err.message);
  });

  const sessionData = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});

  return {
    user: {
      id: row.user_id,
      name: row.name,
      email: row.email,
      avatarColor: row.avatar_color,
    },
    session: {
      id: row.session_id,
      expiresAt: row.expires_at,
      csrfToken: sessionData.csrfToken || null,
    },
  };
}

module.exports = {
  AppError,
  register,
  login,
  logout,
  getUserFromSession,
};
