'use strict';

const db = require('../config/db');

/**
 * Computes today's date in local calendar format (YYYY-MM-DD).
 * @returns {string}
 */
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Determines whether a task is overdue using date-only comparison.
 * Overdue when:
 * 1. Has due_date
 * 2. due_date < today's local date
 * 3. status !== 'done'
 * 4. is_archived === false
 *
 * @param {Object} task
 * @returns {boolean}
 */
function isTaskOverdue(task) {
  if (!task.due_date || task.status === 'done' || task.is_archived) {
    return false;
  }

  let dateStr = task.due_date;
  if (dateStr instanceof Date) {
    const year = dateStr.getFullYear();
    const month = String(dateStr.getMonth() + 1).padStart(2, '0');
    const day = String(dateStr.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
  } else if (typeof dateStr === 'string' && dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0];
  }

  const today = getLocalDateString();
  return dateStr < today;
}

/**
 * Verifies that the user is an active member of the project.
 *
 * @param {string} projectId
 * @param {string} userId
 * @returns {Promise<string>} Role of member
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
 * Creates a new task and associates multiple project members in a transaction.
 *
 * @param {string} projectId
 * @param {string} userId - Authenticated creator ID
 * @param {Object} taskData
 * @returns {Promise<Object>} Created task with assignees
 */
async function createTask(projectId, userId, taskData) {
  // 1. Verify creator is a member of the project
  await verifyProjectMember(projectId, userId);

  const trimmedTitle = taskData.title.trim();
  const trimmedDesc = taskData.description ? taskData.description.trim() : null;
  const priority = taskData.priority || 'medium';
  const dueDate = taskData.due_date || null;
  const rawAssignees = Array.isArray(taskData.assignee_ids) ? taskData.assignee_ids : [];
  const assigneeIds = [...new Set(rawAssignees)];

  // 2. Validate that each assignee belongs to this project
  if (assigneeIds.length > 0) {
    const memberCheck = await db.query(
      `SELECT user_id FROM project_members WHERE project_id = $1 AND user_id = ANY($2::uuid[])`,
      [projectId, assigneeIds]
    );

    if (memberCheck.rows.length !== assigneeIds.length) {
      const error = new Error('One or more assignees are not members of this project.');
      error.status = 400;
      error.code = 'INVALID_ASSIGNEE';
      throw error;
    }
  }

  // 3. Calculate next position in 'todo' status
  const posResult = await db.query(
    `SELECT COALESCE(MAX(position) + 1, 0)::int AS next_pos
     FROM tasks
     WHERE project_id = $1 AND status = 'todo' AND is_archived = false`,
    [projectId]
  );
  const position = posResult.rows[0]?.next_pos ?? 0;

  // 4. Insert task and assignees inside transaction
  return db.withTransaction(async (client) => {
    const taskInsert = await client.query(
      `INSERT INTO tasks (project_id, created_by, title, description, status, priority, due_date, position)
       VALUES ($1, $2, $3, $4, 'todo', $5, $6, $7)
       RETURNING id, project_id, created_by, title, description, status, priority,
                 TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date, position, is_archived, created_at, updated_at`,
      [projectId, userId, trimmedTitle, trimmedDesc, priority, dueDate, position]
    );

    const task = taskInsert.rows[0];

    // Insert assignees
    const assignees = [];
    if (assigneeIds.length > 0) {
      for (const aId of assigneeIds) {
        await client.query(
          `INSERT INTO task_assignees (task_id, user_id, project_id)
           VALUES ($1, $2, $3)`,
          [task.id, aId, projectId]
        );
      }

      // Fetch assignee profiles
      const assigneesResult = await client.query(
        `SELECT id, name, email, avatar_color AS "avatarColor"
         FROM users
         WHERE id = ANY($1::uuid[])`,
        [assigneeIds]
      );
      assignees.push(...assigneesResult.rows);
    }

    // Fetch creator details
    const creatorResult = await client.query(
      `SELECT id, name, email, avatar_color AS "avatarColor" FROM users WHERE id = $1`,
      [userId]
    );

    return {
      ...task,
      creator: creatorResult.rows[0],
      assignees,
      isOverdue: isTaskOverdue(task),
    };
  });
}

/**
 * Retrieves all active tasks for a project, grouped by status column.
 *
 * @param {string} projectId
 * @param {string} userId
 * @param {string} [statusFilter]
 * @returns {Promise<Object>} Grouped tasks { todo: [], in_progress: [], review: [], done: [] }
 */
async function getProjectTasks(projectId, userId, statusFilter = null) {
  // 1. Verify user is a project member
  await verifyProjectMember(projectId, userId);

  let query = `
    SELECT
      t.id,
      t.project_id,
      t.created_by,
      t.title,
      t.description,
      t.status,
      t.priority,
      TO_CHAR(t.due_date, 'YYYY-MM-DD') AS due_date,
      t.position,
      t.is_archived,
      t.created_at,
      t.updated_at,
      u.name AS creator_name,
      u.email AS creator_email,
      u.avatar_color AS creator_avatar_color,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', ua.id,
            'name', ua.name,
            'email', ua.email,
            'avatarColor', ua.avatar_color
          )
        ) FILTER (WHERE ua.id IS NOT NULL),
        '[]'::json
      ) AS assignees
    FROM tasks t
    INNER JOIN users u ON u.id = t.created_by
    LEFT JOIN task_assignees ta ON ta.task_id = t.id AND ta.project_id = t.project_id
    LEFT JOIN users ua ON ua.id = ta.user_id
    WHERE t.project_id = $1 AND t.is_archived = false
  `;

  const params = [projectId];

  if (statusFilter) {
    query += ` AND t.status = $2`;
    params.push(statusFilter);
  }

  query += `
    GROUP BY t.id, u.id
    ORDER BY t.status, t.position ASC, t.created_at ASC
  `;

  const { rows } = await db.query(query, params);

  // Group into standard 4-column structure
  const grouped = {
    todo: [],
    in_progress: [],
    review: [],
    done: [],
  };

  for (const row of rows) {
    const taskObj = {
      id: row.id,
      projectId: row.project_id,
      createdBy: row.created_by,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      dueDate: row.due_date,
      position: row.position,
      isArchived: row.is_archived,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      creator: {
        id: row.created_by,
        name: row.creator_name,
        email: row.creator_email,
        avatarColor: row.creator_avatar_color,
      },
      assignees: Array.isArray(row.assignees) ? row.assignees : [],
      isOverdue: isTaskOverdue(row),
    };

    if (grouped[row.status]) {
      grouped[row.status].push(taskObj);
    }
  }

  return grouped;
}

/**
 * Retrieves a single task by ID.
 *
 * @param {string} projectId
 * @param {string} taskId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getTaskById(projectId, taskId, userId) {
  // 1. Verify user is a project member
  await verifyProjectMember(projectId, userId);

  const query = `
    SELECT
      t.id,
      t.project_id,
      t.created_by,
      t.title,
      t.description,
      t.status,
      t.priority,
      TO_CHAR(t.due_date, 'YYYY-MM-DD') AS due_date,
      t.position,
      t.is_archived,
      t.created_at,
      t.updated_at,
      p.name AS project_name,
      p.color AS project_color,
      u.name AS creator_name,
      u.email AS creator_email,
      u.avatar_color AS creator_avatar_color,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', ua.id,
            'name', ua.name,
            'email', ua.email,
            'avatarColor', ua.avatar_color
          )
        ) FILTER (WHERE ua.id IS NOT NULL),
        '[]'::json
      ) AS assignees
    FROM tasks t
    INNER JOIN projects p ON p.id = t.project_id
    INNER JOIN users u ON u.id = t.created_by
    LEFT JOIN task_assignees ta ON ta.task_id = t.id AND ta.project_id = t.project_id
    LEFT JOIN users ua ON ua.id = ta.user_id
    WHERE t.id = $1 AND t.project_id = $2
    GROUP BY t.id, p.id, u.id
  `;

  const { rows } = await db.query(query, [taskId, projectId]);

  if (rows.length === 0) {
    const error = new Error('Task not found.');
    error.status = 404;
    error.code = 'TASK_NOT_FOUND';
    throw error;
  }

  const row = rows[0];

  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    projectColor: row.project_color,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    position: row.position,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    creator: {
      id: row.created_by,
      name: row.creator_name,
      email: row.creator_email,
      avatarColor: row.creator_avatar_color,
    },
    assignees: Array.isArray(row.assignees) ? row.assignees : [],
    isOverdue: isTaskOverdue(row),
  };
}

/**
 * Updates an existing task and its assignees.
 *
 * @param {string} projectId
 * @param {string} taskId
 * @param {string} userId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
async function updateTask(projectId, taskId, userId, updates) {
  // 1. Verify user is a project member
  await verifyProjectMember(projectId, userId);

  // 2. Verify task exists
  const taskCheck = await db.query(
    `SELECT id, project_id, status FROM tasks WHERE id = $1 AND project_id = $2`,
    [taskId, projectId]
  );

  if (taskCheck.rows.length === 0) {
    const error = new Error('Task not found.');
    error.status = 404;
    error.code = 'TASK_NOT_FOUND';
    throw error;
  }

  // 3. If assignees are updated, validate they belong to the project
  let assigneeIds = null;
  if (updates.assignee_ids !== undefined && updates.assignee_ids !== null) {
    assigneeIds = [...new Set(updates.assignee_ids)];
    if (assigneeIds.length > 0) {
      const memberCheck = await db.query(
        `SELECT user_id FROM project_members WHERE project_id = $1 AND user_id = ANY($2::uuid[])`,
        [projectId, assigneeIds]
      );

      if (memberCheck.rows.length !== assigneeIds.length) {
        const error = new Error('One or more assignees are not members of this project.');
        error.status = 400;
        error.code = 'INVALID_ASSIGNEE';
        throw error;
      }
    }
  }

  // 4. Prepare dynamic UPDATE query
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (updates.title !== undefined) {
    fields.push(`title = $${paramIndex++}`);
    values.push(updates.title.trim());
  }

  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(updates.description ? updates.description.trim() : null);
  }

  if (updates.priority !== undefined) {
    fields.push(`priority = $${paramIndex++}`);
    values.push(updates.priority);
  }

  if (updates.due_date !== undefined) {
    fields.push(`due_date = $${paramIndex++}`);
    values.push(updates.due_date ? updates.due_date : null);
  }

  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }

  if (updates.is_archived !== undefined) {
    fields.push(`is_archived = $${paramIndex++}`);
    values.push(Boolean(updates.is_archived));
  }

  await db.withTransaction(async (client) => {
    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`);
      values.push(taskId, projectId);

      await client.query(
        `UPDATE tasks
         SET ${fields.join(', ')}
         WHERE id = $${paramIndex++} AND project_id = $${paramIndex}`,
        values
      );
    }

    // Update assignees if provided
    if (assigneeIds !== null) {
      await client.query(
        `DELETE FROM task_assignees WHERE task_id = $1 AND project_id = $2`,
        [taskId, projectId]
      );

      for (const aId of assigneeIds) {
        await client.query(
          `INSERT INTO task_assignees (task_id, user_id, project_id)
           VALUES ($1, $2, $3)`,
          [taskId, aId, projectId]
        );
      }
    }
  });

  return getTaskById(projectId, taskId, userId);
}

/**
 * Moves a task to a different status column and position safely in a transaction.
 *
 * @param {string} projectId
 * @param {string} taskId
 * @param {string} userId
 * @param {Object} moveData
 * @param {string} moveData.status - Target status
 * @param {number} moveData.position - Target 0-based position
 * @returns {Promise<Object>}
 */
async function moveTask(projectId, taskId, userId, { status, position }) {
  // 1. Verify user is a project member
  await verifyProjectMember(projectId, userId);

  await db.withTransaction(async (client) => {
    // 2. Fetch current task state with row lock
    const currentTaskResult = await client.query(
      `SELECT id, status, position FROM tasks WHERE id = $1 AND project_id = $2 FOR UPDATE`,
      [taskId, projectId]
    );

    if (currentTaskResult.rows.length === 0) {
      const error = new Error('Task not found.');
      error.status = 404;
      error.code = 'TASK_NOT_FOUND';
      throw error;
    }

    const currentTask = currentTaskResult.rows[0];
    const oldStatus = currentTask.status;
    const oldPos = currentTask.position;
    const newStatus = status;
    const newPos = position;

    if (oldStatus === newStatus) {
      // Reordering within the same status column
      if (oldPos < newPos) {
        await client.query(
          `UPDATE tasks
           SET position = position - 1
           WHERE project_id = $1 AND status = $2 AND is_archived = false
             AND position > $3 AND position <= $4 AND id != $5`,
          [projectId, oldStatus, oldPos, newPos, taskId]
        );
      } else if (oldPos > newPos) {
        await client.query(
          `UPDATE tasks
           SET position = position + 1
           WHERE project_id = $1 AND status = $2 AND is_archived = false
             AND position >= $3 AND position < $4 AND id != $5`,
          [projectId, oldStatus, newPos, oldPos, taskId]
        );
      }
    } else {
      // Moving across different columns
      // 1. Close gap in source column
      await client.query(
        `UPDATE tasks
         SET position = position - 1
         WHERE project_id = $1 AND status = $2 AND is_archived = false AND position > $3`,
        [projectId, oldStatus, oldPos]
      );

      // 2. Make room in target column
      await client.query(
        `UPDATE tasks
         SET position = position + 1
         WHERE project_id = $1 AND status = $2 AND is_archived = false AND position >= $3`,
        [projectId, newStatus, newPos]
      );
    }

    // 3. Update the moved task
    await client.query(
      `UPDATE tasks
       SET status = $1, position = $2, updated_at = NOW()
       WHERE id = $3 AND project_id = $4`,
      [newStatus, newPos, taskId, projectId]
    );
  });

  return getTaskById(projectId, taskId, userId);
}

/**
 * Deletes a task. Permitted for project owner, admin, or task creator.
 *
 * @param {string} projectId
 * @param {string} taskId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function deleteTask(projectId, taskId, userId) {
  // 1. Verify user membership and get their role
  const role = await verifyProjectMember(projectId, userId);

  // 2. Fetch task to check creator
  const taskResult = await db.query(
    `SELECT id, created_by, title FROM tasks WHERE id = $1 AND project_id = $2`,
    [taskId, projectId]
  );

  if (taskResult.rows.length === 0) {
    const error = new Error('Task not found.');
    error.status = 404;
    error.code = 'TASK_NOT_FOUND';
    throw error;
  }

  const task = taskResult.rows[0];

  // 3. Authorization check
  const isOwner = role === 'owner';
  const isAdmin = role === 'admin';
  const isCreator = task.created_by === userId;

  if (!isOwner && !isAdmin && !isCreator) {
    const error = new Error('Only the project owner, an admin, or the task creator can delete this task.');
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }

  // 4. Delete task (cascades to task_assignees and task_comments)
  await db.query(
    `DELETE FROM tasks WHERE id = $1 AND project_id = $2`,
    [taskId, projectId]
  );

  return {
    deleted: true,
    taskId,
    projectId,
    title: task.title,
  };
}

module.exports = {
  isTaskOverdue,
  getLocalDateString,
  createTask,
  getProjectTasks,
  getTaskById,
  updateTask,
  moveTask,
  deleteTask,
};
