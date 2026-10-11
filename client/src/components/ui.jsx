// Small shared presentational components.
import { useEffect, useState } from 'react';
import { Ring } from './motion.jsx';

export const STATUS_LABEL = { demonstrated: 'Demonstrated', partial: 'Partial evidence', not_evidenced: 'Not evidenced' };
export const STAGE_LABEL = { saved: 'Saved', applied: 'Applied', assessment: 'Assessment', interview: 'Interview', offer: 'Offer', rejected: 'Rejected' };

export function StatusPill({ status }) {
  return <span className={`pill status-${status}`}>{STATUS_LABEL[status] || status}</span>;
}

export function FitBadge({ fit }) {
  if (!fit) return null;
  const tone = fit.fitScore >= 75 ? 'good' : fit.fitScore >= 50 ? 'warn' : 'low';
  return (
    <span className={`fit fit-${tone}`} title="Evidence coverage of the job's requirements — not a proficiency score">
      <Ring value={fit.fitScore} size={38} stroke={4} tone={tone} />
      <span className="fit-text"><strong>{fit.fitLabel}</strong><span>evidence coverage</span></span>
    </span>
  );
}

export function FreshnessTag({ freshness }) {
  if (!freshness || freshness.state === 'open') return null;
  return <span className={`pill fresh-${freshness.state}`} title={freshness.warning || ''}>{freshness.label}</span>;
}

export function SkillChips({ skills = [], tone = '' }) {
  return (
    <div className="chips">
      {skills.map((s) => <span key={s} className={`chip ${tone}`}>{s}</span>)}
    </div>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return <div className="error-note">{error.message || String(error)}</div>;
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

export const formatDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const formatMoney = (salary) => {
  if (!salary?.min) return null;
  const f = (n) => (n >= 100000 ? `${(n / 100000).toFixed(1).replace(/\.0$/, '')}L` : `${Math.round(n / 1000)}k`);
  return `₹${f(salary.min)}–${f(salary.max)}${salary.max < 100000 ? '/mo' : '/yr'}`;
};
export const pct = (x) => `${Math.round((x || 0) * 100)}%`;

/** Loads data with loading/error state. Returns [data, { loading, error, reload, setData }]. */
export function useAsync(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fn()
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return [data, { loading, error, reload: () => setTick((t) => t + 1), setData }];
}
