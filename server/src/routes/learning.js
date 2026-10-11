import { Router } from 'express';
import { LearningTask } from '../models/LearningTask.js';
import { MatchAnalysis } from '../models/MatchAnalysis.js';
import { buildLearningPlan, resourcesForSkill } from '../services/prepstack.js';
import { runAndStoreAnalysis } from '../services/matchContext.js';
import { findVisibleJob } from './jobs.js';
import { badRequest, notFound } from '../utils/httpError.js';

const router = Router();

router.get('/', async (req, res) => {
  const tasks = await LearningTask.find({ user: req.userId }).sort({ status: 1, order: 1, createdAt: 1 }).populate('sourceJobs', 'title company');
  res.json({ tasks });
});

// Turns a job's skill gaps into learning tasks linked to the existing Prepstack roadmap.
// Existing open tasks for the same skill are reused, so the student's general roadmap is not restarted.
router.post('/plan', async (req, res) => {
  if (!req.body?.jobId) throw badRequest('jobId is required');
  const job = await findVisibleJob(req.userId, req.body.jobId);
  const analysis = await MatchAnalysis.findOne({ user: req.userId, job: job._id }).sort({ createdAt: -1 })
    || await runAndStoreAnalysis(req.userId, job);
  const planned = await buildLearningPlan(analysis.results);
  const maxOrder = (await LearningTask.findOne({ user: req.userId }).sort({ order: -1 }).select('order'))?.order || 0;

  const created = [];
  const reused = [];
  for (const [i, task] of planned.entries()) {
    const existing = await LearningTask.findOne({ user: req.userId, skill: task.skill, status: { $ne: 'done' } });
    if (existing) {
      existing.sourceJobs.addToSet(job._id);
      await existing.save();
      reused.push(existing);
    } else {
      created.push(await LearningTask.create({ ...task, user: req.userId, order: maxOrder + i + 1, sourceJobs: [job._id] }));
    }
  }
  res.status(201).json({ created, reused, analysisId: analysis._id });
});

router.get('/resources/:skill', async (req, res) => {
  res.json({ resources: await resourcesForSkill(req.params.skill) });
});

router.patch('/:id', async (req, res) => {
  const task = await LearningTask.findOne({ _id: req.params.id, user: req.userId });
  if (!task) throw notFound('Learning task');
  const { status } = req.body || {};
  if (status) {
    if (!['todo', 'in_progress', 'done'].includes(status)) throw badRequest('Invalid status');
    task.status = status;
    task.completedAt = status === 'done' ? new Date() : undefined;
  }
  await task.save();
  res.json({ task });
});

router.delete('/:id', async (req, res) => {
  const result = await LearningTask.deleteOne({ _id: req.params.id, user: req.userId });
  if (!result.deletedCount) throw notFound('Learning task');
  res.json({ ok: true });
});

export default router;
