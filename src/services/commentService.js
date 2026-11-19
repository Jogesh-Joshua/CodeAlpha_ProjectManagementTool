'use strict';

const db = require('../config/db');

/**
 * Verifies that the user is an active member of the project and retrieves their role.
 *
 * @param {string} projectId
 * @param {string} userId
 * @returns {Promise<string>} Member role ('owner', 'admin', 'member')
 */
async function verifyProjectMember(projectId, userId) {
  const { rows } = await db.query(
    `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId]
  );

  if (rows.length === 0) {
    const error = new Error('You are not a member of this project.');
    error.status = 403;
    error.code = 'NOT_A_MEMBER';
    throw error;
  }

  return rows[0].role;
}

/**
 * Verifies that the specified task belongs to the given project.
 *
 * @param {string} projectId
 * @param {string} taskId
 * @returns {Promise<Object>} Task metadata
 */
async function verifyTaskInProject(projectId, taskId) {
  const { rows } = await db.query(
    `SELECT id, project_id, title FROM tasks WHERE id = $1 AND project_id = $2`,
    [taskId, projectId]
  );

  if (rows.length === 0) {
    const error = new Error('Task not found in this project.');
    error.status = 404;
    error.code = 'TASK_NOT_FOUND';
    throw error;
  }

  return rows[0];
}

/**
 * Retrieves all comments for a task in chronological order (newest at bottom).
 *
 * @param {string} projectId
 * @param {string} taskId
 * @param {string} userId
 * @returns {Promise<Array<Object>>}
 */
async function getTaskComments(projectId, taskId, userId) {
  // 1. Verify project membership and task association
  await verifyProjectMember(projectId, userId);
  await verifyTaskInProject(projectId, taskId);

  // 2. Fetch comments with author details
  const query = `
    SELECT
      c.id,
      c.task_id,
      c.author_id,
      c.body,
      c.is_edited,
      c.created_at,
      c.updated_at,
      u.name AS author_name,
      u.email AS author_email,
      u.avatar_color AS author_avatar_color
    FROM task_comments c
    INNER JOIN users u ON u.id = c.author_id
    WHERE c.task_id = $1
    ORDER BY c.created_at ASC
  `;

  const { rows } = await db.query(query, [taskId]);

  return rows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    authorId: row.author_id,
    body: row.body,
    isEdited: row.is_edited,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: row.author_id,
      name: row.author_name,
      email: row.author_email,
      avatarColor: row.author_avatar_color,
    },
  }));
}

/**
 * Creates a new comment on a task.
 *
 * @param {string} projectId
 * @param {string} taskId
 * @param {string} userId
 * @param {Object} data
 * @param {string} data.body
 * @returns {Promise<Object>} Created comment with author details
 */
async function createComment(projectId, taskId, userId, { body }) {
  // 1. Verify project membership and task association
  await verifyProjectMember(projectId, userId);
  await verifyTaskInProject(projectId, taskId);

  const trimmedBody = body.trim();

  // 2. Insert comment
  const insertResult = await db.query(
    `INSERT INTO task_comments (task_id, author_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, task_id, author_id, body, is_edited, created_at, updated_at`,
    [taskId, userId, trimmedBody]
  );

  const comment = insertResult.rows[0];

  // 3. Fetch author details
  const authorResult = await db.query(
    `SELECT id, name, email, avatar_color AS "avatarColor" FROM users WHERE id = $1`,
    [userId]
  );

  return {
    id: comment.id,
    taskId: comment.task_id,
    authorId: comment.author_id,
    body: comment.body,
    isEdited: comment.is_edited,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    author: authorResult.rows[0],
  };
}

/**
 * Updates a comment's body. Only the author can edit their own comment.
 *
 * @param {string} projectId
 * @param {string} taskId
 * @param {string} commentId
 * @param {string} userId
 * @param {Object} data
 * @param {string} data.body
 * @returns {Promise<Object>} Updated comment
 */
async function updateComment(projectId, taskId, commentId, userId, { body }) {
  // 1. Verify project membership and task association
  await verifyProjectMember(projectId, userId);
  await verifyTaskInProject(projectId, taskId);

  // 2. Verify comment existence
  const commentCheck = await db.query(
    `SELECT id, task_id, author_id FROM task_comments WHERE id = $1 AND task_id = $2`,
    [commentId, taskId]
  );

  if (commentCheck.rows.length === 0) {
    const error = new Error('Comment not found on this task.');
    error.status = 404;
    error.code = 'COMMENT_NOT_FOUND';
    throw error;
  }

  const comment = commentCheck.rows[0];

  // 3. Authorization: Only the author can edit
  if (comment.author_id !== userId) {
    const error = new Error('Only the author can edit this comment.');
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }

  const trimmedBody = body.trim();

  // 4. Update comment
  const updateResult = await db.query(
    `UPDATE task_comments
     SET body = $1, is_edited = true, updated_at = NOW()
     WHERE id = $2 AND task_id = $3
     RETURNING id, task_id, author_id, body, is_edited, created_at, updated_at`,
    [trimmedBody, commentId, taskId]
  );

  const updated = updateResult.rows[0];

  const authorResult = await db.query(
    `SELECT id, name, email, avatar_color AS "avatarColor" FROM users WHERE id = $1`,
    [userId]
  );

  return {
    id: updated.id,
    taskId: updated.task_id,
    authorId: updated.author_id,
    body: updated.body,
    isEdited: updated.is_edited,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
    author: authorResult.rows[0],
  };
}

/**
 * Deletes a comment. Allowed for the author, project owner, or project admin.
 *
 * @param {string} projectId
 * @param {string} taskId
 * @param {string} commentId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function deleteComment(projectId, taskId, commentId, userId) {
  // 1. Verify project membership and get caller's role
  const userRole = await verifyProjectMember(projectId, userId);
  await verifyTaskInProject(projectId, taskId);

  // 2. Fetch comment to check author
  const commentCheck = await db.query(
    `SELECT id, task_id, author_id FROM task_comments WHERE id = $1 AND task_id = $2`,
    [commentId, taskId]
  );

  if (commentCheck.rows.length === 0) {
    const error = new Error('Comment not found on this task.');
    error.status = 404;
    error.code = 'COMMENT_NOT_FOUND';
    throw error;
  }

  const comment = commentCheck.rows[0];

  // 3. Authorization: author, owner, or admin
  const isAuthor = comment.author_id === userId;
  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'admin';

  if (!isAuthor && !isOwner && !isAdmin) {
    const error = new Error('You do not have permission to delete this comment.');
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }

  // 4. Delete comment
  await db.query(
    `DELETE FROM task_comments WHERE id = $1 AND task_id = $2`,
    [commentId, taskId]
  );

  return {
    deleted: true,
    commentId,
    taskId,
    projectId,
  };
}

module.exports = {
  getTaskComments,
  createComment,
  updateComment,
  deleteComment,
};
