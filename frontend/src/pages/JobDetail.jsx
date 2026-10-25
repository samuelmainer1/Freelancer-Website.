import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { budgetRange, formatDate, timeAgo } from '../utils.js';
import StatusPill from '../components/StatusPill.jsx';
import BidForm from '../components/BidForm.jsx';
import BidsPanel from '../components/BidsPanel.jsx';
import Stars from '../components/Stars.jsx';

export default function JobDetail() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const [job, setJob] = useState(null);
  const [bidsInfo, setBidsInfo] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null); // { type: 'ok'|'err', text }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api(`/jobs/${id}`);
      setJob(d.job);
      if (token) {
        try {
          setBidsInfo(await api(`/jobs/${id}/bids`, { token }));
        } catch {
          setBidsInfo(null);
        }
      } else {
        setBidsInfo(null);
      }
    } catch (e) {
      setError(e.message);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner = Boolean(user && bidsInfo?.is_owner);
  const myBid = !bidsInfo?.is_owner ? bidsInfo?.bids?.[0] || null : null;
  const canBid = user?.role === 'freelancer' && job?.status === 'open';
  const acceptingBid = isOwner && job?.status === 'open';

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-rose-600">{error}</p>
        <Link to="/" className="mt-4 inline-block font-semibold text-emerald-700 hover:underline">
          ← Back to jobs
        </Link>
      </div>
    );
  }
  if (!job) {
    return <div className="grid min-h-[50vh] place-items-center text-slate-400">Loading…</div>;
  }

  async function submitBid(payload) {
    setBusy(true);
    setNotice(null);
    try {
      await api(`/jobs/${id}/bids`, { method: 'POST', token, body: payload });
      setNotice({
        type: 'ok',
        text: myBid ? 'Your bid has been updated.' : 'Your bid has been placed!',
      });
      await load();
    } catch (err) {
      setNotice({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function acceptBid(bidId) {
    setNotice(null);
    try {
      await api(`/bids/${bidId}/accept`, { method: 'POST', token });
      setNotice({ type: 'ok', text: 'Bid accepted — the job has been awarded! 🎉' });
      await load();
    } catch (err) {
      setNotice({ type: 'err', text: err.message });
    }
  }

  async function closeJob() {
    setNotice(null);
    try {
      await api(`/jobs/${id}/close`, { method: 'POST', token });
      setNotice({ type: 'ok', text: 'Job closed. It is no longer visible to freelancers.' });
      await load();
    } catch (err) {
      setNotice({ type: 'err', text: err.message });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {notice && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {notice.text}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: job + bids */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={job.status} />
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {job.category}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">{job.title}</h1>
            <p className="mt-4 whitespace-pre-wrap leading-relaxed text-slate-700">
              {job.description}
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Budget</dt>
                <dd className="mt-0.5 font-semibold text-emerald-700">
                  {budgetRange(job.budget_min, job.budget_max)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Deadline</dt>
                <dd className="mt-0.5 font-semibold text-slate-700">
                  {job.deadline ? formatDate(job.deadline) : 'Flexible'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Posted</dt>
                <dd className="mt-0.5 font-semibold text-slate-700">{timeAgo(job.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Client</dt>
                <dd className="mt-0.5 font-semibold text-slate-700">
                  <Link
                    to={`/users/${job.client_id}`}
                    className="transition hover:text-emerald-700"
                  >
                    {job.client_name}
                  </Link>
                  {job.client_review_count > 0 && (
                    <span className="mt-1 flex items-center gap-1 text-xs font-normal text-slate-500">
                      <Stars value={job.client_rating} showValue />
                      <span>({job.client_review_count})</span>
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {isOwner && (
            <BidsPanel
              bids={bidsInfo?.bids ?? []}
              accepting={acceptingBid}
              onAccept={acceptBid}
              reviewing={job.status === 'awarded'}
              onReviewed={() => load()}
            />
          )}
        </div>

        {/* Right: actions */}
        <aside className="space-y-6">
          {job.status === 'awarded' && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-sm text-violet-700">
              🎉 This job has been <strong>awarded</strong> and is no longer accepting bids.
            </div>
          )}

          {isOwner && job.status === 'open' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900">Manage job</h3>
              <p className="mt-1 text-xs text-slate-500">
                Accepting a bid awards the job. Closing it removes it from the feed.
              </p>
              <Link
                to={`/jobs/${job.id}/edit`}
                className="mt-3 block w-full rounded-xl border border-slate-300 py-2 text-center text-sm font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700"
              >
                Edit job
              </Link>
              <button
                onClick={closeJob}
                className="mt-2 w-full rounded-xl border border-slate-300 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
              >
                Close job
              </button>
            </div>
          )}

          {canBid && <BidForm myBid={myBid} busy={busy} onSubmit={submitBid} />}

          {myBid && !canBid && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900">Your bid</h3>
              <div className="mt-2 flex items-center justify-between gap-2">
                <StatusPill status={myBid.status} />
                <span className="text-xs text-slate-500">{myBid.days} days delivery</span>
              </div>
              <Link
                to={`/messages/${job.id}/${job.client_id}`}
                className="mt-3 block w-full rounded-xl border border-slate-300 py-2 text-center text-sm font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700"
              >
                Message client
              </Link>
            </div>
          )}

          {!user && job.status === 'open' && (
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-sky-50 p-5 text-sm">
              <h3 className="font-bold text-slate-900">Want to work on this job?</h3>
              <p className="mt-1 text-slate-600">
                Create a free freelancer account and place your bid in seconds.
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  to="/register"
                  className="flex-1 rounded-xl bg-emerald-600 py-2 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Sign up
                </Link>
                <Link
                  to="/login"
                  className="flex-1 rounded-xl border border-slate-300 bg-white py-2 text-center text-sm font-semibold text-slate-700 transition hover:border-emerald-400"
                >
                  Log in
                </Link>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
