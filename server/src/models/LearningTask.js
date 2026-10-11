import mongoose from 'mongoose';

const { Schema } = mongoose;

const learningTaskSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  skill: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  importance: { type: String, enum: ['mandatory', 'preferred'], default: 'mandatory' },
  gapStatus: { type: String, enum: ['partial', 'not_evidenced'], default: 'not_evidenced' },
  estimatedHours: Number,
  order: { type: Number, default: 0 },
  status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
  completedAt: Date,
  sourceJobs: [{ type: Schema.Types.ObjectId, ref: 'Job' }],
  // Links into the existing Prepstack roadmap, coding practice and mock interview modules.
  prepstack: {
    roadmapModuleId: String,
    roadmapUrl: String,
    practice: [{ _id: false, id: String, title: String, url: String }],
    mockInterviewUrl: String,
  },
}, { timestamps: true });

export const LearningTask = mongoose.model('LearningTask', learningTaskSchema);
