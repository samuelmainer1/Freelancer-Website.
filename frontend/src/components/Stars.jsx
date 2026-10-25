const SIZES = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

// Read-only 1–5 star display with optional rating value
export default function Stars({ value = 0, size = 'sm', showValue = false }) {
  const rounded = Math.round(Number(value) || 0);
  return (
    <span className={`inline-flex items-center gap-1 ${SIZES[size] || SIZES.sm}`}>
      <span className="tracking-tight text-amber-400" aria-hidden="true">
        {'★'.repeat(rounded)}
        <span className="text-slate-300">{'★'.repeat(5 - rounded)}</span>
      </span>
      {showValue && (
        <span className="font-semibold text-slate-700">
          {Number(value) ? Number(value).toFixed(1) : '—'}
        </span>
      )}
      <span className="sr-only">{rounded} out of 5 stars</span>
    </span>
  );
}

// Interactive star picker for the review form
export function StarPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
          className={`text-2xl leading-none transition ${
            n <= value ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}