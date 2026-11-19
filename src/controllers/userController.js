'use strict';

const userService = require('../services/userService');
const { sendSuccess } = require('../utils/response');

/**
 * Searches users by query.
 */
async function search(req, res, next) {
  try {
    const { q } = req.query;
    const users = await userService.searchUsers(q, req.user ? req.user.id : null);
    sendSuccess(res, { users });
  } catch (err) {
    next(err);
  }
}

/**
 * Updates profile display name.
 */
async function updateProfile(req, res, next) {
  try {
    const user = await userService.updateProfile(req.user.id, req.body);
    sendSuccess(res, { user }, 'Profile updated successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Changes password.
 */
async function changePassword(req, res, next) {
  try {
    await userService.changePassword(req.user.id, req.body);
    sendSuccess(res, {}, 'Password changed successfully.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  search,
  updateProfile,
  changePassword,
};
