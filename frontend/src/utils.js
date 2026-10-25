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
