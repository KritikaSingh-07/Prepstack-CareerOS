import { Router } from 'express';
import { Application } from '../models/Application.js';
import { MatchAnalysis } from '../models/MatchAnalysis.js';
import { loadMatchContext, runAndStoreAnalysis } from '../services/matchContext.js';
import { draftCoverLetter, selectProjects, rewriteBullets, buildChecklist, buildInterviewPack } from '../services/copilot.js';
import { llmEnabled } from '../services/llm.js';
import { notFound } from '../utils/httpError.js';

const router = Router();

/** Loads the application, its job, the student's profile and the latest analysis (running one if needed). */
async function context(req) {
  const app = await Application.findOne({ _id: req.params.applicationId, user: req.userId }).populate('job');
  if (!app) throw notFound('Application');
  const ctx = await loadMatchContext(req.userId);
  const analysis = await MatchAnalysis.findOne({ user: req.userId, job: app.job._id }).sort({ createdAt: -1 })
    || await runAndStoreAnalysis(req.userId, app.job);
  return { app, job: app.job, user: ctx.user, profile: ctx.profile, analysis };
}

router.get('/status', (_req, res) => {
  res.json({ llm: llmEnabled() ? 'claude' : 'template' });
});

router.post('/:applicationId/cover-letter', async (req, res) => {
  const { user, profile, job, analysis } = await context(req);
  res.json(await draftCoverLetter({ user, profile, job, analysis }));
});

router.post('/:applicationId/projects', async (req, res) => {
  const { profile, job } = await context(req);
  res.json({ projects: selectProjects(profile, job, 5) });
});

router.post('/:applicationId/bullets', async (req, res) => {
  const { profile, job } = await context(req);
  res.json({
    suggestions: rewriteBullets(profile, job),
    note: 'Suggestions only rephrase what is already on your resume. Accept a suggestion only if it is accurate, and replace placeholders with real figures or remove them.',
  });
});

router.post('/:applicationId/checklist', async (req, res) => {
  const { app, job, analysis } = await context(req);
  const fresh = buildChecklist({ job, analysis, hasResumeVersion: Boolean(app.resumeVersion), hasCoverLetter: Boolean(app.coverLetter) });
  // Preserve items the student already ticked off.
  const doneTexts = new Set(app.checklist.filter((c) => c.done).map((c) => c.text));
  app.checklist = fresh.map((item) => ({ ...item, done: item.done || doneTexts.has(item.text) }));
  await app.save();
  res.json({ checklist: app.checklist });
});

router.post('/:applicationId/interview-pack', async (req, res) => {
  const { app, job, analysis, profile } = await context(req);
  app.interviewPack = await buildInterviewPack({ job, analysis, profile });
  app.markModified('interviewPack');
  await app.save();
  res.json({ interviewPack: app.interviewPack });
});

export default router;
