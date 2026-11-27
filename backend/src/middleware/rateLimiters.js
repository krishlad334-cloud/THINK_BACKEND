const rateLimit = require('express-rate-limit');

const buildRateLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        message,
        data: null,
      });
    },
  });

const apiLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many API requests from this IP. Please try again later.',
});

const authLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

const thoughtSubmitLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many thought submissions from this IP. Please wait 15 minutes before submitting again.',
});

const newsletterLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many subscription attempts. Please try again later.',
});

module.exports = {
  apiLimiter,
  authLimiter,
  thoughtSubmitLimiter,
  newsletterLimiter,
};
