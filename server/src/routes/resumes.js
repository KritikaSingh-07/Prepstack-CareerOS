import { Router } from 'express';
import multer from 'multer';
import { Resume } from '../models/Resume.js';
import { User } from '../models/User.js';
import { Application } from '../models/Application.js';
import { parseResumeText, extractPdfText, findIssues } from '../services/resumeParser.js';
import { extractSkills } from '../services/skills/extractor.js';
import { runAndStoreAnalysis } from '../services/matchContext.js';
import { findVisibleJob } from './jobs.js';
import { badRequest, notFound } from '../utils/httpError.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || file.mimetype === 'text/plain';
    cb(ok ? null : badRequest('Upload a PDF (or plain-text) resume'), ok);
  },
});

const nextVersion = async (userId) => ((await Resume.findOne({ user: userId }).sort({ version: -1 }).select('version'))?.version || 0) + 1;

/** Copies a resume's structured data into the student's editable profile. */
export async function applyResumeToProfile(user, resume) {
  const current = user.toObject().profile || {};
  user.profile = {
    ...current,
    summary: resume.parsed.summary || current.summary,
    skills: [...new Set([...(resume.parsed.skills || []), ...(current.skills || [])])],
    education: resume.parsed.education,
    experience: resume.parsed.experience,
    projects: resume.parsed.projects,
    links: resume.parsed.contact?.links || current.links,
  };
  user.primaryResume = resume._id;
  await user.save();
}

/** Renders structured resume data back to plain text (used for tailored versions). */
function renderText(parsed) {
  const lines = [parsed.contact?.name, [parsed.contact?.email, parsed.contact?.phone].filter(Boolean).join(' | '), ...(parsed.contact?.links || [])];
  if (parsed.summary) lines.push('', 'Summary', parsed.summary);
  if (parsed.education?.length) lines.push('', 'Education', ...parsed.education.map((e) => [e.degree, e.institution, e.endDate, e.score].filter(Boolean).join(' | ')));
  if (parsed.experience?.length) {
    lines.push('', 'Experience');
    for (const e of parsed.experience) lines.push([e.title, e.organization, [e.startDate, e.endDate].filter(Boolean).join(' – ')].filter(Boolean).join(' | '), ...(e.bullets || []).map((b) => `• ${b}`));
  }
  if (parsed.projects?.length) {
    lines.push('', 'Projects');
    for (const p of parsed.projects) lines.push([p.name, (p.technologies || []).join(', ')].filter(Boolean).join(' | '), ...(p.bullets || []).map((b) => `• ${b}`));
  }
  if (parsed.skills?.length) lines.push('', 'Skills', parsed.skills.join(', '));
  return lines.filter((l) => l !== undefined).join('\n');
}

router.get('/', async (req, res) => {
  const user = await User.findById(req.userId).select('primaryResume');
  const resumes = await Resume.find({ user: req.userId }).sort({ version: -1 }).populate('targetJob', 'title company').select('-rawText');
  res.json({ resumes, primaryResume: user?.primaryResume });
});

router.post('/upload', upload.single('resume'), async (req, res) => {
  if (!req.file) throw badRequest('Attach a resume file in the "resume" field');
  let rawText;
  try {
    rawText = req.file.mimetype === 'application/pdf' ? await extractPdfText(req.file.buffer) : req.file.buffer.toString('utf8');
  } catch {
    throw badRequest('This PDF could not be read. Try re-exporting it from your editor as a standard PDF.');
  }
  if (rawText.trim().length < 50) throw badRequest('Could not read text from this file. If it is a scanned image, export a text-based PDF instead.');
  const { parsed, issues } = parseResumeText(rawText);
  const version = await nextVersion(req.userId);
  const resume = await Resume.create({
    user: req.userId,
    label: req.body.label || `Resume v${version}`,
    version,
    source: 'upload',
    fileName: req.file.originalname,
    rawText,
    parsed,
    issues,
  });
  const user = await User.findById(req.userId);
  if (req.body.applyToProfile !== 'false' || !user.primaryResume) await applyResumeToProfile(user, resume);
  res.status(201).json({ resume, appliedToProfile: String(user.primaryResume) === String(resume._id) });
});

router.get('/:id', async (req, res) => {
  const resume = await Resume.findOne({ _id: req.params.id, user: req.userId }).populate('targetJob', 'title company');
  if (!resume) throw notFound('Resume');
  res.json({ resume });
});

router.post('/:id/primary', async (req, res) => {
  const resume = await Resume.findOne({ _id: req.params.id, user: req.userId });
  if (!resume) throw notFound('Resume');
  const user = await User.findById(req.userId);
  await applyResumeToProfile(user, resume);
  res.json({ user });
});

// Compare this specific resume version against a job description.
router.post('/:id/compare', async (req, res) => {
  const resume = await Resume.findOne({ _id: req.params.id, user: req.userId });
  if (!resume) throw notFound('Resume');
  if (!req.body?.jobId) throw badRequest('jobId is required');
  const job = await findVisibleJob(req.userId, req.body.jobId);
  const analysis = await runAndStoreAnalysis(req.userId, job, resume._id);
  res.status(201).json({ analysis });
});

// Save an edited, job-specific version (e.g. after accepting Copilot bullet suggestions).
router.post('/:id/tailor', async (req, res) => {
  const base = await Resume.findOne({ _id: req.params.id, user: req.userId });
  if (!base) throw notFound('Resume');
  const { label, jobId, applicationId, parsed: edits = {} } = req.body || {};
  const job = jobId ? await findVisibleJob(req.userId, jobId) : null;
  const parsed = { ...base.toObject().parsed, ...edits };
  for (const list of ['experience', 'projects']) {
    parsed[list] = (parsed[list] || []).map((e) => ({ ...e, technologies: extractSkills([e.title, e.name, e.description, ...(e.bullets || []), ...(e.technologies || [])].join(' ')) }));
  }
  const version = await nextVersion(req.userId);
  const resume = await Resume.create({
    user: req.userId,
    label: label || `${base.label} — tailored${job ? ` for ${job.company}` : ''}`,
    version,
    source: 'tailored',
    basedOn: base._id,
    targetJob: job?._id,
    fileName: base.fileName,
    rawText: renderText(parsed),
    parsed,
    issues: findIssues(parsed),
  });
  if (applicationId) await Application.updateOne({ _id: applicationId, user: req.userId }, { resumeVersion: resume._id });
  res.status(201).json({ resume });
});

router.delete('/:id', async (req, res) => {
  const user = await User.findById(req.userId).select('primaryResume');
  if (String(user.primaryResume) === req.params.id) throw badRequest('Choose another primary resume before deleting this one');
  const result = await Resume.deleteOne({ _id: req.params.id, user: req.userId });
  if (!result.deletedCount) throw notFound('Resume');
  await Application.updateMany({ user: req.userId, resumeVersion: req.params.id }, { $unset: { resumeVersion: 1 } });
  res.json({ ok: true });
});

export default router;
