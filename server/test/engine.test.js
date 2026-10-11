import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSkills, deriveRequirements } from '../src/services/skills/extractor.js';
import { parseResumeText } from '../src/services/resumeParser.js';
import { analyzeMatch, assessRequirement } from '../src/services/matchEngine.js';
import { freshness } from '../src/services/jobFreshness.js';
import { learningSequence } from '../src/services/prepstack.js';
import { rewriteBullets, selectProjects } from '../src/services/copilot.js';
import { SAMPLE_RESUME_TEXT } from '../src/seed/sampleResume.js';

const rahulJob = {
  requirements: [
    { skill: 'React', importance: 'mandatory' },
    { skill: 'Node.js', importance: 'mandatory' },
    { skill: 'MongoDB', importance: 'mandatory' },
    { skill: 'REST APIs', importance: 'mandatory' },
    { skill: 'Automated Testing', importance: 'mandatory' },
    { skill: 'Docker', importance: 'mandatory' },
  ],
};

test('extractSkills normalises aliases and respects word boundaries', () => {
  const skills = extractSkills('Built with ReactJS, node.js, Mongoose and CI/CD. Java 17.');
  assert.ok(skills.includes('React'));
  assert.ok(skills.includes('Node.js'));
  assert.ok(skills.includes('MongoDB'));
  assert.ok(skills.includes('CI/CD'));
  assert.ok(skills.includes('Java'));
  assert.ok(!skills.includes('JavaScript'), '"Java" and "node.js" must not imply JavaScript');
});

test('deriveRequirements separates mandatory and nice-to-have skills', () => {
  const reqs = deriveRequirements('Requirements\n- React and Node.js\n- MongoDB\n\nNice to have\n- Docker\n- React Testing Library');
  const by = Object.fromEntries(reqs.map((r) => [r.skill, r.importance]));
  assert.equal(by.React, 'mandatory');
  assert.equal(by.MongoDB, 'mandatory');
  assert.equal(by.Docker, 'preferred');
});

test('parseResumeText extracts contact, education, experience, projects and skills', () => {
  const { parsed, issues } = parseResumeText(SAMPLE_RESUME_TEXT);
  assert.equal(parsed.contact.email, 'rahul.sharma@example.com');
  assert.equal(parsed.contact.name, 'Rahul Sharma');
  assert.equal(parsed.education.length, 1);
  assert.match(parsed.education[0].degree, /B\.Tech/);
  assert.equal(parsed.experience.length, 1);
  assert.equal(parsed.experience[0].title, 'Web Development Intern');
  assert.equal(parsed.experience[0].organization, 'Finch Retail Solutions');
  assert.equal(parsed.experience[0].startDate, 'Jun 2024');
  assert.deepEqual(parsed.projects.map((p) => p.name), ['ShopSphere', 'DevConnect', 'TaskFlow']);
  assert.ok(parsed.projects[0].technologies.includes('MongoDB'));
  assert.ok(parsed.skills.includes('Jest'));
  assert.ok(issues.some((i) => i.field === 'skills' && i.message.includes('Jest')), 'flags skills listed without evidence');
  assert.ok(issues.some((i) => i.field === 'impact'), 'flags unquantified bullets');
});

test('Rahul example: demonstrated, partial and not-evidenced classification', () => {
  const { parsed } = parseResumeText(SAMPLE_RESUME_TEXT);
  const { results, summary, suggestions } = analyzeMatch({ profile: parsed, job: rahulJob, resumeText: SAMPLE_RESUME_TEXT });
  const status = Object.fromEntries(results.map((r) => [r.skill, r.status]));
  assert.equal(status.React, 'demonstrated');
  assert.equal(status['Node.js'], 'demonstrated');
  assert.equal(status.MongoDB, 'demonstrated');
  assert.equal(status['REST APIs'], 'partial');
  assert.equal(status['Automated Testing'], 'partial');
  assert.equal(status.Docker, 'not_evidenced');
  assert.equal(summary.mandatoryTotal, 6);
  assert.equal(summary.mandatoryMet, 3);

  const api = suggestions.find((s) => s.skill === 'REST APIs');
  assert.equal(api.type, 'clarify');
  assert.equal(api.grounding, 'ShopSphere', 'suggestion is grounded in the project that hints at API work');
  assert.equal(suggestions[0].type, 'learn', 'mandatory missing skills come first');
});

test('implied skills count as demonstrated, completed learning counts as partial', () => {
  const profile = { skills: [], projects: [{ name: 'Utils', bullets: ['Added Jest unit specs'], technologies: ['Jest'] }], experience: [] };
  assert.equal(assessRequirement({ skill: 'Automated Testing', importance: 'mandatory' }, profile).status, 'demonstrated');
  const learned = assessRequirement({ skill: 'Docker', importance: 'mandatory' }, profile, [{ skill: 'Docker', title: 'Docker fundamentals' }]);
  assert.equal(learned.status, 'partial');
});

test('freshness flags closed, stale and closing-soon listings', () => {
  const now = new Date('2026-01-15T00:00:00Z');
  const d = (days) => new Date(now.getTime() + days * 864e5);
  assert.equal(freshness({ status: 'open', closingDate: d(-1), lastVerifiedAt: d(-1) }, now).state, 'closed');
  assert.equal(freshness({ status: 'open', closingDate: d(30), lastVerifiedAt: d(-40) }, now).state, 'stale');
  assert.equal(freshness({ status: 'open', closingDate: d(3), lastVerifiedAt: d(-1) }, now).state, 'closing_soon');
  assert.equal(freshness({ status: 'open', closingDate: d(30), lastVerifiedAt: d(-1) }, now).state, 'open');
});

test('learningSequence puts mandatory gaps and prerequisites first', () => {
  const seq = learningSequence([
    { skill: 'TypeScript', importance: 'preferred', status: 'not_evidenced' },
    { skill: 'Kubernetes', importance: 'mandatory', status: 'not_evidenced' },
    { skill: 'Docker', importance: 'mandatory', status: 'partial' },
  ]).map((g) => g.skill);
  assert.deepEqual(seq, ['Docker', 'Kubernetes', 'TypeScript']);
});

test('copilot rewrites never introduce technologies the entry did not use', () => {
  const { parsed } = parseResumeText(SAMPLE_RESUME_TEXT);
  const suggestions = rewriteBullets(parsed, rahulJob);
  assert.ok(suggestions.length > 0);
  for (const s of suggestions) {
    assert.ok(!/docker/i.test(s.suggestion), 'Docker was never used, so it must not appear');
  }
  const weak = suggestions.find((s) => s.original.startsWith('Worked on'));
  assert.ok(weak && weak.suggestion.startsWith('Built'));
  const projects = selectProjects(parsed, rahulJob);
  assert.equal(projects[0].name, 'ShopSphere');
});
