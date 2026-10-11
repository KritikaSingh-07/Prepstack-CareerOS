import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Empty, ErrorNote, formatDate, useAsync } from '../components/ui.jsx';

const COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
];

function Task({ task, onStatus, onDelete, index = 0 }) {
  return (
    <div className={`card task ${task.importance} stagger`} style={{ '--i': index }}>
      <div className="section-head">
        <strong>{task.skill}</strong>
        <span className={`tag ${task.importance}`}>{task.importance}</span>
      </div>
      <div>{task.title}</div>
      <div className="small muted">{task.description}</div>
      <div className="small muted">~{task.estimatedHours}h · {task.gapStatus === 'partial' ? 'Strengthen existing evidence' : 'New skill'}</div>
      {task.sourceJobs?.length > 0 && <div className="small">For: {task.sourceJobs.map((j) => `${j.title} (${j.company})`).join(', ')}</div>}
      <div className="prepstack-links">
        <a href={task.prepstack?.roadmapUrl} target="_blank" rel="noreferrer">Roadmap module ↗</a>
        {task.prepstack?.practice?.map((p) => <a key={p.id} href={p.url} target="_blank" rel="noreferrer">{p.title} ↗</a>)}
        {task.prepstack?.mockInterviewUrl && <a href={task.prepstack.mockInterviewUrl} target="_blank" rel="noreferrer">Mock interview ↗</a>}
      </div>
      <div className="card-actions">
        {task.status !== 'todo' && <button className="btn small ghost" onClick={() => onStatus(task._id, task.status === 'done' ? 'in_progress' : 'todo')}>← Back</button>}
        {task.status !== 'done' && <button className="btn small primary" onClick={() => onStatus(task._id, task.status === 'todo' ? 'in_progress' : 'done')}>{task.status === 'todo' ? 'Start' : 'Mark done'}</button>}
        {task.status === 'done' && <span className="small muted">Completed {formatDate(task.completedAt)}</span>}
        <button className="btn small link" onClick={() => onDelete(task._id)}>Remove</button>
      </div>
    </div>
  );
}

export default function LearningPage() {
  const [data, { error, reload }] = useAsync(() => api.learningTasks(), []);
  const tasks = data?.tasks || [];
  const onStatus = async (id, status) => { await api.updateLearningTask(id, status); reload(); };
  const onDelete = async (id) => { await api.deleteLearningTask(id); reload(); };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Targeted learning plan</h1>
          <p className="muted">Tasks created from your job-specific skill gaps, linked to your existing Prepstack roadmap, coding practice and mock interviews. Completed tasks count as evidence in future analyses.</p>
        </div>
      </div>
      <ErrorNote error={error} />
      {data && tasks.length === 0 && (
        <Empty title="No learning tasks yet">Open a job, analyse your fit, and choose “Create targeted learning plan”. <Link to="/jobs">Browse jobs →</Link></Empty>
      )}
      <div className="learning-cols">
        {COLUMNS.map((c) => (
          <div key={c.key}>
            <h3>{c.label} <span className="count-badge">{tasks.filter((t) => t.status === c.key).length}</span></h3>
            {tasks.filter((t) => t.status === c.key).map((t, i) => <Task key={t._id} index={i} task={t} onStatus={onStatus} onDelete={onDelete} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
