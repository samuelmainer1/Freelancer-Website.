export default function Hero({ term, onTermChange, onSearch, stats }) {
  const cards = stats
    ? [
        { label: 'Open jobs', value: stats.open_jobs },
        { label: 'Bids placed', value: stats.total_bids },
        { label: 'Freelancers', value: stats.freelancers },
      ]
    : [];

  return (
    <section className="border-b border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Hire top talent.
          <br />
          Get work <span className="text-emerald-600">done.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
          Post a job and start receiving bids from skilled freelancers — or find your next
          project today.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch();
          }}
          className="mx-auto mt-8 flex max-w-xl gap-2"
        >
          <input
            value={term}
            onChange={(e) => onTermChange(e.target.value)}
            placeholder="Search jobs — e.g. “React”, “logo”, “SEO”…"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Search
          </button>
        </form>

        {stats && (
          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-4">
            {cards.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm"
              >
                <div className="text-2xl font-extrabold text-emerald-700">{s.value}</div>
                <div className="text-xs font-medium text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
