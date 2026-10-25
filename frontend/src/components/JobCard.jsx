import { Link } from 'react-router-dom';
import { budgetRange, formatDate, timeAgo } from '../utils.js';

export default function JobCard({ job }) {
  return (
    <Link
      to={`/jobs/${job.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{job.title}</h3>
        <span className="shrink-0 text-xs text-slate-400">{timeAgo(job.created_at)}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">{job.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          {job.category}
        </span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          {budgetRange(job.budget_min, job.budget_max)}
        </span>
        {job.deadline && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
            Due {formatDate(job.deadline)}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>
          by <span className="font-medium text-slate-700">{job.client_name}</span>
        </span>
        <span className="font-medium text-emerald-700">
          {job.bid_count} bid{job.bid_count === 1 ? '' : 's'}
        </span>
      </div>
    </Link>
  );
}
