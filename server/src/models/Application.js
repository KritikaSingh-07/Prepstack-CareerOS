import mongoose from 'mongoose';

const { Schema } = mongoose;

export const STAGES = ['saved', 'applied', 'assessment', 'interview', 'offer', 'rejected'];

// One workspace per job application: JD, resume version, gaps, notes, events and next action.
const applicationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  stage: { type: String, enum: STAGES, default: 'saved' },
  order: { type: Number, default: 0 },
  appliedAt: Date,
  jobUrl: String,
  resumeVersion: { type: Schema.Types.ObjectId, ref: 'Resume' },
  analysis: { type: Schema.Types.ObjectId, ref: 'MatchAnalysis' },
  contacts: [{ name: String, role: String, email: String, phone: String }],
  notes: { type: String, default: '' },
  interviewNotes: { type: String, default: '' },
  events: [{
    type: { type: String, enum: ['deadline', 'assessment', 'interview', 'follow_up', 'other'], default: 'other' },
    title: String,
    date: Date,
    done: { type: Boolean, default: false },
  }],
  nextAction: { text: String, dueDate: Date },
  timeline: [{
    _id: false,
    from: String,
    to: String,
    at: { type: Date, default: Date.now },
    note: String,
  }],
  // Copilot artefacts. The student reviews and edits all of them; nothing is submitted automatically.
  coverLetter: { type: String, default: '' },
  selectedProjects: [String],
  checklist: [{ text: String, done: { type: Boolean, default: false } }],
  interviewPack: { type: Schema.Types.Mixed, default: null },
}, { timestamps: true });

applicationSchema.index({ user: 1, job: 1 }, { unique: true });

export const Application = mongoose.model('Application', applicationSchema);
