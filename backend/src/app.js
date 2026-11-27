const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const thoughtRoutes = require('./routes/thoughtRoutes');
const replyRoutes = require('./routes/replyRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { apiLimiter } = require('./middleware/rateLimiters');
const { AppError, notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { sendResponse } = require('./utils/response');

const app = express();

// Parse allowed origins strictly from CLIENT_URL environment variable
const parseAllowedOrigins = () => {
  const raw =
    process.env.CLIENT_URL ||
    'https://thinkhere.vercel.app,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5500,http://127.0.0.1:5500';
  return raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
};

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = parseAllowedOrigins();
    // Allow non-browser clients (curl, server-to-server) with no Origin header
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/+$/, '');
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new AppError(`CORS policy: Origin '${origin}' is not allowed.`, 403));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.set('trust proxy', 1);

// Core security & request parsing middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Global rate limiter for all /api routes
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  const dbReadyState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return sendResponse(res, 200, 'OverThink API is running.', {
    status: 'ok',
    database: dbStatusMap[dbReadyState] || 'unknown',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// API feature routes
app.use('/api/auth', authRoutes);
app.use('/api/thoughts', thoughtRoutes);
app.use('/api/replies', replyRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 & centralized JSON error handler
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
