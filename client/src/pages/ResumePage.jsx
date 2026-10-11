import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import AnalysisPanel from '../components/AnalysisPanel.jsx';
import { Empty, ErrorNote, SkillChips, formatDate, useAsync } from '../components/ui.jsx';

function UploadForm({ onUploaded, hasPrimary }) {
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState('');
  const [apply, setApply] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function submit(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { resume } = await api.uploadResume(file, label, apply);
      setFile(null);
      setLabel('');
      e.target.reset();
      onUploaded(resume._id);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card upload" onSubmit={submit}>
      <h3>Upload a resume</h3>
      <p className="muted small">PDF (text-based, not scanned), up to 5 MB. Each upload is saved as a new version.</p>
      <input type="file" accept="application/pdf,text/plain" onChange={(e) => setFile(e.target.files[0])} required />
      <input placeholder="Version label (e.g. General, Backend-focused)" value={label} onChange={(e) => setLabel(e.target.value)} />
      {hasPrimary && <label className="inline"><input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} /> Update my profile from this resume</label>}
      <ErrorNote error={error} />
      <button className="btn primary" disabled={busy || !file}>{busy ? 'Parsing…' : 'Upload & analyse'}</button>
    </form>
  );
}

function ParsedResume({ resume }) {
  const p = resume.parsed;
  return (
    <div className="parsed">
      <section>
        <h3>Contact</h3>
        <div>{p.contact?.name} · {p.contact?.email || <em className="warn-text">no email</em>} · {p.contact?.phone || <em className="warn-text">no phone</em>}</div>
        <div className="small muted">{p.contact?.links?.join(' · ')}</div>
      </section>
      <section>
        <h3>Skills listed</h3>
        <SkillChips skills={p.skills} />
      </section>
      <section>
        <h3>Education</h3>
        {p.education.length ? p.education.map((e) => (
          <div key={e._id}>{e.degree}{e.institution && ` — ${e.institution}`} <span className="muted small">{[e.startDate, e.endDate].filter(Boolean).join('–')} {e.score && `· ${e.score}`}</span></div>
        )) : <span className="muted">Not detected</span>}
      </section>
      <section>
        <h3>Experience</h3>
        {p.experience.length ? p.experience.map((e) => (
          <div key={e._id} className="entry">
            <strong>{e.title}</strong>{e.organization && ` · ${e.organization}`} <span className="muted small">{[e.startDate, e.endDate].filter(Boolean).join(' – ')}</span>
            <ul>{e.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
            <SkillChips skills={e.technologies} tone="chip-soft" />
          </div>
        )) : <span className="muted">Not detected</span>}
      </section>
      <section>
        <h3>Projects</h3>
        {p.projects.length ? p.projects.map((pr) => (
          <div key={pr._id} className="entry">
            <strong>{pr.name}</strong> {pr.url && <a href={pr.url.startsWith('http') ? pr.url : `https://${pr.url}`} target="_blank" rel="noreferrer" className="small">link ↗</a>}
            <ul>{pr.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
            <SkillChips skills={pr.technologies} tone="chip-soft" />
          </div>
        )) : <span className="muted">Not detected</span>}
      </section>
    </div>
  );
}

export default function ResumePage() {
  const [list, listState] = useAsync(() => api.resumes(), []);
  const [selectedId, setSelectedId] = useState(null);
  const [jobs] = useAsync(() => api.searchJobs({ limit: 100 }), []);
  const [compareJob, setCompareJob] = useState('');
  const [comparison, setComparison] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedId && list?.resumes.length) setSelectedId(list.primaryResume || list.resumes[0]._id);
  }, [list, selectedId]);
  const [detail] = useAsync(() => (selectedId ? api.getResume(selectedId) : Promise.resolve(null)), [selectedId]);
  const resume = detail?.resume;

  async function act(fn) {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError(e); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Resume intelligence</h1>
          <p className="muted">Your resume becomes a structured profile. We point out missing or unclear information and compare any version against a specific job.</p>
        </div>
      </div>
      <div className="two-col reverse">
        <aside>
          <UploadForm hasPrimary={Boolean(list?.primaryResume)} onUploaded={(id) => { listState.reload(); setSelectedId(id); }} />
          <section className="card">
            <h3>Versions</h3>
            {list?.resumes.length === 0 && <Empty title="No resumes yet">Upload your first resume to build your profile.</Empty>}
            <ul className="versions">
              {list?.resumes.map((r) => (
                <li key={r._id} className={r._id === selectedId ? 'active' : ''} onClick={() => { setSelectedId(r._id); setComparison(null); }}>
                  <div><strong>{r.label}</strong> <span className="muted small">v{r.version}</span></div>
                  <div className="small muted">
                    {r.source === 'tailored' ? `Tailored${r.targetJob ? ` for ${r.targetJob.company}` : ''}` : r.fileName} · {formatDate(r.createdAt)}
                    {r._id === list.primaryResume && <span className="tag good">primary</span>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <div>
          <ErrorNote error={error} />
          {resume && (
            <>
              <section className="card">
                <div className="section-head">
                  <h2>{resume.label} <span className="muted small">v{resume.version}</span></h2>
                  <div className="inline-controls">
                    {resume._id !== list?.primaryResume && <button className="btn small" disabled={busy} onClick={() => act(async () => { await api.setPrimaryResume(resume._id); listState.reload(); })}>Make primary & update profile</button>}
                    {resume._id !== list?.primaryResume && <button className="btn small danger" disabled={busy} onClick={() => act(async () => { await api.deleteResume(resume._id); setSelectedId(null); listState.reload(); })}>Delete</button>}
                  </div>
                </div>
                <h3>Missing or unclear information</h3>
                {resume.issues.length === 0 ? <p className="muted">No issues found.</p> : (
                  <ul className="issues">
                    {resume.issues.map((i, n) => (
                      <li key={n} className={`issue sev-${i.severity}`}>
                        <div><span className={`tag sev-${i.severity}`}>{i.severity}</span> {i.message}</div>
                        <div className="small muted">{i.suggestion}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card">
                <div className="section-head">
                  <h2>Compare against a job</h2>
                  <div className="inline-controls">
                    <select value={compareJob} onChange={(e) => setCompareJob(e.target.value)}>
                      <option value="">Choose a job…</option>
                      {jobs?.items.map(({ job }) => <option key={job._id} value={job._id}>{job.title} — {job.company}</option>)}
                    </select>
                    <button className="btn small primary" disabled={!compareJob || busy} onClick={() => act(async () => setComparison((await api.compareResume(resume._id, compareJob)).analysis))}>Compare</button>
                  </div>
                </div>
                {comparison ? <AnalysisPanel analysis={comparison} /> : <p className="muted small">See which requirements this version demonstrates and get specific, evidence-based improvement suggestions.</p>}
              </section>

              <section className="card">
                <h2>Structured profile</h2>
                <ParsedResume resume={resume} />
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
