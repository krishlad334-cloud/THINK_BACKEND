const Thought = require('../models/Thought');
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
    });

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
        .populate('user', 'name email role')
        .populate('assignedConsultant', 'name email role')
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
      .populate('user', 'name role')
      .populate('assignedConsultant', 'name role')
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
 * PATCH /api/thoughts/:id/status
 * Consultant/Admin endpoint to update the status of a thought.
 */
const updateThoughtStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const thought = await Thought.findById(req.params.id);
    if (!thought) {
      return next(new AppError('Thought not found.', 404));
    }

    thought.status = status;
    if (['accepted', 'in_progress', 'answered', 'resolved'].includes(status) && !thought.assignedConsultant) {
      thought.assignedConsultant = req.user._id;
    }

    await thought.save();

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
  updateThoughtStatus,
};
