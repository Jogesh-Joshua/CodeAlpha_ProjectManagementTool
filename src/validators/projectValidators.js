'use strict';

const { validators } = require('../middleware/validate');
const constants = require('../config/constants');

/**
 * Validates request payload for creating a project.
 */
function validateCreateProject(req) {
  const errors = {};
  const { name, description, color } = req.body || {};

  if (!name || !validators.isNonEmptyString(name, 1, 150)) {
    errors.name = 'Project name is required and must be between 1 and 150 characters.';
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    errors.description = 'Description must be a string.';
  } else if (description && description.length > 2000) {
    errors.description = 'Description cannot exceed 2000 characters.';
  }

  if (color && !validators.isValidColorHex(color)) {
    errors.color = 'Color must be a valid 3-digit or 6-digit hex code (e.g. #5B5BD6).';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Validates request payload for updating project details.
 */
function validateUpdateProject(req) {
  const errors = {};
  const { name, description, color, is_archived } = req.body || {};

  const hasAtLeastOneField =
    name !== undefined ||
    description !== undefined ||
    color !== undefined ||
    is_archived !== undefined;

  if (!hasAtLeastOneField) {
    errors._general = 'At least one field (name, description, color, is_archived) must be provided.';
  }

  if (name !== undefined && !validators.isNonEmptyString(name, 1, 150)) {
    errors.name = 'Project name must be between 1 and 150 characters.';
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    errors.description = 'Description must be a string.';
  } else if (description && description.length > 2000) {
    errors.description = 'Description cannot exceed 2000 characters.';
  }

  if (color !== undefined && !validators.isValidColorHex(color)) {
    errors.color = 'Color must be a valid 3-digit or 6-digit hex code (e.g. #5B5BD6).';
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
 * Validates project UUID route param (:id or :projectId).
 */
function validateProjectIdParam(req) {
  const errors = {};
  const projectId = req.params.projectId || req.params.id;

  if (!projectId || !validators.isValidUUID(projectId)) {
    errors.projectId = 'Invalid project ID format (UUID expected).';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Validates adding a member by email.
 */
function validateAddMember(req) {
  const errors = {};
  const { email, role } = req.body || {};

  if (!email || !validators.isValidEmail(email)) {
    errors.email = 'A valid user email address is required.';
  }

  if (role !== undefined) {
    const allowedRoles = ['admin', 'member'];
    if (!allowedRoles.includes(role)) {
      errors.role = 'Role must be either "admin" or "member". To transfer ownership, use role update.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Validates updating a member's role.
 */
function validateUpdateMemberRole(req) {
  const errors = {};
  const { role } = req.body || {};
  const { userId } = req.params;

  if (!userId || !validators.isValidUUID(userId)) {
    errors.userId = 'Invalid user ID format (UUID expected).';
  }

  if (!role || !constants.PROJECT_ROLES.includes(role)) {
    errors.role = `Role is required and must be one of: ${constants.PROJECT_ROLES.join(', ')}.`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Validates member UUID parameter.
 */
function validateMemberIdParam(req) {
  const errors = {};
  const { userId } = req.params;

  if (!userId || !validators.isValidUUID(userId)) {
    errors.userId = 'Invalid user ID format (UUID expected).';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Validates search query param.
 */
function validateSearchUsers(req) {
  const errors = {};
  const q = req.query.q;

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    errors.q = 'Search query "q" must be a non-empty string.';
  } else if (q.trim().length > 100) {
    errors.q = 'Search query cannot exceed 100 characters.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Validates user profile update.
 */
function validateUpdateProfile(req) {
  const errors = {};
  const { name } = req.body || {};

  if (!name || !validators.isNonEmptyString(name, 2, 100)) {
    errors.name = 'Display name must be between 2 and 100 characters.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Validates password change.
 */
function validateChangePassword(req) {
  const errors = {};
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || typeof currentPassword !== 'string') {
    errors.currentPassword = 'Current password is required.';
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    errors.newPassword = 'New password must be at least 8 characters long.';
  } else if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    errors.newPassword = 'New password must contain at least one uppercase letter and one number.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

module.exports = {
  validateCreateProject,
  validateUpdateProject,
  validateProjectIdParam,
  validateAddMember,
  validateUpdateMemberRole,
  validateMemberIdParam,
  validateSearchUsers,
  validateUpdateProfile,
  validateChangePassword,
};
