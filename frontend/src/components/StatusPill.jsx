export default function StatusPill({ status }) {
  const styles = {
    open: 'bg-emerald-100 text-emerald-700',
    awarded: 'bg-violet-100 text-violet-700',
    closed: 'bg-slate-200 text-slate-600',
    pending: 'bg-amber-100 text-amber-700',
    accepted: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-rose-100 text-rose-700',
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
        styles[status] || 'bg-slate-100 text-slate-600'
      }`}
    >
      {status}
    </span>
  );
}
