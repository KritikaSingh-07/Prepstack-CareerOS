import { Application, STAGES } from '../models/Application.js';
import { LearningTask } from '../models/LearningTask.js';
import { MatchAnalysis } from '../models/MatchAnalysis.js';
import { freshness } from './jobFreshness.js';

const DAY = 24 * 60 * 60 * 1000;
const FOLLOW_UP_AFTER_DAYS = 7;
const reachedStage = (app, stage) => app.stage === stage || app.timeline.some((t) => t.to === stage);

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d;
}

export function weeklyActivity(apps, weeks = 8, now = new Date()) {
  const current = startOfWeek(now);
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(current.getTime() - (weeks - 1 - i) * 7 * DAY);
    return { weekStart: start, applied: 0, saved: 0 };
  });
  for (const app of apps) {
    const add = (date, key) => {
      if (!date) return;
      const ws = startOfWeek(date).getTime();
      const bucket = buckets.find((b) => b.weekStart.getTime() === ws);
      if (bucket) bucket[key] += 1;
    };
    add(app.appliedAt, 'applied');
    add(app.createdAt, 'saved');
  }
  return buckets;
}

export function buildReminders(apps, now = new Date()) {
  const reminders = [];
  const horizon = now.getTime() + 14 * DAY;
  for (const app of apps) {
    const job = app.job || {};
    for (const ev of app.events || []) {
      if (ev.done || !ev.date) continue;
      const t = new Date(ev.date).getTime();
      if (t < now.getTime() - DAY) {
        reminders.push({ kind: 'overdue', applicationId: app._id, date: ev.date, text: `Overdue: ${ev.title} (${job.company})` });
      } else if (t <= horizon) {
        reminders.push({ kind: ev.type, applicationId: app._id, date: ev.date, text: `${ev.title} — ${job.title} at ${job.company}` });
      }
    }
    // Skip when a deadline event already reminds the student about this closing date.
    const hasDeadlineEvent = (app.events || []).some((e) => e.type === 'deadline' && !e.done);
    if (app.stage === 'saved' && job.closingDate && !hasDeadlineEvent) {
      const f = freshness(job, now);
      if (f.state === 'closing_soon') {
        reminders.push({ kind: 'deadline', applicationId: app._id, date: job.closingDate, text: `${job.title} at ${job.company} closes soon and you haven't applied` });
      }
    }
    const lastChange = app.timeline.length ? new Date(app.timeline[app.timeline.length - 1].at) : new Date(app.updatedAt);
    if (app.stage === 'applied' && now - lastChange > FOLLOW_UP_AFTER_DAYS * DAY) {
      reminders.push({
        kind: 'follow_up',
        applicationId: app._id,
        date: now,
        text: `No update from ${job.company} for ${Math.floor((now - lastChange) / DAY)} days — consider a polite follow-up`,
      });
    }
    if (app.nextAction?.text && app.nextAction.dueDate && new Date(app.nextAction.dueDate).getTime() <= horizon) {
      reminders.push({ kind: 'next_action', applicationId: app._id, date: app.nextAction.dueDate, text: `${app.nextAction.text} (${job.company})` });
    }
  }
  return reminders.sort((a, b) => new Date(a.date) - new Date(b.date));
}

export async function buildInsights(userId, preferences = {}) {
  const apps = await Application.find({ user: userId }).populate('job').lean();
  const tasks = await LearningTask.find({ user: userId }).lean();

  const byStage = Object.fromEntries(STAGES.map((s) => [s, apps.filter((a) => a.stage === s).length]));
  const applied = apps.filter((a) => a.appliedAt || ['applied', 'assessment', 'interview', 'offer'].some((s) => reachedStage(a, s)));
  const interviews = applied.filter((a) => reachedStage(a, 'interview') || reachedStage(a, 'offer'));
  const assessments = applied.filter((a) => reachedStage(a, 'assessment'));
  const offers = applied.filter((a) => reachedStage(a, 'offer'));

  // Skills most requested across the student's shortlisted and active jobs.
  const skillCounts = new Map();
  for (const app of apps) {
    for (const req of app.job?.requirements || []) {
      const entry = skillCounts.get(req.skill) || { skill: req.skill, jobs: 0, mandatory: 0 };
      entry.jobs += 1;
      if (req.importance === 'mandatory') entry.mandatory += 1;
      skillCounts.set(req.skill, entry);
    }
  }

  // Gap frequency from each application's latest analysis.
  const jobIds = apps.map((a) => a.job?._id).filter(Boolean);
  const analyses = await MatchAnalysis.find({ user: userId, job: { $in: jobIds } }).sort({ createdAt: -1 }).lean();
  const latestByJob = new Map();
  for (const a of analyses) if (!latestByJob.has(String(a.job))) latestByJob.set(String(a.job), a);
  const gapCounts = new Map();
  for (const analysis of latestByJob.values()) {
    for (const r of analysis.results) {
      if (r.status === 'demonstrated') continue;
      const entry = gapCounts.get(r.skill) || { skill: r.skill, jobs: 0, notEvidenced: 0, partial: 0 };
      entry.jobs += 1;
      entry[r.status === 'partial' ? 'partial' : 'notEvidenced'] += 1;
      gapCounts.set(r.skill, entry);
    }
  }
  const commonGaps = [...gapCounts.values()].sort((a, b) => b.jobs - a.jobs);
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const openTaskSkills = new Set(tasks.filter((t) => t.status !== 'done').map((t) => t.skill));

  const suggestions = [];
  const analysedCount = latestByJob.size;
  for (const gap of commonGaps.slice(0, 3)) {
    if (analysedCount >= 2 && gap.jobs / analysedCount >= 0.4) {
      suggestions.push({
        kind: 'skill_gap',
        skill: gap.skill,
        text: `${gap.jobs} of your ${analysedCount} target jobs ask for ${gap.skill}, and your profile doesn't clearly show it yet.${openTaskSkills.has(gap.skill) ? ' You already have a learning task for it — keep going.' : ` Consider adding a ${gap.skill} task or project to your learning plan.`}`,
      });
    }
  }
  const weekStart = startOfWeek(new Date());
  const appliedThisWeek = applied.filter((a) => a.appliedAt && new Date(a.appliedAt) >= weekStart).length;
  const goal = preferences.weeklyApplicationGoal || 5;
  if (appliedThisWeek < goal) {
    suggestions.push({ kind: 'activity', text: `You've applied to ${appliedThisWeek} of your ${goal} weekly goal. ${byStage.saved ? `You have ${byStage.saved} saved job(s) ready to review.` : 'Browse recommended jobs to build your shortlist.'}` });
  }
  if (applied.length >= 5 && interviews.length === 0) {
    suggestions.push({ kind: 'conversion', text: 'You have several applications but no interviews yet. Review the resume suggestions for your top jobs and tailor a version before the next application.' });
  }

  return {
    totals: {
      tracked: apps.length,
      applied: applied.length,
      assessments: assessments.length,
      interviews: interviews.length,
      offers: offers.length,
      rejected: byStage.rejected,
      appliedThisWeek,
      weeklyGoal: goal,
    },
    conversion: {
      applicationToInterview: applied.length ? interviews.length / applied.length : 0,
      applicationToAssessment: applied.length ? assessments.length / applied.length : 0,
      interviewToOffer: interviews.length ? offers.length / interviews.length : 0,
    },
    byStage,
    weeklyActivity: weeklyActivity(apps),
    topSkills: [...skillCounts.values()].sort((a, b) => b.jobs - a.jobs).slice(0, 10),
    commonGaps: commonGaps.slice(0, 8),
    skillsImproved: doneTasks.map((t) => ({ skill: t.skill, title: t.title, completedAt: t.completedAt })),
    learning: {
      total: tasks.length,
      done: doneTasks.length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    },
    reminders: buildReminders(apps),
    suggestions,
  };
}
