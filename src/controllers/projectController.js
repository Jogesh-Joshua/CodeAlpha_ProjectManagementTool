'use strict';

const projectService = require('../services/projectService');
const { sendSuccess, sendCreated, sendDeleted } = require('../utils/response');

/**
 * Creates a new project.
 */
async function create(req, res, next) {
  try {
    const { name, description, color } = req.body;
    const project = await projectService.createProject({
      name,
      description,
      color,
      ownerId: req.user.id,
    });
    sendCreated(res, { project }, 'Project created successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Lists all projects where the authenticated user is a member.
 */
async function list(req, res, next) {
  try {
    const projects = await projectService.getUserProjects(req.user.id);
    sendSuccess(res, { projects });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves details of a specific project.
 */
async function getById(req, res, next) {
  try {
    const project = await projectService.getProjectById(req.params.id, req.user.id);
    sendSuccess(res, { project });
  } catch (err) {
    next(err);
  }
}

/**
 * Updates project details (name, description, color, is_archived).
 */
async function update(req, res, next) {
  try {
    const project = await projectService.updateProject(req.params.id, req.user.id, req.body);
    sendSuccess(res, { project }, 'Project updated successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Deletes a project. Only allowed by project owner.
 */
async function remove(req, res, next) {
  try {
    const result = await projectService.deleteProject(req.params.id, req.user.id);
    sendDeleted(res, result, 'Project deleted successfully.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  list,
  getById,
  update,
  remove,
};
