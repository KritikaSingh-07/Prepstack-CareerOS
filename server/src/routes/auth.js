import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { badRequest, HttpError } from '../utils/httpError.js';
import { env } from '../config/env.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.isTest ? 1000 : 50, standardHeaders: true, legacyHeaders: false });

router.post('/register', limiter, async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) throw badRequest('Name, email and password are required');
  if (String(password).length < 8) throw badRequest('Password must be at least 8 characters');
  if (await User.exists({ email: String(email).toLowerCase() })) throw new HttpError(409, 'An account with this email already exists');
  const user = new User({ name, email, profile: { skills: [], projects: [], experience: [], education: [] } });
  await user.setPassword(password);
  await user.save();
  res.status(201).json({ token: signToken(user), user });
});

router.post('/login', limiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw badRequest('Email and password are required');
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+passwordHash');
  if (!user || !(await user.checkPassword(password))) throw new HttpError(401, 'Incorrect email or password');
  res.json({ token: signToken(user), user });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, 'Account no longer exists');
  res.json({ user });
});

export default router;
