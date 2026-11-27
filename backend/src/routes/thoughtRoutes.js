const express = require('express');
const {
  createThought,
  getThoughts,
  getMyThoughts,
  getThoughtById,
  updateThoughtStatus,
} = require('../controllers/thoughtController');
const { protect, optionalProtect, restrictTo } = require('../middleware/auth');
const { thoughtSubmitLimiter } = require('../middleware/rateLimiters');
const {
  createThoughtRules,
  listThoughtsRules,
  mongoIdParamRule,
  updateStatusRules,
} = require('../middleware/validate');

const router = express.Router();

// Authenticated user's own thoughts (declared before /:id)
router.get('/my', protect, listThoughtsRules, getMyThoughts);

// Public thought submission (links user automatically if JWT is attached)
router.post('/', thoughtSubmitLimiter, optionalProtect, createThoughtRules, createThought);

// Consultant/Admin inbox with filtering and pagination
router.get('/', protect, restrictTo('consultant', 'admin'), listThoughtsRules, getThoughts);

// Fetch single thought + replies
router.get('/:id', optionalProtect, mongoIdParamRule('id'), getThoughtById);

// Consultant/Admin status update
router.patch('/:id/status', protect, restrictTo('consultant', 'admin'), updateStatusRules, updateThoughtStatus);

module.exports = router;
