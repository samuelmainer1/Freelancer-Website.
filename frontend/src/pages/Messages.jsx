import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';
import { timeAgo } from '../utils.js';

// Conversation page: /messages/:jobId/:userId
export default function Messages() {
  const { jobId, userId } = useParams();
  const { user, token } = useAuth();
  const [data, setData] = useState(null);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api(`/jobs/${jobId}/messages/${userId}`, { token })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [jobId, userId, token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [data?.messages?.length]);

  const send = async (e) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await api(`/jobs/${jobId}/messages/${userId}`, {
        method: 'POST',
        body: { body: text },
        token,
      });
      setData((d) => ({ ...d, messages: [...(d?.messages || []), res.message] }));
      setBody('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200/60" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {error || 'Conversation not found.'}
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto flex max-w-3xl flex-col px-4 py-10">
      <Link
        to="/inbox"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-emerald-700"
      >
        ← Back to inbox
      </Link>

      <div className="flex items-center gap-3 rounded-t-2xl border border-slate-200 bg-white p-4">
        <Avatar id={data.other?.id} name={data.other?.name} src={data.other?.avatar} />
        <div className="min-w-0 flex-1">
          <Link
            to={`/users/${data.other?.id}`}
            className="font-semibold text-slate-900 hover:text-emerald-700"
          >
            {data.other?.name || 'User'}
          </Link>
          <p className="truncate text-sm text-slate-500">
            {data.other?.headline || (data.other?.role === 'client' ? 'Client' : 'Freelancer')}
          </p>
        </div>
        <Link
          to={`/jobs/${data.job.id}`}
          className="max-w-[45%] truncate rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
        >
          {data.job.title}
        </Link>
      </div>

      <div className="border-x border-slate-200 bg-slate-50 p-4">
        {data.messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            No messages yet — say hello to get the conversation started.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.messages.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                      mine
                        ? 'rounded-br-sm bg-emerald-600 text-white'
                        : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
                    }`}
                  >
                    {m.body}
                  </div>
                  <span className="mt-0.5 px-1 text-[11px] text-slate-400">
                    {timeAgo(m.created_at)}
                  </span>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form onSubmit={send} className="rounded-b-2xl border border-slate-200 bg-white p-3">
        {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) send(e);
            }}
            rows={2}
            maxLength={2000}
            placeholder="Write a message…  (Enter to send, Shift+Enter for a new line)"
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <button
            type="submit"
            disabled={!body.trim() || sending}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  );
}

// Inbox list: /inbox
export function Inbox() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api('/inbox', { token })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
          <p className="mt-1 text-sm text-slate-500">
            Conversations about jobs you've posted or bid on.
          </p>
        </div>
        {data?.unread_total > 0 && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
            {data.unread_total} unread
          </span>
        )}
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
          {error}
        </div>
      ) : !data ? (
        <div className="mt-6 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200/60" />
          ))}
        </div>
      ) : data.threads.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No conversations yet.
          <p className="mt-1 text-sm">
            Message a freelancer from your job's bids, or message a client from a job you bid on.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {data.threads.map((t) => (
            <li key={`${t.job_id}-${t.user_id}`}>
              <Link
                to={`/messages/${t.job_id}/${t.user_id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50"
              >
                <Avatar id={t.user_id} name={t.user_name} src={t.user_avatar} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-slate-900">{t.user_name}</p>
                    {t.unread > 0 && (
                      <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {t.unread}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-slate-500">
                    {t.last_sender_id === t.user_id ? '' : 'You: '}
                    {t.last_message}
                  </p>
                  <p className="truncate text-xs text-slate-400">{t.job_title}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(t.last_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

