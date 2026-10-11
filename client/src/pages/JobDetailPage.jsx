import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import AnalysisPanel from '../components/AnalysisPanel.jsx';
import { ErrorNote, FitBadge, FreshnessTag, formatDate, formatMoney, useAsync, STAGE_LABEL } from '../components/ui.jsx';
import { Skeleton } from '../components/motion.jsx';

export default function JobDetailPage() {
  const { id } = useParams();
  const [data, { loading, error, reload }] = useAsync(() => api.getJob(id), [id]);
  const [resumes] = useAsync(() => api.resumes(), []);
  const [history, historyState] = useAsync(() => api.jobAnalyses(id), [id]);
  const [resumeId, setResumeId] = useState('');
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState(null);
  const [plan, setPlan] = useState(null);

  async function run(label, fn) {
    setBusy(label);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy('');
    }
  }

  if (loading && !data) return <Skeleton />;
  if (error) return <ErrorNote error={error} />;
  const { job, freshness, latestAnalysis, application } = data;

  const analyze = () => run('analyze', async () => {
    await api.analyzeJob(id, resumeId || undefined);
    reload();
    historyState.reload();
  });
  const save = () => run('save', async () => { await api.saveJob(id); reload(); });
  const makePlan = () => run('plan', async () => setPlan(await api.planLearning(id)));

  return (
    <div className="two-col">
      <div>
        <Link to="/jobs" className="muted small">← Back to jobs</Link>
        <div className="page-head">
          <div>
            <h1>{job.title}</h1>
            <div className="muted">{job.company} · {job.workMode === 'remote' ? 'Remote' : `${job.location} (${job.workMode})`} · {job.experienceLevel} · {job.employmentType}</div>
          </div>
          {latestAnalysis && <FitBadge fit={latestAnalysis.summary} />}
        </div>
        <div className="job-meta">
          <FreshnessTag freshness={freshness} />
          {formatMoney(job.salary) && <span>{formatMoney(job.salary)}</span>}
          <span className="muted">Posted {formatDate(job.postedAt)}</span>
          <span className="muted">Closes {formatDate(job.closingDate)}</span>
          <span className="muted">Last verified {formatDate(job.lastVerifiedAt)}</span>
          <span className="muted">Source: {job.source}</span>
        </div>
        {freshness.warning && <div className="notice warn">{freshness.warning}</div>}
        {freshness.state === 'closed' && <div className="notice warn">This listing is closed.</div>}

        <div className="card-actions">
          {application
            ? <Link className="btn primary" to={`/applications/${application._id}`}>Open application workspace ({STAGE_LABEL[application.stage]})</Link>
            : <button className="btn primary" disabled={busy === 'save'} onClick={save}>☆ Save to shortlist & track</button>}
          {job.url && <a className="btn ghost" href={job.url} target="_blank" rel="noreferrer">Employer listing ↗</a>}
        </div>
        <ErrorNote error={actionError} />

        <section className="card">
          <div className="section-head">
            <h2>Your fit & skill gaps</h2>
            <div className="inline-controls">
              <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} title="Compare your editable profile or a specific resume version">
                <option value="">Compare: my profile</option>
                {resumes?.resumes.map((r) => <option key={r._id} value={r._id}>Compare: {r.label} (v{r.version})</option>)}
              </select>
              <button className="btn small" disabled={busy === 'analyze'} onClick={analyze}>{busy === 'analyze' ? 'Analysing…' : latestAnalysis ? 'Re-analyse' : 'Analyse my fit'}</button>
            </div>
          </div>
          {latestAnalysis ? <AnalysisPanel analysis={latestAnalysis} /> : <p className="muted">Run an analysis to see which requirements you've demonstrated, which are partial, and which aren't evidenced yet.</p>}
        </section>

        <section className="card">
          <h2>Job description</h2>
          <pre className="jd">{job.description}</pre>
        </section>
      </div>

      <aside>
        <section className="card">
          <h3>Close the gaps</h3>
          <p className="muted small">Turns this job's gaps into tasks on your existing Prepstack roadmap. Skills you're already working on are reused, not restarted.</p>
          <button className="btn primary full" disabled={busy === 'plan'} onClick={makePlan}>{busy === 'plan' ? 'Planning…' : 'Create targeted learning plan'}</button>
          {plan && (
            <div className="plan">
              {plan.created.length === 0 && plan.reused.length === 0 && <p className="muted">No gaps to close — every requirement is demonstrated.</p>}
              {[...plan.created, ...plan.reused].map((t) => (
                <div key={t._id} className="plan-item">
                  <strong>{t.skill}</strong> <span className={`tag ${t.importance}`}>{t.importance}</span>
                  {plan.reused.includes(t) && <span className="tag">already in your plan</span>}
                  <div className="small">{t.title}</div>
                  <a className="small" href={t.prepstack?.roadmapUrl} target="_blank" rel="noreferrer">Open in Prepstack roadmap ↗</a>
                </div>
              ))}
              <Link className="btn ghost full" to="/learning">View learning plan →</Link>
            </div>
          )}
        </section>
        <section className="card">
          <h3>Requirements</h3>
          <ul className="plain">
            {job.requirements.map((r) => <li key={r.skill}>{r.skill} <span className={`tag ${r.importance}`}>{r.importance}</span></li>)}
          </ul>
        </section>
        {history?.analyses.length > 0 && (
          <section className="card">
            <h3>Analysis history</h3>
            <ul className="plain small">
              {history.analyses.map((a) => (
                <li key={a._id}>{formatDate(a.createdAt)} — {a.summary.fitScore}% ({a.resume ? `${a.resume.label} v${a.resume.version}` : 'profile'})</li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
