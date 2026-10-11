import { Router } from 'express';
import { User } from '../models/User.js';
import { canonicalName } from '../services/skills/taxonomy.js';
import { extractSkills } from '../services/skills/extractor.js';
import { notFound } from '../utils/httpError.js';

const router = Router();

router.get('/', async (req, res) => {
  const user = await User.findById(req.userId).populate('primaryResume', 'label version createdAt');
  if (!user) throw notFound('User');
  res.json({ user });
});

router.put('/', async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw notFound('User');
  const { name, profile, preferences } = req.body || {};
  if (name) user.name = name;
  if (profile) {
    const next = { ...(user.toObject().profile || {}), ...profile };
    next.skills = [...new Set((next.skills || []).map(canonicalName).filter(Boolean))];
    // Keep detected technologies in sync with what the student wrote.
    next.projects = (next.projects || []).map((p) => ({
      ...p,
      technologies: [...new Set([...(p.technologies || []).map(canonicalName), ...extractSkills([p.name, p.description, ...(p.bullets || [])].join(' '))])],
    }));
    next.experience = (next.experience || []).map((e) => ({
      ...e,
      technologies: [...new Set([...(e.technologies || []).map(canonicalName), ...extractSkills([e.title, ...(e.bullets || [])].join(' '))])],
    }));
    user.profile = next;
  }
  if (preferences) user.preferences = { ...(user.toObject().preferences || {}), ...preferences };
  await user.save();
  res.json({ user });
});

export default router;
