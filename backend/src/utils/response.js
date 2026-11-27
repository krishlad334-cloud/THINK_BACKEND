/**
 * Send standardized JSON API responses: { success, message, data }.
 */
const sendResponse = (res, statusCode, message, data = null) => {
  return res.status(statusCode).json({
    success: statusCode >= 200 && statusCode < 400,
    message,
    data,
  });
};

module.exports = {
  sendResponse,
};
