import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { seedDatabase } from './seed/seed.js';

if (process.env.NODE_ENV === 'production') {
  if (!env.mongoUri) throw new Error('MONGO_URI is required in production.');
  if (env.jwtSecret === 'dev-secret-please-change') throw new Error('Set a strong JWT_SECRET in production.');
}

const inMemory = await connectDB();
if (inMemory) {
  await seedDatabase();
  console.log('Using an in-memory MongoDB (MONGO_URI not set). Demo data seeded; changes are lost on restart.');
  console.log('Demo login: rahul@example.com / password123');
}

createApp().listen(env.port, () => {
  console.log(`Prepstack CareerOS API listening on http://localhost:${env.port}`);
});
