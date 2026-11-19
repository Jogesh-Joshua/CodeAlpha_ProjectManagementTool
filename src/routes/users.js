'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validateOrigin, validateCsrf } = require('../middleware/csrf');
const { validate } = require('../middleware/validate');
const {
  validateSearchUsers,
  validateUpdateProfile,
  validateChangePassword,
} = require('../validators/projectValidators');
const userController = require('../controllers/userController');

const router = express.Router();

// All user routes require authentication
router.use(requireAuth);

router.get(
  '/search',
  validate(validateSearchUsers),
  userController.search
);

router.patch(
  '/me',
  validateOrigin,
  validateCsrf,
  validate(validateUpdateProfile),
  userController.updateProfile
);

router.patch(
  '/me/password',
  validateOrigin,
  validateCsrf,
  validate(validateChangePassword),
  userController.changePassword
);

module.exports = router;
