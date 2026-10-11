import { Router } from 'express';
import { Application, STAGES } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { MatchAnalysis } from '../models/MatchAnalysis.js';
import { LearningTask } from '../models/LearningTask.js';
import { freshness } from '../services/jobFreshness.js';
import { deriveRequirements } from '../services/skills/extractor.js';
import { findVisibleJob } from './jobs.js';
import { badRequest, notFound } from '../utils/httpError.js';

const router = Router();

const EDITABLE = ['notes', 'interviewNotes', 'contacts', 'events', 'nextAction', 'jobUrl', 'resumeVersion', 'coverLetter', 'checklist', 'selectedProjects'];

async function findOwned(userId, id) {
  const app = await Application.findOne({ _id: id, user: userId });
  if (!app) throw notFound('Application');
  return app;
}

router.get('/', async (req, res) => {
  const apps = await Application.find({ user: req.userId })
    .sort({ stage: 1, order: 1, updatedAt: -1 })
    .populate('job', 'title company location workMode closingDate lastVerifiedAt status url')
    .populate('analysis', 'summary')
    .lean();
  const items = apps.map((a) => {
    const upcoming = (a.events || []).filter((e) => !e.done && e.date && new Date(e.date) >= new Date(Date.now() - 864e5))
      .sort((x, y) => new Date(x.date) - new Date(y.date))[0] || null;
    return { ...a, freshness: a.job ? freshness(a.job) : null, upcomingEvent: upcoming };
  });
  res.json({ items, stages: STAGES });
});

// Track an application for a listed job, or for a job found elsewhere (created as a private job).
router.post('/', async (req, res) => {
  const { jobId, job: external, stage = 'saved' } = req.body || {};
  if (!STAGES.includes(stage)) throw badRequest('Invalid stage');
  let job;
  if (jobId) {
    job = await findVisibleJob(req.userId, jobId);
  } else if (external?.title && external?.company) {
    job = await Job.create({
      title: external.title,
      company: external.company,
      description: external.description || `${external.title} at ${external.company}`,
      url: external.url,
      location: external.location,
      workMode: external.workMode || 'onsite',
      closingDate: external.closingDate || undefined,
      requirements: deriveRequirements(external.description || ''),
      source: 'Added by you',
      createdBy: req.userId,
    });
  } else {
    throw badRequest('Provide jobId, or job.title and job.company');
  }
  if (await Application.exists({ user: req.userId, job: job._id })) throw badRequest('You are already tracking this job');
  const app = await Application.create({
    user: req.userId,
    job: job._id,
    stage,
    jobUrl: job.url,
    appliedAt: stage === 'saved' ? undefined : new Date(),
    timeline: [{ from: null, to: stage, note: 'Added to tracker' }],
    events: job.closingDate ? [{ type: 'deadline', title: 'Application closes', date: job.closingDate }] : [],
  });
  res.status(201).json({ application: await app.populate('job') });
});

// The single workspace for an application.
router.get('/:id', async (req, res) => {
  const app = await Application.findOne({ _id: req.params.id, user: req.userId })
    .populate('job')
    .populate('resumeVersion', 'label version source createdAt')
    .populate('analysis');
  if (!app) throw notFound('Application');
  const latestAnalysis = await MatchAnalysis.findOne({ user: req.userId, job: app.job._id }).sort({ createdAt: -1 });
  const skills = (app.job.requirements || []).map((r) => r.skill);
  const learningTasks = await LearningTask.find({ user: req.userId, skill: { $in: skills } }).sort({ order: 1 });
  res.json({ application: app, latestAnalysis, learningTasks, freshness: freshness(app.job) });
});

router.patch('/:id', async (req, res) => {
  const app = await findOwned(req.userId, req.params.id);
  for (const key of EDITABLE) if (key in (req.body || {})) app[key] = req.body[key];
  await app.save();
  res.json({ application: app });
});

router.patch('/:id/stage', async (req, res) => {
  const { stage, note, order } = req.body || {};
  if (!STAGES.includes(stage)) throw badRequest(`Stage must be one of: ${STAGES.join(', ')}`);
  const app = await findOwned(req.userId, req.params.id);
  if (app.stage !== stage) {
    app.timeline.push({ from: app.stage, to: stage, note: note || '' });
    if (stage !== 'saved' && stage !== 'rejected' && !app.appliedAt) app.appliedAt = new Date();
    if (stage === 'applied' && !app.events.some((e) => e.type === 'follow_up')) {
      app.events.push({ type: 'follow_up', title: 'Follow up if no response', date: new Date(Date.now() + 7 * 864e5) });
    }
    app.stage = stage;
  }
  if (typeof order === 'number') app.order = order;
  await app.save();
  res.json({ application: app });
});

router.delete('/:id', async (req, res) => {
  const app = await findOwned(req.userId, req.params.id);
  await app.deleteOne();
  res.json({ ok: true });
});

export default router;
