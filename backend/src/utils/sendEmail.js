const nodemailer = require('nodemailer');

let cachedTransporter = null;

/**
 * Create and cache SMTP transporter only when credentials exist in env.
 */
const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const { EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_USER || !EMAIL_PASS) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: EMAIL_HOST || 'smtp.gmail.com',
    port: Number(EMAIL_PORT) || 587,
    secure: EMAIL_SECURE === 'true',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  return cachedTransporter;
};

/**
 * Escape basic HTML entities before embedding user content inside email markup.
 */
const escapeHtml = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Send an email notification to the user when their thought is answered.
 * Gracefully skips if SMTP credentials are not configured so API requests still succeed.
 */
const sendThoughtAnsweredEmail = async ({ to, name, thoughtMessage, replyMessage, responderName, thoughtId }) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.info(`[sendEmail] SMTP not configured. Skipped email notification for thought ${thoughtId} -> ${to}`);
    return { sent: false, skipped: true };
  }

  const from = process.env.EMAIL_FROM || `OverThink <${process.env.EMAIL_USER}>`;
  const preview = thoughtMessage.length > 140 ? `${thoughtMessage.slice(0, 140)}...` : thoughtMessage;

  const info = await transporter.sendMail({
    from,
    to,
    subject: 'Your OverThink has a new solution!',
    text: [
      `Hi ${name},`,
      '',
      `Good news! ${responderName} has answered your OverThink:`,
      `"${preview}"`,
      '',
      'Solution:',
      replyMessage,
      '',
      `Reference ID: ${thoughtId}`,
      '— OverThink Team',
    ].join('\n'),
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0A0816; color: #F5F3FF; border-radius: 16px;">
        <h2 style="margin: 0 0 12px; color: #5EEAD4;">Your OverThink Has Been Answered</h2>
        <p style="margin: 0 0 16px; color: #CBD5E1;">Hi ${escapeHtml(name)},</p>
        <p style="margin: 0 0 12px; color: #E2E8F0;"><strong>${escapeHtml(responderName)}</strong> shared a solution for your thought:</p>
        <blockquote style="margin: 0 0 16px; padding: 12px 16px; border-left: 3px solid #A855F7; background: #15122B; color: #A9A4C8;">
          ${escapeHtml(preview)}
        </blockquote>
        <div style="padding: 16px; background: #15122B; border: 1px solid #4C4585; border-radius: 12px; color: #F5F3FF; white-space: pre-wrap;">
          ${escapeHtml(replyMessage)}
        </div>
        <p style="margin: 20px 0 0; font-size: 12px; color: #94A3B8;">Reference ID: ${escapeHtml(String(thoughtId))}</p>
      </div>
    `,
  });

  return { sent: true, skipped: false, messageId: info.messageId };
};

module.exports = {
  sendThoughtAnsweredEmail,
};
