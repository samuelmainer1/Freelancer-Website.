export const CATEGORIES = [
  'Web Development',
  'Mobile Development',
  'Design',
  'Writing',
  'Marketing',
  'Data & AI',
  'Video & Audio',
  'Other',
];

export function money(n) {
  if (n == null || isNaN(Number(n))) return null;
  return '$' + Number(n).toLocaleString('en-US');
}

export function budgetRange(min, max) {
  if (min != null && max != null) return `${money(min)} – ${money(max)}`;
  if (min != null) return `From ${money(min)}`;
  if (max != null) return `Up to ${money(max)}`;
  return 'Negotiable';
}

// Compact money for stat tiles: $12.5k / $1.2M. Keeps big earnings readable.
export function compactMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '$0';
  if (Math.abs(v) >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(v) >= 10_000) return '$' + (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return money(v);
}

// Picks the singular or plural form: pluralize(1,'bid','bids') -> 'bid'
export function pluralize(n, one, many) {
  return n === 1 ? one : many;
}

// Formats SQLite UTC timestamps ("YYYY-MM-DD HH:MM:SS") as relative time
export function timeAgo(sqlUtc) {
  if (!sqlUtc) return '';
  const d = new Date(String(sqlUtc).replace(' ', 'T') + 'Z');
  const diff = Date.now() - d.getTime();
  if (isNaN(diff)) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDate(sqlDate) {
  if (!sqlDate) return '';
  return new Date(sqlDate + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
