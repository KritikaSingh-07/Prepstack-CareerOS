import { User } from '../models/User.js';
import { Resume } from '../models/Resume.js';
import { LearningTask } from '../models/LearningTask.js';
import { MatchAnalysis } from '../models/MatchAnalysis.js';
import { analyzeMatch } from './matchEngine.js';
import { notFound } from '../utils/httpError.js';

/** Loads everything the match engine needs about a student. */
export async function loadMatchContext(userId, resumeId) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User');
  const resume = resumeId
    ? await Resume.findOne({ _id: resumeId, user: userId })
    : user.primaryResume ? await Resume.findById(user.primaryResume) : null;
  const completedLearning = await LearningTask.find({ user: userId, status: 'done' }).lean();

  // A specific resume version is compared on its own content; otherwise the editable profile is used.
  const profile = resumeId && resume
    ? { skills: resume.parsed.skills, experience: resume.parsed.experience, projects: resume.parsed.projects }
    : user.toObject().profile || {};
  return { user, resume, profile, completedLearning, resumeText: resume?.rawText || '' };
}

/** Runs and stores a versioned analysis for a job. */
export async function runAndStoreAnalysis(userId, job, resumeId) {
  const ctx = await loadMatchContext(userId, resumeId);
  const result = analyzeMatch({ profile: ctx.profile, job, completedLearning: ctx.completedLearning, resumeText: ctx.resumeText });
  return MatchAnalysis.create({ user: userId, job: job._id, resume: ctx.resume?._id, ...result });
}
