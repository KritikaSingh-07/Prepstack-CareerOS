import { analyzeMatch } from './matchEngine.js';
import { freshness } from './jobFreshness.js';

const LEVELS = ['internship', 'entry', 'junior', 'mid'];

const norm = (s = '') => s.toLowerCase();

function roleMatches(job, targetRoles = []) {
  if (!targetRoles.length) return null;
  const haystack = norm(`${job.title} ${job.roleCategory}`);
  return targetRoles.find((role) => norm(role).split(/\s+/).filter((w) => w.length > 2).every((w) => haystack.includes(w))
    || haystack.includes(norm(role))) || null;
}

function locationMatches(job, prefs) {
  if (prefs.remote === 'remote') return job.workMode === 'remote';
  if (job.workMode === 'remote') return prefs.remote === 'any' || prefs.remote === 'remote';
  if (prefs.remote !== 'any' && prefs.remote !== job.workMode) return false;
  if (!prefs.locations?.length) return true;
  return prefs.locations.some((loc) => norm(job.location).includes(norm(loc)));
}

/**
 * Ranks jobs for a student and explains each recommendation.
 * Fit (evidence coverage) dominates; preferences and freshness adjust the ranking.
 */
export function recommendJobs(jobs, { profile, preferences = {}, completedLearning = [] }) {
  const ranked = jobs.map((job) => {
    const match = analyzeMatch({ profile, job, completedLearning });
    const fresh = freshness(job);
    const reasons = [];
    const cautions = [];
    let score = match.summary.fitScore * 0.6;

    const demonstrated = match.results.filter((r) => r.status === 'demonstrated' && r.importance === 'mandatory').map((r) => r.skill);
    if (demonstrated.length) reasons.push(`You show evidence for ${demonstrated.slice(0, 4).join(', ')}${demonstrated.length > 4 ? '…' : ''}.`);

    const role = roleMatches(job, preferences.targetRoles);
    if (role) { score += 15; reasons.push(`Matches your target role "${role}".`); }

    if (locationMatches(job, preferences)) {
      score += 10;
      reasons.push(job.workMode === 'remote' ? 'Remote, as you prefer.' : `Located in ${job.location}, matching your preferences.`);
    } else {
      cautions.push(`${job.workMode === 'remote' ? 'Remote' : job.location} may not match your location preferences.`);
    }

    const levelGap = LEVELS.indexOf(job.experienceLevel) - LEVELS.indexOf(preferences.experienceLevel || 'junior');
    if (levelGap <= 0) { score += 10; } else { cautions.push(`Asks for ${job.experienceLevel}-level experience.`); }

    if (fresh.state === 'open') score += 5;
    if (fresh.state === 'stale') { score -= 10; cautions.push(fresh.warning); }
    if (fresh.state === 'closing_soon') reasons.push(`${fresh.label} — act soon.`);
    if (fresh.state === 'closed') score -= 100;

    const missingMandatory = match.results.filter((r) => r.importance === 'mandatory' && r.status === 'not_evidenced').map((r) => r.skill);
    if (missingMandatory.length) cautions.push(`No evidence yet for mandatory: ${missingMandatory.join(', ')}.`);

    // The requirements that matter most: mandatory ones, gaps first.
    const keyRequirements = match.results
      .filter((r) => r.importance === 'mandatory')
      .sort((a, b) => (a.status === 'demonstrated') - (b.status === 'demonstrated'))
      .slice(0, 5)
      .map((r) => ({ skill: r.skill, status: r.status }));

    return {
      job,
      score: Math.round(score),
      fit: match.summary,
      freshness: fresh,
      reasons,
      cautions,
      keyRequirements,
    };
  });
  return ranked.sort((a, b) => b.score - a.score);
}
