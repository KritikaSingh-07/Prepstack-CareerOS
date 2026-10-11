import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Brand } from '../components/Layout.jsx';
import { Icon } from '../components/motion.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorNote } from '../components/ui.jsx';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="blobs" aria-hidden="true"><span /><span /><span /></div>
      <div className="auth-pitch">
        <Brand />
        <h1>One platform. The entire job-seeking journey.</h1>
        <ol className="journey">
          <li><Icon name="search" /> <span><strong>Discover</strong> jobs that fit your skills and goals</span></li>
          <li><Icon name="scale" /> <span><strong>Evaluate</strong> how well your profile matches each job</span></li>
          <li><Icon name="target" /> <span><strong>Improve</strong> by closing gaps through your Prepstack roadmap</span></li>
          <li><Icon name="board" /> <span><strong>Execute</strong> by tracking applications, interviews and outcomes</span></li>
        </ol>
        <Link to="/" className="back-home">← Back to home</Link>
      </div>
      <form className="card auth-card" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Log in' : 'Create your account'}</h2>
        {mode === 'register' && (
          <label>Name<input value={form.name} onChange={set('name')} required autoComplete="name" /></label>
        )}
        <label>Email<input type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></label>
        <label>Password<input type="password" value={form.password} onChange={set('password')} required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        <ErrorNote error={error} />
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
        <button type="button" className="btn link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
        </button>
        {mode === 'login' && (
          <button type="button" className="btn ghost" onClick={() => setForm({ ...form, email: 'rahul@example.com', password: 'password123' })}>
            Use demo account (Rahul)
          </button>
        )}
      </form>
    </div>
  );
}
