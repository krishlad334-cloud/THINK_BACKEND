const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorHandler');
const { sendResponse } = require('../utils/response');

const buildUserNotificationFilter = (user) => {
  const matchingRoles = user.role === 'user' || user.role === 'client' ? ['user', 'client'] : [user.role];
  return {
    $or: [
      { recipient: user._id },
      { recipient: null, recipientRole: { $in: matchingRoles } },
    ],
  };
};

/**
 * GET /api/notifications
 * List notifications for the signed-in user and their role.
 */
const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find(buildUserNotificationFilter(req.user))
      .sort({ createdAt: -1 })
      .limit(50);

    return sendResponse(res, 200, 'Notifications fetched successfully.', {
      notifications,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, ...buildUserNotificationFilter(req.user) },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return next(new AppError('Notification not found.', 404));
    }

    return sendResponse(res, 200, 'Notification marked as read.', {
      notification,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications for the current user as read.
 */
const markAllNotificationsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { ...buildUserNotificationFilter(req.user), isRead: false },
      { $set: { isRead: true } }
    );

    return sendResponse(res, 200, 'All notifications marked as read.', {
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
