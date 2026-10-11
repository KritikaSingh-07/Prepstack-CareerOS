import mongoose from 'mongoose';

const { Schema } = mongoose;

// Versioned: a new analysis is stored every time a profile is compared against a job.
const matchAnalysisSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  resume: { type: Schema.Types.ObjectId, ref: 'Resume' },
  results: [{
    _id: false,
    skill: String,
    importance: String,
    status: { type: String, enum: ['demonstrated', 'partial', 'not_evidenced'] },
    reason: String,
    evidence: [{ _id: false, source: String, label: String, detail: String }],
  }],
  summary: {
    demonstrated: Number,
    partial: Number,
    notEvidenced: Number,
    mandatoryMet: Number,
    mandatoryTotal: Number,
    fitScore: Number,
    fitLabel: String,
  },
  suggestions: [{ _id: false, type: { type: String }, skill: String, message: String, example: String, grounding: String }],
  keywordCoverage: { covered: [String], missing: [String], listedOnly: [String], ratio: Number, note: String },
  disclaimer: String,
}, { timestamps: true });

export const MatchAnalysis = mongoose.model('MatchAnalysis', matchAnalysisSchema);
