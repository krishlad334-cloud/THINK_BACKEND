const Reply = require('../models/Reply');
const Thought = require('../models/Thought');
const { AppError } = require('../middleware/errorHandler');
const { sendResponse } = require('../utils/response');
const { sendThoughtAnsweredEmail } = require('../utils/sendEmail');

/**
 * POST /api/replies
 * Consultant/Admin endpoint to save a solution reply, mark thought answered, and notify user.
 */
const createReply = async (req, res, next) => {
  try {
    const thoughtId = req.body.thought || req.body.thoughtId;
    const { message, responderType, actionChecklist } = req.body;

    const thought = await Thought.findById(thoughtId);
    if (!thought) {
      return next(new AppError('Thought not found.', 404));
    }

    const resolvedResponderType =
      responderType || (req.user.role === 'admin' ? 'admin' : 'consultant');
    const isAI = resolvedResponderType === 'AI';
    const responderName = isAI ? 'OverThink AI' : req.user.name;

    const reply = await Reply.create({
      thought: thought._id,
      responder: isAI ? null : req.user._id,
      responderType: resolvedResponderType,
      responderName,
      message: message.trim(),
      actionChecklist: Array.isArray(actionChecklist) ? actionChecklist : [],
    });

    thought.status = 'answered';
    if (!isAI && !thought.assignedConsultant) {
      thought.assignedConsultant = req.user._id;
    }
    await thought.save();

    let emailNotification = { sent: false, skipped: true };
    try {
      emailNotification = await sendThoughtAnsweredEmail({
        to: thought.email,
        name: thought.name,
        thoughtMessage: thought.message,
        replyMessage: reply.message,
        responderName,
        thoughtId: thought._id,
      });
    } catch (emailErr) {
      console.error('[Reply Email Notification Error]', emailErr.message);
      emailNotification = { sent: false, skipped: false, error: emailErr.message };
    }

    await reply.populate('responder', 'name role');

    return sendResponse(res, 201, 'Reply submitted and thought marked as answered.', {
      reply,
      thought,
      emailNotification,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/replies/:thoughtId
 * Fetch all replies associated with a specific thought.
 */
const getRepliesByThought = async (req, res, next) => {
  try {
    const thought = await Thought.findById(req.params.thoughtId).select('_id');
    if (!thought) {
      return next(new AppError('Thought not found.', 404));
    }

    const replies = await Reply.find({ thought: req.params.thoughtId })
      .sort({ createdAt: 1 })
      .populate('responder', 'name role');

    return sendResponse(res, 200, 'Replies fetched successfully.', {
      replies,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createReply,
  getRepliesByThought,
};
