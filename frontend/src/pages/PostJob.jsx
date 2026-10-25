import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { CATEGORIES } from '../utils.js';

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100';

export default function PostJob() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    category: CATEGORIES[0],
    budget_min: '',
    budget_max: '',
    deadline: '',
    description: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = await api('/jobs', { method: 'POST', token, body: form });
      navigate(`/jobs/${d.job.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Post a new job</h1>
        <p className="mt-1 text-sm text-slate-500">
          Describe the work — freelancers will start bidding right away.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Job title *</span>
            <input
              required
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. Build a React landing page"
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
                placeholder="e.g. 500"
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
                placeholder="e.g. 1500"
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
              placeholder="Describe the work, deliverables, tech stack, and anything a freelancer needs to know…"
              className={inputClass}
            />
          </label>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-emerald-600 py-2.5 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {busy ? 'Publishing…' : 'Publish job'}
          </button>
        </form>
      </div>
    </div>
  );
}
