import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon } from './motion.jsx';

const NAV = [
  { to: '/dashboard', label: 'Insights', icon: 'chart' },
  { to: '/jobs', label: 'Discover', icon: 'search' },
  { to: '/resume', label: 'Resume', icon: 'file' },
  { to: '/applications', label: 'Applications', icon: 'board' },
  { to: '/learning', label: 'Learning', icon: 'book' },
  { to: '/profile', label: 'Profile', icon: 'user' },
];

export function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">P</span>
      <span>Prepstack <strong>CareerOS</strong></span>
    </Link>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const initials = (user?.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="shell">
      <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
        <Brand />
        <button className="btn ghost small menu-toggle" onClick={() => setOpen(!open)} aria-label="Toggle navigation" aria-expanded={open}>
          <Icon name="menu" />
        </button>
        <nav className={`nav ${open ? 'open' : ''}`}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={n.icon} size={17} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="user">
          <span className="avatar" title={user?.name}>{initials}</span>
          <button className="btn ghost small" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="content">
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
