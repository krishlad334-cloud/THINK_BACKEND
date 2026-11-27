const Thought = require('../models/Thought');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorHandler');
const { sendResponse } = require('../utils/response');

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isPrivilegedOrOwner = (reqUser, thought) => {
  if (!reqUser) return false;
  if (['consultant', 'admin'].includes(reqUser.role)) return true;
  if (thought.user && thought.user._id && thought.user._id.equals(reqUser._id)) return true;
  if (thought.user && typeof thought.user.equals === 'function' && thought.user.equals(reqUser._id)) return true;
  return Boolean(thought.email && reqUser.email && thought.email.toLowerCase() === reqUser.email.toLowerCase());
};

/**
 * POST /api/thoughts
 * Public endpoint to submit a new thought/problem (linked to req.user when logged in).
 */
const createThought = async (req, res, next) => {
  try {
    const name = (req.body.name || req.user?.name || '').trim();
    const email = (req.body.email || req.user?.email || '').trim().toLowerCase();
    const message = (req.body.message || '').trim();
    const title = (req.body.title || message.split('\n')[0].slice(0, 80)).trim();
    const description = (req.body.description || message).trim();

    const thought = await Thought.create({
      user: req.user ? req.user._id : null,
      name,
      email,
      title,
      description,
      category: req.body.category || 'other',
      message,
      solverType: req.body.solverType || 'human',
      urgency: req.body.urgency || 'Standard',
      tags: Array.isArray(req.body.tags) ? req.body.tags : [req.body.category || 'other'],
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
    });

    // Notify consultants of incoming thought (non-fatal if notification insert fails)
    Notification.create({
      recipient: null,
      recipientRole: 'consultant',
      title: 'New OverThink Submitted',
      message: `${thought.name} submitted: "${thought.title.slice(0, 45)}"`,
      type: 'thought_matched',
      thought: thought._id,
    }).catch((err) => console.warn('[Notification Error]', err.message));

    return sendResponse(
      res,
      201,
      'Your thought has been submitted! Expect a solution within 24 hours.',
      { thought }
    );
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/thoughts
 * Consultant/Admin endpoint to list thoughts with pagination and filters.
 */
const getThoughts = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.solverType) filter.solverType = req.query.solverType;

    if (req.query.q && String(req.query.q).trim()) {
      const regex = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
      filter.$or = [
        { name: regex },
        { email: regex },
        { title: regex },
        { message: regex },
      ];
    }

    const [thoughts, total] = await Promise.all([
      Thought.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'name email role avatar')
        .populate('assignedConsultant', 'name email role avatar')
        .populate({
          path: 'replies',
          options: { sort: { createdAt: 1 } },
          populate: { path: 'responder', select: 'name role' },
        }),
      Thought.countDocuments(filter),
    ]);

    return sendResponse(res, 200, 'Thoughts fetched successfully.', {
      thoughts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/thoughts/my
 * Authenticated endpoint for a user/client to view their own submitted thoughts & replies.
 */
const getMyThoughts = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {
      $or: [{ user: req.user._id }, { email: req.user.email.toLowerCase() }],
    };

    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;

    const [thoughts, total] = await Promise.all([
      Thought.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('assignedConsultant', 'name role avatar')
        .populate({
          path: 'replies',
          options: { sort: { createdAt: 1 } },
          populate: { path: 'responder', select: 'name role' },
        }),
      Thought.countDocuments(filter),
    ]);

    return sendResponse(res, 200, 'Your thoughts fetched successfully.', {
      thoughts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/thoughts/:id
 * Fetch a single thought and its replies. Masks submitter email for unauthenticated lookups.
 */
const getThoughtById = async (req, res, next) => {
  try {
    const thought = await Thought.findById(req.params.id)
      .populate('user', 'name role avatar')
      .populate('assignedConsultant', 'name role avatar')
      .populate({
        path: 'replies',
        options: { sort: { createdAt: 1 } },
        populate: { path: 'responder', select: 'name role' },
      });

    if (!thought) {
      return next(new AppError('Thought not found.', 404));
    }

    const result = thought.toJSON();
    if (!isPrivilegedOrOwner(req.user, thought)) {
      delete result.email;
    }

    return sendResponse(res, 200, 'Thought fetched successfully.', {
      thought: result,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/thoughts/:id/accept
 * Consultant/Admin accepts a thought and opens a 1-on-1 Conversation room.
 */
const acceptThought = async (req, res, next) => {
  try {
    const thought = await Thought.findById(req.params.id).populate('user', 'name avatar');
    if (!thought) {
      return next(new AppError('Thought not found.', 404));
    }

    const existingConv = await Conversation.findOne({ thought: thought._id });
    if (existingConv) {
      if (existingConv.consultant.equals(req.user._id) || req.user.role === 'admin') {
        return sendResponse(res, 200, 'You already accepted this OverThink.', {
          thought,
          conversation: existingConv,
          alreadyAccepted: true,
        });
      }
      return next(new AppError('This OverThink has already been accepted by another consultant.', 409));
    }

    if (
      !['pending', 'pending_human'].includes(thought.status) &&
      thought.assignedConsultant &&
      !thought.assignedConsultant.equals(req.user._id)
    ) {
      return next(new AppError('This OverThink has already been claimed.', 409));
    }

    thought.status = 'accepted';
    thought.assignedConsultant = req.user._id;
    await thought.save();

    const conversation = await Conversation.create({
      thought: thought._id,
      client: thought.user ? thought.user._id : null,
      clientName: thought.name,
      clientAvatar: thought.user?.avatar || '',
      consultant: req.user._id,
      consultantName: req.user.name,
      consultantAvatar: req.user.avatar || '',
      status: 'accepted',
      messages: [
        {
          sender: thought.user ? thought.user._id : null,
          senderName: thought.name,
          senderAvatar: thought.user?.avatar || '',
          senderRole: 'client',
          isProblemPost: true,
          problemTitle: thought.title || thought.message.slice(0, 80),
          problemDescription: thought.description || thought.message,
          text: thought.message,
          attachments: thought.attachments || [],
          isRead: true,
        },
      ],
    });

    if (thought.user) {
      Notification.create({
        recipient: thought.user._id,
        recipientRole: 'client',
        title: 'OverThink Accepted!',
        message: `${req.user.name} accepted your OverThink and opened a consultation room.`,
        type: 'thought_accepted',
        thought: thought._id,
        conversation: conversation._id,
      }).catch((err) => console.warn('[Notification Error]', err.message));
    }

    return sendResponse(res, 201, 'OverThink accepted and consultation room created.', {
      thought,
      conversation,
      alreadyAccepted: false,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/thoughts/:id/status
 * Consultant/Admin endpoint to update status and optional AI/structured solution details.
 */
const updateThoughtStatus = async (req, res, next) => {
  try {
    const { status, solution, aiResponse, aiDiagnosticPlan } = req.body;

    const thought = await Thought.findById(req.params.id);
    if (!thought) {
      return next(new AppError('Thought not found.', 404));
    }

    thought.status = status;
    if (solution !== undefined) thought.solution = solution;
    if (aiResponse !== undefined) thought.aiResponse = aiResponse;
    if (Array.isArray(aiDiagnosticPlan)) thought.aiDiagnosticPlan = aiDiagnosticPlan;

    if (['accepted', 'in_progress', 'answered', 'resolved'].includes(status) && !thought.assignedConsultant) {
      thought.assignedConsultant = req.user._id;
    }

    await thought.save();

    // Sync linked conversation status if one exists
    await Conversation.updateOne({ thought: thought._id }, { $set: { status } });

    return sendResponse(res, 200, `Thought status updated to ${status}.`, {
      thought,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createThought,
  getThoughts,
  getMyThoughts,
  getThoughtById,
  acceptThought,
  updateThoughtStatus,
};
