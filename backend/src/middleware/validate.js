const { body, param, query, validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const { THOUGHT_CATEGORIES, SOLVER_TYPES, THOUGHT_STATUSES, URGENCY_LEVELS } = require('../models/Thought');
const { RESPONDER_TYPES } = require('../models/Reply');

/**
 * Normalize descriptive OverThink category names to the canonical schema values.
 */
const normalizeCategory = (value) => {
  if (typeof value !== 'string') return value;
  const v = value.trim().toLowerCase();
  if (THOUGHT_CATEGORIES.includes(v)) return v;
  if (v.includes('business') || v.includes('strategy') || v.includes('startup')) return 'business';
  if (v.includes('career') || v.includes('job') || v.includes('growth')) return 'career';
  if (v.includes('personal') || v.includes('mindset') || v.includes('life')) return 'personal';
  if (v.includes('general')) return 'other';
  return v;
};

/**
 * Inspect express-validator results and forward formatted 400 error if invalid.
 */
const handleValidation = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map((err) => ({
    field: err.path || err.param,
    message: err.msg,
  }));

  return next(new AppError(errors[0].message, 400, { errors }));
};

const registerRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('mobile')
    .optional({ values: 'falsy' })
    .customSanitizer((val) => String(val).replace(/\D/g, ''))
    .isLength({ min: 10, max: 15 })
    .withMessage('Mobile number must be between 10 and 15 digits'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .trim()
    .toLowerCase()
    .isIn(['user', 'client', 'consultant'])
    .withMessage('Public signup role must be user, client, or consultant'),
  handleValidation,
];

const loginRules = [
  body('identifier')
    .custom((value, { req }) => {
      const raw = String(value || req.body.email || req.body.mobile || '').trim();
      if (!raw) {
        throw new Error('Email or mobile number is required');
      }
      return true;
    }),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidation,
];

const createThoughtRules = [
  body('name')
    .if((_val, { req }) => !req.user || req.body.name !== undefined)
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .if((_val, { req }) => !req.user || req.body.email !== undefined)
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 3000 })
    .withMessage('Description cannot exceed 3000 characters'),
  body('message')
    .custom((value, { req }) => {
      const composed = (value || req.body.description || req.body.title || '').trim();
      if (!composed) {
        throw new Error('Thought message is required');
      }
      if (composed.length > 3000) {
        throw new Error('Thought message cannot exceed 3000 characters');
      }
      return true;
    })
    .customSanitizer((value, { req }) => {
      if (typeof value === 'string' && value.trim()) return value.trim();
      const title = (req.body.title || '').trim();
      const desc = (req.body.description || '').trim();
      return title && desc ? `${title}\n\n${desc}` : title || desc;
    }),
  body('category')
    .optional()
    .customSanitizer(normalizeCategory)
    .isIn(THOUGHT_CATEGORIES)
    .withMessage(`Category must be one of: ${THOUGHT_CATEGORIES.join(', ')}`),
  body('solverType')
    .optional()
    .trim()
    .toLowerCase()
    .isIn(SOLVER_TYPES)
    .withMessage(`Solver type must be one of: ${SOLVER_TYPES.join(', ')}`),
  body('urgency')
    .optional()
    .trim()
    .isIn(URGENCY_LEVELS)
    .withMessage(`Urgency must be one of: ${URGENCY_LEVELS.join(', ')}`),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('attachments must be an array'),
  handleValidation,
];

const listThoughtsRules = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('status')
    .optional()
    .trim()
    .toLowerCase()
    .isIn(THOUGHT_STATUSES)
    .withMessage(`Status must be one of: ${THOUGHT_STATUSES.join(', ')}`),
  query('category')
    .optional()
    .customSanitizer(normalizeCategory)
    .isIn(THOUGHT_CATEGORIES)
    .withMessage(`Category must be one of: ${THOUGHT_CATEGORIES.join(', ')}`),
  query('solverType')
    .optional()
    .trim()
    .toLowerCase()
    .isIn(SOLVER_TYPES)
    .withMessage(`Solver type must be one of: ${SOLVER_TYPES.join(', ')}`),
  handleValidation,
];

const mongoIdParamRule = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName} format`),
  handleValidation,
];

const updateStatusRules = [
  param('id').isMongoId().withMessage('Invalid thought ID format'),
  body('status')
    .trim()
    .toLowerCase()
    .notEmpty()
    .withMessage('Status is required')
    .isIn(THOUGHT_STATUSES)
    .withMessage(`Status must be one of: ${THOUGHT_STATUSES.join(', ')}`),
  handleValidation,
];

const createReplyRules = [
  body('thought')
    .custom((value, { req }) => {
      const thoughtId = value || req.body.thoughtId;
      if (!thoughtId) {
        throw new Error('Thought ID is required');
      }
      if (!/^[a-fA-F0-9]{24}$/.test(String(thoughtId))) {
        throw new Error('Invalid thought ID format');
      }
      return true;
    }),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Reply message is required')
    .isLength({ min: 2, max: 5000 })
    .withMessage('Reply must be between 2 and 5000 characters'),
  body('responderType')
    .optional()
    .trim()
    .isIn(RESPONDER_TYPES)
    .withMessage(`Responder type must be one of: ${RESPONDER_TYPES.join(', ')}`),
  body('actionChecklist')
    .optional()
    .isArray()
    .withMessage('actionChecklist must be an array of strings'),
  handleValidation,
];

const sendMessageRules = [
  param('id').isMongoId().withMessage('Invalid conversation ID format'),
  body('text')
    .custom((value, { req }) => {
      const hasText = typeof value === 'string' && value.trim().length > 0;
      const hasAttachments = Array.isArray(req.body.attachments) && req.body.attachments.length > 0;
      if (!hasText && !hasAttachments) {
        throw new Error('Message text or attachment is required');
      }
      if (typeof value === 'string' && value.length > 4000) {
        throw new Error('Message cannot exceed 4000 characters');
      }
      return true;
    }),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('attachments must be an array'),
  handleValidation,
];

const newsletterRules = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('source')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Source cannot exceed 50 characters'),
  handleValidation,
];

module.exports = {
  registerRules,
  loginRules,
  createThoughtRules,
  listThoughtsRules,
  mongoIdParamRule,
  updateStatusRules,
  createReplyRules,
  sendMessageRules,
  newsletterRules,
};
