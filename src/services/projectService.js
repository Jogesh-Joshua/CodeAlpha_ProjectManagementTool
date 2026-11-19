'use strict';

const db = require('../config/db');

/**
 * Creates a new project and designates the creator as owner in an atomic transaction.
 *
 * @param {Object} params
 * @param {string} params.name
 * @param {string} [params.description]
 * @param {string} [params.color]
 * @param {string} params.ownerId
 * @returns {Promise<Object>} Created project with owner details
 */
async function createProject({ name, description = null, color = '#5B5BD6', ownerId }) {
  const trimmedName = name.trim();
  const trimmedDescription = description ? description.trim() : null;
  const projectColor = color ? color.trim() : '#5B5BD6';

  return db.withTransaction(async (client) => {
    // 1. Insert project
    const projectResult = await client.query(
      `INSERT INTO projects (name, description, color, owner_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, color, owner_id, is_archived, created_at, updated_at`,
      [trimmedName, trimmedDescription, projectColor, ownerId]
    );

    const project = projectResult.rows[0];

    // 2. Add owner to project_members
    await client.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [project.id, ownerId, 'owner']
    );

    // 3. Fetch creator info
    const ownerResult = await client.query(
      `SELECT id, name, email, avatar_color FROM users WHERE id = $1`,
      [ownerId]
    );
    const owner = ownerResult.rows[0];

    return {
      ...project,
      owner: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        avatarColor: owner.avatar_color,
      },
      userRole: 'owner',
      memberCount: 1,
      taskCount: 0,
      completedTaskCount: 0,
    };
  });
}

/**
 * Lists all projects where the given user is a member, with aggregated stats.
 *
 * @param {string} userId
 * @returns {Promise<Array<Object>>}
 */
async function getUserProjects(userId) {
  const query = `
    SELECT
      p.id,
      p.name,
      p.description,
      p.color,
      p.owner_id,
      p.is_archived,
      p.created_at,
      p.updated_at,
      pm.role AS user_role,
      pm.joined_at AS user_joined_at,
      u.name AS owner_name,
      u.email AS owner_email,
      u.avatar_color AS owner_avatar_color,
      COALESCE(members_agg.member_count, 0)::int AS member_count,
      COALESCE(tasks_agg.task_count, 0)::int AS task_count,
      COALESCE(tasks_agg.completed_task_count, 0)::int AS completed_task_count
    FROM projects p
    INNER JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
    INNER JOIN users u ON u.id = p.owner_id
    LEFT JOIN (
      SELECT project_id, COUNT(*)::int AS member_count
      FROM project_members
      GROUP BY project_id
    ) members_agg ON members_agg.project_id = p.id
    LEFT JOIN (
      SELECT
        project_id,
        COUNT(*)::int AS task_count,
        COUNT(CASE WHEN status = 'done' THEN 1 END)::int AS completed_task_count
      FROM tasks
      GROUP BY project_id
    ) tasks_agg ON tasks_agg.project_id = p.id
    ORDER BY p.is_archived ASC, p.updated_at DESC
  `;

  const { rows } = await db.query(query, [userId]);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    ownerId: row.owner_id,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userRole: row.user_role,
    userJoinedAt: row.user_joined_at,
    owner: {
      id: row.owner_id,
      name: row.owner_name,
      email: row.owner_email,
      avatarColor: row.owner_avatar_color,
    },
    memberCount: row.member_count,
    taskCount: row.task_count,
    completedTaskCount: row.completed_task_count,
    progressPercentage:
      row.task_count > 0 ? Math.round((row.completed_task_count / row.task_count) * 100) : 0,
  }));
}

/**
 * Fetches a single project by ID, verifying that the requesting user is a member.
 *
 * @param {string} projectId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getProjectById(projectId, userId) {
  // First check if the project exists
  const projectCheck = await db.query(
    `SELECT p.id, p.name, p.description, p.color, p.owner_id, p.is_archived, p.created_at, p.updated_at,
            u.name AS owner_name, u.email AS owner_email, u.avatar_color AS owner_avatar_color
     FROM projects p
     INNER JOIN users u ON u.id = p.owner_id
     WHERE p.id = $1`,
    [projectId]
  );

  if (projectCheck.rows.length === 0) {
    const error = new Error('Project not found.');
    error.status = 404;
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }

  const project = projectCheck.rows[0];

  // Verify membership
  const memberCheck = await db.query(
    `SELECT role, joined_at FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId]
  );

  if (memberCheck.rows.length === 0) {
    const error = new Error('You are not a member of this project.');
    error.status = 403;
    error.code = 'NOT_A_MEMBER';
    throw error;
  }

  const membership = memberCheck.rows[0];

  // Fetch status breakdown and counts
  const tasksStats = await db.query(
    `SELECT
       COUNT(*)::int AS total_tasks,
       COUNT(CASE WHEN status = 'todo' THEN 1 END)::int AS todo_count,
       COUNT(CASE WHEN status = 'in_progress' THEN 1 END)::int AS in_progress_count,
       COUNT(CASE WHEN status = 'review' THEN 1 END)::int AS review_count,
       COUNT(CASE WHEN status = 'done' THEN 1 END)::int AS done_count
     FROM tasks
     WHERE project_id = $1`,
    [projectId]
  );

  const stats = tasksStats.rows[0] || {
    total_tasks: 0,
    todo_count: 0,
    in_progress_count: 0,
    review_count: 0,
    done_count: 0,
  };

  // Fetch members roster preview
  const membersResult = await db.query(
    `SELECT pm.role, pm.joined_at, u.id, u.name, u.email, u.avatar_color
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
       pm.joined_at ASC`,
    [projectId]
  );

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    color: project.color,
    ownerId: project.owner_id,
    isArchived: project.is_archived,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    userRole: membership.role,
    userJoinedAt: membership.joined_at,
    owner: {
      id: project.owner_id,
      name: project.owner_name,
      email: project.owner_email,
      avatarColor: project.owner_avatar_color,
    },
    memberCount: membersResult.rows.length,
    members: membersResult.rows.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      avatarColor: m.avatar_color,
      role: m.role,
      joinedAt: m.joined_at,
    })),
    taskCount: stats.total_tasks,
    completedTaskCount: stats.done_count,
    tasksByStatus: {
      todo: stats.todo_count,
      in_progress: stats.in_progress_count,
      review: stats.review_count,
      done: stats.done_count,
    },
    progressPercentage:
      stats.total_tasks > 0 ? Math.round((stats.done_count / stats.total_tasks) * 100) : 0,
  };
}

/**
 * Updates project details (name, description, color, is_archived).
 *
 * @param {string} projectId
 * @param {string} userId
 * @param {Object} updates
 * @returns {Promise<Object>} Updated project
 */
async function updateProject(projectId, userId, updates) {
  // Check membership and role (must be owner or admin)
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

  const role = memberCheck.rows[0].role;
  if (role !== 'owner' && role !== 'admin') {
    const error = new Error('This action requires admin or owner role.');
    error.status = 403;
    error.code = 'INSUFFICIENT_ROLE';
    throw error;
  }

  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name.trim());
  }

  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(updates.description ? updates.description.trim() : null);
  }

  if (updates.color !== undefined) {
    fields.push(`color = $${paramIndex++}`);
    values.push(updates.color.trim());
  }

  if (updates.is_archived !== undefined) {
    fields.push(`is_archived = $${paramIndex++}`);
    values.push(Boolean(updates.is_archived));
  }

  if (fields.length === 0) {
    return getProjectById(projectId, userId);
  }

  fields.push(`updated_at = NOW()`);
  values.push(projectId);

  const query = `
    UPDATE projects
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, name, description, color, owner_id, is_archived, created_at, updated_at
  `;

  const { rows } = await db.query(query, values);
  if (rows.length === 0) {
    const error = new Error('Project not found.');
    error.status = 404;
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }

  return {
    ...rows[0],
    isArchived: rows[0].is_archived,
    createdAt: rows[0].created_at,
    updatedAt: rows[0].updated_at,
    ownerId: rows[0].owner_id,
    userRole: role,
  };
}

/**
 * Deletes a project. Only the project owner can perform this action.
 *
 * @param {string} projectId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function deleteProject(projectId, userId) {
  // Check that the project exists and user is owner
  const projectResult = await db.query(
    `SELECT id, name, owner_id FROM projects WHERE id = $1`,
    [projectId]
  );

  if (projectResult.rows.length === 0) {
    const error = new Error('Project not found.');
    error.status = 404;
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }

  const project = projectResult.rows[0];

  if (project.owner_id !== userId) {
    const error = new Error('Only the project owner can delete this project.');
    error.status = 403;
    error.code = 'FORBIDDEN_NOT_OWNER';
    throw error;
  }

  // Delete project (cascade handles project_members, tasks, task_assignees, task_comments, notifications)
  await db.query(`DELETE FROM projects WHERE id = $1`, [projectId]);

  return {
    deleted: true,
    projectId,
    name: project.name,
  };
}

module.exports = {
  createProject,
  getUserProjects,
  getProjectById,
  updateProject,
  deleteProject,
};
