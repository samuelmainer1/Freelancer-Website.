import { Link } from 'react-router-dom';
import { money, timeAgo } from '../utils.js';
import Avatar from './Avatar.jsx';
import StatusPill from './StatusPill.jsx';
import ReviewForm from './ReviewForm.jsx';
import Stars from './Stars.jsx';

export default function BidsPanel({ bids, accepting, onAccept, reviewing = false, onReviewed }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Bids ({bids.length})</h2>

      {bids.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No bids yet. Freelancers will appear here as soon as they bid.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {bids.map((b) => (
            <li key={b.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Link to={`/users/${b.freelancer_id}`} className="shrink-0">
                    <Avatar
                      id={b.freelancer_id}
                      name={b.freelancer_name}
                      src={b.freelancer_avatar}
                      size="md"
                    />
                  </Link>
                  <div className="min-w-0">
                    <Link
                      to={`/users/${b.freelancer_id}`}
                      className="text-sm font-semibold text-slate-900 transition hover:text-emerald-700"
                    >
                      {b.freelancer_name}
                    </Link>
                    {b.freelancer_headline && (
                      <div className="truncate text-xs text-slate-500">
                        {b.freelancer_headline}
                      </div>
                    )}
                    <div className="text-xs text-slate-400">{timeAgo(b.created_at)}</div>
                    {b.freelancer_rating_count > 0 && (
                      <div className="mt-1 flex items-center gap-1">
                        <Stars value={b.freelancer_rating} showValue />
                        <span className="text-xs text-slate-400">({b.freelancer_rating_count})</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right">
                    <div className="font-bold text-emerald-700">{money(b.amount)}</div>
                    <div className="text-xs text-slate-500">{b.days} days delivery</div>
                  </div>
                  <StatusPill status={b.status} />
                  <Link
                    to={`/messages/${b.job_id}/${b.freelancer_id}`}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700"
                  >
                    Message
                  </Link>
                  {accepting && b.status === 'pending' && (
                    <button
                      onClick={() => onAccept(b.id)}
                      className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Accept bid
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap border-t border-slate-100 pt-3 text-sm text-slate-600">
                {b.proposal}
              </p>
              {reviewing && b.status === 'accepted' && (
                <ReviewForm
                  bid={b}
                  revieweeName={b.freelancer_name.split(' ')[0]}
                  revieweeRole="freelancer"
                  existing={
                    b.review_id
                      ? { id: b.review_id, rating: b.review_rating, comment: b.review_comment }
                      : null
                  }
                  onSaved={onReviewed}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
