// Canonical skill taxonomy used by resume parsing, job requirement extraction and matching.
//
// - aliases:   phrases that count as a direct mention of the skill.
// - impliedBy: other canonical skills whose demonstrated use also demonstrates this one
//              (e.g. writing Jest tests demonstrates "Automated Testing").
// - weak:      phrases that hint at related experience but are not clear evidence on their own.
//              They produce "partial evidence" rather than "demonstrated".
// - prereqs:   skills that should be learned first; used to order learning sequences.

export const SKILLS = [
  // Languages
  { name: 'JavaScript', category: 'language', aliases: ['javascript', 'js', 'es6', 'ecmascript'] },
  { name: 'TypeScript', category: 'language', aliases: ['typescript'], prereqs: ['JavaScript'] },
  { name: 'Python', category: 'language', aliases: ['python', 'python3'] },
  { name: 'Java', category: 'language', aliases: ['java'] },
  { name: 'C++', category: 'language', aliases: ['c++', 'cpp'] },
  { name: 'Go', category: 'language', aliases: ['golang'] },
  { name: 'SQL', category: 'database', aliases: ['sql', 'structured query language'] },
  { name: 'HTML', category: 'frontend', aliases: ['html', 'html5'] },
  { name: 'CSS', category: 'frontend', aliases: ['css', 'css3', 'sass', 'scss'] },

  // Frontend
  { name: 'React', category: 'frontend', aliases: ['react', 'react.js', 'reactjs'], prereqs: ['JavaScript'] },
  { name: 'Redux', category: 'frontend', aliases: ['redux', 'redux toolkit', 'rtk'], prereqs: ['React'] },
  { name: 'Next.js', category: 'frontend', aliases: ['next.js', 'nextjs'], prereqs: ['React'] },
  { name: 'Angular', category: 'frontend', aliases: ['angular', 'angularjs'] },
  { name: 'Vue', category: 'frontend', aliases: ['vue', 'vue.js', 'vuejs'] },
  { name: 'Tailwind CSS', category: 'frontend', aliases: ['tailwind', 'tailwindcss', 'tailwind css'], prereqs: ['CSS'] },
  { name: 'Responsive Design', category: 'frontend', aliases: ['responsive design', 'responsive ui', 'mobile-first', 'mobile first'], weak: ['responsive'] },

  // Backend
  { name: 'Node.js', category: 'backend', aliases: ['node.js', 'nodejs', 'node'], impliedBy: ['Express'], prereqs: ['JavaScript'] },
  { name: 'Express', category: 'backend', aliases: ['express', 'express.js', 'expressjs'], prereqs: ['Node.js'] },
  { name: 'REST APIs', category: 'backend', aliases: ['rest api', 'rest apis', 'restful', 'restful api', 'restful apis'], weak: ['api', 'apis', 'endpoint', 'endpoints', 'backend', 'express', 'crud'], prereqs: ['Node.js'] },
  { name: 'GraphQL', category: 'backend', aliases: ['graphql', 'apollo'] },
  { name: 'Authentication', category: 'backend', aliases: ['jwt', 'oauth', 'authentication', 'auth0', 'passport.js', 'session auth'], weak: ['login', 'sign up', 'signup', 'auth'] },
  { name: 'Django', category: 'backend', aliases: ['django'], prereqs: ['Python'] },
  { name: 'Spring Boot', category: 'backend', aliases: ['spring boot', 'spring'], prereqs: ['Java'] },
  { name: 'WebSockets', category: 'backend', aliases: ['websocket', 'websockets', 'socket.io'], weak: ['real-time', 'realtime'] },

  // Databases
  { name: 'MongoDB', category: 'database', aliases: ['mongodb', 'mongo', 'mongoose'] },
  { name: 'PostgreSQL', category: 'database', aliases: ['postgresql', 'postgres', 'psql'], prereqs: ['SQL'] },
  { name: 'MySQL', category: 'database', aliases: ['mysql'], prereqs: ['SQL'] },
  { name: 'Redis', category: 'database', aliases: ['redis'], weak: ['caching', 'cache'] },
  { name: 'Data Modeling', category: 'database', aliases: ['data modeling', 'data modelling', 'schema design', 'database design'], weak: ['schema', 'schemas'] },

  // Quality
  { name: 'Automated Testing', category: 'quality', aliases: ['automated testing', 'unit testing', 'unit tests', 'unit test', 'integration testing', 'integration tests', 'test automation', 'tdd', 'test-driven', 'testing'], impliedBy: ['Jest', 'Mocha', 'Cypress', 'React Testing Library', 'Playwright'], weak: ['tested', 'test', 'tests', 'qa', 'debugging', 'bug fixes'] },
  { name: 'Jest', category: 'quality', aliases: ['jest'], prereqs: ['JavaScript'] },
  { name: 'Mocha', category: 'quality', aliases: ['mocha', 'chai'] },
  { name: 'Cypress', category: 'quality', aliases: ['cypress'] },
  { name: 'Playwright', category: 'quality', aliases: ['playwright'] },
  { name: 'React Testing Library', category: 'quality', aliases: ['react testing library', 'testing-library', 'rtl'], prereqs: ['React', 'Jest'] },

  // DevOps / Cloud
  { name: 'Git', category: 'devops', aliases: ['git', 'github', 'gitlab', 'version control'] },
  { name: 'Docker', category: 'devops', aliases: ['docker', 'dockerfile', 'docker-compose', 'docker compose', 'containerization', 'containerized'], weak: ['container', 'containers', 'deployment', 'deployed'] },
  { name: 'Kubernetes', category: 'devops', aliases: ['kubernetes', 'k8s'], prereqs: ['Docker'] },
  { name: 'CI/CD', category: 'devops', aliases: ['ci/cd', 'cicd', 'continuous integration', 'github actions', 'jenkins', 'gitlab ci'], weak: ['pipeline', 'pipelines', 'automated deployment'], prereqs: ['Git'] },
  { name: 'AWS', category: 'cloud', aliases: ['aws', 'amazon web services', 'ec2', 's3', 'lambda'], weak: ['cloud'] },
  { name: 'Linux', category: 'devops', aliases: ['linux', 'bash', 'shell scripting', 'ubuntu'] },

  // Fundamentals
  { name: 'Data Structures & Algorithms', category: 'fundamentals', aliases: ['data structures', 'algorithms', 'dsa', 'leetcode', 'competitive programming'] },
  { name: 'System Design', category: 'fundamentals', aliases: ['system design', 'scalability', 'distributed systems'], weak: ['architecture', 'scalable'] },
  { name: 'Agile', category: 'process', aliases: ['agile', 'scrum', 'sprint planning', 'jira'] },
];

const byName = new Map(SKILLS.map((s) => [s.name.toLowerCase(), s]));

export function getSkill(name) {
  if (!name) return null;
  return byName.get(String(name).toLowerCase()) || findByAlias(name);
}

function findByAlias(term) {
  const t = String(term).toLowerCase().trim();
  return SKILLS.find((s) => s.aliases.includes(t)) || null;
}

/** Normalises a free-text skill name to its canonical name, or returns the trimmed input if unknown. */
export function canonicalName(term) {
  const skill = getSkill(term);
  return skill ? skill.name : String(term).trim();
}

/** Skills whose demonstrated use also demonstrates `name` (inverse of impliedBy). */
export function implyingSkills(name) {
  const skill = getSkill(name);
  return skill?.impliedBy || [];
}

export function prereqsOf(name) {
  return getSkill(name)?.prereqs || [];
}
