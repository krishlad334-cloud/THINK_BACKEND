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
 * Register a new user, client, or consultant account (supports optional mobile number).
 */
const register = async (req, res, next) => {
  try {
    const { name, email, mobile, password, role, headline, bio, skills, services, avatar } = req.body;

    if (role === 'admin') {
      return next(new AppError('Admin accounts cannot be created through public registration.', 403));
    }

    const normalizedEmail = email.toLowerCase();
    const cleanMobile = mobile ? String(mobile).replace(/\D/g, '') : undefined;

    const duplicateQuery = cleanMobile
      ? { $or: [{ email: normalizedEmail }, { mobile: cleanMobile }] }
      : { email: normalizedEmail };

    const existingUser = await User.findOne(duplicateQuery);
    if (existingUser) {
      const conflictField = existingUser.email === normalizedEmail ? 'email' : 'mobile number';
      return next(new AppError(`An account with this ${conflictField} already exists.`, 409));
    }

    const assignedRole = ['user', 'client', 'consultant'].includes(role) ? role : 'user';

    const userPayload = {
      name,
      email: normalizedEmail,
      password,
      role: assignedRole,
      avatar: avatar || '',
      headline: headline || '',
      bio: bio || '',
      skills: Array.isArray(skills) ? skills : [],
      services: Array.isArray(services) ? services : [],
      isVerified: assignedRole !== 'consultant',
      assessmentPassed: assignedRole !== 'consultant',
    };

    if (cleanMobile) {
      userPayload.mobile = cleanMobile;
    }

    const user = await User.create(userPayload);
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
 * Authenticate with email or mobile number and return a JWT token.
 */
const login = async (req, res, next) => {
  try {
    const { password } = req.body;
    const rawIdentifier = String(req.body.identifier || req.body.email || req.body.mobile || '').trim();

    let query;
    if (rawIdentifier.includes('@')) {
      query = { email: rawIdentifier.toLowerCase() };
    } else {
      const digits = rawIdentifier.replace(/\D/g, '');
      query = digits ? { mobile: digits } : { email: rawIdentifier.toLowerCase() };
    }

    const user = await User.findOne(query).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Invalid credentials. Please check your email/mobile and password.', 401));
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
 * Update allowed profile and consultant qualification fields for the authenticated user.
 */
const updateMe = async (req, res, next) => {
  try {
    const allowedFields = [
      'name',
      'mobile',
      'avatar',
      'headline',
      'bio',
      'hourlyRate',
      'skills',
      'services',
      'assessmentPassed',
      'assessmentScore',
      'isVerified',
    ];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] =
          field === 'mobile' && req.body.mobile
            ? String(req.body.mobile).replace(/\D/g, '')
            : req.body[field];
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

/**
 * GET /api/auth/consultants
 * List public consultant directory profiles (without email/mobile PII unless needed).
 */
const getConsultants = async (_req, res, next) => {
  try {
    const consultants = await User.find({ role: 'consultant' })
      .select('name avatar headline bio hourlyRate skills services isVerified assessmentPassed createdAt')
      .sort({ isVerified: -1, createdAt: -1 });

    return sendResponse(res, 200, 'Consultants fetched successfully.', {
      consultants,
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
  getConsultants,
};
