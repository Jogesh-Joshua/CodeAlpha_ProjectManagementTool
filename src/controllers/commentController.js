'use strict';

const commentService = require('../services/commentService');
const { sendSuccess, sendCreated, sendDeleted } = require('../utils/response');

/**
 * Lists all comments for a task.
 */
async function list(req, res, next) {
  try {
    const projectId = req.params.projectId || req.params.id;
    const { taskId } = req.params;
    const comments = await commentService.getTaskComments(projectId, taskId, req.user.id);
    sendSuccess(res, { comments }, 'Comments retrieved successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Creates a new comment on a task.
 */
async function create(req, res, next) {
  try {
    const projectId = req.params.projectId || req.params.id;
    const { taskId } = req.params;
    const comment = await commentService.createComment(projectId, taskId, req.user.id, req.body);
    sendCreated(res, { comment }, 'Comment added successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Updates an existing comment.
 */
async function update(req, res, next) {
  try {
    const projectId = req.params.projectId || req.params.id;
    const { taskId, commentId } = req.params;
    const comment = await commentService.updateComment(
      projectId,
      taskId,
      commentId,
      req.user.id,
      req.body
    );
    sendSuccess(res, { comment }, 'Comment updated successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Deletes a comment.
 */
async function remove(req, res, next) {
  try {
    const projectId = req.params.projectId || req.params.id;
    const { taskId, commentId } = req.params;
    const result = await commentService.deleteComment(
      projectId,
      taskId,
      commentId,
      req.user.id
    );
    sendDeleted(res, result, 'Comment deleted successfully.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
};
