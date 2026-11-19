'use strict';

const db = require('../config/db');

/**
 * Lists all members of a project. Caller must be an active project member.
 *
 * @param {string} projectId
 * @param {string} userId
 * @returns {Promise<Array<Object>>}
 */
async function getProjectMembers(projectId, userId) {
  // 1. Verify caller membership
  const memberCheck = await db.query(
    `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId]
  );

  if (memberCheck.rows.length === 0) {
    const error = new Error('You are not a member of this project.');
    error.status = 403;
    error.code = 'NOT_A_MEMBER';
    throw error;
  }

  // 2. Fetch all members with user details
  const query = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.avatar_color,
      pm.role,
      pm.joined_at
    FROM project_members pm
    INNER JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = $1
    ORDER BY
      CASE pm.role
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'member' THEN 3
        ELSE 4
      END,
      pm.joined_at ASC
  `;

  const { rows } = await db.query(query, [projectId]);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    avatarColor: r.avatar_color,
    role: r.role,
    joinedAt: r.joined_at,
  }));
}

/**
 * Adds an existing registered user to a project by their email.
 * Caller must be owner or admin.
 *
 * @param {string} projectId
 * @param {string} requesterId
 * @param {string} email
 * @param {string} [role='member']
 * @returns {Promise<Object>} Added member profile
 */
async function addMemberByEmail(projectId, requesterId, email, role = 'member') {
  // 1. Verify requester has owner or admin role
  const requesterCheck = await db.query(
    `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, requesterId]
  );

  if (requesterCheck.rows.length === 0) {
    const error = new Error('You are not a member of this project.');
    error.status = 403;
    error.code = 'NOT_A_MEMBER';
    throw error;
  }

  const requesterRole = requesterCheck.rows[0].role;
  if (requesterRole !== 'owner' && requesterRole !== 'admin') {
    const error = new Error('Only project owners and admins can invite members.');
    error.status = 403;
    error.code = 'INSUFFICIENT_ROLE';
    throw error;
  }

  // Role must be member or admin (owner cannot be added directly due to one-owner invariant)
  if (role === 'owner') {
    const error = new Error('Cannot add a member as owner. Transfer ownership instead.');
    error.status = 400;
    error.code = 'CANNOT_ASSIGN_OWNER_ROLE';
    throw error;
  }

  // 2. Find target user by normalized lowercase email
  const normalizedEmail = email.trim().toLowerCase();
  const userResult = await db.query(
    `SELECT id, name, email, avatar_color FROM users WHERE LOWER(email) = $1`,
    [normalizedEmail]
  );

  if (userResult.rows.length === 0) {
    const error = new Error(`User with email "${normalizedEmail}" is not registered on Orbit.`);
    error.status = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const targetUser = userResult.rows[0];

  // 3. Check if already a member
  const existingMember = await db.query(
    `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, targetUser.id]
  );

  if (existingMember.rows.length > 0) {
    const error = new Error('This user is already a member of this project.');
    error.status = 409;
    error.code = 'ALREADY_MEMBER';
    throw error;
  }

  // 4. Add member
  const insertResult = await db.query(
    `INSERT INTO project_members (project_id, user_id, role)
     VALUES ($1, $2, $3)
     RETURNING role, joined_at`,
    [projectId, targetUser.id, role]
  );

  const newMembership = insertResult.rows[0];

  return {
    id: targetUser.id,
    name: targetUser.name,
    email: targetUser.email,
    avatarColor: targetUser.avatar_color,
    role: newMembership.role,
    joinedAt: newMembership.joined_at,
  };
}

/**
 * Updates a member's role.
 * Only the project owner can change roles.
 * Supports ownership transfer if newRole is 'owner'.
 *
 * @param {string} projectId
 * @param {string} requesterId
 * @param {string} targetUserId
 * @param {string} newRole
 * @returns {Promise<Object>} Updated member profile
 */
async function updateMemberRole(projectId, requesterId, targetUserId, newRole) {
  // 1. Verify requester is the owner
  const requesterCheck = await db.query(
    `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, requesterId]
  );

  if (requesterCheck.rows.length === 0) {
    const error = new Error('You are not a member of this project.');
    error.status = 403;
    error.code = 'NOT_A_MEMBER';
    throw error;
  }

  if (requesterCheck.rows[0].role !== 'owner') {
    const error = new Error('Only the project owner can change member roles or transfer ownership.');
    error.status = 403;
    error.code = 'FORBIDDEN_NOT_OWNER';
    throw error;
  }

  // 2. Verify target member exists
  const targetCheck = await db.query(
    `SELECT pm.role, u.name, u.email, u.avatar_color
     FROM project_members pm
     INNER JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1 AND pm.user_id = $2`,
    [projectId, targetUserId]
  );

  if (targetCheck.rows.length === 0) {
    const error = new Error('Target user is not a member of this project.');
    error.status = 404;
    error.code = 'MEMBER_NOT_FOUND';
    throw error;
  }

  const targetMember = targetCheck.rows[0];

  // 3. Prevent owner from demoting themselves directly without transfer
  if (requesterId === targetUserId && newRole !== 'owner') {
    const error = new Error('You cannot demote yourself. Transfer ownership to another member first.');
    error.status = 400;
    error.code = 'CANNOT_DEMOTE_LAST_OWNER';
    throw error;
  }

  // 4. Handle ownership transfer
  if (newRole === 'owner') {
    if (requesterId === targetUserId) {
      // Already owner, nothing to change
      return {
        id: targetUserId,
        name: targetMember.name,
        email: targetMember.email,
        avatarColor: targetMember.avatar_color,
        role: 'owner',
      };
    }

    return db.withTransaction(async (client) => {
      // Demote current owner to admin
      await client.query(
        `UPDATE project_members SET role = 'admin' WHERE project_id = $1 AND user_id = $2`,
        [projectId, requesterId]
      );

      // Promote new owner
      await client.query(
        `UPDATE project_members SET role = 'owner' WHERE project_id = $1 AND user_id = $2`,
        [projectId, targetUserId]
      );

      // Update project owner_id reference
      await client.query(
        `UPDATE projects SET owner_id = $1, updated_at = NOW() WHERE id = $2`,
        [targetUserId, projectId]
      );

      return {
        id: targetUserId,
        name: targetMember.name,
        email: targetMember.email,
        avatarColor: targetMember.avatar_color,
        role: 'owner',
        ownershipTransferred: true,
      };
    });
  }

  // 5. Normal role update (admin / member)
  const updateResult = await db.query(
    `UPDATE project_members
     SET role = $1
     WHERE project_id = $2 AND user_id = $3
     RETURNING role`,
    [newRole, projectId, targetUserId]
  );

  return {
    id: targetUserId,
    name: targetMember.name,
    email: targetMember.email,
    avatarColor: targetMember.avatar_color,
    role: updateResult.rows[0].role,
  };
}

/**
 * Removes a member from a project.
 * Automatically removes their task assignments via database CASCADE.
 *
 * @param {string} projectId
 * @param {string} requesterId
 * @param {string} targetUserId
 * @returns {Promise<Object>}
 */
async function removeMember(projectId, requesterId, targetUserId) {
  // 1. Verify requester membership and role
  const requesterCheck = await db.query(
    `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, requesterId]
  );

  if (requesterCheck.rows.length === 0) {
    const error = new Error('You are not a member of this project.');
    error.status = 403;
    error.code = 'NOT_A_MEMBER';
    throw error;
  }

  const requesterRole = requesterCheck.rows[0].role;
  const isSelf = requesterId === targetUserId;

  // 2. Verify target member exists
  const targetCheck = await db.query(
    `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, targetUserId]
  );

  if (targetCheck.rows.length === 0) {
    const error = new Error('Target user is not a member of this project.');
    error.status = 404;
    error.code = 'MEMBER_NOT_FOUND';
    throw error;
  }

  const targetRole = targetCheck.rows[0].role;

  // 3. Cannot remove the owner
  if (targetRole === 'owner') {
    const error = new Error('The project owner cannot be removed. Transfer ownership or delete the project.');
    error.status = 400;
    error.code = 'CANNOT_REMOVE_OWNER';
    throw error;
  }

  // 4. Authorization checks
  if (!isSelf) {
    if (requesterRole === 'member') {
      const error = new Error('Members cannot remove other participants.');
      error.status = 403;
      error.code = 'INSUFFICIENT_ROLE';
      throw error;
    }

    if (requesterRole === 'admin' && targetRole === 'admin') {
      const error = new Error('Admins cannot remove other admins. Only the project owner can do this.');
      error.status = 403;
      error.code = 'INSUFFICIENT_ROLE';
      throw error;
    }
  }

  // 5. Delete member (cascade automatically cleans up task_assignees)
  await db.query(
    `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, targetUserId]
  );

  return {
    removed: true,
    projectId,
    userId: targetUserId,
    isSelf,
  };
}

module.exports = {
  getProjectMembers,
  addMemberByEmail,
  updateMemberRole,
  removeMember,
};
