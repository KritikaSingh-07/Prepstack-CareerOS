import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { Resume } from '../models/Resume.js';
import { Application } from '../models/Application.js';
import { MatchAnalysis } from '../models/MatchAnalysis.js';
import { LearningTask } from '../models/LearningTask.js';
import { buildJobDocs } from './jobs.js';
import { SAMPLE_RESUME_TEXT } from './sampleResume.js';
import { parseResumeText } from '../services/resumeParser.js';
import { runAndStoreAnalysis } from '../services/matchContext.js';
import { applyResumeToProfile } from '../routes/resumes.js';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);

export async function seedDatabase() {
  await Promise.all([User, Job, Resume, Application, MatchAnalysis, LearningTask].map((M) => M.deleteMany({})));

  const jobs = await Job.insertMany(buildJobDocs());
  const byCompany = (name) => jobs.find((j) => j.company === name);

  const rahul = new User({
    name: 'Rahul Sharma',
    email: 'rahul@example.com',
    preferences: { targetRoles: ['MERN', 'Full Stack', 'Node.js'], locations: ['Bengaluru', 'Pune'], remote: 'any', experienceLevel: 'junior', weeklyApplicationGoal: 5 },
  });
  await rahul.setPassword('password123');
  await rahul.save();

  const { parsed, issues } = parseResumeText(SAMPLE_RESUME_TEXT);
  const resume = await Resume.create({ user: rahul._id, label: 'General resume', version: 1, source: 'seed', fileName: 'rahul-sharma-resume.pdf', rawText: SAMPLE_RESUME_TEXT, parsed, issues });
  await applyResumeToProfile(rahul, resume);

  // A realistic pipeline spread over the last few weeks.
  const pipeline = [
    { company: 'Brightloop Labs', stage: 'saved', created: 2, history: [] },
    { company: 'Hivepath', stage: 'saved', created: 1, history: [] },
    { company: 'Kitebird Commerce', stage: 'applied', created: 12, history: [['applied', 10]] },
    { company: 'Saffron Health', stage: 'assessment', created: 20, history: [['applied', 18], ['assessment', 6]], event: { type: 'assessment', title: 'Online coding assessment', in: 2 } },
    { company: 'Quillstack', stage: 'interview', created: 26, history: [['applied', 24], ['assessment', 15], ['interview', 4]], event: { type: 'interview', title: 'Technical interview (round 1)', in: 4 } },
    { company: 'Ledgerleaf', stage: 'rejected', created: 30, history: [['applied', 28], ['rejected', 14]] },
    { company: 'Pixelmint Studio', stage: 'applied', created: 5, history: [['applied', 3]] },
  ];

  for (const item of pipeline) {
    const job = byCompany(item.company);
    const analysis = await runAndStoreAnalysis(rahul._id, job);
    const timeline = [{ from: null, to: 'saved', at: daysAgo(item.created), note: 'Saved to shortlist' }];
    let prev = 'saved';
    for (const [to, ago] of item.history) {
      timeline.push({ from: prev, to, at: daysAgo(ago), note: '' });
      prev = to;
    }
    const applied = item.history.find(([s]) => s === 'applied');
    const events = [];
    if (job.closingDate) events.push({ type: 'deadline', title: 'Application closes', date: job.closingDate });
    if (item.event) events.push({ type: item.event.type, title: item.event.title, date: new Date(Date.now() + item.event.in * DAY) });
    const app = await Application.create({
      user: rahul._id,
      job: job._id,
      stage: item.stage,
      jobUrl: job.url,
      appliedAt: applied ? daysAgo(applied[1]) : undefined,
      resumeVersion: applied ? resume._id : undefined,
      analysis: analysis._id,
      timeline,
      events,
      contacts: item.stage === 'interview' ? [{ name: 'Priya (Talent Partner)', role: 'Recruiter', email: 'talent@quillstack.example' }] : [],
      nextAction: item.stage === 'interview'
        ? { text: 'Revise SQL joins and prepare the TaskFlow walkthrough', dueDate: new Date(Date.now() + 3 * DAY) }
        : item.stage === 'saved' ? { text: 'Review skill gaps and tailor resume', dueDate: new Date(Date.now() + 2 * DAY) } : undefined,
    });
    await Application.collection.updateOne({ _id: app._id }, { $set: { createdAt: daysAgo(item.created), updatedAt: daysAgo(item.history.at(-1)?.[1] ?? item.created) } });
  }

  return { users: 1, jobs: jobs.length };
}

// `npm run seed` — seeds the database configured in MONGO_URI.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { connectDB, disconnectDB } = await import('../config/db.js');
  const inMemory = await connectDB();
  if (inMemory) {
    console.log('MONGO_URI is not set. The dev server seeds its in-memory database automatically; set MONGO_URI to seed a persistent database.');
  } else {
    const result = await seedDatabase();
    console.log(`Seeded ${result.jobs} jobs and the demo user rahul@example.com / password123`);
  }
  await disconnectDB();
  await mongoose.disconnect();
}
