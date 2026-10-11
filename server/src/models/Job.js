import mongoose from 'mongoose';

const { Schema } = mongoose;

const jobSchema = new Schema({
  title: { type: String, required: true, trim: true },
  company: { type: String, required: true, trim: true },
  location: { type: String, default: '' },
  workMode: { type: String, enum: ['remote', 'hybrid', 'onsite'], default: 'onsite' },
  experienceLevel: { type: String, enum: ['internship', 'entry', 'junior', 'mid'], default: 'junior' },
  employmentType: { type: String, enum: ['full-time', 'internship', 'contract', 'part-time'], default: 'full-time' },
  roleCategory: { type: String, default: 'Full Stack' },
  description: { type: String, required: true },
  requirements: [{
    _id: false,
    skill: { type: String, required: true },
    importance: { type: String, enum: ['mandatory', 'preferred'], default: 'mandatory' },
  }],
  salary: { min: Number, max: Number, currency: { type: String, default: 'INR' } },
  url: String,
  source: { type: String, default: 'Prepstack partner' },
  postedAt: { type: Date, default: Date.now },
  closingDate: Date,
  // When the listing's open status was last confirmed with its source.
  lastVerifiedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  // Jobs a student adds themselves (e.g. pasted from another site) are private to that student.
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

jobSchema.index({ title: 'text', company: 'text', description: 'text' });
jobSchema.index({ createdBy: 1, status: 1 });

export const Job = mongoose.model('Job', jobSchema);
