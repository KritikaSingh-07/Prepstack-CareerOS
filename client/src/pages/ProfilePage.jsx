import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorNote, SkillChips, useAsync } from '../components/ui.jsx';
import { Skeleton } from '../components/motion.jsx';

const splitList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

function ProjectEditor({ project, onChange, onRemove }) {
  return (
    <div className="card project-edit">
      <div className="form-grid">
        <label>Name<input value={project.name} onChange={(e) => onChange({ ...project, name: e.target.value })} /></label>
        <label>URL<input value={project.url || ''} onChange={(e) => onChange({ ...project, url: e.target.value })} /></label>
        <label className="span-2">Technologies (comma-separated)<input value={(project.technologies || []).join(', ')} onChange={(e) => onChange({ ...project, technologies: splitList(e.target.value) })} /></label>
        <label className="span-2">What you built (one bullet per line)
          <textarea rows={4} value={(project.bullets || []).join('\n')} onChange={(e) => onChange({ ...project, bullets: e.target.value.split('\n') })} />
        </label>
      </div>
      <button className="btn small link" onClick={onRemove}>Remove project</button>
    </div>
  );
}

export default function ProfilePage() {
  const { setUser } = useAuth();
  const [data, { error }] = useAsync(() => api.getProfile(), []);
  const [form, setForm] = useState(null);
  const [state, setState] = useState({ busy: false, error: null, saved: false });

  useEffect(() => {
    if (!data) return;
    const u = data.user;
    setForm({
      name: u.name,
      skills: (u.profile?.skills || []).join(', '),
      projects: u.profile?.projects || [],
      experience: u.profile?.experience || [],
      education: u.profile?.education || [],
      targetRoles: (u.preferences?.targetRoles || []).join(', '),
      locations: (u.preferences?.locations || []).join(', '),
      remote: u.preferences?.remote || 'any',
      experienceLevel: u.preferences?.experienceLevel || 'junior',
      weeklyApplicationGoal: u.preferences?.weeklyApplicationGoal || 5,
    });
  }, [data]);

  if (error) return <ErrorNote error={error} />;
  if (!form) return <Skeleton />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setState({ busy: true, error: null, saved: false });
    try {
      const { user } = await api.updateProfile({
        name: form.name,
        profile: {
          skills: splitList(form.skills),
          projects: form.projects.filter((p) => p.name).map((p) => ({ ...p, bullets: (p.bullets || []).map((b) => b.trim()).filter(Boolean) })),
          experience: form.experience,
        },
        preferences: {
          targetRoles: splitList(form.targetRoles),
          locations: splitList(form.locations),
          remote: form.remote,
          experienceLevel: form.experienceLevel,
          weeklyApplicationGoal: Number(form.weeklyApplicationGoal) || 5,
        },
      });
      setUser(user);
      setForm({ ...form, skills: user.profile.skills.join(', '), projects: user.profile.projects });
      setState({ busy: false, error: null, saved: true });
    } catch (err) {
      setState({ busy: false, error: err, saved: false });
    }
  }

  return (
    <form onSubmit={save}>
      <div className="page-head">
        <div>
          <h1>Profile & career preferences</h1>
          <p className="muted">Built from your primary resume. Edits here are used for recommendations and skill-gap analysis.</p>
        </div>
        <button className="btn primary" disabled={state.busy}>{state.busy ? 'Saving…' : 'Save profile'}</button>
      </div>
      <ErrorNote error={state.error} />
      {state.saved && <div className="success">Profile saved. Re-analyse jobs to see the updated fit.</div>}

      <div className="two-col">
        <div>
          <section className="card">
            <h3>Skills</h3>
            <label>Skills you can show evidence for (comma-separated)<textarea rows={3} value={form.skills} onChange={set('skills')} /></label>
            <p className="small muted">A skill listed here without a matching project or role counts as partial evidence.</p>
          </section>
          <section className="card">
            <div className="section-head">
              <h3>Projects</h3>
              <button type="button" className="btn small" onClick={() => setForm({ ...form, projects: [...form.projects, { name: '', bullets: [], technologies: [] }] })}>+ Add project</button>
            </div>
            {form.projects.map((p, i) => (
              <ProjectEditor
                key={p._id || i}
                project={p}
                onChange={(np) => setForm({ ...form, projects: form.projects.map((x, j) => (j === i ? np : x)) })}
                onRemove={() => setForm({ ...form, projects: form.projects.filter((_, j) => j !== i) })}
              />
            ))}
          </section>
          <section className="card">
            <h3>Experience</h3>
            {form.experience.length === 0 && <p className="muted small">No experience entries — upload a resume to import them.</p>}
            {form.experience.map((e, i) => (
              <div key={e._id || i} className="entry">
                <strong>{e.title}</strong>{e.organization && ` · ${e.organization}`} <span className="small muted">{[e.startDate, e.endDate].filter(Boolean).join(' – ')}</span>
                <textarea rows={3} value={(e.bullets || []).join('\n')} onChange={(ev) => setForm({ ...form, experience: form.experience.map((x, j) => (j === i ? { ...x, bullets: ev.target.value.split('\n') } : x)) })} />
                <SkillChips skills={e.technologies} tone="chip-soft" />
              </div>
            ))}
          </section>
          <section className="card">
            <h3>Education</h3>
            {form.education.map((e, i) => <div key={e._id || i}>{e.degree} {e.institution && `— ${e.institution}`} <span className="small muted">{e.endDate} {e.score && `· ${e.score}`}</span></div>)}
          </section>
        </div>
        <aside>
          <section className="card stack">
            <h3>Career preferences</h3>
            <label>Name<input value={form.name} onChange={set('name')} /></label>
            <label>Target roles (comma-separated)<input value={form.targetRoles} onChange={set('targetRoles')} placeholder="MERN, Full Stack, Backend" /></label>
            <label>Preferred locations<input value={form.locations} onChange={set('locations')} placeholder="Bengaluru, Pune" /></label>
            <label>Work mode
              <select value={form.remote} onChange={set('remote')}>
                <option value="any">Any</option><option value="remote">Remote only</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option>
              </select>
            </label>
            <label>Experience level
              <select value={form.experienceLevel} onChange={set('experienceLevel')}>
                <option value="internship">Internship</option><option value="entry">Entry</option><option value="junior">Junior</option><option value="mid">Mid</option>
              </select>
            </label>
            <label>Weekly application goal<input type="number" min={1} max={50} value={form.weeklyApplicationGoal} onChange={set('weeklyApplicationGoal')} /></label>
          </section>
        </aside>
      </div>
    </form>
  );
}
