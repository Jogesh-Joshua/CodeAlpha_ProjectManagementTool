'use strict';

/**
 * Orbit — Application Constants
 */

module.exports = {
  // Session
  SESSION_TTL_DAYS: 7,
  SESSION_COOKIE_NAME: 'orbit_sid',

  // Avatar colour palette (assigned round-robin on registration)
  AVATAR_COLORS: [
    '#5B5BD6', '#22C55E', '#F59E0B', '#EF4444',
    '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6',
  ],

  // Task constants
  TASK_STATUSES:   ['todo', 'in_progress', 'review', 'done'],
  TASK_PRIORITIES: ['low', 'medium', 'high', 'critical'],

  // Project roles
  PROJECT_ROLES: ['owner', 'admin', 'member'],

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE:     100,

  // Comment
  COMMENT_MAX_LENGTH: 10000,
};
