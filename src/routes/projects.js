'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validateOrigin, validateCsrf } = require('../middleware/csrf');
const { validate } = require('../middleware/validate');
const {
  validateCreateProject,
  validateUpdateProject,
  validateProjectIdParam,
  validateAddMember,
  validateUpdateMemberRole,
  validateMemberIdParam,
} = require('../validators/projectValidators');
const {
  validateCreateTask,
  validateUpdateTask,
  validateMoveTask,
  validateTaskIdParam,
} = require('../validators/taskValidators');
const {
  validateCreateComment,
  validateUpdateComment,
  validateCommentIdParam,
} = require('../validators/commentValidators');
const projectController = require('../controllers/projectController');
const memberController = require('../controllers/memberController');
const taskController = require('../controllers/taskController');
const commentController = require('../controllers/commentController');

const router = express.Router();

// All project routes require authentication
router.use(requireAuth);

// ── Project Management Endpoints ──────────────────────────────
router.get('/', projectController.list);

router.post(
  '/',
  validateOrigin,
  validateCsrf,
  validate(validateCreateProject),
  projectController.create
);

router.get(
  '/:id',
  validate(validateProjectIdParam),
  projectController.getById
);

router.patch(
  '/:id',
  validateOrigin,
  validateCsrf,
  validate(validateProjectIdParam),
  validate(validateUpdateProject),
  projectController.update
);

router.delete(
  '/:id',
  validateOrigin,
  validateCsrf,
  validate(validateProjectIdParam),
  projectController.remove
);

// ── Project Members Endpoints ─────────────────────────────────
router.get(
  '/:id/members',
  validate(validateProjectIdParam),
  memberController.list
);

router.post(
  '/:id/members',
  validateOrigin,
  validateCsrf,
  validate(validateProjectIdParam),
  validate(validateAddMember),
  memberController.add
);

router.patch(
  '/:id/members/:userId',
  validateOrigin,
  validateCsrf,
  validate(validateProjectIdParam),
  validate(validateUpdateMemberRole),
  memberController.updateRole
);

router.delete(
  '/:id/members/:userId',
  validateOrigin,
  validateCsrf,
  validate(validateProjectIdParam),
  validate(validateMemberIdParam),
  memberController.remove
);

// ── Project Tasks Endpoints ───────────────────────────────────
router.get(
  '/:id/tasks',
  validate(validateProjectIdParam),
  taskController.list
);

router.post(
  '/:id/tasks',
  validateOrigin,
  validateCsrf,
  validate(validateProjectIdParam),
  validate(validateCreateTask),
  taskController.create
);

router.get(
  '/:id/tasks/:taskId',
  validate(validateProjectIdParam),
  validate(validateTaskIdParam),
  taskController.getById
);

router.patch(
  '/:id/tasks/:taskId',
  validateOrigin,
  validateCsrf,
  validate(validateProjectIdParam),
  validate(validateTaskIdParam),
  validate(validateUpdateTask),
  taskController.update
);

router.patch(
  '/:id/tasks/:taskId/move',
  validateOrigin,
  validateCsrf,
  validate(validateProjectIdParam),
  validate(validateTaskIdParam),
  validate(validateMoveTask),
  taskController.move
);

router.delete(
  '/:id/tasks/:taskId',
  validateOrigin,
  validateCsrf,
  validate(validateProjectIdParam),
  validate(validateTaskIdParam),
  taskController.remove
);

// ── Task Comments Endpoints ───────────────────────────────────
router.get(
  '/:id/tasks/:taskId/comments',
  validate(validateProjectIdParam),
  validate(validateTaskIdParam),
  commentController.list
);

router.post(
  '/:id/tasks/:taskId/comments',
  validateOrigin,
  validateCsrf,
  validate(validateProjectIdParam),
  validate(validateTaskIdParam),
  validate(validateCreateComment),
  commentController.create
);

router.patch(
  '/:id/tasks/:taskId/comments/:commentId',
  validateOrigin,
  validateCsrf,
  validate(validateProjectIdParam),
  validate(validateTaskIdParam),
  validate(validateCommentIdParam),
  validate(validateUpdateComment),
  commentController.update
);

router.delete(
  '/:id/tasks/:taskId/comments/:commentId',
  validateOrigin,
  validateCsrf,
  validate(validateProjectIdParam),
  validate(validateTaskIdParam),
  validate(validateCommentIdParam),
  commentController.remove
);

module.exports = router;
