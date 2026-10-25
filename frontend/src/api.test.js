import { describe, expect, it, vi, beforeEach } from 'vitest';
import { api } from './api.js';

// Exercises the fetch wrapper's token/body handling and error mapping, which
// every page depends on but none of them re-implement.
describe('api', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: 1 }) });
  });

  it('prefixes /api and defaults to GET', async () => {
    await api('/jobs');
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/jobs');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers).toEqual({});
  });

  it('attaches the bearer token when provided', async () => {
    await api('/bids/mine', { token: 'abc' });
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer abc');
  });

  it('sends JSON bodies with the right content type', async () => {
    await api('/bids/5/review', { method: 'POST', body: { rating: 5 }, token: 'abc' });
    const [, init] = global.fetch.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ rating: 5 });
  });

  it('throws the server error message when the response is not ok', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Only clients can do that.' }),
    });
    await expect(api('/jobs')).rejects.toThrow('Only clients can do that.');
  });

  it('falls back to a status message when the body is not JSON', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError('bad json');
      },
    });
    await expect(api('/jobs')).rejects.toThrow('Request failed (500)');
  });

  it('uses a relative /api path so a same-origin deploy works without config', async () => {
    await api('/jobs');
    expect(global.fetch.mock.calls[0][0]).toBe('/api/jobs');
  });
});
