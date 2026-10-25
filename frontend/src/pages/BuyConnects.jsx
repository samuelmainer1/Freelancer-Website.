import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { money, timeAgo } from '../utils.js';

export default function BuyConnects() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let alive = true;
    api('/connects', { token })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [token]);

  async function buy(pkg) {
    setBusyId(pkg.id);
    setNotice(null);
    try {
      const d = await api('/connects/purchase', {
        method: 'POST',
        token,
        body: { package_id: pkg.id },
      });
      setNotice({
        type: 'ok',
        text: `Added ${d.purchased.connects} Connects — your new balance is ${d.balance}.`,
      });
      // Refresh balance + purchase history
      setData(await api('/connects', { token }));
    } catch (e) {
      setNotice({ type: 'err', text: e.message });
    } finally {
      setBusyId(null);
    }
  }

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Connects</h1>
      <p className="mt-1 text-slate-600">
        Connects are your bid credits. Bidding on a new job costs{' '}
        <strong>{data.bid_cost}</strong> Connect; updating a bid you already placed is always free.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-sky-50 p-5">
        <div>
          <div className="text-4xl font-extrabold text-emerald-700" data-testid="balance">
            {data.balance}
          </div>
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800/70">
            Connects available
          </div>
        </div>
        <div className="ml-auto text-sm text-slate-600">
          <div>
            Bids placed so far: <strong>{data.total_spent}</strong>
          </div>
          {data.balance < data.bid_cost && (
            <div className="mt-1 font-semibold text-rose-600">
              You are out of Connects — top up below to keep bidding.
            </div>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
          role="status"
        >
          {notice.text}
        </div>
      )}

      <h2 className="mt-8 text-lg font-bold text-slate-900">Buy more Connects</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {data.packages.map((pkg) => (
          <div
            key={pkg.id}
            className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm ${
              pkg.best_value ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'
            }`}
          >
            {pkg.best_value && (
              <span className="absolute -top-2.5 left-4 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Best value
              </span>
            )}
            <h3 className="font-bold text-slate-900">{pkg.name}</h3>
            <div className="mt-2 text-3xl font-extrabold text-slate-900">
              {pkg.connects}
              <span className="ml-1 text-sm font-semibold text-slate-500">Connects</span>
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {money(pkg.price_usd)} · {money(Math.round((pkg.price_usd / pkg.connects) * 100) / 100)} per
              Connect
            </div>
            <button
              onClick={() => buy(pkg)}
              disabled={busyId != null}
              className="mt-4 rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {busyId === pkg.id ? 'Processing…' : `Buy for ${money(pkg.price_usd)}`}
            </button>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Demo mode: purchases are credited instantly and no card is charged.
      </p>

      <h2 className="mt-8 text-lg font-bold text-slate-900">Purchase history</h2>
      {data.purchases.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          No purchases yet.
        </p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Package</th>
                <th className="px-4 py-2 font-semibold">Connects</th>
                <th className="px-4 py-2 font-semibold">Paid</th>
                <th className="px-4 py-2 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {data.purchases.map((p) => {
                const pkg = data.packages.find((x) => x.id === p.package_id);
                return (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-800">
                      {pkg ? pkg.name : p.package_id}
                    </td>
                    <td className="px-4 py-2 text-emerald-700">+{p.connects}</td>
                    <td className="px-4 py-2 text-slate-600">{money(p.amount_usd)}</td>
                    <td className="px-4 py-2 text-slate-500">{timeAgo(p.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Link
          to="/my-bids"
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700"
        >
          My bids
        </Link>
        <Link
          to="/"
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Find work
        </Link>
      </div>
    </div>
  );
}
