import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { ErrorNote, FreshnessTag, STAGE_LABEL, formatDate, useAsync } from '../components/ui.jsx';

const STAGES = ['saved', 'applied', 'assessment', 'interview', 'offer', 'rejected'];

function AppCard({ app, onMove, index = 0 }) {
  const fit = app.analysis?.summary;
  return (
    <div
      className="kanban-card stagger"
      style={{ '--i': index }}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', app._id); e.dataTransfer.effectAllowed = 'move'; }}
    >
      <Link to={`/applications/${app._id}`} className="kc-title">{app.job?.title}</Link>
      <div className="muted small">{app.job?.company}</div>
      <div className="kc-meta">
        {fit && <span className={`mini-fit ${fit.fitScore >= 75 ? 'good' : fit.fitScore >= 50 ? 'warn' : 'low'}`}>{fit.fitScore}% fit</span>}
        <FreshnessTag freshness={app.stage === 'saved' ? app.freshness : null} />
      </div>
      {app.upcomingEvent && <div className="small kc-event">📅 {app.upcomingEvent.title} · {formatDate(app.upcomingEvent.date)}</div>}
      {app.nextAction?.text && <div className="small kc-next">→ {app.nextAction.text}</div>}
      <select className="kc-move" value={app.stage} onChange={(e) => onMove(app._id, e.target.value)} aria-label="Move to stage">
        {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
      </select>
    </div>
  );
}

function AddExternal({ onAdded }) {
  const [form, setForm] = useState({ title: '', company: '', url: '', description: '', stage: 'applied' });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    try {
      const { stage, ...job } = form;
      await api.createApplication({ job, stage });
      setForm({ title: '', company: '', url: '', description: '', stage: 'applied' });
      onAdded();
    } catch (err) {
      setError(err);
    }
  }
  return (
    <form className="card form-grid" onSubmit={submit}>
      <h3 className="span-2">Track an application from another site</h3>
      <label>Job title<input value={form.title} onChange={set('title')} required /></label>
      <label>Company<input value={form.company} onChange={set('company')} required /></label>
      <label>Job URL<input type="url" value={form.url} onChange={set('url')} /></label>
      <label>Stage<select value={form.stage} onChange={set('stage')}>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></label>
      <label className="span-2">Job description (optional — enables skill-gap analysis)<textarea rows={4} value={form.description} onChange={set('description')} /></label>
      <ErrorNote error={error} />
      <div className="span-2"><button className="btn primary">Add to tracker</button></div>
    </form>
  );
}

export default function ApplicationsPage() {
  const [data, { error, reload, setData }] = useAsync(() => api.applications(), []);
  const [dragOver, setDragOver] = useState(null);
  const [moveError, setMoveError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  async function move(id, stage) {
    const prev = data;
    setMoveError(null);
    setData({ ...data, items: data.items.map((a) => (a._id === id ? { ...a, stage } : a)) });
    try {
      await api.moveApplication(id, stage);
      reload();
    } catch (e) {
      setData(prev);
      setMoveError(e);
    }
  }

  const items = data?.items || [];
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Application pipeline</h1>
          <p className="muted">Drag cards between stages. Every application has its own workspace with the job description, resume version, gaps, notes and next action.</p>
        </div>
        <button className="btn ghost" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Close' : '+ Track external application'}</button>
      </div>
      {showAdd && <AddExternal onAdded={() => { setShowAdd(false); reload(); }} />}
      <ErrorNote error={error || moveError} />
      <div className="kanban">
        {STAGES.map((stage) => {
          const col = items.filter((a) => a.stage === stage);
          return (
            <div
              key={stage}
              className={`kanban-col col-${stage} ${dragOver === stage ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(stage); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = e.dataTransfer.getData('text/plain');
                const app = items.find((a) => a._id === id);
                if (app && app.stage !== stage) move(id, stage);
              }}
            >
              <div className="kanban-col-head">{STAGE_LABEL[stage]} <span className="count-badge">{col.length}</span></div>
              {col.map((app, i) => <AppCard key={app._id} index={i} app={app} onMove={move} />)}
              {col.length === 0 && <div className="kanban-empty">Drop here</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
