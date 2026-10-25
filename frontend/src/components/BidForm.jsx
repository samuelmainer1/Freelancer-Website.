import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { money } from '../utils.js';

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100';

export default function BidForm({ myBid, busy, onSubmit, connectBalance = null }) {
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('');
  const [proposal, setProposal] = useState('');
  const hasBid = Boolean(myBid);

  // Updating an existing bid is free; only a brand-new bid costs a Connect.
  const costsConnect = !hasBid;
  const outOfConnects = costsConnect && connectBalance != null && connectBalance < 1;

  // Prefill with the freelancer's existing bid
  useEffect(() => {
    if (myBid) {
      setAmount(String(myBid.amount));
      setDays(String(myBid.days));
      setProposal(myBid.proposal);
    }
  }, [myBid]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ amount: Number(amount), days: Number(days), proposal });
      }}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-slate-900">{hasBid ? 'Update your bid' : 'Place a bid'}</h3>
        {costsConnect && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              outOfConnects ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            Costs 1 Connect
          </span>
        )}
      </div>
      {hasBid && (
        <p className="mt-1 text-xs text-emerald-700">
          You already bid on this job — submitting again updates it for free.
        </p>
      )}
      {costsConnect && connectBalance != null && !outOfConnects && (
        <p className="mt-1 text-xs text-slate-500">
          You have {connectBalance} Connect{connectBalance === 1 ? '' : 's'} left.
        </p>
      )}
      {outOfConnects && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <p className="font-semibold">You are out of Connects.</p>
          <p className="mt-0.5">Buy more Connects to keep bidding on new jobs.</p>
          <Link
            to="/connects"
            className="mt-2 inline-block rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white transition hover:bg-rose-700"
          >
            Buy Connects
          </Link>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Amount (USD) *</span>
          <input
            type="number"
            required
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1500"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Delivery (days) *</span>
          <input
            type="number"
            required
            min="1"
            step="1"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="14"
            className={inputClass}
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-slate-600">Proposal *</span>
        <textarea
          required
          rows={5}
          value={proposal}
          onChange={(e) => setProposal(e.target.value)}
          placeholder="Describe your approach, relevant experience, and why you're the best fit…"
          className={inputClass}
        />
      </label>

      <button
        type="submit"
        disabled={busy || outOfConnects}
        className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy ? 'Submitting…' : hasBid ? 'Update bid' : `Submit bid${amount ? ` · ${money(amount)}` : ''}`}
      </button>
    </form>
  );
}
