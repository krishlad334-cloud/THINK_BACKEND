const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('./errorHandler');

/**
 * Extract Bearer token from Authorization header if present.
 */
const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
};

/**
 * Require a valid JWT token and attach the user document to req.user.
 */
const protect = async (req, _res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return next(new AppError('Authentication required. Please log in.', 401));
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return next(new AppError('Server JWT configuration error.', 500));
    }

    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new AppError('User belonging to this token no longer exists.', 401));
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Optionally decode JWT if provided on public routes (e.g., POST /api/thoughts)
 * so authenticated users automatically link their thoughts to their account.
 */
const optionalProtect = async (req, _res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token || !process.env.JWT_SECRET) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user) {
      req.user = user;
    }
    return next();
  } catch (_err) {
    // Ignore invalid/expired optional tokens on public routes
    return next();
  }
};

/**
 * Restrict route access to specific roles.
 * Treats 'client' as equivalent to 'user' when 'user' is allowed.
 */
const restrictTo = (...roles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    const effectiveRole = req.user.role === 'client' ? 'user' : req.user.role;
    const isAllowed = roles.includes(req.user.role) || roles.includes(effectiveRole);

    if (!isAllowed) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }

    return next();
  };
};

module.exports = {
  protect,
  optionalProtect,
  restrictTo,
};
