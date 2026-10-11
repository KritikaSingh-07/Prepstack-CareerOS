import mongoose from 'mongoose';
import { experienceSchema, projectSchema, educationSchema } from './profileSchemas.js';

const { Schema } = mongoose;

// Every upload or tailored edit is stored as a new version.
const resumeSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  label: { type: String, required: true },
  version: { type: Number, required: true },
  source: { type: String, enum: ['upload', 'tailored', 'seed'], default: 'upload' },
  fileName: String,
  basedOn: { type: Schema.Types.ObjectId, ref: 'Resume' },
  targetJob: { type: Schema.Types.ObjectId, ref: 'Job' },
  rawText: { type: String, default: '' },
  parsed: {
    contact: { name: String, email: String, phone: String, links: [String] },
    summary: String,
    skills: [String],
    allSkills: [String],
    education: [educationSchema],
    experience: [experienceSchema],
    projects: [projectSchema],
    certifications: [String],
    achievements: [String],
  },
  issues: [{ _id: false, severity: String, field: String, message: String, suggestion: String }],
}, { timestamps: true });

export const Resume = mongoose.model('Resume', resumeSchema);
