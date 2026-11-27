const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    senderName: {
      type: String,
      trim: true,
      required: true,
    },
    senderAvatar: {
      type: String,
      trim: true,
      default: '',
    },
    senderRole: {
      type: String,
      trim: true,
      default: 'client',
    },
    isProblemPost: {
      type: Boolean,
      default: false,
    },
    problemTitle: {
      type: String,
      trim: true,
      default: '',
    },
    problemDescription: {
      type: String,
      trim: true,
      default: '',
    },
    text: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: '',
    },
    attachments: {
      type: [
        {
          name: { type: String, trim: true },
          size: { type: String, trim: true },
        },
      ],
      default: [],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const conversationSchema = new mongoose.Schema(
  {
    thought: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Thought',
      required: true,
      unique: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    clientName: {
      type: String,
      trim: true,
      required: true,
    },
    clientAvatar: {
      type: String,
      trim: true,
      default: '',
    },
    consultant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    consultantName: {
      type: String,
      trim: true,
      required: true,
    },
    consultantAvatar: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      trim: true,
      default: 'accepted',
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

conversationSchema.index({ client: 1, updatedAt: -1 });
conversationSchema.index({ consultant: 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
