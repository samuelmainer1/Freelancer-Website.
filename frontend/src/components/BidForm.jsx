import { useEffect, useState } from 'react';
import { money } from '../utils.js';

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100';

export default function BidForm({ myBid, busy, onSubmit }) {
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('');
  const [proposal, setProposal] = useState('');
  const hasBid = Boolean(myBid);

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
      <h3 className="font-bold text-slate-900">{hasBid ? 'Update your bid' : 'Place a bid'}</h3>
      {hasBid && (
        <p className="mt-1 text-xs text-emerald-700">
          You already bid on this job — submitting again updates it.
        </p>
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
        disabled={busy}
        className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy ? 'Submitting…' : hasBid ? 'Update bid' : `Submit bid${amount ? ` · ${money(amount)}` : ''}`}
      </button>
    </form>
  );
}
