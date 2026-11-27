const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorHandler');
const { sendResponse } = require('../utils/response');

const isConversationParticipant = (conversation, user) => {
  if (!conversation || !user) return false;
  if (user.role === 'admin') return true;
  return (
    (conversation.client && conversation.client.equals(user._id)) ||
    (conversation.consultant && conversation.consultant.equals(user._id))
  );
};

/**
 * GET /api/conversations
 * List all 1-on-1 conversations belonging to the authenticated client or consultant.
 */
const getConversations = async (req, res, next) => {
  try {
    const query =
      req.user.role === 'admin'
        ? {}
        : { $or: [{ client: req.user._id }, { consultant: req.user._id }] };

    const conversations = await Conversation.find(query)
      .sort({ updatedAt: -1 })
      .populate('thought', 'title category status urgency');

    return sendResponse(res, 200, 'Conversations fetched successfully.', {
      conversations,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/conversations/:id/messages
 * Send a message inside an active 1-on-1 consultation conversation.
 */
const sendMessage = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return next(new AppError('Conversation not found.', 404));
    }

    if (!isConversationParticipant(conversation, req.user)) {
      return next(new AppError('You do not have permission to post in this conversation.', 403));
    }

    const newMessage = {
      sender: req.user._id,
      senderName: req.user.name,
      senderAvatar: req.user.avatar || '',
      senderRole: req.user.role === 'user' ? 'client' : req.user.role,
      text: (req.body.text || '').trim(),
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
      isRead: false,
    };

    conversation.messages.push(newMessage);
    await conversation.save();

    const savedMsg = conversation.messages[conversation.messages.length - 1];
    const isSenderClient = conversation.client && conversation.client.equals(req.user._id);
    const recipientId = isSenderClient ? conversation.consultant : conversation.client;
    const recipientRole = isSenderClient ? 'consultant' : 'client';

    if (recipientId) {
      Notification.create({
        recipient: recipientId,
        recipientRole,
        title: `New Message from ${req.user.name}`,
        message: newMessage.text ? newMessage.text.slice(0, 80) : 'Sent an attachment',
        type: 'new_message',
        thought: conversation.thought,
        conversation: conversation._id,
      }).catch((err) => console.warn('[Notification Error]', err.message));
    }

    return sendResponse(res, 201, 'Message sent.', {
      message: savedMsg,
      conversation,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/conversations/:id/read
 * Mark incoming messages from the other party as read.
 */
const markConversationRead = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return next(new AppError('Conversation not found.', 404));
    }

    if (!isConversationParticipant(conversation, req.user)) {
      return next(new AppError('You do not have permission to update this conversation.', 403));
    }

    let updatedCount = 0;
    conversation.messages.forEach((msg) => {
      if (msg.sender && !msg.sender.equals(req.user._id) && !msg.isRead) {
        msg.isRead = true;
        updatedCount += 1;
      }
    });

    if (updatedCount > 0) {
      await conversation.save();
    }

    return sendResponse(res, 200, 'Conversation marked as read.', {
      updatedCount,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/conversations/:id/messages/:messageId
 * Delete a chat message authored by the requester (cannot delete original problem post).
 */
const deleteMessage = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return next(new AppError('Conversation not found.', 404));
    }

    if (!isConversationParticipant(conversation, req.user)) {
      return next(new AppError('You do not have permission to modify this conversation.', 403));
    }

    const msg = conversation.messages.id(req.params.messageId);
    if (!msg) {
      return next(new AppError('Message not found.', 404));
    }

    if (msg.isProblemPost) {
      return next(new AppError('Cannot delete the original thought post.', 400));
    }

    if (msg.sender && !msg.sender.equals(req.user._id) && req.user.role !== 'admin') {
      return next(new AppError('You can only delete your own messages.', 403));
    }

    msg.deleteOne();
    await conversation.save();

    return sendResponse(res, 200, 'Message deleted.', {
      deletedMessageId: req.params.messageId,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getConversations,
  sendMessage,
  markConversationRead,
  deleteMessage,
};
