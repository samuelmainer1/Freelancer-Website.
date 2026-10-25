import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { budgetRange, formatDate, timeAgo } from '../utils.js';
import Avatar from '../components/Avatar.jsx';
import Stars from '../components/Stars.jsx';
import StatusPill from '../components/StatusPill.jsx';

export default function Profile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    api(`/users/${id}`)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id]);

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
  if (!data) {
    return <div className="grid min-h-[50vh] place-items-center text-slate-400">Loading…</div>;
  }

  const p = data.profile;
  const isMe = user?.id === p.id;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Profile header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar id={p.id} name={p.name} src={p.avatar} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{p.name}</h1>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                  p.role === 'client' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
                }`}
              >
                {p.role}
              </span>
              {data.count > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5">
                  <Stars value={data.average} showValue />
                  <span className="text-xs text-slate-500">({data.count})</span>
                </span>
              )}
              {isMe && (
                <Link
                  to="/settings/profile"
                  className="rounded-full border border-emerald-600 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-600 hover:text-white"
                >
                  Edit profile
                </Link>
              )}
            </div>
            {p.headline && <p className="mt-1 text-slate-600">{p.headline}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              {p.location && <span>📍 {p.location}</span>}
              <span>
                🗓 Member since {formatDate(String(p.member_since).slice(0, 10))}
              </span>
              {p.role === 'freelancer' && p.hourly_rate != null && (
                <span className="font-semibold text-emerald-700">
                  ${p.hourly_rate}/hr
                </span>
              )}
              {p.website && (
                <a
                  href={p.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 hover:underline"
                >
                  🔗 Website
                </a>
              )}
            </div>
          </div>
        </div>

        {p.role === 'client' && p.company && (
          <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Company:</span> {p.company}
          </p>
        )}

        {p.skills.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap gap-2">
              {p.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {p.bio && (
          <p className="mt-4 whitespace-pre-wrap border-t border-slate-100 pt-4 leading-relaxed text-slate-700">
            {p.bio}
          </p>
        )}

        {p.portfolio && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h2 className="text-sm font-bold text-slate-800">Portfolio</h2>
            <ul className="mt-2 space-y-1">
              {p.portfolio
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean)
                .map((entry) => (
                  <PortfolioLink key={entry} entry={entry} />
                ))}
            </ul>
          </div>
        )}
      </div>
            {/* Role-specific activity */}
      {p.role === 'client' ? (
        <section className="mt-6">
          <h2 className="text-lg font-bold text-slate-900">
            Jobs posted by {p.name.split(' ')[0]}
          </h2>
          <div className="mt-3 space-y-3">
            {data.jobs.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                No jobs posted yet.
              </p>
            )}
            {data.jobs.map((j) => (
              <div
                key={j.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <Link
                    to={`/jobs/${j.id}`}
                    className="font-semibold text-slate-900 transition hover:text-emerald-700"
                  >
                    {j.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">
                      {j.category}
                    </span>
                    <span>{timeAgo(j.created_at)}</span>
                    <span>
                      · {j.bid_count} bid{j.bid_count === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={j.status} />
                  <span className="text-sm font-semibold text-emerald-700">
                    {budgetRange(j.budget_min, j.budget_max)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
              <div className="text-3xl font-extrabold text-emerald-600">
                {data.stats.active_bids}
              </div>
              <div className="mt-1 text-sm text-slate-500">Active bids</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
              <div className="text-3xl font-extrabold text-emerald-600">
                {data.stats.won_jobs}
              </div>
              <div className="mt-1 text-sm text-slate-500">Jobs won</div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Recent won work</h2>
            <div className="mt-3 space-y-3">
              {data.won_jobs.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                  No awarded jobs yet — place bids to win your first job!
                </p>
              )}
              {data.won_jobs.map((j) => (
                <div
                  key={j.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/jobs/${j.id}`}
                      className="font-semibold text-slate-900 transition hover:text-emerald-700"
                    >
                      {j.title}
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Client: {j.client_name} · {timeAgo(j.created_at)}
                    </div>
                  </div>
                  <StatusPill status={j.status} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {/* Reviews */}
      <section className="mt-6">
        <h2 className="text-lg font-bold text-slate-900">
          Reviews {data.count > 0 && <span className="text-slate-400">({data.count})</span>}
        </h2>
        <div className="mt-3 space-y-3">
          {data.count === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              No reviews yet.
            </p>
          )}
          {data.reviews.map((r) => (
            <article
              key={r.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/users/${r.reviewer_id}`}
                  className="font-semibold text-slate-900 hover:text-emerald-700"
                >
                  {r.reviewer_name}
                </Link>
                <Stars value={r.rating} />
                <span className="text-xs text-slate-400">{timeAgo(r.created_at)}</span>
              </div>
              <Link
                to={`/jobs/${r.job_id}`}
                className="mt-0.5 block text-xs text-slate-500 hover:text-emerald-700"
              >
                on “{r.job_title}”
              </Link>
              {r.comment && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {r.comment}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

// One portfolio entry: "GitHub: https://…" renders as a labelled external link
function PortfolioLink({ entry }) {
  const match = entry.match(/^(.*?):\s*(https?:\/\/\S+)$/i) || entry.match(/^(https?:\/\/\S+)$/i);
  const label = match && match[2] ? match[1] || match[2] : entry;
  const href = match ? match[match.length - 1] : null;
  if (!href) {
    return <li className="text-sm text-slate-600">{entry}</li>;
  }
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-sm font-semibold text-emerald-700 hover:underline"
      >
        {label}
      </a>
    </li>
  );
}