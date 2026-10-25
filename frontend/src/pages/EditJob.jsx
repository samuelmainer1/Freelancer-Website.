import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { CATEGORIES } from '../utils.js';

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100';

export default function EditJob() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api(`/jobs/${id}`)
      .then((d) => {
        if (!alive) return;
        if (user && d.job.client_id !== user.id) {
          setError('You can only edit your own jobs.');
          return;
        }
        if (d.job.status !== 'open') {
          setError('Only open jobs can be edited.');
          return;
        }
        setForm({
          title: d.job.title || '',
          category: d.job.category || CATEGORIES[0],
          budget_min: d.job.budget_min ?? '',
          budget_max: d.job.budget_max ?? '',
          deadline: d.job.deadline || '',
          description: d.job.description || '',
        });
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id, user]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/jobs/${id}`, { method: 'PUT', token, body: form });
      navigate(`/jobs/${id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (error && !form) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200/60" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Edit job</h1>
        <p className="mt-1 text-sm text-slate-500">
          Changes are visible to freelancers immediately.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Job title *</span>
            <input
              required
              maxLength={120}
              value={form.title}
              onChange={set('title')}
              className={inputClass}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Category</span>
              <select value={form.category} onChange={set('category')} className={inputClass}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Deadline</span>
              <input
                type="date"
                value={form.deadline}
                onChange={set('deadline')}
                className={inputClass}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Budget min (USD)</span>
              <input
                type="number"
                min="0"
                value={form.budget_min}
                onChange={set('budget_min')}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Budget max (USD)</span>
              <input
                type="number"
                min="0"
                value={form.budget_max}
                onChange={set('budget_max')}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Description *</span>
            <textarea
              required
              rows={6}
              value={form.description}
              onChange={set('description')}
              className={inputClass}
            />
          </label>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-emerald-600 px-8 py-2.5 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/jobs/${id}`)}
              className="rounded-xl border border-slate-300 px-6 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
