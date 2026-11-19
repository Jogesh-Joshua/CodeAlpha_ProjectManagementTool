'use strict';

const { validators } = require('../middleware/validate');
const constants = require('../config/constants');

/**
 * Validates creating a task.
 */
function validateCreateTask(req) {
  const errors = {};
  const { title, description, priority, due_date, assignee_ids } = req.body || {};

  if (!title || !validators.isNonEmptyString(title, 1, 255)) {
    errors.title = 'Task title is required and must be between 1 and 255 characters.';
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    errors.description = 'Description must be a string.';
  } else if (description && description.length > 10000) {
    errors.description = 'Description cannot exceed 10000 characters.';
  }

  if (priority !== undefined && !constants.TASK_PRIORITIES.includes(priority)) {
    errors.priority = `Priority must be one of: ${constants.TASK_PRIORITIES.join(', ')}.`;
  }

  if (due_date !== undefined && due_date !== null && due_date !== '') {
    if (!validators.isValidDateString(due_date)) {
      errors.due_date = 'Due date must be a valid date format (e.g. YYYY-MM-DD).';
    }
  }

  if (assignee_ids !== undefined && assignee_ids !== null) {
    if (!Array.isArray(assignee_ids)) {
      errors.assignee_ids = 'assignee_ids must be an array of user UUIDs.';
    } else {
      const invalidUuid = assignee_ids.some((id) => !validators.isValidUUID(id));
      if (invalidUuid) {
        errors.assignee_ids = 'All assignee IDs must be valid UUIDs.';
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Validates updating task details.
 */
function validateUpdateTask(req) {
  const errors = {};
  const { title, description, priority, due_date, status, assignee_ids, is_archived } = req.body || {};

  const hasAtLeastOneField =
    title !== undefined ||
    description !== undefined ||
    priority !== undefined ||
    due_date !== undefined ||
    status !== undefined ||
    assignee_ids !== undefined ||
    is_archived !== undefined;

  if (!hasAtLeastOneField) {
    errors._general = 'At least one field must be provided for update.';
  }

  if (title !== undefined && !validators.isNonEmptyString(title, 1, 255)) {
    errors.title = 'Task title must be between 1 and 255 characters.';
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    errors.description = 'Description must be a string.';
  } else if (description && description.length > 10000) {
    errors.description = 'Description cannot exceed 10000 characters.';
  }

  if (priority !== undefined && !constants.TASK_PRIORITIES.includes(priority)) {
    errors.priority = `Priority must be one of: ${constants.TASK_PRIORITIES.join(', ')}.`;
  }

  if (status !== undefined && !constants.TASK_STATUSES.includes(status)) {
    errors.status = `Status must be one of: ${constants.TASK_STATUSES.join(', ')}.`;
  }

  if (due_date !== undefined && due_date !== null && due_date !== '') {
    if (!validators.isValidDateString(due_date)) {
      errors.due_date = 'Due date must be a valid date format (e.g. YYYY-MM-DD).';
    }
  }

  if (assignee_ids !== undefined && assignee_ids !== null) {
    if (!Array.isArray(assignee_ids)) {
      errors.assignee_ids = 'assignee_ids must be an array of user UUIDs.';
    } else {
      const invalidUuid = assignee_ids.some((id) => !validators.isValidUUID(id));
      if (invalidUuid) {
        errors.assignee_ids = 'All assignee IDs must be valid UUIDs.';
      }
    }
  }

  if (is_archived !== undefined && typeof is_archived !== 'boolean') {
    errors.is_archived = 'is_archived must be a boolean.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Validates moving a task to a status and position.
 */
function validateMoveTask(req) {
  const errors = {};
  const { status, position } = req.body || {};

  if (!status || !constants.TASK_STATUSES.includes(status)) {
    errors.status = `Status is required and must be one of: ${constants.TASK_STATUSES.join(', ')}.`;
  }

  if (position === undefined || position === null || !Number.isInteger(position) || position < 0) {
    errors.position = 'Position is required and must be a non-negative integer (0 or greater).';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Validates task UUID parameter (:taskId).
 */
function validateTaskIdParam(req) {
  const errors = {};
  const { taskId } = req.params;

  if (!taskId || !validators.isValidUUID(taskId)) {
    errors.taskId = 'Invalid task ID format (UUID expected).';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

module.exports = {
  validateCreateTask,
  validateUpdateTask,
  validateMoveTask,
  validateTaskIdParam,
};
