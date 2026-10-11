import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { experienceSchema, projectSchema, educationSchema } from './profileSchemas.js';

const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  // Structured profile: populated from the primary resume and editable by the student.
  profile: {
    headline: String,
    summary: String,
    skills: [String],
    education: [educationSchema],
    experience: [experienceSchema],
    projects: [projectSchema],
    links: [String],
  },
  preferences: {
    targetRoles: [String],
    locations: [String],
    remote: { type: String, enum: ['any', 'remote', 'hybrid', 'onsite'], default: 'any' },
    experienceLevel: { type: String, enum: ['internship', 'entry', 'junior', 'mid'], default: 'junior' },
    weeklyApplicationGoal: { type: Number, default: 5 },
  },
  primaryResume: { type: Schema.Types.ObjectId, ref: 'Resume' },
}, { timestamps: true });

userSchema.methods.setPassword = async function setPassword(password) {
  this.passwordHash = await bcrypt.hash(password, 10);
};

userSchema.methods.checkPassword = function checkPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

export const User = mongoose.model('User', userSchema);
