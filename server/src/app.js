import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { User } from './models/User.js';
import { buildInsights } from './services/insights.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import jobRoutes from './routes/jobs.js';
import resumeRoutes from './routes/resumes.js';
import applicationRoutes from './routes/applications.js';
import learningRoutes from './routes/learning.js';
import copilotRoutes from './routes/copilot.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json({ limit: '1mb' }));
  if (!env.isTest) app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/profile', requireAuth, profileRoutes);
  app.use('/api/jobs', requireAuth, jobRoutes);
  app.use('/api/resumes', requireAuth, resumeRoutes);
  app.use('/api/applications', requireAuth, applicationRoutes);
  app.use('/api/learning', requireAuth, learningRoutes);
  app.use('/api/copilot', requireAuth, copilotRoutes);
  app.get('/api/insights', requireAuth, async (req, res) => {
    const user = await User.findById(req.userId).select('preferences');
    res.json(await buildInsights(req.userId, user?.preferences));
  });

  app.use('/api', notFoundHandler);

  // In production the API also serves the built React client.
  const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));
  if (process.env.NODE_ENV === 'production' && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
