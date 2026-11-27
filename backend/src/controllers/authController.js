const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { sendResponse } = require('../utils/response');

const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * POST /api/auth/register
 * Register a new user, client, or consultant account.
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, headline, bio, skills } = req.body;

    // Never allow privilege escalation via public registration
    if (role === 'admin') {
      return next(new AppError('Admin accounts cannot be created through public registration.', 403));
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return next(new AppError('An account with this email already exists.', 409));
    }

    const assignedRole = ['user', 'client', 'consultant'].includes(role) ? role : 'user';

    const user = await User.create({
      name,
      email,
      password,
      role: assignedRole,
      headline: headline || '',
      bio: bio || '',
      skills: Array.isArray(skills) ? skills : [],
    });

    const token = signToken(user._id);

    return sendResponse(res, 201, 'Account registered successfully.', {
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/auth/login
 * Authenticate an existing user and return a JWT token.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Invalid email or password.', 401));
    }

    const token = signToken(user._id);

    return sendResponse(res, 200, 'Logged in successfully.', {
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/auth/me
 * Return the currently authenticated user's profile.
 */
const getMe = async (req, res, next) => {
  try {
    return sendResponse(res, 200, 'Current user fetched successfully.', {
      user: req.user,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/auth/me
 * Update allowed profile fields for the authenticated user.
 */
const updateMe = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'headline', 'bio', 'skills', 'assessmentPassed'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    return sendResponse(res, 200, 'Profile updated successfully.', {
      user: updatedUser,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateMe,
};
