import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { formatDate, money, timeAgo } from '../utils.js';
import StatusPill from '../components/StatusPill.jsx';

export default function MyJobs() {
  const { token } = useAuth();
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await api('/jobs/mine', { token });
      setJobs(d.jobs);
    } catch (e) {
      setError(e.message);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function closeJob(id) {
    setClosing(id);
    setError('');
    try {
      await api(`/jobs/${id}/close`, { method: 'POST', token });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setClosing(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Jobs</h1>
        <Link
          to="/post-job"
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          + Post a Job
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!jobs && !error ? (
        <div className="mt-8 grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/60" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500">You haven't posted any jobs yet.</p>
          <Link
            to="/post-job"
            className="mt-3 inline-block font-semibold text-emerald-700 hover:underline"
          >
            Post your first job →
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={job.status} />
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {job.category}
                    </span>
                  </div>
                  <h2 className="mt-2 font-semibold text-slate-900">{job.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Posted {timeAgo(job.created_at)}
                    {job.deadline ? ` · Due ${formatDate(job.deadline)}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-700">
                    {job.bid_count} bid{job.bid_count === 1 ? '' : 's'}
                  </div>
                  {job.lowest_bid != null && (
                    <div className="text-xs text-slate-500">Lowest: {money(job.lowest_bid)}</div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                <Link
                  to={`/jobs/${job.id}`}
                  className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  {job.status === 'open' ? 'View bids' : 'View job'}
                </Link>
                {job.status === 'open' && (
                  <button
                    onClick={() => closeJob(job.id)}
                    disabled={closing === job.id}
                    className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                  >
                    {closing === job.id ? 'Closing…' : 'Close job'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
