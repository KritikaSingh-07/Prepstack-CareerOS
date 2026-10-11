import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Brand } from '../components/Layout.jsx';
import { Icon, Reveal, Ring } from '../components/motion.jsx';

const JOURNEY = [
  { icon: 'search', title: 'Discover', text: 'Find relevant jobs based on your skills, projects, experience and goals.' },
  { icon: 'scale', title: 'Evaluate', text: 'See exactly how well your profile matches each job, requirement by requirement.' },
  { icon: 'target', title: 'Improve', text: 'Turn missing skills into tasks on your existing Prepstack roadmap.' },
  { icon: 'board', title: 'Execute', text: 'Track applications, interviews, deadlines and outcomes in one place.' },
];

const FEATURES = [
  { icon: 'search', title: 'Smart job discovery', text: 'Jobs ranked by fit, with the reasons behind every recommendation and flags on stale listings.' },
  { icon: 'file', title: 'Resume intelligence', text: 'Upload a PDF and get a structured profile, plus specific fixes grounded in your real experience.' },
  { icon: 'target', title: 'Job-specific skill gaps', text: 'Requirements classified as demonstrated, partial or not yet evidenced — mandatory vs preferred.' },
  { icon: 'board', title: 'Application workspace', text: 'A Kanban pipeline where every application holds its JD, resume version, gaps, notes and next step.' },
  { icon: 'spark', title: 'Application copilot', text: 'Cover-letter drafts, project picks and bullet rewrites that never invent achievements.' },
  { icon: 'chart', title: 'Career insights', text: 'Conversion rates, weekly activity, skill trends and the next actions that matter.' },
];

const DEMO_REQS = [
  { skill: 'React', status: 'demonstrated', label: 'Demonstrated' },
  { skill: 'Node.js', status: 'demonstrated', label: 'Demonstrated' },
  { skill: 'MongoDB', status: 'demonstrated', label: 'Demonstrated' },
  { skill: 'Automated testing', status: 'partial', label: 'Partial evidence' },
  { skill: 'Docker', status: 'not_evidenced', label: 'Not evidenced' },
];

const STEPS = [
  { title: 'Find a suitable job', text: 'Rahul finds a Junior MERN role requiring React, Node.js, MongoDB, REST APIs, testing and Docker.' },
  { title: 'Analyse his profile', text: 'CareerOS compares the requirements with evidence from his resume and projects.' },
  { title: 'Create targeted actions', text: 'A testing exercise and a Docker fundamentals task are linked into his existing roadmap.' },
  { title: 'Prepare the application', text: 'He accepts honest resume rewrites, picks his best projects and saves a tailored version.' },
  { title: 'Track the outcome', text: 'He marks it applied, logs the assessment date and preps with a job-specific interview pack.' },
];

const CYCLE = ['Find a job', 'Understand the requirements', 'Close skill gaps', 'Prepare', 'Apply', 'Track the outcome'];

function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="hv-card">
        <div className="hv-head">
          <div>
            <div className="hv-title">Junior MERN Stack Developer</div>
            <div className="hv-sub">Brightloop Labs · Bengaluru · Hybrid</div>
          </div>
          <Ring value={67} size={54} stroke={6} tone="warn" label="67%" />
        </div>
        <ul className="hv-reqs">
          {DEMO_REQS.map((r, i) => (
            <li key={r.skill} style={{ '--i': i }}>
              <span>{r.skill}</span>
              <span className={`pill status-${r.status}`}>{r.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="hv-float hv-float-1"><Icon name="book" size={16} /> Docker fundamentals added to your roadmap</div>
      <div className="hv-float hv-float-2"><Icon name="check" size={16} /> Moved to <strong>Interview</strong></div>
    </div>
  );
}

export default function HomePage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function tryDemo() {
    setBusy(true);
    try {
      if (!user) await login('rahul@example.com', 'password123');
      navigate('/dashboard');
    } catch {
      navigate('/login');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="home">
      <div className="blobs" aria-hidden="true"><span /><span /><span /></div>

      <header className="home-nav">
        <Brand />
        <nav>
          <a href="#journey">How it works</a>
          <a href="#features">Features</a>
          <a href="#example">Example</a>
        </nav>
        <div className="home-nav-cta">
          {user ? (
            <Link className="btn primary" to="/dashboard">Open dashboard <Icon name="arrow" size={16} /></Link>
          ) : (
            <>
              <Link className="btn ghost" to="/login">Log in</Link>
              <Link className="btn primary" to="/login?mode=register">Get started</Link>
            </>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow anim-fade" style={{ '--d': '0ms' }}>The next evolution of Prepstack Interview Ace</span>
          <h1 className="anim-fade" style={{ '--d': '80ms' }}>
            One platform.<br /><span className="grad-text">The entire job-seeking journey.</span>
          </h1>
          <p className="lead anim-fade" style={{ '--d': '160ms' }}>
            Find jobs that fit, understand exactly where you stand, close the gaps with your Prepstack roadmap,
            and track every application — all connected.
          </p>
          <div className="hero-cta anim-fade" style={{ '--d': '240ms' }}>
            <button className="btn primary lg" onClick={tryDemo} disabled={busy}>
              {busy ? 'Opening demo…' : user ? 'Go to my dashboard' : 'Try the live demo'} <Icon name="arrow" size={18} />
            </button>
            {!user && <Link className="btn ghost lg" to="/login?mode=register">Create free account</Link>}
          </div>
          <ul className="hero-points anim-fade" style={{ '--d': '320ms' }}>
            <li><Icon name="check" size={16} /> Evidence-based fit, not vanity scores</li>
            <li><Icon name="check" size={16} /> Never invents achievements</li>
            <li><Icon name="check" size={16} /> Builds on your existing roadmap</li>
          </ul>
        </div>
        <HeroVisual />
      </section>

      <div className="marquee" aria-label="The CareerOS cycle">
        <div className="marquee-track">
          {[...CYCLE, ...CYCLE, ...CYCLE].map((c, i) => (
            <span key={i} className="marquee-item">{c} <Icon name="arrow" size={14} /></span>
          ))}
        </div>
      </div>

      <section id="journey" className="home-section">
        <Reveal className="section-intro">
          <span className="eyebrow">How it works</span>
          <h2>Four steps that finally talk to each other</h2>
          <p className="lead">The value is in the connections: a job's requirements drive your gap analysis, your gaps drive your learning plan, and your progress feeds back into every match.</p>
        </Reveal>
        <div className="journey-grid">
          {JOURNEY.map((j, i) => (
            <Reveal key={j.title} delay={i * 90} className="journey-card">
              <span className="journey-num">0{i + 1}</span>
              <span className="icon-badge"><Icon name={j.icon} /></span>
              <h3>{j.title}</h3>
              <p>{j.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="features" className="home-section">
        <Reveal className="section-intro">
          <span className="eyebrow">Features</span>
          <h2>Everything from shortlist to offer</h2>
        </Reveal>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 90} className="feature-card">
              <span className="icon-badge"><Icon name={f.icon} /></span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="example" className="home-section">
        <Reveal className="section-intro">
          <span className="eyebrow">A real example</span>
          <h2>How Rahul lands his first MERN role</h2>
        </Reveal>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 80} className="step">
              <span className="step-dot">{i + 1}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </section>

      <Reveal as="section" className="cta-band">
        <h2>Ready to see where you stand?</h2>
        <p>Explore the full workflow with Rahul's demo profile — no setup needed.</p>
        <button className="btn light lg" onClick={tryDemo} disabled={busy}>
          {user ? 'Open my dashboard' : 'Launch the demo'} <Icon name="arrow" size={18} />
        </button>
      </Reveal>

      <footer className="home-footer">
        <Brand />
        <span className="muted small">Prepstack tracks your preparation — you stay in control of every application.</span>
      </footer>
    </div>
  );
}
