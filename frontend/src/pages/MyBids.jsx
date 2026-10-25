import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { money, timeAgo } from '../utils.js';
import StatusPill from '../components/StatusPill.jsx';
import ReviewForm from '../components/ReviewForm.jsx';
import Stars from '../components/Stars.jsx';

export default function MyBids() {
  const { token } = useAuth();
  const [bids, setBids] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/bids/mine', { token })
      .then((d) => setBids(d.bids))
      .catch((e) => setError(e.message));
  }, [token]);

  // Merge the saved review back into local state so the form collapses
  // without a full refetch.
  function handleReviewed(bidId, review) {
    setBids((prev) =>
      prev.map((b) =>
        b.id === bidId
          ? { ...b, client_review_id: review.id, client_review_rating: review.rating }
          : b
      )
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">My Bids</h1>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!bids ? (
        <div className="mt-8 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/60" />
          ))}
        </div>
      ) : bids.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500">You haven't placed any bids yet.</p>
          <Link to="/" className="mt-3 inline-block font-semibold text-emerald-700 hover:underline">
            Browse open jobs →
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {bids.map((b) => (
            <li
              key={b.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link
                    to={`/jobs/${b.job_id}`}
                    className="font-semibold text-slate-900 hover:text-emerald-700"
                  >
                    {b.job_title}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500">
                    by{' '}
                    <Link
                      to={`/users/${b.client_id}`}
                      className="font-medium text-slate-600 hover:text-emerald-700"
                    >
                      {b.client_name}
                    </Link>{' '}
                    · job is <span className="font-medium">{b.job_status}</span>{' '}
                    · bid {timeAgo(b.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-bold text-emerald-700">{money(b.amount)}</div>
                    <div className="text-xs text-slate-500">{b.days} days delivery</div>
                  </div>
                  <StatusPill status={b.status} />
                </div>
              </div>
              <p className="mt-3 line-clamp-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
                {b.proposal}
              </p>

              {(b.status === 'accepted' || b.client_review_id) && (
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
                  <Link
                    to={`/messages/${b.job_id}/${b.client_id}`}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700"
                  >
                    Message client
                  </Link>
                  {b.client_review_id && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      You rated this client
                      <Stars value={b.client_review_rating} showValue />
                    </span>
                  )}
                  {b.status === 'accepted' && (
                    <ReviewForm
                      bid={b}
                      revieweeName={b.client_name.split(' ')[0]}
                      revieweeRole="client"
                      existing={
                        b.client_review_id
                          ? { id: b.client_review_id, rating: b.client_review_rating, comment: '' }
                          : null
                      }
                      onSaved={(review) => handleReviewed(b.id, review)}
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
