// One headline metric on a freelancer's profile (earnings, jobs done, ...).
export function StatTile({ label, value, hint, accent = 'text-slate-900' }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
      <div className={`text-2xl font-extrabold ${accent}`}>{value}</div>
      <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

// 5→1 star distribution bar chart under the rating summary.
export function RatingBreakdown({ breakdown, count }) {
  if (!count) return null;
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((star) => {
        const n = breakdown?.[star] || 0;
        const pct = Math.round((n / count) * 100);
        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="w-6 text-right font-medium text-slate-500">{star}★</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="w-8 text-right tabular-nums text-slate-500">{n}</span>
          </div>
        );
      })}
    </div>
  );
}
