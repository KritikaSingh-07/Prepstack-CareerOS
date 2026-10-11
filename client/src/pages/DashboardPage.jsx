import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { ErrorNote, STAGE_LABEL, formatDate, pct, useAsync } from '../components/ui.jsx';
import { CountUp, Icon, Skeleton } from '../components/motion.jsx';

function Stat({ label, value, suffix = '', sub, icon, i }) {
  return (
    <div className="stat" style={{ '--i': i }}>
      <div className="stat-top"><span className="stat-label">{label}</span><span className="stat-icon"><Icon name={icon} size={18} /></span></div>
      <div className="stat-value"><CountUp value={value} />{suffix}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function WeeklyChart({ weeks }) {
  const max = Math.max(1, ...weeks.map((w) => Math.max(w.applied, w.saved)));
  return (
    <div className="bars" role="img" aria-label="Applications per week over the last 8 weeks">
      {weeks.map((w) => (
        <div key={w.weekStart} className="bar-col" title={`Week of ${formatDate(w.weekStart)}: ${w.applied} applied, ${w.saved} saved`}>
          <div className="bar-pair">
            <div className="bar saved" style={{ height: `${(w.saved / max) * 100}%` }} />
            <div className="bar applied" style={{ height: `${(w.applied / max) * 100}%` }} />
          </div>
          <div className="bar-label">{new Date(w.weekStart).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
        </div>
      ))}
    </div>
  );
}

function HBarList({ rows, valueKey, max, tone }) {
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.skill}>
          <span className="hbar-label">{r.skill}</span>
          <span className="hbar-track"><span className={`hbar-fill ${tone}`} style={{ width: `${(r[valueKey] / max) * 100}%` }} /></span>
          <span className="hbar-value">{r[valueKey]}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const [data, { error, loading }] = useAsync(() => api.insights(), []);
  if (loading && !data) return <Skeleton />;
  if (error) return <ErrorNote error={error} />;
  const { totals, conversion, byStage, weeklyActivity, topSkills, commonGaps, skillsImproved, reminders, suggestions, learning } = data;
  const funnel = ['saved', 'applied', 'assessment', 'interview', 'offer'];
  const maxStage = Math.max(1, ...funnel.map((s) => byStage[s]));

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Career insights</h1>
          <p className="muted">Find a job → understand the requirements → close skill gaps → prepare → apply → track the outcome.</p>
        </div>
        <Link className="btn primary" to="/jobs">Find jobs</Link>
      </div>

      <div className="stats">
        <Stat i={0} icon="file" label="Applications submitted" value={totals.applied} sub={`${totals.appliedThisWeek}/${totals.weeklyGoal} this week`} />
        <Stat i={1} icon="user" label="Interviews" value={totals.interviews} sub={`${totals.assessments} assessments`} />
        <Stat i={2} icon="chart" label="Application → interview" value={Math.round(conversion.applicationToInterview * 100)} suffix="%" sub={`${pct(conversion.applicationToAssessment)} reach assessment`} />
        <Stat i={3} icon="spark" label="Offers" value={totals.offers} sub={`${totals.rejected} rejected`} />
        <Stat i={4} icon="book" label="Learning tasks done" value={learning.done} suffix={` / ${learning.total}`} sub={`${learning.inProgress} in progress`} />
      </div>

      <div className="two-col">
        <div>
          {suggestions.length > 0 && (
            <section className="card">
              <h3>Suggested next actions</h3>
              <ul className="suggestions">
                {suggestions.map((s, i) => <li key={i} className={`suggestion s-${s.kind}`}>{s.text}{s.skill && <> <Link to="/learning">Learning plan →</Link></>}</li>)}
              </ul>
            </section>
          )}

          <section className="card">
            <div className="section-head">
              <h3>Weekly activity</h3>
              <span className="legend"><i className="dot saved" /> saved <i className="dot applied" /> applied</span>
            </div>
            <WeeklyChart weeks={weeklyActivity} />
          </section>

          <section className="card">
            <h3>Pipeline</h3>
            <ul className="hbars">
              {funnel.map((s) => (
                <li key={s}>
                  <span className="hbar-label">{STAGE_LABEL[s]}</span>
                  <span className="hbar-track"><span className="hbar-fill accent" style={{ width: `${(byStage[s] / maxStage) * 100}%` }} /></span>
                  <span className="hbar-value">{byStage[s]}</span>
                </li>
              ))}
            </ul>
            <Link to="/applications" className="small">Open pipeline →</Link>
          </section>

          <div className="split">
            <section className="card">
              <h3>Most requested skills in your target jobs</h3>
              {topSkills.length ? <HBarList rows={topSkills} valueKey="jobs" max={topSkills[0].jobs} tone="accent" /> : <p className="muted small">Save some jobs to see trends.</p>}
            </section>
            <section className="card">
              <h3>Most common gaps</h3>
              {commonGaps.length ? <HBarList rows={commonGaps} valueKey="jobs" max={commonGaps[0].jobs} tone="warn" /> : <p className="muted small">No gaps found in analysed jobs.</p>}
            </section>
          </div>
        </div>

        <aside>
          <section className="card">
            <h3>Reminders</h3>
            {reminders.length === 0 && <p className="muted small">Nothing due in the next two weeks.</p>}
            <ul className="reminders">
              {reminders.map((r, i) => (
                <li key={i} className={`rem rem-${r.kind}`}>
                  <Link to={`/applications/${r.applicationId}`}>{r.text}</Link>
                  <div className="small muted">{formatDate(r.date)}</div>
                </li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h3>Skills improved</h3>
            {skillsImproved.length === 0 ? <p className="muted small">Complete learning tasks to build evidence for missing skills.</p> : (
              <ul className="plain">
                {skillsImproved.map((s) => <li key={s.title}><strong>{s.skill}</strong> <span className="small muted">{formatDate(s.completedAt)}</span></li>)}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
