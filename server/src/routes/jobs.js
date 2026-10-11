import { Router } from 'express';
import { Job } from '../models/Job.js';
import { Application } from '../models/Application.js';
import { MatchAnalysis } from '../models/MatchAnalysis.js';
import { freshness } from '../services/jobFreshness.js';
import { recommendJobs } from '../services/recommender.js';
import { analyzeMatch } from '../services/matchEngine.js';
import { loadMatchContext, runAndStoreAnalysis } from '../services/matchContext.js';
import { deriveRequirements } from '../services/skills/extractor.js';
import { canonicalName } from '../services/skills/taxonomy.js';
import { badRequest, notFound } from '../utils/httpError.js';

const router = Router();

const visibleTo = (userId) => ({ $or: [{ createdBy: null }, { createdBy: userId }] });
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function findVisibleJob(userId, jobId) {
  const job = await Job.findOne({ _id: jobId, ...visibleTo(userId) });
  if (!job) throw notFound('Job');
  return job;
}

function buildFilter(userId, query) {
  const filter = { $and: [visibleTo(userId)] };
  if (query.q) {
    const re = new RegExp(escapeRegex(String(query.q)), 'i');
    filter.$and.push({ $or: [{ title: re }, { company: re }, { description: re }] });
  }
  if (query.role) filter.$and.push({ $or: [{ roleCategory: query.role }, { title: new RegExp(escapeRegex(query.role), 'i') }] });
  if (query.level) filter.$and.push({ experienceLevel: { $in: String(query.level).split(',') } });
  if (query.workMode) filter.$and.push({ workMode: { $in: String(query.workMode).split(',') } });
  if (query.location) filter.$and.push({ location: new RegExp(escapeRegex(query.location), 'i') });
  if (query.skills) {
    const skills = String(query.skills).split(',').map((s) => canonicalName(s.trim())).filter(Boolean);
    filter.$and.push({ 'requirements.skill': { $all: skills } });
  }
  if (query.includeClosed !== 'true') filter.$and.push({ status: 'open' });
  return filter;
}

router.get('/meta/filters', async (req, res) => {
  const match = visibleTo(req.userId);
  const [locations, roles, skills] = await Promise.all([
    Job.distinct('location', match),
    Job.distinct('roleCategory', match),
    Job.distinct('requirements.skill', match),
  ]);
  res.json({ locations: locations.filter(Boolean).sort(), roles: roles.sort(), skills: skills.sort(), levels: ['internship', 'entry', 'junior', 'mid'], workModes: ['remote', 'hybrid', 'onsite'] });
});

router.get('/recommended', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const ctx = await loadMatchContext(req.userId);
  const jobs = await Job.find({ ...visibleTo(req.userId), status: 'open' }).lean();
  const saved = await Application.find({ user: req.userId }).select('job stage').lean();
  const savedMap = new Map(saved.map((a) => [String(a.job), a]));
  const ranked = recommendJobs(jobs, { profile: ctx.profile, preferences: ctx.user.preferences, completedLearning: ctx.completedLearning })
    .filter((r) => r.freshness.state !== 'closed')
    .slice(0, limit)
    .map((r) => ({ ...r, application: savedMap.get(String(r.job._id)) || null }));
  res.json({ items: ranked, hasProfile: Boolean(ctx.profile.skills?.length || ctx.profile.projects?.length) });
});

router.get('/', async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const filter = buildFilter(req.userId, req.query);
  const sort = req.query.sort === 'closing' ? { closingDate: 1 } : { postedAt: -1 };
  const [jobs, total, ctx, saved] = await Promise.all([
    Job.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Job.countDocuments(filter),
    loadMatchContext(req.userId),
    Application.find({ user: req.userId }).select('job stage').lean(),
  ]);
  const savedMap = new Map(saved.map((a) => [String(a.job), a]));
  let items = jobs.map((job) => ({
    job,
    freshness: freshness(job),
    fit: analyzeMatch({ profile: ctx.profile, job, completedLearning: ctx.completedLearning }).summary,
    application: savedMap.get(String(job._id)) || null,
  }));
  if (req.query.sort === 'fit') items = items.sort((a, b) => b.fit.fitScore - a.fit.fitScore);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

// Students can add a job they found elsewhere; requirements are derived from the description.
router.post('/', async (req, res) => {
  const { title, company, description, url, location, workMode, experienceLevel, closingDate, requirements } = req.body || {};
  if (!title || !company || !description) throw badRequest('Title, company and description are required');
  const reqs = Array.isArray(requirements) && requirements.length
    ? requirements.map((r) => ({ skill: canonicalName(r.skill), importance: r.importance === 'preferred' ? 'preferred' : 'mandatory' }))
    : deriveRequirements(description);
  const job = await Job.create({
    title, company, description, url, location, workMode, experienceLevel, closingDate,
    requirements: reqs,
    source: 'Added by you',
    createdBy: req.userId,
    lastVerifiedAt: new Date(),
  });
  res.status(201).json({ job, freshness: freshness(job) });
});

router.get('/:id', async (req, res) => {
  const job = await findVisibleJob(req.userId, req.params.id);
  const [latestAnalysis, application] = await Promise.all([
    MatchAnalysis.findOne({ user: req.userId, job: job._id }).sort({ createdAt: -1 }),
    Application.findOne({ user: req.userId, job: job._id }).select('stage _id'),
  ]);
  res.json({ job, freshness: freshness(job), latestAnalysis, application });
});

router.post('/:id/analyze', async (req, res) => {
  const job = await findVisibleJob(req.userId, req.params.id);
  const analysis = await runAndStoreAnalysis(req.userId, job, req.body?.resumeId);
  await Application.updateOne({ user: req.userId, job: job._id }, { analysis: analysis._id });
  res.status(201).json({ analysis });
});

router.get('/:id/analyses', async (req, res) => {
  const job = await findVisibleJob(req.userId, req.params.id);
  const analyses = await MatchAnalysis.find({ user: req.userId, job: job._id }).sort({ createdAt: -1 }).populate('resume', 'label version').select('summary resume createdAt');
  res.json({ analyses });
});

router.post('/:id/save', async (req, res) => {
  const job = await findVisibleJob(req.userId, req.params.id);
  let app = await Application.findOne({ user: req.userId, job: job._id });
  if (!app) {
    const analysis = await MatchAnalysis.findOne({ user: req.userId, job: job._id }).sort({ createdAt: -1 });
    app = await Application.create({
      user: req.userId,
      job: job._id,
      stage: 'saved',
      jobUrl: job.url,
      analysis: analysis?._id,
      timeline: [{ from: null, to: 'saved', note: 'Saved to shortlist' }],
      events: job.closingDate ? [{ type: 'deadline', title: 'Application closes', date: job.closingDate }] : [],
    });
  }
  res.status(201).json({ application: app });
});

router.delete('/:id/save', async (req, res) => {
  const result = await Application.deleteOne({ user: req.userId, job: req.params.id, stage: 'saved' });
  if (!result.deletedCount) throw badRequest('Only applications still in "Saved" can be removed from the shortlist');
  res.json({ ok: true });
});

export default router;
