// Tiny fetch wrapper for the REST API. Adds the JSON header and auth token.
// In dev the Vite proxy forwards /api to localhost:4000. In production set
// VITE_API_URL (e.g. https://api.example.com) to point at the deployed API;
// when it is unset we keep the relative /api path, which works when the
// frontend and API share an origin (reverse proxy / same domain).
const API_BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');

export async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(API_BASE + '/api' + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
