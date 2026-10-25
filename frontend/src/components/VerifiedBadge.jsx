// Trust mark for identity-checked accounts. `is_verified` is set by an admin,
// never by the user, so this is purely presentational.
export default function VerifiedBadge({ verified, size = 'md' }) {
  if (!verified) return null;
  const dims = size === 'lg' ? 'h-5 w-5 text-[11px]' : 'h-4 w-4 text-[9px]';
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full bg-sky-500 font-bold text-white ${dims}`}
      title="Verified account"
      aria-label="Verified account"
      role="img"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.79 6.8-6.79a1 1 0 011.4 0z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}
