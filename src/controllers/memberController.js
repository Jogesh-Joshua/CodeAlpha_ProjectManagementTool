'use strict';

const memberService = require('../services/memberService');
const { sendSuccess, sendCreated, sendDeleted } = require('../utils/response');

/**
 * Lists all members for a project.
 */
async function list(req, res, next) {
  try {
    const projectId = req.params.projectId || req.params.id;
    const members = await memberService.getProjectMembers(projectId, req.user.id);
    sendSuccess(res, { members });
  } catch (err) {
    next(err);
  }
}

/**
 * Adds an existing registered user to the project by email.
 */
async function add(req, res, next) {
  try {
    const projectId = req.params.projectId || req.params.id;
    const { email, role } = req.body;
    const member = await memberService.addMemberByEmail(
      projectId,
      req.user.id,
      email,
      role || 'member'
    );
    sendCreated(res, { member }, 'Member added to project successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Updates a member's role (supports owner transfer).
 */
async function updateRole(req, res, next) {
  try {
    const projectId = req.params.projectId || req.params.id;
    const { userId } = req.params;
    const { role } = req.body;
    const member = await memberService.updateMemberRole(
      projectId,
      req.user.id,
      userId,
      role
    );
    sendSuccess(res, { member }, 'Member role updated successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Removes a member from the project.
 */
async function remove(req, res, next) {
  try {
    const projectId = req.params.projectId || req.params.id;
    const { userId } = req.params;
    const result = await memberService.removeMember(projectId, req.user.id, userId);
    sendDeleted(res, result, 'Member removed from project successfully.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  add,
  updateRole,
  remove,
};
