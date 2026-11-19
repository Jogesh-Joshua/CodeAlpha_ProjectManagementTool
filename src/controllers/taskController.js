'use strict';

const taskService = require('../services/taskService');
const { sendSuccess, sendCreated, sendDeleted } = require('../utils/response');

/**
 * Creates a new task within a project.
 */
async function create(req, res, next) {
  try {
    const projectId = req.params.projectId || req.params.id;
    const task = await taskService.createTask(projectId, req.user.id, req.body);
    sendCreated(res, { task }, 'Task created successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Lists all active tasks for a project, grouped by status column.
 */
async function list(req, res, next) {
  try {
    const projectId = req.params.projectId || req.params.id;
    const tasks = await taskService.getProjectTasks(projectId, req.user.id, req.query.status);
    sendSuccess(res, tasks, 'Tasks retrieved successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves single task details.
 */
async function getById(req, res, next) {
  try {
    const projectId = req.params.projectId || req.params.id;
    const task = await taskService.getTaskById(projectId, req.params.taskId, req.user.id);
    sendSuccess(res, { task }, 'Task retrieved successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Updates a task.
 */
async function update(req, res, next) {
  try {
    const projectId = req.params.projectId || req.params.id;
    const task = await taskService.updateTask(projectId, req.params.taskId, req.user.id, req.body);
    sendSuccess(res, { task }, 'Task updated successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Moves a task to a status and position.
 */
async function move(req, res, next) {
  try {
    const projectId = req.params.projectId || req.params.id;
    const task = await taskService.moveTask(projectId, req.params.taskId, req.user.id, req.body);
    sendSuccess(res, { task }, 'Task moved successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Deletes a task.
 */
async function remove(req, res, next) {
  try {
    const projectId = req.params.projectId || req.params.id;
    const result = await taskService.deleteTask(projectId, req.params.taskId, req.user.id);
    sendDeleted(res, result, 'Task deleted successfully.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  list,
  getById,
  update,
  move,
  remove,
};
