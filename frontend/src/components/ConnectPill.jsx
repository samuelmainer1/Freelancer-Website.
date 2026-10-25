import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api';
import { pluralize } from '../utils.js';

// Navbar chip showing how many Connects (bid credits) a freelancer has left.
// Refetches on navigation so the count stays honest after placing or buying.
export default function ConnectPill({ onBalance }) {
  const { user, token } = useAuth();
  const location = useLocation();
  const [balance, setBalance] = useState(null);

  const isFreelancer = user?.role === 'freelancer';

  useEffect(() => {
    if (!token || !isFreelancer) {
      setBalance(null);
      return;
    }
    let alive = true;
    api('/connects', { token })
      .then((d) => {
        if (!alive) return;
        setBalance(d.balance);
        onBalance?.(d.balance);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isFreelancer, location.pathname]);

  if (!isFreelancer || balance == null) return null;

  const low = balance < 1;
  return (
    <Link
      to="/connects"
      title="Connects are spent when you bid on a new job"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
        low
          ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
          : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
      }`}
    >
      <span aria-hidden="true">⚡</span>
      <span data-testid="connect-count">{balance}</span>
      <span className="hidden sm:inline">{pluralize(balance, 'Connect', 'Connects')}</span>
      {low && <span className="font-bold">· Buy</span>}
    </Link>
  );
}
