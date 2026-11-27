const mongoose = require('mongoose');

const THOUGHT_CATEGORIES = ['business', 'career', 'personal', 'other'];
const SOLVER_TYPES = ['human', 'ai'];
const THOUGHT_STATUSES = [
  'pending',
  'pending_human',
  'accepted',
  'in_progress',
  'answered',
  'resolved',
  'ai_fallback',
  'closed',
];
const URGENCY_LEVELS = ['Standard', 'Priority', 'Urgent'];

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    size: { type: String, trim: true },
    type: { type: String, trim: true },
    url: { type: String, trim: true },
  },
  { _id: false }
);

const thoughtSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    title: {
      type: String,
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
      default: '',
    },
    description: {
      type: String,
      trim: true,
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
      default: '',
    },
    category: {
      type: String,
      enum: {
        values: THOUGHT_CATEGORIES,
        message: 'Category must be one of: business, career, personal, other',
      },
      default: 'other',
    },
    message: {
      type: String,
      required: [true, 'Thought message is required'],
      trim: true,
      maxlength: [3000, 'Message cannot exceed 3000 characters'],
    },
    solverType: {
      type: String,
      enum: {
        values: SOLVER_TYPES,
        message: 'Solver type must be human or ai',
      },
      default: 'human',
    },
    urgency: {
      type: String,
      enum: URGENCY_LEVELS,
      default: 'Standard',
    },
    status: {
      type: String,
      enum: THOUGHT_STATUSES,
      default: 'pending',
    },
    assignedConsultant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    solution: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    aiResponse: {
      type: String,
      trim: true,
      default: '',
    },
    aiDiagnosticPlan: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

thoughtSchema.index({ status: 1, category: 1, createdAt: -1 });
thoughtSchema.index({ user: 1, createdAt: -1 });

thoughtSchema.virtual('replies', {
  ref: 'Reply',
  localField: '_id',
  foreignField: 'thought',
});

module.exports = mongoose.model('Thought', thoughtSchema);
module.exports.THOUGHT_CATEGORIES = THOUGHT_CATEGORIES;
module.exports.SOLVER_TYPES = SOLVER_TYPES;
module.exports.THOUGHT_STATUSES = THOUGHT_STATUSES;
module.exports.URGENCY_LEVELS = URGENCY_LEVELS;
