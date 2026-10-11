import { SKILLS, canonicalName } from './taxonomy.js';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

// Word-ish boundaries that also work for terms such as "c++", "node.js" or "ci/cd".
const termRegex = (term) => new RegExp(`(?<![a-z0-9.])${escape(term)}(?![a-z0-9])`, 'i');

const aliasPatterns = SKILLS.map((skill) => ({
  skill,
  patterns: skill.aliases.map(termRegex),
  weakPatterns: (skill.weak || []).map((w) => ({ term: w, re: termRegex(w) })),
}));

/** Returns canonical skill names mentioned directly in `text`. */
export function extractSkills(text = '') {
  if (!text) return [];
  const found = [];
  for (const { skill, patterns } of aliasPatterns) {
    if (patterns.some((re) => re.test(text))) found.push(skill.name);
  }
  return found;
}

export function mentionsSkill(text = '', skillName) {
  const entry = aliasPatterns.find((a) => a.skill.name === canonicalName(skillName));
  if (!entry) return termRegex(String(skillName).toLowerCase()).test(text);
  return entry.patterns.some((re) => re.test(text));
}

/** Returns the weak-signal phrases for `skillName` found in `text`. */
export function weakSignals(text = '', skillName) {
  const entry = aliasPatterns.find((a) => a.skill.name === canonicalName(skillName));
  if (!entry) return [];
  return entry.weakPatterns.filter(({ re }) => re.test(text)).map(({ term }) => term);
}

const PREFERRED_HINT = /(nice[- ]to[- ]have|preferred|bonus|a plus|is a plus|good to have|desirable|optional)/i;
const MANDATORY_HINT = /(requirements?|required|must[- ]have|must|qualifications|you have|what you.?ll need|essential)/i;

/**
 * Derives structured requirements from a free-text job description.
 * Lines under a "nice to have / preferred" heading (or containing that wording) are preferred;
 * everything else is treated as mandatory.
 */
export function deriveRequirements(description = '') {
  const requirements = new Map();
  let mode = 'mandatory';
  for (const rawLine of description.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const isHeading = line.length < 60 && !/^[-*•▪]/.test(line);
    if (isHeading && PREFERRED_HINT.test(line)) mode = 'preferred';
    else if (isHeading && MANDATORY_HINT.test(line)) mode = 'mandatory';

    const importance = PREFERRED_HINT.test(line) ? 'preferred' : mode;
    for (const skill of extractSkills(line)) {
      const existing = requirements.get(skill);
      // A skill mentioned as mandatory anywhere stays mandatory.
      if (!existing || (existing === 'preferred' && importance === 'mandatory')) {
        requirements.set(skill, importance);
      }
    }
  }
  return [...requirements].map(([skill, importance]) => ({ skill, importance }));
}
