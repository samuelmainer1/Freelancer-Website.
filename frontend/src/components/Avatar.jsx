const COLORS = [
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
];

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-24 w-24 text-3xl',
};

// Deterministic colored initials avatar (derived from user id), or the uploaded photo
export default function Avatar({ id = 0, name = '', src = null, size = 'md', ring = false }) {
  const initials =
    String(name)
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  const color = COLORS[Math.abs(Number(id) || 0) % COLORS.length];
  const base = `inline-grid shrink-0 place-items-center rounded-full font-bold ${
    SIZES[size] || SIZES.md
  } ${ring ? 'ring-4 ring-white' : ''}`;

  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name}'s avatar` : 'Avatar'}
        className={`${base} object-cover`}
      />
    );
  }

  return (
    <span className={`${base} ${color}`} aria-hidden="true">
      {initials}
    </span>
  );
}