const express = require('express');
const { register, login, getMe, updateMe, getConsultants } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiters');
const { registerRules, loginRules } = require('../middleware/validate');

const router = express.Router();

router.post('/register', authLimiter, registerRules, register);
router.post('/login', authLimiter, loginRules, login);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);
router.get('/consultants', getConsultants);

module.exports = router;
