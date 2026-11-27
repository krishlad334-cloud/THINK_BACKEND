const Newsletter = require('../models/Newsletter');
const { sendResponse } = require('../utils/response');

/**
 * POST /api/newsletter
 * Subscribe an email address to OverThink updates.
 */
const subscribeNewsletter = async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase();
    const source = req.body.source || 'landing_page';

    const existing = await Newsletter.findOne({ email });
    if (existing) {
      if (existing.isActive) {
        return sendResponse(res, 200, 'You are already subscribed to OverThink updates!', {
          subscription: existing,
          alreadySubscribed: true,
        });
      }

      existing.isActive = true;
      existing.source = source;
      await existing.save();

      return sendResponse(res, 200, 'Your OverThink newsletter subscription has been reactivated.', {
        subscription: existing,
        alreadySubscribed: false,
      });
    }

    const subscription = await Newsletter.create({ email, source });

    return sendResponse(res, 201, 'Subscribed to OverThink updates!', {
      subscription,
      alreadySubscribed: false,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  subscribeNewsletter,
};
