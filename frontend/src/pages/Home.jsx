import { useEffect, useState } from 'react';
import { api } from '../api';
import { CATEGORIES } from '../utils.js';
import JobCard from '../components/JobCard.jsx';
import Hero from '../components/Hero.jsx';

export default function Home() {
  const [jobs, setJobs] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total_pages: 1, total: 0 });
  const [stats, setStats] = useState(null);
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setSearch(term.trim()), 350);
    return () => clearTimeout(t);
  }, [term]);

  // Any filter change resets to the first page
  useEffect(() => {
    setPage(1);
  }, [search, category]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    params.set('page', page);
    api(`/jobs?${params}`)
      .then((d) => {
        if (!alive) return;
        setJobs(d.jobs);
        setMeta({
          page: d.page ?? page,
          total_pages: d.total_pages ?? 1,
          total: d.total ?? d.jobs.length,
        });
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [search, category, page]);

  useEffect(() => {
    api('/stats')
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <>
      <Hero
        term={term}
        onTermChange={setTerm}
        onSearch={() => setSearch(term.trim())}
        stats={stats}
      />

      {/* Job feed */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCategory('')}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              category === ''
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'border border-slate-300 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-700'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(category === c ? '' : c)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                category === c
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'border border-slate-300 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Open jobs</h2>
          {!loading && !error && (
            <span className="text-sm text-slate-500">
              {meta.total} job{meta.total === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-200/60" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
            {error}
          </div>
        ) : jobs.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            No jobs found{search ? ` for “${search}”` : ''}
            {category ? ` in ${category}` : ''}.
            {(search || category) && (
              <button
                onClick={() => {
                  setTerm('');
                  setSearch('');
                  setCategory('');
                }}
                className="ml-2 font-semibold text-emerald-700 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && meta.total_pages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 text-sm text-slate-500">
              Page {meta.page} of {meta.total_pages}
            </span>
            <button
              disabled={page >= meta.total_pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </>
  );
}
