const express = require('express');
const { createReply, getRepliesByThought } = require('../controllers/replyController');
const { protect, optionalProtect, restrictTo } = require('../middleware/auth');
const { createReplyRules, mongoIdParamRule } = require('../middleware/validate');

const router = express.Router();

router.post('/', protect, restrictTo('consultant', 'admin'), createReplyRules, createReply);
router.get('/:thoughtId', optionalProtect, mongoIdParamRule('thoughtId'), getRepliesByThought);

module.exports = router;
