import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import AnalysisPanel from '../components/AnalysisPanel.jsx';
import { ErrorNote, FreshnessTag, STAGE_LABEL, formatDate, useAsync } from '../components/ui.jsx';
import { Skeleton } from '../components/motion.jsx';

const STAGES = ['saved', 'applied', 'assessment', 'interview', 'offer', 'rejected'];
const TABS = ['Overview', 'Fit & gaps', 'Copilot', 'Interview prep', 'Notes & timeline'];
const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

function Overview({ app, freshness, save, resumes }) {
  const [nextAction, setNextAction] = useState({ text: app.nextAction?.text || '', dueDate: toInputDate(app.nextAction?.dueDate) });
  const [event, setEvent] = useState({ type: 'interview', title: '', date: '' });
  const [contact, setContact] = useState({ name: '', role: '', email: '' });
  const job = app.job;

  return (
    <div className="two-col">
      <div>
        <section className="card">
          <h3>Next action</h3>
          <form className="row" onSubmit={(e) => { e.preventDefault(); save({ nextAction: { text: nextAction.text, dueDate: nextAction.dueDate || null } }); }}>
            <input placeholder="e.g. Finish testing task before applying" value={nextAction.text} onChange={(e) => setNextAction({ ...nextAction, text: e.target.value })} />
            <input type="date" value={nextAction.dueDate} onChange={(e) => setNextAction({ ...nextAction, dueDate: e.target.value })} />
            <button className="btn small primary">Save</button>
          </form>
        </section>

        <section className="card">
          <h3>Deadlines, assessments & interviews</h3>
          <ul className="events">
            {[...app.events].sort((a, b) => new Date(a.date) - new Date(b.date)).map((ev) => (
              <li key={ev._id} className={ev.done ? 'done' : ''}>
                <label className="inline">
                  <input type="checkbox" checked={ev.done} onChange={() => save({ events: app.events.map((x) => (x._id === ev._id ? { ...x, done: !x.done } : x)) })} />
                  <span className={`tag ev-${ev.type}`}>{ev.type.replace('_', ' ')}</span> {ev.title} — {formatDate(ev.date)}
                </label>
                <button className="btn link small" onClick={() => save({ events: app.events.filter((x) => x._id !== ev._id) })}>remove</button>
              </li>
            ))}
          </ul>
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (!event.title || !event.date) return; save({ events: [...app.events, event] }); setEvent({ type: 'interview', title: '', date: '' }); }}>
            <select value={event.type} onChange={(e) => setEvent({ ...event, type: e.target.value })}>
              <option value="interview">Interview</option><option value="assessment">Assessment</option><option value="deadline">Deadline</option><option value="follow_up">Follow-up</option><option value="other">Other</option>
            </select>
            <input placeholder="Title" value={event.title} onChange={(e) => setEvent({ ...event, title: e.target.value })} />
            <input type="date" value={event.date} onChange={(e) => setEvent({ ...event, date: e.target.value })} />
            <button className="btn small">Add</button>
          </form>
        </section>

        <section className="card">
          <h3>Contacts</h3>
          <ul className="plain">
            {app.contacts.map((c) => (
              <li key={c._id}>{c.name} {c.role && <span className="muted">· {c.role}</span>} {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                <button className="btn link small" onClick={() => save({ contacts: app.contacts.filter((x) => x._id !== c._id) })}>remove</button>
              </li>
            ))}
          </ul>
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (!contact.name) return; save({ contacts: [...app.contacts, contact] }); setContact({ name: '', role: '', email: '' }); }}>
            <input placeholder="Name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
            <input placeholder="Role" value={contact.role} onChange={(e) => setContact({ ...contact, role: e.target.value })} />
            <input placeholder="Email" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
            <button className="btn small">Add</button>
          </form>
        </section>

        <section className="card">
          <h3>Job description</h3>
          <pre className="jd">{job.description}</pre>
        </section>
      </div>
      <aside>
        <section className="card">
          <h3>Listing</h3>
          <div className="stack small">
            <FreshnessTag freshness={freshness} />
            {freshness.warning && <div className="notice warn">{freshness.warning}</div>}
            <div>Closes: {formatDate(job.closingDate)}</div>
            <div>Applied: {formatDate(app.appliedAt)}</div>
            <label>Job URL<input defaultValue={app.jobUrl || ''} onBlur={(e) => e.target.value !== (app.jobUrl || '') && save({ jobUrl: e.target.value })} /></label>
            {app.jobUrl && <a href={app.jobUrl} target="_blank" rel="noreferrer">Open listing ↗</a>}
            <Link to={`/jobs/${job._id}`}>View job page →</Link>
          </div>
        </section>
        <section className="card">
          <h3>Resume version used</h3>
          <select value={app.resumeVersion?._id || ''} onChange={(e) => save({ resumeVersion: e.target.value || null })}>
            <option value="">Not selected</option>
            {resumes?.resumes.map((r) => <option key={r._id} value={r._id}>{r.label} (v{r.version})</option>)}
          </select>
          <p className="small muted">Tailor a version in the Copilot tab, then it's linked here automatically.</p>
        </section>
      </aside>
    </div>
  );
}

function Copilot({ app, save, reloadAll }) {
  const [status] = useAsync(() => api.copilotStatus(), []);
  const [letter, setLetter] = useState(app.coverLetter || '');
  const [letterMeta, setLetterMeta] = useState(null);
  const [projects, setProjects] = useState(null);
  const [bullets, setBullets] = useState(null);
  const [accepted, setAccepted] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState('');

  async function run(key, fn) {
    setBusy(key);
    setError(null);
    try { await fn(); } catch (e) { setError(e); } finally { setBusy(''); }
  }

  async function saveTailored() {
    const { resumes, primaryResume } = await api.resumes();
    const baseId = app.resumeVersion?._id || primaryResume || resumes[0]?._id;
    if (!baseId) throw new Error('Upload a resume first.');
    const { resume } = await api.getResume(baseId);
    const replace = (entries) => entries.map((e) => ({ ...e, bullets: e.bullets.map((b) => accepted[b] ?? b) }));
    await api.tailorResume(baseId, {
      jobId: app.job._id,
      applicationId: app._id,
      label: `${app.job.company} — ${app.job.title}`,
      parsed: { experience: replace(resume.parsed.experience), projects: replace(resume.parsed.projects) },
    });
    setSaved('Tailored resume version saved and linked to this application.');
    reloadAll();
  }

  return (
    <div>
      <div className="notice">
        Copilot drafts using only verified information from your profile{status?.llm === 'claude' ? ' (written with Claude)' : ' (grounded templates)'}. You review and edit everything — Prepstack never submits applications for you.
      </div>
      <ErrorNote error={error} />

      <section className="card">
        <div className="section-head">
          <h3>Projects that best demonstrate the requirements</h3>
          <button className="btn small" disabled={busy === 'projects'} onClick={() => run('projects', async () => setProjects((await api.projectSelection(app._id)).projects))}>Suggest projects</button>
        </div>
        {projects && (projects.length === 0 ? <p className="muted">None of your projects show this job's requirements yet — see your learning plan.</p> : (
          <ul className="plain">
            {projects.map((p) => (
              <li key={p.name} className="project-pick">
                <label className="inline">
                  <input type="checkbox" checked={app.selectedProjects.includes(p.name)} onChange={(e) => save({ selectedProjects: e.target.checked ? [...app.selectedProjects, p.name] : app.selectedProjects.filter((x) => x !== p.name) })} />
                  <strong>{p.name}</strong>
                </label>
                <div className="chips">{p.matchedSkills.map((s) => <span key={s} className="chip chip-ok">{s}</span>)}</div>
                <div className="small muted">{p.talkingPoint}</div>
              </li>
            ))}
          </ul>
        ))}
      </section>

      <section className="card">
        <div className="section-head">
          <h3>Resume bullet suggestions</h3>
          <button className="btn small" disabled={busy === 'bullets'} onClick={() => run('bullets', async () => setBullets(await api.bulletSuggestions(app._id)))}>Suggest rewrites</button>
        </div>
        {bullets && (
          <>
            <p className="small muted">{bullets.note}</p>
            {bullets.suggestions.length === 0 && <p className="muted">No rewrites needed for this job.</p>}
            {bullets.suggestions.map((s) => (
              <div key={s.original} className="bullet-row">
                <div className="small muted">{s.entry}</div>
                <div className="before">{s.original}</div>
                <textarea rows={2} value={accepted[s.original] ?? s.suggestion} onChange={(e) => setAccepted({ ...accepted, [s.original]: e.target.value })} />
                <div className="small muted">{s.notes.join(' ')}</div>
                <label className="inline small">
                  <input type="checkbox" checked={s.original in accepted} onChange={(e) => {
                    const next = { ...accepted };
                    if (e.target.checked) next[s.original] = s.suggestion; else delete next[s.original];
                    setAccepted(next);
                  }} /> Use this rewrite (edit it first if needed)
                </label>
              </div>
            ))}
            {Object.keys(accepted).length > 0 && (
              <button className="btn primary" disabled={busy === 'tailor'} onClick={() => run('tailor', saveTailored)}>Save as tailored resume version for this job</button>
            )}
            {saved && <div className="success">{saved}</div>}
          </>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <h3>Cover letter draft</h3>
          <button className="btn small" disabled={busy === 'letter'} onClick={() => run('letter', async () => { const d = await api.coverLetter(app._id); setLetter(d.text); setLetterMeta(d); })}>{letter ? 'Regenerate draft' : 'Generate draft'}</button>
        </div>
        {letterMeta && <p className="small muted">{letterMeta.reviewNote}</p>}
        <textarea rows={14} value={letter} onChange={(e) => setLetter(e.target.value)} placeholder="Generate a draft, then edit it in your own voice." />
        <button className="btn small primary" disabled={letter === app.coverLetter} onClick={() => run('saveLetter', () => save({ coverLetter: letter }))}>Save cover letter</button>
      </section>

      <section className="card">
        <div className="section-head">
          <h3>Application checklist</h3>
          <button className="btn small" disabled={busy === 'checklist'} onClick={() => run('checklist', async () => { await api.checklist(app._id); reloadAll(); })}>{app.checklist.length ? 'Refresh checklist' : 'Create checklist'}</button>
        </div>
        <ul className="checklist">
          {app.checklist.map((c) => (
            <li key={c._id} className={c.done ? 'done' : ''}>
              <label className="inline"><input type="checkbox" checked={c.done} onChange={() => save({ checklist: app.checklist.map((x) => (x._id === c._id ? { ...x, done: !x.done } : x)) })} /> {c.text}</label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function InterviewPrep({ app, reloadAll }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const pack = app.interviewPack;
  async function generate() {
    setBusy(true);
    try { await api.interviewPack(app._id); reloadAll(); } catch (e) { setError(e); } finally { setBusy(false); }
  }
  return (
    <div>
      <div className="section-head">
        <p className="muted">A job-specific revision pack built from your existing Prepstack interview questions, coding practice and mock interviews — prioritised by your gaps.</p>
        <button className="btn primary" disabled={busy} onClick={generate}>{pack ? 'Rebuild pack' : 'Build revision pack'}</button>
      </div>
      <ErrorNote error={error} />
      {pack && (
        <>
          <a className="btn ghost" href={pack.mockInterviewUrl} target="_blank" rel="noreferrer">Start a job-specific mock interview in Prepstack ↗</a>
          <div className="pack-grid">
            {pack.topics.map((t) => (
              <section key={t.skill} className={`card pack pri-${t.priority}`}>
                <div className="section-head"><h3>{t.skill}</h3><span className={`tag pri-${t.priority}`}>{t.priority} priority</span></div>
                <ul>{t.questions.map((q) => <li key={q}>{q}</li>)}</ul>
                <div className="small"><strong>Practise in the Prepstack editor:</strong></div>
                <ul className="small">{t.practice.map((p) => <li key={p.id}><a href={p.url} target="_blank" rel="noreferrer">{p.title} ↗</a></li>)}</ul>
              </section>
            ))}
          </div>
          {pack.projectDeepDives.length > 0 && (
            <section className="card">
              <h3>Project deep-dives</h3>
              {pack.projectDeepDives.map((p) => (
                <div key={p.project}><strong>{p.project}</strong><ul>{p.questions.map((q) => <li key={q}>{q}</li>)}</ul></div>
              ))}
            </section>
          )}
          <section className="card">
            <h3>Behavioural</h3>
            <ul>{pack.behavioural.map((q) => <li key={q}>{q}</li>)}</ul>
          </section>
        </>
      )}
      <NotesBox app={app} field="interviewNotes" title="Interview notes" />
    </div>
  );
}

function NotesBox({ app, field, title }) {
  const [value, setValue] = useState(app[field] || '');
  const [state, setState] = useState('');
  useEffect(() => setValue(app[field] || ''), [app, field]);
  async function saveNotes() {
    setState('Saving…');
    try { await api.updateApplication(app._id, { [field]: value }); setState('Saved'); } catch (e) { setState(e.message); }
  }
  return (
    <section className="card">
      <div className="section-head"><h3>{title}</h3><span className="small muted">{state}</span></div>
      <textarea rows={8} value={value} onChange={(e) => { setValue(e.target.value); setState(''); }} onBlur={() => value !== (app[field] || '') && saveNotes()} />
    </section>
  );
}

export default function ApplicationWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(TABS[0]);
  const [data, { loading, error, reload, setData }] = useAsync(() => api.getApplication(id), [id]);
  const [resumes, resumesState] = useAsync(() => api.resumes(), []);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (loading && !data) return <Skeleton />;
  if (error) return <ErrorNote error={error} />;
  const { application: app, latestAnalysis, learningTasks, freshness } = data;

  async function save(patch) {
    setActionError(null);
    try {
      const { application } = await api.updateApplication(app._id, patch);
      // Keep populated fields (job, resumeVersion) from the current view, then refresh.
      setData({ ...data, application: { ...app, ...application, job: app.job, resumeVersion: app.resumeVersion } });
      if ('resumeVersion' in patch) reload();
    } catch (e) {
      setActionError(e);
    }
  }
  async function move(stage) {
    try { await api.moveApplication(app._id, stage); reload(); } catch (e) { setActionError(e); }
  }
  async function reanalyse() {
    setBusy(true);
    try { await api.analyzeJob(app.job._id); reload(); } catch (e) { setActionError(e); } finally { setBusy(false); }
  }
  async function plan() {
    setBusy(true);
    try { await api.planLearning(app.job._id); reload(); } catch (e) { setActionError(e); } finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm('Stop tracking this application? Its notes and timeline will be deleted.')) return;
    await api.deleteApplication(app._id);
    navigate('/applications');
  }

  return (
    <div>
      <Link to="/applications" className="muted small">← Pipeline</Link>
      <div className="page-head">
        <div>
          <h1>{app.job.title}</h1>
          <div className="muted">{app.job.company} · {app.job.workMode === 'remote' ? 'Remote' : app.job.location}</div>
        </div>
        <div className="inline-controls">
          <select value={app.stage} onChange={(e) => move(e.target.value)} className="stage-select">
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </select>
          <button className="btn small danger" onClick={remove}>Delete</button>
        </div>
      </div>
      <div className="stage-track">
        {STAGES.filter((s) => s !== 'rejected').map((s) => {
          const reached = app.timeline.some((t) => t.to === s) || app.stage === s;
          return <span key={s} className={`stage-step ${reached ? 'reached' : ''} ${app.stage === s ? 'current' : ''}`}>{STAGE_LABEL[s]}</span>;
        })}
        {app.stage === 'rejected' && <span className="stage-step current rejected">Rejected</span>}
      </div>
      <ErrorNote error={actionError} />

      <div className="tabs">
        {TABS.map((t) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Overview' && <Overview app={app} freshness={freshness} save={save} resumes={resumes} />}

      {tab === 'Fit & gaps' && (
        <div className="two-col">
          <section className="card">
            <div className="section-head">
              <h3>Skill-gap analysis</h3>
              <button className="btn small" disabled={busy} onClick={reanalyse}>Re-analyse</button>
            </div>
            {latestAnalysis ? <AnalysisPanel analysis={latestAnalysis} /> : <p className="muted">No analysis yet.</p>}
          </section>
          <aside>
            <section className="card">
              <h3>Learning tasks for this job</h3>
              {learningTasks.length === 0 && <p className="muted small">No tasks yet.</p>}
              <ul className="plain">
                {learningTasks.map((t) => (
                  <li key={t._id}>
                    <span className={`tag task-${t.status}`}>{t.status.replace('_', ' ')}</span> <strong>{t.skill}</strong>
                    <div className="small"><a href={t.prepstack?.roadmapUrl} target="_blank" rel="noreferrer">{t.title} ↗</a></div>
                  </li>
                ))}
              </ul>
              <button className="btn primary full" disabled={busy} onClick={plan}>Add gaps to learning plan</button>
            </section>
          </aside>
        </div>
      )}

      {tab === 'Copilot' && <Copilot app={app} save={save} reloadAll={() => { reload(); resumesState.reload(); }} />}
      {tab === 'Interview prep' && <InterviewPrep app={app} reloadAll={reload} />}

      {tab === 'Notes & timeline' && (
        <div className="two-col">
          <NotesBox app={app} field="notes" title="Notes" />
          <section className="card">
            <h3>Timeline</h3>
            <ol className="timeline">
              {[...app.timeline].reverse().map((t, i) => (
                <li key={i}>
                  <strong>{t.from ? `${STAGE_LABEL[t.from]} → ${STAGE_LABEL[t.to]}` : STAGE_LABEL[t.to]}</strong>
                  <span className="muted small"> {formatDate(t.at)}</span>
                  {t.note && <div className="small">{t.note}</div>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
