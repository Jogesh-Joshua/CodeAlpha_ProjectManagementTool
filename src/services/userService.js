'use strict';

const db = require('../config/db');
const { hashPassword, verifyPassword } = require('../utils/crypto');

/**
 * Searches registered users by name or email (case-insensitive substring match).
 *
 * @param {string} query
 * @param {string} [excludeUserId]
 * @param {number} [limit=10]
 * @returns {Promise<Array<Object>>} Safe user profiles
 */
async function searchUsers(query, excludeUserId = null, limit = 10) {
  const searchTerm = `%${query.trim().toLowerCase()}%`;

  let sql = `
    SELECT id, name, email, avatar_color
    FROM users
    WHERE (LOWER(name) LIKE $1 OR LOWER(email) LIKE $1)
  `;
  const params = [searchTerm];

  if (excludeUserId) {
    sql += ` AND id != $2`;
    params.push(excludeUserId);
  }

  sql += ` ORDER BY name ASC LIMIT $${params.length + 1}`;
  params.push(Math.min(limit, 20));

  const { rows } = await db.query(sql, params);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    avatarColor: r.avatar_color,
  }));
}

/**
 * Updates user profile details (display name).
 *
 * @param {string} userId
 * @param {Object} data
 * @param {string} data.name
 * @returns {Promise<Object>} Safe user profile
 */
async function updateProfile(userId, { name }) {
  const trimmedName = name.trim();

  const { rows } = await db.query(
    `UPDATE users
     SET name = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, name, email, avatar_color`,
    [trimmedName, userId]
  );

  if (rows.length === 0) {
    const error = new Error('User not found.');
    error.status = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const user = rows[0];
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarColor: user.avatar_color,
  };
}

/**
 * Changes user password after verifying their current password.
 *
 * @param {string} userId
 * @param {Object} data
 * @param {string} data.currentPassword
 * @param {string} data.newPassword
 * @returns {Promise<void>}
 */
async function changePassword(userId, { currentPassword, newPassword }) {
  // 1. Fetch user password hash
  const { rows } = await db.query(
    `SELECT password_hash FROM users WHERE id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    const error = new Error('User not found.');
    error.status = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const { password_hash: currentHash } = rows[0];

  // 2. Verify current password
  const isMatch = await verifyPassword(currentPassword, currentHash);
  if (!isMatch) {
    const error = new Error('Current password does not match.');
    error.status = 400;
    error.code = 'INVALID_CURRENT_PASSWORD';
    throw error;
  }

  // 3. Hash new password and update
  const newHash = await hashPassword(newPassword);
  await db.query(
    `UPDATE users
     SET password_hash = $1, updated_at = NOW()
     WHERE id = $2`,
    [newHash, userId]
  );
}

module.exports = {
  searchUsers,
  updateProfile,
  changePassword,
};
