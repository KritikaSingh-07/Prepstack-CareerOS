import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = '';

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { createApp } = await import('../src/app.js');
const { seedDatabase } = await import('../src/seed/seed.js');
const { SAMPLE_RESUME_TEXT } = await import('../src/seed/sampleResume.js');

let server;
let base;
let token;

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const data = await res.json();
  return { status: res.status, data };
}

before(async () => {
  await connectDB();
  await seedDatabase();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server?.close();
  await disconnectDB();
});

test('auth: rejects bad credentials and logs in the demo user', async () => {
  assert.equal((await api('/auth/login', { method: 'POST', body: { email: 'rahul@example.com', password: 'wrong-password' } })).status, 401);
  const { status, data } = await api('/auth/login', { method: 'POST', body: { email: 'rahul@example.com', password: 'password123' } });
  assert.equal(status, 200);
  token = data.token;
  assert.equal((await api('/auth/me')).data.user.email, 'rahul@example.com');
});

test('discover: recommended jobs are ranked and explained, closed jobs hidden', async () => {
  const { data } = await api('/jobs/recommended?limit=50');
  assert.ok(data.items.length > 5);
  assert.ok(data.items.every((i) => i.freshness.state !== 'closed'));
  assert.ok(data.items[0].reasons.length > 0);
  for (let i = 1; i < data.items.length; i += 1) assert.ok(data.items[i - 1].score >= data.items[i].score);
  const filtered = await api('/jobs?workMode=remote&skills=React');
  assert.ok(filtered.data.items.every((i) => i.job.workMode === 'remote' && i.job.requirements.some((r) => r.skill === 'React')));
});

test('end-to-end: analyse a job, build a learning plan, track and prepare an application', async () => {
  const list = await api('/jobs?q=Brightloop');
  const job = list.data.items[0].job;
  const versionsBefore = (await api(`/jobs/${job._id}/analyses`)).data.analyses.length;

  const analysis = (await api(`/jobs/${job._id}/analyze`, { method: 'POST', body: {} })).data.analysis;
  const status = Object.fromEntries(analysis.results.map((r) => [r.skill, r.status]));
  assert.equal(status.React, 'demonstrated');
  assert.equal(status['Automated Testing'], 'partial');
  assert.equal(status.Docker, 'not_evidenced');

  const plan = (await api('/learning/plan', { method: 'POST', body: { jobId: job._id } })).data;
  const docker = plan.created.find((t) => t.skill === 'Docker');
  assert.ok(docker.prepstack.roadmapUrl.includes('/roadmap/docker'));
  // Planning again reuses tasks instead of creating duplicates.
  assert.equal((await api('/learning/plan', { method: 'POST', body: { jobId: job._id } })).data.created.length, 0);

  // Completing the Docker task upgrades Docker to partial evidence on re-analysis.
  await api(`/learning/${docker._id}`, { method: 'PATCH', body: { status: 'done' } });
  const reanalysed = (await api(`/jobs/${job._id}/analyze`, { method: 'POST', body: {} })).data.analysis;
  assert.equal(reanalysed.results.find((r) => r.skill === 'Docker').status, 'partial');
  assert.equal((await api(`/jobs/${job._id}/analyses`)).data.analyses.length, versionsBefore + 2, 'analyses are versioned');

  const apps = (await api('/applications')).data.items;
  const app = apps.find((a) => a.job._id === job._id);
  assert.equal(app.stage, 'saved');

  const moved = (await api(`/applications/${app._id}/stage`, { method: 'PATCH', body: { stage: 'applied' } })).data.application;
  assert.equal(moved.stage, 'applied');
  assert.ok(moved.appliedAt);
  assert.equal(moved.timeline.at(-1).to, 'applied');

  const letter = (await api(`/copilot/${app._id}/cover-letter`, { method: 'POST' })).data;
  assert.equal(letter.generatedBy, 'template');
  assert.match(letter.text, /Brightloop Labs/);
  assert.ok(!/Docker/.test(letter.text), 'cover letter must not claim unevidenced skills');

  const checklist = (await api(`/copilot/${app._id}/checklist`, { method: 'POST' })).data.checklist;
  assert.ok(checklist.length >= 5);
  const pack = (await api(`/copilot/${app._id}/interview-pack`, { method: 'POST' })).data.interviewPack;
  assert.ok(pack.topics.length > 0 && pack.mockInterviewUrl.includes('/mock-interview'));

  const workspace = (await api(`/applications/${app._id}`)).data;
  assert.ok(workspace.latestAnalysis);
  assert.ok(workspace.application.interviewPack);
  assert.ok(workspace.learningTasks.some((t) => t.skill === 'Docker'));
});

test('resume: upload a text resume, compare it to a job and save a tailored version', async () => {
  const form = new FormData();
  form.append('resume', new Blob([SAMPLE_RESUME_TEXT.replace('Manually tested', 'Wrote Jest unit tests for')], { type: 'text/plain' }), 'resume.txt');
  form.append('label', 'Testing-focused');
  form.append('applyToProfile', 'false');
  const uploaded = await api('/resumes/upload', { method: 'POST', form });
  assert.equal(uploaded.status, 201);
  const resume = uploaded.data.resume;
  assert.equal(resume.version, 2);

  const job = (await api('/jobs?q=Brightloop')).data.items[0].job;
  const analysis = (await api(`/resumes/${resume._id}/compare`, { method: 'POST', body: { jobId: job._id } })).data.analysis;
  assert.equal(analysis.results.find((r) => r.skill === 'Automated Testing').status, 'demonstrated');

  const tailored = (await api(`/resumes/${resume._id}/tailor`, { method: 'POST', body: { jobId: job._id } })).data.resume;
  assert.equal(tailored.source, 'tailored');
  assert.equal(tailored.version, 3);
});

test('insights: totals, conversion and reminders', async () => {
  const { data } = await api('/insights');
  assert.ok(data.totals.applied >= 5);
  assert.ok(data.totals.interviews >= 1);
  assert.ok(data.conversion.applicationToInterview > 0);
  assert.equal(data.weeklyActivity.length, 8);
  assert.ok(data.topSkills.length > 0);
  assert.ok(data.reminders.some((r) => r.kind === 'interview' || r.kind === 'assessment'));
  assert.ok(data.skillsImproved.some((s) => s.skill === 'Docker'));
});

test('jobs added by a student are private to that student', async () => {
  const created = (await api('/jobs', { method: 'POST', body: { title: 'Node Dev', company: 'Private Co', description: 'Requirements\n- Node.js\nNice to have\n- Docker' } })).data.job;
  assert.deepEqual(created.requirements.map((r) => r.importance), ['mandatory', 'preferred']);
  const other = await api('/auth/register', { method: 'POST', body: { name: 'Asha', email: 'asha@example.com', password: 'password123' } });
  const saved = token;
  token = other.data.token;
  assert.equal((await api(`/jobs/${created._id}`)).status, 404);
  token = saved;
});
