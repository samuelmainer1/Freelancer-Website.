import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api';
import Avatar from './Avatar.jsx';
import ConnectPill from './ConnectPill.jsx';

const linkClass = ({ isActive }) =>
  'rounded-full px-3 py-1.5 text-sm font-medium transition ' +
  (isActive
    ? 'bg-emerald-50 text-emerald-700'
    : 'text-slate-600 hover:text-emerald-700');

export default function Navbar() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  // Refresh the messaging badge whenever we navigate
  useEffect(() => {
    if (!token) {
      setUnread(0);
      return;
    }
    let alive = true;
    api('/unread-count', { token })
      .then((d) => alive && setUnread(d.unread || 0))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token, location.pathname]);

  function handleLogout() {
    logout();
    navigate('/');
  }


  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link
          to="/"
          className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-900"
        >
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-600 text-white">
            F
          </span>
          Freelance<span className="-ml-1.5 text-emerald-600">Hub</span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>
            Find Work
          </NavLink>
          <NavLink to="/freelancers" className={linkClass}>
            Find Freelancers
          </NavLink>
          {user?.role === 'client' && (
            <>
              <NavLink to="/my-jobs" className={linkClass}>
                My Jobs
              </NavLink>
              <NavLink to="/post-job" className={linkClass}>
                Post a Job
              </NavLink>
            </>
          )}
          {user?.role === 'freelancer' && (
            <NavLink to="/my-bids" className={linkClass}>
              My Bids
            </NavLink>
          )}
          {user && (
            <NavLink to="/inbox" className={linkClass}>
              Messages
              {unread > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </NavLink>
          )}
          {user && (
            <NavLink to={`/users/${user.id}`} className={linkClass}>
              My Profile
            </NavLink>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ConnectPill />
          {user ? (
            <>
              <span className="hidden items-center gap-2 sm:flex">
                <Link to={`/users/${user.id}`} className="flex items-center gap-2">
                  <Avatar id={user.id} name={user.name} src={user.avatar} size="sm" />
                  <span className="text-sm font-semibold text-slate-700 transition hover:text-emerald-700">
                    {user.name}
                  </span>
                </Link>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                    user.role === 'client'
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-sky-100 text-sky-700'
                  }`}
                >
                  {user.role}
                </span>
              </span>
              <button
                onClick={handleLogout}
                className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-full px-4 py-1.5 text-sm font-semibold text-slate-700 transition hover:text-emerald-700"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
