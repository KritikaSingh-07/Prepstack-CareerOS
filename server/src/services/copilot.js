// Application Copilot: helps students prepare job-specific applications using only verified profile facts.
// Every output is a draft the student reviews and edits; nothing is submitted on their behalf.

import { canonicalName } from './skills/taxonomy.js';
import { mentionsSkill } from './skills/extractor.js';
import { resourcesForSkill } from './prepstack.js';
import { generateText } from './llm.js';
import { env } from '../config/env.js';

const WEAK_START = /^(worked on|responsible for|helped( to)?|assisted( in| with)?|involved in|participated in|did|made|handled)\s+/i;
const STRONG_VERB = {
  'worked on': 'Built', 'responsible for': 'Owned', helped: 'Contributed to', 'helped to': 'Contributed to',
  assisted: 'Supported', 'assisted in': 'Supported', 'assisted with': 'Supported', 'involved in': 'Contributed to',
  'participated in': 'Contributed to', did: 'Delivered', made: 'Built', handled: 'Managed',
};

const GROUNDING_RULES = `Rules you must follow:
- Use only facts present in the PROFILE JSON. Never invent employers, projects, metrics, dates, or technologies.
- If a strong statement would need a fact that is missing, write a bracketed placeholder such as [add a measurable result] instead of making one up.
- Do not claim skills the profile marks as not evidenced.
- Plain text only, no markdown headings.`;

function requirementSkills(job) {
  return (job.requirements || []).map((r) => ({ skill: canonicalName(r.skill), importance: r.importance }));
}

function projectText(p) {
  return [p.name, p.description, ...(p.bullets || []), ...(p.technologies || [])].join(' ');
}

/** Ranks the student's projects by how well they demonstrate the job's requirements. */
export function selectProjects(profile, job, limit = 3) {
  const reqs = requirementSkills(job);
  const scored = (profile.projects || []).map((p) => {
    const text = projectText(p);
    const matched = reqs.filter((r) => (p.technologies || []).map(canonicalName).includes(r.skill) || mentionsSkill(text, r.skill));
    const score = matched.reduce((s, r) => s + (r.importance === 'mandatory' ? 2 : 1), 0);
    return {
      name: p.name,
      url: p.url,
      matchedSkills: matched.map((r) => r.skill),
      score,
      talkingPoint: matched.length
        ? `Use "${p.name}" to show ${matched.map((r) => r.skill).join(', ')}. Explain the problem, your design decisions and what you would improve.`
        : `"${p.name}" does not directly show this job's requirements.`,
    };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Suggests clearer, job-relevant bullet rewrites without inventing achievements. */
export function rewriteBullets(profile, job) {
  const reqs = requirementSkills(job).map((r) => r.skill);
  const entries = [
    ...(profile.projects || []).map((p) => ({ kind: 'project', label: p.name, bullets: p.bullets || [], technologies: p.technologies || [] })),
    ...(profile.experience || []).map((e) => ({ kind: 'experience', label: [e.title, e.organization].filter(Boolean).join(' at '), bullets: e.bullets || [], technologies: e.technologies || [] })),
  ];
  const suggestions = [];
  for (const entry of entries) {
    const entryTech = entry.technologies.map(canonicalName);
    for (const original of entry.bullets) {
      const relevant = reqs.filter((s) => mentionsSkill(original, s));
      // Job skills this entry genuinely used but the bullet doesn't mention.
      const unmentioned = reqs.filter((s) => entryTech.includes(s) && !mentionsSkill(original, s));
      const weak = original.match(WEAK_START);
      const hasMetric = /\d/.test(original);
      if (!relevant.length && !unmentioned.length) continue;
      if (!weak && hasMetric && !unmentioned.length) continue;

      let suggestion = original.replace(/\.$/, '');
      const notes = [];
      if (weak) {
        const verb = STRONG_VERB[weak[1].toLowerCase()] || 'Built';
        suggestion = `${verb} ${suggestion.slice(weak[0].length)}`;
        notes.push('Starts with what you did instead of a vague phrase.');
      }
      if (unmentioned.length) {
        suggestion += ` using ${unmentioned.slice(0, 2).join(' and ')}`;
        notes.push(`Names ${unmentioned.slice(0, 2).join(' and ')}, which this ${entry.kind} lists in its technologies.`);
      }
      if (!hasMetric) {
        suggestion += ', [add a real, measurable result if you have one]';
        notes.push('Add a genuine number (users, latency, records, coverage) only if you can back it up.');
      }
      suggestions.push({ entry: entry.label, kind: entry.kind, original, suggestion: `${suggestion}.`, notes });
    }
  }
  return suggestions;
}

/** Builds a job-specific application checklist. */
export function buildChecklist({ job, analysis, hasResumeVersion, hasCoverLetter }) {
  const gaps = (analysis?.results || []).filter((r) => r.importance === 'mandatory' && r.status !== 'demonstrated');
  const items = [
    { text: `Confirm the listing at ${job.company} is still open on the employer's site`, done: false },
    { text: 'Review the skill-gap analysis for this job', done: Boolean(analysis) },
    ...gaps.map((g) => ({ text: g.status === 'partial' ? `Make your ${g.skill} evidence explicit on your resume (only if accurate)` : `Decide how to address the ${g.skill} gap honestly (learning task, cover letter mention)`, done: false })),
    { text: 'Save a tailored resume version for this job', done: Boolean(hasResumeVersion) },
    { text: 'Pick 2–3 projects that best match the requirements', done: false },
    { text: 'Review and personalise the cover letter draft', done: Boolean(hasCoverLetter) },
    { text: 'Proofread resume and cover letter', done: false },
    { text: 'Submit the application on the employer site and mark it as Applied', done: false },
    { text: 'Schedule a follow-up reminder for 7 days after applying', done: false },
  ];
  if (job.closingDate) items.unshift({ text: `Apply before ${new Date(job.closingDate).toDateString()}`, done: false });
  return items;
}

/** Job-specific interview revision pack, built from the existing Prepstack interview + practice modules. */
export async function buildInterviewPack({ job, analysis, profile }) {
  const results = analysis?.results || requirementSkills(job).map((r) => ({ ...r, status: 'unknown' }));
  const topics = [];
  for (const r of results) {
    const res = await resourcesForSkill(r.skill);
    topics.push({
      skill: res.skill,
      status: r.status,
      priority: r.importance === 'mandatory' && r.status !== 'demonstrated' ? 'high' : r.importance === 'mandatory' ? 'medium' : 'low',
      questions: res.interviewQuestions,
      practice: res.practice,
      mockInterviewUrl: res.mockInterviewUrl,
    });
  }
  const order = { high: 0, medium: 1, low: 2 };
  topics.sort((a, b) => order[a.priority] - order[b.priority]);
  const projects = selectProjects(profile, job);
  const slugs = topics.slice(0, 5).map((t) => t.skill.toLowerCase().replace(/[^a-z0-9]+/g, '-')).join(',');
  return {
    generatedAt: new Date(),
    topics,
    projectDeepDives: projects.map((p) => ({
      project: p.name,
      questions: [
        `Walk me through ${p.name}. What problem does it solve?`,
        `Why did you choose ${p.matchedSkills.slice(0, 2).join(' and ') || 'that stack'} for ${p.name}?`,
        `What was the hardest bug in ${p.name}, and how did you fix it?`,
        `What would you change about ${p.name} if you rebuilt it?`,
      ],
    })),
    behavioural: [
      `Why do you want to work at ${job.company}?`,
      'Tell me about a time you learned a new technology quickly.',
      'Describe a disagreement in a team project and how you resolved it.',
    ],
    mockInterviewUrl: `${env.prepstackBaseUrl.replace(/\/$/, '')}/mock-interview?role=${encodeURIComponent(job.title)}&topics=${encodeURIComponent(slugs)}`,
  };
}

function templateCoverLetter({ user, profile, job, analysis, projects }) {
  const demonstrated = (analysis?.results || []).filter((r) => r.status === 'demonstrated').map((r) => r.skill);
  const edu = profile.education?.[0];
  const intro = edu?.degree
    ? `I am ${user.name}, ${edu.degree}${edu.institution ? ` at ${edu.institution}` : ''}, and I am applying for the ${job.title} role at ${job.company}.`
    : `I am ${user.name}, and I am applying for the ${job.title} role at ${job.company}.`;
  const projectParas = projects.slice(0, 2).map((p) =>
    `In ${p.name}, I worked with ${p.matchedSkills.join(', ')}. [Describe in one or two sentences what you built and a result you can stand behind.]`);
  const skillsLine = demonstrated.length
    ? `My resume shows hands-on work with ${demonstrated.slice(0, 5).join(', ')}, which this role lists as requirements.`
    : '';
  return [
    `Dear Hiring Team at ${job.company},`,
    '',
    `${intro} ${skillsLine}`.trim(),
    '',
    ...projectParas.flatMap((p) => [p, '']),
    `[Why ${job.company}: mention something specific about the team, product or mission that genuinely interests you.]`,
    '',
    'Thank you for considering my application. I would welcome the chance to discuss how I can contribute.',
    '',
    'Sincerely,',
    user.name,
  ].join('\n');
}

/** Drafts a cover letter from verified profile facts. Uses Claude when configured, else a grounded template. */
export async function draftCoverLetter({ user, profile, job, analysis }) {
  const projects = selectProjects(profile, job);
  const facts = {
    name: user.name,
    education: profile.education,
    projects: (profile.projects || []).map((p) => ({ name: p.name, description: p.description, bullets: p.bullets, technologies: p.technologies })),
    experience: profile.experience,
    demonstratedSkills: (analysis?.results || []).filter((r) => r.status === 'demonstrated').map((r) => r.skill),
    notEvidencedSkills: (analysis?.results || []).filter((r) => r.status === 'not_evidenced').map((r) => r.skill),
    mostRelevantProjects: projects.map((p) => p.name),
  };
  const llmText = await generateText({
    system: `You help students draft honest, specific cover letters. ${GROUNDING_RULES}`,
    prompt: `Write a concise cover letter (under 300 words) for the role below.\n\nJOB:\n${job.title} at ${job.company}\n${job.description}\n\nPROFILE:\n${JSON.stringify(facts, null, 2)}\n\nInclude a placeholder for why the student wants this company specifically.`,
  });
  return {
    text: llmText || templateCoverLetter({ user, profile, job, analysis, projects }),
    generatedBy: llmText ? 'claude' : 'template',
    projects,
    reviewNote: 'This is a draft. Replace every [bracketed placeholder], check every claim is true, and make it sound like you before sending.',
  };
}
