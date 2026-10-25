import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { StarPicker } from './Stars.jsx';

// Lets either party on an accepted bid rate the other one.
// `revieweeName` is who is being reviewed; `revieweeRole` only changes the wording.
export default function ReviewForm({ bid, revieweeName, revieweeRole = 'freelancer', existing, onSaved }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existing?.rating || 0);
  const [comment, setComment] = useState(existing?.comment || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const roleWord = revieweeRole === 'client' ? 'client' : 'freelancer';

  async function submit(e) {
    e.preventDefault();
    if (!rating) return setError('Choose a star rating first.');
    setBusy(true);
    setError('');
    try {
      const d = await api(`/bids/${bid.id}/review`, {
        method: 'POST',
        token,
        body: { rating, comment },
      });
      setOpen(false);
      onSaved?.(d.review);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-amber-400 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-400 hover:text-white"
      >
        {existing ? 'Edit your review' : `★ Review ${revieweeName}`}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-800">
        How did {revieweeName} do as a {roleWord}?
      </p>
      <div className="mt-1">
        <StarPicker value={rating} onChange={setRating} />
      </div>
      <textarea
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1500}
        placeholder="Share how the project went (optional)…"
        className="mt-2 w-full resize-y rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
      />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Submit review'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}