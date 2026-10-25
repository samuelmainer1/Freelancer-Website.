import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import Avatar from '../components/Avatar.jsx';
import Stars from '../components/Stars.jsx';

const SORTS = [
  { value: '', label: 'Most reviews' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'rate', label: 'Lowest rate' },
  { value: 'name', label: 'Name A–Z' },
];

export default function Freelancers() {
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get('search') || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const search = params.get('search') || '';
  const skill = params.get('skill') || '';
  const maxRate = params.get('max_rate') || '';
  const minRating = params.get('min_rating') || '';
  const sort = params.get('sort') || '';
  const page = Number(params.get('page') || 1);

  // Keep the input in sync when the URL changes (e.g. Clear filters)
  useEffect(() => {
    setTerm(search);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (term.trim() === search) return;
      const next = new URLSearchParams(params);
      if (term.trim()) next.set('search', term.trim());
      else next.delete('search');
      next.delete('page');
      setParams(next, { replace: true });
    }, 350);
    return () => clearTimeout(t);
  }, [term]);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (skill) q.set('skill', skill);
    if (maxRate) q.set('max_rate', maxRate);
    if (minRating) q.set('min_rating', minRating);
    if (sort) q.set('sort', sort);
    q.set('page', page);
    q.set('limit', 12);
    api(`/users?${q}`)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [search, skill, maxRate, minRating, sort, page]);

  const freelancers = data?.freelancers || [];
  const hasFilters = search || skill || maxRate || minRating;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Find freelancers</h1>
          <p className="mt-1 text-sm text-slate-500">Browse talent by skill, rate and rating.</p>
        </div>
        {data && (
          <span className="text-sm text-slate-500">
            {data.total} freelancer{data.total === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {/* Filters */}
      <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search
          </span>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Name, headline or skill…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Skill
          </span>
          <input
            value={skill}
            onChange={(e) => update('skill', e.target.value)}
            placeholder="e.g. React"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Max $/hr
          </span>
          <input
            type="number"
            min="0"
            value={maxRate}
            onChange={(e) => update('max_rate', e.target.value)}
            placeholder="Any"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sort by
          </span>
          <select
            value={sort}
            onChange={(e) => update('sort', e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {[4, 4.5].map((r) => (
          <button
            key={r}
            onClick={() => update('min_rating', minRating === String(r) ? '' : String(r))}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              minRating === String(r)
                ? 'bg-amber-400 text-amber-950'
                : 'border border-slate-300 bg-white text-slate-600 hover:border-amber-400'
            }`}
          >
            ★ {r}+
          </button>
        ))}
        {hasFilters && (
          <button
            onClick={() => {
              setTerm('');
              setParams(new URLSearchParams());
            }}
            className="ml-1 text-xs font-semibold text-emerald-700 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-2xl bg-slate-200/60" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {error}
        </div>
      ) : freelancers.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No freelancers match those filters.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {freelancers.map((f) => (
            <Link
              key={f.id}
              to={`/users/${f.id}`}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <Avatar id={f.id} name={f.name} src={f.avatar} size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 group-hover:text-emerald-700">
                    {f.name}
                  </p>
                  <p className="truncate text-sm text-slate-500">{f.headline || 'Freelancer'}</p>
                  {f.location && (
                    <p className="mt-0.5 truncate text-xs text-slate-400">{f.location}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                {f.review_count > 0 ? (
                  <>
                    <Stars value={f.average_rating} showValue />
                    <span>({f.review_count})</span>
                  </>
                ) : (
                  <span className="text-slate-400">No reviews yet</span>
                )}
                {f.jobs_done > 0 && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                    {f.jobs_done} job{f.jobs_done === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              {f.skills?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {f.skills.slice(0, 4).map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-auto pt-4 text-sm font-semibold text-slate-700">
                {f.hourly_rate != null ? `$${f.hourly_rate}/hr` : 'Rate on request'}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => update('page', String(page - 1))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-2 text-sm text-slate-500">
            Page {data.page} of {data.total_pages}
          </span>
          <button
            disabled={page >= data.total_pages}
            onClick={() => update('page', String(page + 1))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
