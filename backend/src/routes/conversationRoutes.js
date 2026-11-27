const express = require('express');
const {
  getConversations,
  sendMessage,
  markConversationRead,
  deleteMessage,
} = require('../controllers/conversationController');
const { protect } = require('../middleware/auth');
const { mongoIdParamRule, sendMessageRules } = require('../middleware/validate');

const router = express.Router();

router.use(protect);

router.get('/', getConversations);
router.post('/:id/messages', sendMessageRules, sendMessage);
router.patch('/:id/read', mongoIdParamRule('id'), markConversationRead);
router.delete(
  '/:id/messages/:messageId',
  mongoIdParamRule('id'),
  mongoIdParamRule('messageId'),
  deleteMessage
);

module.exports = router;
