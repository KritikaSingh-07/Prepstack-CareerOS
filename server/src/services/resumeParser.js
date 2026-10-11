import { extractSkills, mentionsSkill } from './skills/extractor.js';

const SECTION_PATTERNS = {
  summary: /^(summary|profile|objective|about me|professional summary)$/i,
  education: /^(education|academic background|academics|qualifications)$/i,
  experience: /^(experience|work experience|professional experience|employment|internships?|work history)$/i,
  projects: /^(projects|personal projects|academic projects|key projects)$/i,
  skills: /^(skills|technical skills|tech stack|technologies|core skills|skills & tools)$/i,
  certifications: /^(certifications?|courses|certificates)$/i,
  achievements: /^(achievements|awards|accomplishments|extracurriculars?|activities)$/i,
};

const BULLET = /^[-*•▪●◦‣–]\s*/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(\+?\d[\d\s().-]{8,}\d)/;
const URL = /(https?:\/\/[^\s]+|(?:www\.)?(?:linkedin\.com|github\.com)\/[^\s]+)/gi;
const DATE_RANGE = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\b(?:19|20)\d{2}\b)\s*(?:[-–—]|to)\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\b(?:19|20)\d{2}\b|present|current|now)/i;
const YEAR = /\b(?:19|20)\d{2}\b/;
const WEAK_STARTS = /^(worked on|responsible for|helped|assisted|involved in|participated in|did|made|handled)\b/i;

function detectSection(line) {
  const clean = line.replace(/[:|]/g, '').trim();
  if (clean.length > 40) return null;
  for (const [key, re] of Object.entries(SECTION_PATTERNS)) {
    if (re.test(clean)) return key;
  }
  return null;
}

/** Splits a section's lines into entries: a non-bullet line following bullets starts a new entry. */
function splitEntries(lines) {
  const entries = [];
  let current = null;
  for (const line of lines) {
    const isBullet = BULLET.test(line);
    // PDF extraction wraps long bullets; a lowercase continuation line belongs to the previous bullet.
    if (!isBullet && current?.bullets.length && /^[a-z(]/.test(line)) {
      current.bullets[current.bullets.length - 1] += ` ${line}`;
      continue;
    }
    if (!isBullet && (!current || current.bullets.length > 0)) {
      current = { headerLines: [line], bullets: [] };
      entries.push(current);
    } else if (!isBullet) {
      current.headerLines.push(line);
    } else {
      if (!current) {
        current = { headerLines: [], bullets: [] };
        entries.push(current);
      }
      current.bullets.push(line.replace(BULLET, '').trim());
    }
  }
  return entries;
}

function toExperience(entry) {
  const header = entry.headerLines.join(' | ');
  const dates = header.match(DATE_RANGE);
  const [first = '', second = ''] = entry.headerLines.map((l) => l.replace(DATE_RANGE, '').replace(/[|,–-]\s*$/, '').trim()).filter(Boolean);
  let title = first;
  let organization = second;
  // "Software Intern, Acme Corp" or "Software Intern at Acme Corp" on a single line.
  const split = first.match(/^(.+?)(?:\s+(?:at|@)\s+|\s*[,|]\s*|\s+[–-]\s+)(.+)$/);
  if (!second && split) [, title, organization] = split;
  const text = [header, ...entry.bullets].join(' ');
  return {
    title: title.trim(),
    organization: organization.trim(),
    startDate: dates?.[1] || '',
    endDate: dates?.[2] || '',
    bullets: entry.bullets,
    technologies: extractSkills(text),
  };
}

function toProject(entry) {
  const header = entry.headerLines.join(' ');
  const urls = header.match(URL) || [];
  const [namePart, techPart = ''] = header.replace(URL, '').split(/\s[|–—-]\s|:\s/);
  const description = entry.bullets.join(' ');
  return {
    name: namePart.trim() || 'Untitled project',
    description,
    bullets: entry.bullets,
    technologies: [...new Set([...extractSkills(techPart), ...extractSkills(`${header} ${description}`)])],
    url: urls[0] || '',
  };
}

function toEducation(entry) {
  const lines = [...entry.headerLines, ...entry.bullets];
  const text = lines.join(' ');
  const degreeLine = lines.find((l) => /(b\.?tech|b\.?e\b|bachelor|master|m\.?tech|b\.?sc|m\.?sc|bca|mca|diploma|ph\.?d|degree|high school|class xii|12th)/i.test(l));
  const institutionLine = lines.find((l) => /(university|college|institute|school|iit|nit|iiit)/i.test(l));
  const gpa = text.match(/(cgpa|gpa|percentage)[:\s]*([\d.]+\s*(?:\/\s*[\d.]+|%)?)/i);
  const dates = text.match(DATE_RANGE);
  return {
    degree: (degreeLine || entry.headerLines[0] || '').replace(DATE_RANGE, '').trim(),
    institution: (institutionLine && institutionLine !== degreeLine ? institutionLine : '').replace(DATE_RANGE, '').replace(/[\s,|–-]+$/, '').trim(),
    startDate: dates?.[1] || '',
    endDate: dates?.[2] || text.match(YEAR)?.[0] || '',
    score: gpa ? gpa[2].trim() : '',
  };
}

/**
 * Identifies missing or unclear information. Every issue is phrased as something the student
 * can act on, never as a generic score.
 */
export function findIssues(parsed) {
  const issues = [];
  const add = (severity, field, message, suggestion) => issues.push({ severity, field, message, suggestion });

  if (!parsed.contact.email) add('high', 'contact', 'No email address was found.', 'Add a professional email address at the top of your resume.');
  if (!parsed.contact.phone) add('medium', 'contact', 'No phone number was found.', 'Add a phone number recruiters can reach you on.');
  if (!parsed.contact.links.some((l) => /github|linkedin/i.test(l))) {
    add('low', 'contact', 'No GitHub or LinkedIn link was found.', 'Link your GitHub so reviewers can verify your project work.');
  }
  if (parsed.education.length === 0) add('medium', 'education', 'No education section was detected.', 'Add your degree, institution and graduation year.');
  if (parsed.projects.length === 0 && parsed.experience.length === 0) {
    add('high', 'projects', 'No projects or experience were detected.', 'Add at least two projects describing what you built and which technologies you used.');
  }

  for (const exp of parsed.experience) {
    if (!exp.startDate && !exp.endDate) add('low', 'experience', `"${exp.title || exp.organization}" has no dates.`, 'Add start and end dates (e.g. "Jun 2024 – Aug 2024").');
  }

  const allBullets = [...parsed.experience, ...parsed.projects].flatMap((e) => e.bullets);
  const unquantified = allBullets.filter((b) => !/\d/.test(b));
  if (allBullets.length > 0 && unquantified.length / allBullets.length > 0.6) {
    add('medium', 'impact', `${unquantified.length} of ${allBullets.length} bullet points have no measurable outcome.`,
      'Where you genuinely have a number (users, response time, test coverage, records handled), include it. Do not invent figures.');
  }
  const weak = allBullets.filter((b) => WEAK_STARTS.test(b));
  if (weak.length) {
    add('low', 'wording', `${weak.length} bullet point(s) start with vague phrases such as "worked on" or "responsible for".`,
      'Start with what you did: "Built", "Designed", "Implemented", "Reduced".');
  }

  for (const project of parsed.projects) {
    if (project.bullets.length === 0 && project.description.length < 40) {
      add('medium', 'projects', `Project "${project.name}" has little or no description.`, 'Describe the problem, what you built and the technologies used.');
    }
  }

  // Skills claimed in the skills list but never shown in a project or role.
  const evidenceText = [...parsed.experience, ...parsed.projects].map((e) => [e.title, e.name, e.description, ...e.bullets].join(' ')).join(' ');
  const unevidenced = parsed.skills.filter((s) => !mentionsSkill(evidenceText, s));
  if (unevidenced.length) {
    add('medium', 'skills', `Listed but not demonstrated in any project or role: ${unevidenced.join(', ')}.`,
      'Mention where you used these skills in a project or role bullet, or remove them if you have not used them.');
  }
  return issues;
}

/** Turns raw resume text into a structured profile. */
export function parseResumeText(rawText = '') {
  const lines = rawText.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

  const sections = { header: [] };
  let current = 'header';
  for (const line of lines) {
    const section = detectSection(line);
    if (section) {
      current = section;
      sections[current] = sections[current] || [];
    } else {
      sections[current].push(line);
    }
  }

  const headerText = sections.header.join(' ');
  const contact = {
    name: sections.header.find((l) => !EMAIL.test(l) && !PHONE.test(l) && l.split(' ').length <= 5) || '',
    email: (rawText.match(EMAIL) || [''])[0],
    phone: ((headerText || rawText).match(PHONE) || [''])[0].trim(),
    links: [...new Set(rawText.match(URL) || [])],
  };

  const skillsListText = (sections.skills || []).join(', ');
  const parsed = {
    contact,
    summary: (sections.summary || []).join(' '),
    education: splitEntries(sections.education || []).map(toEducation),
    experience: splitEntries(sections.experience || []).map(toExperience),
    projects: splitEntries(sections.projects || []).map(toProject),
    skills: extractSkills(skillsListText),
    certifications: (sections.certifications || []).map((l) => l.replace(BULLET, '')),
    achievements: (sections.achievements || []).map((l) => l.replace(BULLET, '')),
  };
  // Skills detected anywhere in the document (including projects/experience).
  parsed.allSkills = extractSkills(rawText);
  if (parsed.skills.length === 0) parsed.skills = parsed.allSkills;
  return { parsed, issues: findIssues(parsed) };
}

export async function extractPdfText(buffer) {
  // Importing the lib entry directly avoids pdf-parse's debug-mode self test in index.js.
  const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
  const result = await pdfParse(buffer);
  return result.text || '';
}
