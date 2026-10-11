import { mentionsSkill, weakSignals, extractSkills } from './skills/extractor.js';
import { canonicalName, implyingSkills, getSkill } from './skills/taxonomy.js';

export const STATUS = {
  DEMONSTRATED: 'demonstrated',
  PARTIAL: 'partial',
  NOT_EVIDENCED: 'not_evidenced',
};

const WEIGHT = { mandatory: 2, preferred: 1 };
const CREDIT = { demonstrated: 1, partial: 0.5, not_evidenced: 0 };

// How to phrase an evidence-based bullet for a skill. {tech} and {entry} come from the student's own entry.
const PHRASING = {
  'REST APIs': 'Designed and implemented REST API endpoints using {tech} for {entry}',
  'Automated Testing': 'Wrote automated tests for the {tech} code in {entry}',
  Docker: 'Containerised {entry} with Docker for consistent local and deployment environments',
  MongoDB: 'Modelled and queried {entry} data in MongoDB',
  Authentication: 'Implemented user authentication for {entry} using {tech}',
  'CI/CD': 'Set up a CI pipeline for {entry} that runs on every push',
  'Data Modeling': 'Designed the data model for {entry}',
};

/** Flattens a profile into evidence entries (projects and roles). */
function evidenceEntries(profile) {
  const experience = (profile.experience || []).map((e) => ({
    type: 'experience',
    label: [e.title, e.organization].filter(Boolean).join(' at ') || 'Experience entry',
    text: [e.title, e.organization, ...(e.bullets || [])].join(' '),
    technologies: e.technologies || [],
  }));
  const projects = (profile.projects || []).map((p) => ({
    type: 'project',
    label: p.name || 'Project',
    text: [p.name, p.description, ...(p.bullets || [])].join(' '),
    technologies: p.technologies || [],
  }));
  return [...projects, ...experience];
}

function entryUses(entry, skill) {
  return entry.technologies.map(canonicalName).includes(skill) || mentionsSkill(entry.text, skill);
}

/** Classifies a single requirement against the student's profile. */
export function assessRequirement(requirement, profile, completedLearning = []) {
  const skill = canonicalName(requirement.skill);
  const entries = evidenceEntries(profile);
  const claimed = (profile.skills || []).map(canonicalName);
  const evidence = [];

  for (const entry of entries) {
    if (entryUses(entry, skill)) {
      evidence.push({ source: entry.type, label: entry.label, detail: `${skill} is used in this ${entry.type}.` });
      continue;
    }
    const implying = implyingSkills(skill).find((s) => entryUses(entry, s));
    if (implying) evidence.push({ source: entry.type, label: entry.label, detail: `Uses ${implying}, which demonstrates ${skill}.` });
  }
  if (evidence.length) {
    return { skill, importance: requirement.importance, status: STATUS.DEMONSTRATED, evidence, reason: `Shown in ${evidence.map((e) => e.label).join(', ')}.` };
  }

  const partial = [];
  if (claimed.includes(skill)) {
    partial.push({ source: 'skills', label: 'Skills section', detail: `${skill} is listed, but no project or role describes using it.` });
  }
  for (const entry of entries) {
    const signals = weakSignals(entry.text, skill);
    if (signals.length) {
      partial.push({ source: entry.type, label: entry.label, detail: `Related wording ("${signals.slice(0, 3).join('", "')}") but ${skill} is not described explicitly.` });
    }
  }
  const learned = completedLearning.find((t) => canonicalName(t.skill) === skill);
  if (learned) {
    partial.push({ source: 'learning', label: learned.title, detail: 'Completed a Prepstack learning task for this skill.' });
  }
  if (partial.length) {
    return { skill, importance: requirement.importance, status: STATUS.PARTIAL, evidence: partial, reason: partial[0].detail };
  }
  return { skill, importance: requirement.importance, status: STATUS.NOT_EVIDENCED, evidence: [], reason: `No evidence of ${skill} in your resume, projects or completed learning.` };
}

function bestEntryFor(skill, profile) {
  const entries = evidenceEntries(profile);
  const category = getSkill(skill)?.category;
  const scored = entries.map((entry) => {
    let score = weakSignals(entry.text, skill).length * 2;
    score += entry.technologies.filter((t) => category && getSkill(t)?.category === category).length;
    return { entry, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].entry : null;
}

/** Picks the entry's technologies most relevant to `skill` (same category, then backend/data). */
function relevantTech(skill, entry) {
  const category = getSkill(skill)?.category;
  const sameCategory = entry.technologies.filter((t) => getSkill(t)?.category === category && t !== skill);
  if (sameCategory.length) return sameCategory.slice(0, 2);
  const serverSide = entry.technologies.filter((t) => ['backend', 'database'].includes(getSkill(t)?.category));
  return (serverSide.length ? serverSide : entry.technologies).slice(0, 2);
}

function exampleBullet(skill, entry) {
  const tech = relevantTech(skill, entry).join(' and ') || skill;
  const template = PHRASING[skill] || `Used ${skill} in {entry} to <what you built or improved>`;
  return `${template.replace('{tech}', tech).replace('{entry}', entry.label)} — <add a real outcome if you have one>.`;
}

/** Builds specific, evidence-grounded improvement suggestions. */
export function buildSuggestions(results, profile) {
  const suggestions = [];
  for (const r of results) {
    if (r.status === STATUS.PARTIAL) {
      const entry = bestEntryFor(r.skill, profile);
      if (entry) {
        suggestions.push({
          type: 'clarify',
          skill: r.skill,
          message: `Your ${entry.type} "${entry.label}" suggests ${r.skill} work, but the resume does not say so clearly. If you did this work, describe it explicitly.`,
          example: exampleBullet(r.skill, entry),
          grounding: entry.label,
        });
      } else {
        suggestions.push({
          type: 'evidence',
          skill: r.skill,
          message: `${r.skill} appears only in your skills list. Add a bullet to the project or role where you actually used it.`,
          example: null,
          grounding: 'Skills section',
        });
      }
    } else if (r.status === STATUS.NOT_EVIDENCED) {
      suggestions.push({
        type: 'learn',
        skill: r.skill,
        message: r.importance === 'mandatory'
          ? `${r.skill} is a mandatory requirement with no evidence yet. Don't add it to your resume until you have used it — add a learning task and a small project instead.`
          : `${r.skill} is preferred, not required. Consider it after closing mandatory gaps.`,
        example: null,
        grounding: null,
      });
    }
  }
  // Mandatory gaps first, then clarifications.
  const order = { learn: 0, clarify: 1, evidence: 2 };
  return suggestions.sort((a, b) => {
    const ia = results.find((r) => r.skill === a.skill)?.importance === 'mandatory' ? 0 : 1;
    const ib = results.find((r) => r.skill === b.skill)?.importance === 'mandatory' ? 0 : 1;
    return ia - ib || order[a.type] - order[b.type];
  });
}

/** Which job keywords literally appear in the resume, reported without encouraging stuffing. */
export function keywordCoverage(requirements, resumeText = '', results = []) {
  const present = new Set(extractSkills(resumeText));
  const covered = [];
  const missing = [];
  const listedOnly = [];
  for (const req of requirements) {
    const skill = canonicalName(req.skill);
    if (present.has(skill) || mentionsSkill(resumeText, skill)) {
      covered.push(skill);
      const r = results.find((x) => x.skill === skill);
      if (r && r.status !== STATUS.DEMONSTRATED) listedOnly.push(skill);
    } else {
      missing.push(skill);
    }
  }
  return {
    covered,
    missing,
    listedOnly,
    ratio: requirements.length ? covered.length / requirements.length : 0,
    note: 'Keyword coverage only shows which terms appear. Add a keyword only where it describes work you actually did — listing it without evidence still counts as partial.',
  };
}

/** Full comparison of a profile against a job. */
export function analyzeMatch({ profile, job, completedLearning = [], resumeText = '' }) {
  const requirements = job.requirements || [];
  const results = requirements.map((req) => assessRequirement(req, profile, completedLearning));

  let earned = 0;
  let possible = 0;
  for (const r of results) {
    const w = WEIGHT[r.importance] || 1;
    possible += w;
    earned += w * CREDIT[r.status];
  }
  const mandatory = results.filter((r) => r.importance === 'mandatory');
  const fitScore = possible ? Math.round((earned / possible) * 100) : 0;
  const summary = {
    demonstrated: results.filter((r) => r.status === STATUS.DEMONSTRATED).length,
    partial: results.filter((r) => r.status === STATUS.PARTIAL).length,
    notEvidenced: results.filter((r) => r.status === STATUS.NOT_EVIDENCED).length,
    mandatoryMet: mandatory.filter((r) => r.status === STATUS.DEMONSTRATED).length,
    mandatoryTotal: mandatory.length,
    fitScore,
    fitLabel: fitScore >= 75 ? 'Strong fit' : fitScore >= 50 ? 'Moderate fit' : 'Stretch role',
  };

  const text = resumeText || evidenceEntries(profile).map((e) => e.text).join(' ') + ' ' + (profile.skills || []).join(', ');
  return {
    results,
    summary,
    suggestions: buildSuggestions(results, profile),
    keywordCoverage: keywordCoverage(requirements, text, results),
    disclaimer: 'Evidence indicators reflect what your resume and Prepstack activity show, not a validated proficiency score.',
  };
}
