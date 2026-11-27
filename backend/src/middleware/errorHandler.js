/**
 * Custom operational error with HTTP status code.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, data = null) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 handler for unmatched API routes.
 */
const notFoundHandler = (req, _res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

/**
 * Centralized error handler returning consistent JSON: { success, message, data }.
 */
const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let data = err.data || null;

  // Mongoose invalid ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A record with that ${field} already exists.`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    message = errors.map((e) => e.message).join('. ') || 'Validation failed';
    data = { errors };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token. Please log in again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your authentication token has expired. Please log in again.';
  }

  // CORS origin rejection
  if (message.startsWith('CORS policy:')) {
    statusCode = 403;
  }

  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) {
    console.error('[Server Error]', err);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    data,
  });
};

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler,
};
