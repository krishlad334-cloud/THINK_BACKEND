const mongoose = require('mongoose');

const RESPONDER_TYPES = ['consultant', 'admin', 'AI'];

const replySchema = new mongoose.Schema(
  {
    thought: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Thought',
      required: [true, 'Thought reference is required'],
      index: true,
    },
    // References a User when answered by a consultant/admin, or null when responderType is 'AI'
    responder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    responderType: {
      type: String,
      enum: RESPONDER_TYPES,
      default: 'consultant',
    },
    responderName: {
      type: String,
      trim: true,
      default: 'OverThink Consultant',
    },
    message: {
      type: String,
      required: [true, 'Reply message is required'],
      trim: true,
      maxlength: [5000, 'Reply cannot exceed 5000 characters'],
    },
    actionChecklist: {
      type: [String],
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

module.exports = mongoose.model('Reply', replySchema);
module.exports.RESPONDER_TYPES = RESPONDER_TYPES;
