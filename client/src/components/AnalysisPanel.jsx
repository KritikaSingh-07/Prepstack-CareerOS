import { FitBadge, StatusPill, formatDate } from './ui.jsx';

const ORDER = { not_evidenced: 0, partial: 1, demonstrated: 2 };

function RequirementRow({ r, index }) {
  return (
    <li className={`req-row req-${r.status} stagger`} style={{ '--i': index }}>
      <div className="req-head">
        <strong>{r.skill}</strong>
        <span className={`tag ${r.importance}`}>{r.importance}</span>
        <StatusPill status={r.status} />
      </div>
      <div className="muted small">{r.reason}</div>
      {r.evidence?.length > 0 && (
        <ul className="evidence">
          {r.evidence.map((e, i) => <li key={i}><span className="ev-src">{e.source}</span> {e.label}: {e.detail}</li>)}
        </ul>
      )}
    </li>
  );
}

export default function AnalysisPanel({ analysis, compact = false }) {
  if (!analysis) return null;
  const { summary, results, suggestions, keywordCoverage } = analysis;
  const sorted = [...results].sort((a, b) => (a.importance === b.importance ? 0 : a.importance === 'mandatory' ? -1 : 1) || ORDER[a.status] - ORDER[b.status]);
  return (
    <div className="analysis">
      <div className="analysis-summary">
        <FitBadge fit={summary} />
        <span><strong>{summary.mandatoryMet}/{summary.mandatoryTotal}</strong> mandatory requirements demonstrated</span>
        <span className="muted small">Analysed {formatDate(analysis.createdAt)}</span>
      </div>
      <div className="counts">
        <span className="count status-demonstrated">{summary.demonstrated} demonstrated</span>
        <span className="count status-partial">{summary.partial} partial</span>
        <span className="count status-not_evidenced">{summary.notEvidenced} not evidenced</span>
      </div>

      <ul className="req-list">{sorted.map((r, i) => <RequirementRow key={r.skill} index={i} r={r} />)}</ul>
      <p className="disclaimer">{analysis.disclaimer}</p>

      {!compact && suggestions?.length > 0 && (
        <section>
          <h3>Specific improvements</h3>
          <ul className="suggestions">
            {suggestions.map((s, i) => (
              <li key={i} className={`suggestion s-${s.type}`}>
                <div><span className="tag">{s.type === 'learn' ? 'Learn' : s.type === 'clarify' ? 'Clarify' : 'Add evidence'}</span> <strong>{s.skill}</strong></div>
                <div>{s.message}</div>
                {s.example && <div className="example">Example (edit to match what you actually did): <em>{s.example}</em></div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!compact && keywordCoverage && (
        <section>
          <h3>Keyword coverage <span className="muted small">{Math.round(keywordCoverage.ratio * 100)}% of requirement keywords appear</span></h3>
          <div className="chips">
            {keywordCoverage.covered.map((k) => (
              <span key={k} className={`chip ${keywordCoverage.listedOnly.includes(k) ? 'chip-warn' : 'chip-ok'}`} title={keywordCoverage.listedOnly.includes(k) ? 'Mentioned, but not backed by a project or role' : 'Mentioned with evidence'}>{k}</span>
            ))}
            {keywordCoverage.missing.map((k) => <span key={k} className="chip chip-missing">{k}</span>)}
          </div>
          <p className="muted small">{keywordCoverage.note}</p>
        </section>
      )}
    </div>
  );
}
