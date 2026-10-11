import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { Empty, ErrorNote, FitBadge, FreshnessTag, formatDate, formatMoney, useAsync, STAGE_LABEL } from '../components/ui.jsx';
import { Skeleton } from '../components/motion.jsx';

function SaveButton({ jobId, application, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (application && application.stage !== 'saved') {
    return <Link className="btn small ghost" to={`/applications/${application._id}`}>{STAGE_LABEL[application.stage]} →</Link>;
  }
  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (application) await api.unsaveJob(jobId);
      else await api.saveJob(jobId);
      onChange();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className={`btn small ${application ? 'ghost' : 'primary'}`} disabled={busy} onClick={toggle}>
        {application ? '★ Shortlisted' : '☆ Save'}
      </button>
      {error && <span className="error-inline">{error.message}</span>}
    </>
  );
}

function JobCard({ item, onChange, index = 0 }) {
  const { job, fit, freshness, reasons, cautions, keyRequirements, application } = item;
  return (
    <article className="card job-card stagger" style={{ '--i': Math.min(index, 12) }}>
      <div className="job-card-head">
        <div>
          <Link to={`/jobs/${job._id}`} className="job-title">{job.title}</Link>
          <div className="muted">{job.company} · {job.workMode === 'remote' ? 'Remote' : `${job.location} (${job.workMode})`} · {job.experienceLevel}</div>
        </div>
        <FitBadge fit={fit} />
      </div>
      <div className="job-meta">
        <FreshnessTag freshness={freshness} />
        {formatMoney(job.salary) && <span className="muted small">{formatMoney(job.salary)}</span>}
        <span className="muted small">Posted {formatDate(job.postedAt)}</span>
        {job.closingDate && <span className="muted small">Closes {formatDate(job.closingDate)}</span>}
      </div>
      {reasons?.length > 0 && (
        <div className="why">
          <span className="why-label">Why recommended</span>
          <ul>{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      {cautions?.length > 0 && <ul className="cautions">{cautions.map((c) => <li key={c}>{c}</li>)}</ul>}
      {keyRequirements?.length > 0 && (
        <div className="key-reqs">
          <span className="why-label">Requirements that matter most</span>
          <div className="chips">
            {keyRequirements.map((r) => <span key={r.skill} className={`chip req-chip status-${r.status}`} title={r.status}>{r.skill}</span>)}
          </div>
        </div>
      )}
      {!keyRequirements && (
        <div className="chips">
          {job.requirements.slice(0, 7).map((r) => <span key={r.skill} className={`chip ${r.importance === 'preferred' ? 'chip-soft' : ''}`}>{r.skill}</span>)}
        </div>
      )}
      <div className="card-actions">
        <Link className="btn small ghost" to={`/jobs/${job._id}`}>View fit & gaps</Link>
        <SaveButton jobId={job._id} application={application} onChange={onChange} />
      </div>
    </article>
  );
}

function AddJobForm({ onDone }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', company: '', location: '', workMode: 'onsite', url: '', closingDate: '', description: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { job } = await api.createJob({ ...form, closingDate: form.closingDate || undefined });
      onDone();
      navigate(`/jobs/${job._id}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }
  return (
    <form className="card form-grid" onSubmit={submit}>
      <h3 className="span-2">Add a job you found elsewhere</h3>
      <label>Title<input value={form.title} onChange={set('title')} required /></label>
      <label>Company<input value={form.company} onChange={set('company')} required /></label>
      <label>Location<input value={form.location} onChange={set('location')} /></label>
      <label>Work mode
        <select value={form.workMode} onChange={set('workMode')}><option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select>
      </label>
      <label>Job URL<input type="url" value={form.url} onChange={set('url')} /></label>
      <label>Closing date<input type="date" value={form.closingDate} onChange={set('closingDate')} /></label>
      <label className="span-2">Job description (paste it — requirements are extracted automatically)
        <textarea rows={8} value={form.description} onChange={set('description')} required />
      </label>
      <ErrorNote error={error} />
      <div className="span-2 card-actions"><button className="btn primary" disabled={busy}>Add and analyse</button></div>
    </form>
  );
}

export default function JobsPage() {
  const [tab, setTab] = useState('recommended');
  const [filters, setFilters] = useState({ q: '', role: '', level: '', workMode: '', location: '', skills: '', sort: 'recent', includeClosed: false });
  const [applied, setApplied] = useState(filters);
  const [showAdd, setShowAdd] = useState(false);
  const [meta] = useAsync(() => api.jobFilters(), []);
  const [recs, recState] = useAsync(() => api.recommendedJobs(20), []);
  const [search, searchState] = useAsync(() => (tab === 'browse' ? api.searchJobs({ ...applied, limit: 50 }) : Promise.resolve(null)), [tab, applied]);

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const refresh = () => { recState.reload(); searchState.reload(); };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Discover jobs</h1>
          <p className="muted">Ranked by how well your evidence covers each job's requirements, plus your preferences.</p>
        </div>
        <button className="btn ghost" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Close' : '+ Add external job'}</button>
      </div>
      {showAdd && <AddJobForm onDone={() => setShowAdd(false)} />}

      <div className="tabs">
        <button className={tab === 'recommended' ? 'active' : ''} onClick={() => setTab('recommended')}>Recommended for you</button>
        <button className={tab === 'browse' ? 'active' : ''} onClick={() => setTab('browse')}>Search & filter</button>
      </div>

      {tab === 'recommended' && (
        <>
          <ErrorNote error={recState.error} />
          {recs && !recs.hasProfile && (
            <div className="notice">Upload your resume to get recommendations based on your actual skills and projects. <Link to="/resume">Upload resume →</Link></div>
          )}
          {recState.loading && !recs ? <Skeleton /> : (
            <div className="job-grid">{recs?.items.map((item, i) => <JobCard key={item.job._id} index={i} item={item} onChange={refresh} />)}</div>
          )}
        </>
      )}

      {tab === 'browse' && (
        <>
          <form className="filters card" onSubmit={(e) => { e.preventDefault(); setApplied(filters); }}>
            <input placeholder="Search title, company or description" value={filters.q} onChange={set('q')} />
            <select value={filters.role} onChange={set('role')}>
              <option value="">Any role</option>
              {meta?.roles.map((r) => <option key={r}>{r}</option>)}
            </select>
            <select value={filters.level} onChange={set('level')}>
              <option value="">Any experience</option>
              {meta?.levels.map((l) => <option key={l}>{l}</option>)}
            </select>
            <select value={filters.workMode} onChange={set('workMode')}>
              <option value="">Remote / on-site</option>
              {meta?.workModes.map((l) => <option key={l}>{l}</option>)}
            </select>
            <select value={filters.location} onChange={set('location')}>
              <option value="">Any location</option>
              {meta?.locations.map((l) => <option key={l}>{l}</option>)}
            </select>
            <select value={filters.skills} onChange={set('skills')}>
              <option value="">Any tech stack</option>
              {meta?.skills.map((l) => <option key={l}>{l}</option>)}
            </select>
            <select value={filters.sort} onChange={set('sort')}>
              <option value="recent">Newest</option>
              <option value="fit">Best fit</option>
              <option value="closing">Closing soonest</option>
            </select>
            <label className="inline"><input type="checkbox" checked={filters.includeClosed} onChange={set('includeClosed')} /> Include closed</label>
            <button className="btn primary">Apply filters</button>
          </form>
          <ErrorNote error={searchState.error} />
          {search && <p className="muted">{search.total} job{search.total === 1 ? '' : 's'} found</p>}
          {search?.items.length === 0 && <Empty title="No jobs match these filters">Try removing a filter.</Empty>}
          <div className="job-grid">{search?.items.map((item, i) => <JobCard key={item.job._id} index={i} item={item} onChange={refresh} />)}</div>
        </>
      )}
    </div>
  );
}
