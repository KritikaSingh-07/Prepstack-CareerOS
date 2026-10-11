// Adapter between CareerOS and the existing Prepstack platform (roadmap, coding editor, mock interviews).
//
// CareerOS never rebuilds those features. It looks up the matching roadmap module, practice exercises and
// interview topics for a skill and deep-links into the existing Prepstack app. When PREPSTACK_API_URL is set,
// lookups go to the existing Prepstack API first; the local catalog below is the fallback and the contract.

import { env } from '../config/env.js';
import { SKILLS, canonicalName, prereqsOf } from './skills/taxonomy.js';

const slug = (s) => s.toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const link = (path) => `${env.prepstackBaseUrl.replace(/\/$/, '')}${path}`;

// Curated entries for the skills most often requested in junior full-stack roles.
const CURATED = {
  'Automated Testing': {
    roadmap: { title: 'Testing fundamentals: unit, integration and end-to-end', hours: 6 },
    practice: ['Write Jest unit tests for a utility module', 'Test an Express route with Supertest', 'Mock a database call in a service test'],
    project: 'Add a test suite (unit + API tests) to one of your existing projects and report the coverage.',
    interview: ['What is the difference between unit and integration tests?', 'How do you test code that talks to a database?', 'What makes a test flaky, and how do you fix it?'],
  },
  Docker: {
    roadmap: { title: 'Docker fundamentals: images, containers and Compose', hours: 5 },
    practice: ['Write a Dockerfile for a Node.js API', 'Run an API and MongoDB together with docker compose', 'Reduce an image size with a multi-stage build'],
    project: 'Containerise one of your MERN projects with a Dockerfile and docker-compose.yml, and document how to run it.',
    interview: ['What is the difference between an image and a container?', 'Why use multi-stage builds?', 'How do containers communicate in Docker Compose?'],
  },
  'REST APIs': {
    roadmap: { title: 'Designing REST APIs with Express', hours: 6 },
    practice: ['Design resource routes and status codes for a todo API', 'Add validation and error handling middleware', 'Implement pagination and filtering'],
    project: 'Document the API of one of your projects (routes, status codes, errors) and add input validation.',
    interview: ['What makes an API RESTful?', 'When do you use PUT vs PATCH?', 'How do you version an API?'],
  },
  MongoDB: {
    roadmap: { title: 'MongoDB and Mongoose data modelling', hours: 6 },
    practice: ['Model one-to-many relations with references vs embedding', 'Write an aggregation pipeline for a report', 'Add indexes and explain a query plan'],
    project: 'Add an aggregation-powered statistics endpoint to one of your projects.',
    interview: ['Embedding vs referencing — when do you choose each?', 'How do indexes affect write performance?', 'What is an aggregation pipeline?'],
  },
  'Node.js': {
    roadmap: { title: 'Node.js runtime, event loop and async patterns', hours: 6 },
    practice: ['Convert callback code to async/await', 'Stream a large file without loading it into memory', 'Handle errors in async Express routes'],
    project: 'Build a small CLI or API in Node.js that uses streams or worker threads.',
    interview: ['Explain the event loop.', 'What is the difference between process.nextTick and setImmediate?', 'How do you handle uncaught promise rejections?'],
  },
  React: {
    roadmap: { title: 'React components, state and hooks', hours: 8 },
    practice: ['Build a controlled form with validation', 'Write a custom hook for data fetching', 'Optimise a list with memoisation'],
    project: 'Build a dashboard page with data fetching, loading and error states.',
    interview: ['When does a component re-render?', 'What problem does useEffect solve, and what are its pitfalls?', 'How do you manage global state?'],
  },
  'CI/CD': {
    roadmap: { title: 'CI/CD with GitHub Actions', hours: 4 },
    practice: ['Write a workflow that runs tests on every pull request', 'Cache dependencies in CI', 'Deploy on merge to main'],
    project: 'Add a GitHub Actions workflow that lints and tests one of your projects.',
    interview: ['What is the difference between continuous delivery and deployment?', 'How do you keep secrets out of CI logs?'],
  },
  TypeScript: {
    roadmap: { title: 'TypeScript for JavaScript developers', hours: 6 },
    practice: ['Type an Express request handler', 'Use generics for a reusable fetch helper', 'Model API responses with discriminated unions'],
    project: 'Migrate one module of an existing project to TypeScript.',
    interview: ['What is the difference between type and interface?', 'What are generics for?'],
  },
  Authentication: {
    roadmap: { title: 'Authentication and authorisation for web apps', hours: 5 },
    practice: ['Implement JWT login and a protected route', 'Hash passwords with bcrypt', 'Add role-based access control middleware'],
    project: 'Add authentication with protected routes to one of your projects.',
    interview: ['Sessions vs JWT — trade-offs?', 'Where should a SPA store tokens?', 'What is CSRF?'],
  },
  'Data Structures & Algorithms': {
    roadmap: { title: 'Core data structures and algorithms', hours: 20 },
    practice: ['Two-pointer and sliding-window problems', 'Hash map frequency problems', 'Tree traversal problems'],
    project: null,
    interview: ['Explain the time complexity of your solution.', 'How would you detect a cycle in a linked list?'],
  },
};

function catalogEntry(skillName) {
  const skill = canonicalName(skillName);
  const s = slug(skill);
  const curated = CURATED[skill];
  return {
    skill,
    roadmapModule: {
      id: `roadmap-${s}`,
      title: curated?.roadmap.title || `${skill} essentials`,
      estimatedHours: curated?.roadmap.hours || 4,
      url: link(`/roadmap/${s}`),
    },
    practice: (curated?.practice || [`${skill} fundamentals exercise set`]).map((title, i) => ({
      id: `practice-${s}-${i + 1}`,
      title,
      url: link(`/practice?topic=${encodeURIComponent(s)}&exercise=${i + 1}`),
    })),
    projectIdea: curated?.project || `Use ${skill} in a small feature of one of your existing projects and describe it on your resume.`,
    interviewQuestions: curated?.interview || [`What have you built with ${skill}?`, `What are common pitfalls when using ${skill}?`],
    mockInterviewUrl: link(`/mock-interview?topics=${encodeURIComponent(s)}`),
  };
}

async function fetchFromPrepstack(skill) {
  if (!env.prepstackApiUrl) return null;
  try {
    const res = await fetch(`${env.prepstackApiUrl.replace(/\/$/, '')}/roadmap/modules?skill=${encodeURIComponent(skill)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // Existing Prepstack unreachable: fall back to the local catalog.
  }
}

export async function resourcesForSkill(skill) {
  const local = catalogEntry(skill);
  const remote = await fetchFromPrepstack(local.skill);
  return remote ? { ...local, ...remote, skill: local.skill } : local;
}

/**
 * Orders gap skills into a learning sequence: mandatory before preferred, missing before partial,
 * and prerequisites before the skills that depend on them.
 */
export function learningSequence(gaps) {
  const rank = (g) => (g.importance === 'mandatory' ? 0 : 2) + (g.status === 'not_evidenced' ? 0 : 1);
  const sorted = [...gaps].sort((a, b) => rank(a) - rank(b));
  const names = new Set(sorted.map((g) => g.skill));
  const visited = new Set();
  const ordered = [];
  const visit = (gap) => {
    if (visited.has(gap.skill)) return;
    visited.add(gap.skill);
    for (const pre of prereqsOf(gap.skill)) {
      const dep = sorted.find((g) => g.skill === pre);
      if (dep && names.has(pre)) visit(dep);
    }
    ordered.push(gap);
  };
  sorted.forEach(visit);
  return ordered;
}

/** Builds learning tasks (not yet persisted) for the gaps in a match analysis. */
export async function buildLearningPlan(results) {
  const gaps = results.filter((r) => r.status !== 'demonstrated');
  const tasks = [];
  for (const gap of learningSequence(gaps)) {
    const res = await resourcesForSkill(gap.skill);
    tasks.push({
      skill: res.skill,
      importance: gap.importance,
      gapStatus: gap.status,
      title: gap.status === 'partial'
        ? `Strengthen and evidence ${res.skill}: ${res.projectIdea}`
        : `${res.roadmapModule.title}`,
      description: gap.status === 'partial'
        ? `You have some ${res.skill} evidence. Complete the practice set and make the work visible in a project.`
        : `Work through the roadmap module, then complete the practice set. Project idea: ${res.projectIdea}`,
      estimatedHours: res.roadmapModule.estimatedHours,
      prepstack: {
        roadmapModuleId: res.roadmapModule.id,
        roadmapUrl: res.roadmapModule.url,
        practice: res.practice,
        mockInterviewUrl: res.mockInterviewUrl,
      },
    });
  }
  return tasks;
}

export const allCatalogSkills = () => SKILLS.map((s) => s.name);
