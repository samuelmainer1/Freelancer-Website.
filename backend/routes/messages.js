import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Who am I allowed to message about this job? (owner ↔ bidders)
function threadParties(jobId, userId) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) return { error: { status: 404, message: 'Job not found.' } };
  const hasBid = db
    .prepare('SELECT 1 AS x FROM bids WHERE job_id = ? AND freelancer_id = ?')
    .get(jobId, userId);

  if (userId === job.client_id) return { job, isOwner: true };
  if (hasBid) return { job, isOwner: false };
  return {
    error: { status: 403, message: 'You can only message on jobs you posted or bid on.' },
  };
}

// GET /api/messages/inbox — conversations grouped by job + counterpart
router.get('/inbox', requireAuth, (req, res) => {
  const me = req.user.id;
  const rows = db
    .prepare(
      `SELECT m.job_id, j.title AS job_title, j.status AS job_status,
              other.id AS user_id, other.name AS user_name, other.avatar AS user_avatar,
              other.role AS user_role,
              MAX(m.created_at) AS last_at,
              SUM(CASE WHEN m.receiver_id = ? AND m.read_at IS NULL THEN 1 ELSE 0 END)
                AS unread
       FROM messages m
       JOIN jobs j ON j.id = m.job_id
       JOIN users other
         ON other.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
       WHERE m.sender_id = ? OR m.receiver_id = ?
       GROUP BY m.job_id, other.id
       ORDER BY last_at DESC`
    )
    .all(me, me, me, me);

  const threads = rows.map((r) => {
    const last = db
      .prepare(
        `SELECT body, created_at, sender_id FROM messages
         WHERE job_id = ? AND (
           (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
         )
         ORDER BY created_at DESC, id DESC LIMIT 1`
      )
      .get(r.job_id, me, r.user_id, r.user_id, me);
    return { ...r, unread: r.unread || 0, last_message: last?.body ?? null, last_sender_id: last?.sender_id ?? null };
  });

  const unread_total = db
    .prepare('SELECT COUNT(*) AS c FROM messages WHERE receiver_id = ? AND read_at IS NULL')
    .get(me).c;

  res.json({ threads, unread_total });
});

// GET /api/jobs/:id/messages/:userId — full conversation, marks incoming as read
router.get('/jobs/:id/messages/:userId', requireAuth, (req, res) => {
  const jobId = Number(req.params.id);
  const otherId = Number(req.params.userId);
  const me = req.user.id;
  const party = threadParties(jobId, me);
  if (party.error) return res.status(party.error.status).json({ error: party.error.message });

  if (!party.isOwner && otherId !== party.job.client_id) {
    return res.status(403).json({ error: 'Freelancers can only message the job owner.' });
  }
  const otherBid = db
    .prepare('SELECT 1 AS x FROM bids WHERE job_id = ? AND freelancer_id = ?')
    .get(jobId, otherId);
  if (party.isOwner && !otherBid && otherId !== me) {
    return res.status(403).json({ error: 'You can only message freelancers who bid on this job.' });
  }

  const messages = db
    .prepare(
      `SELECT id, sender_id, receiver_id, body, read_at, created_at
       FROM messages
       WHERE job_id = ? AND (
         (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
       )
       ORDER BY created_at ASC, id ASC`
    )
    .all(jobId, me, otherId, otherId, me);

  db.prepare(
    `UPDATE messages SET read_at = datetime('now')
     WHERE job_id = ? AND sender_id = ? AND receiver_id = ? AND read_at IS NULL`
  ).run(jobId, otherId, me);

  const other = db
    .prepare('SELECT id, name, role, avatar, headline FROM users WHERE id = ?')
    .get(otherId);

  res.json({ job: party.job, other, messages });
});

// POST /api/jobs/:id/messages/:userId — send a message
router.post('/jobs/:id/messages/:userId', requireAuth, (req, res) => {
  const jobId = Number(req.params.id);
  const otherId = Number(req.params.userId);
  const me = req.user.id;
  const party = threadParties(jobId, me);
  if (party.error) return res.status(party.error.status).json({ error: party.error.message });
  if (otherId === me) {
    return res.status(400).json({ error: 'You cannot message yourself.' });
  }

  if (party.isOwner) {
    const hasBid = db
      .prepare('SELECT 1 AS x FROM bids WHERE job_id = ? AND freelancer_id = ?')
      .get(jobId, otherId);
    if (!hasBid) {
      return res
        .status(403)
        .json({ error: 'You can only message freelancers who bid on this job.' });
    }
  } else if (otherId !== party.job.client_id) {
    return res.status(403).json({ error: 'Freelancers can only message the job owner.' });
  }

  const body = String((req.body || {}).body || '').trim();
  if (!body) return res.status(400).json({ error: 'Message cannot be empty.' });
  if (body.length > 2000) {
    return res.status(400).json({ error: 'Message is too long (max 2000 characters).' });
  }

  const result = db
    .prepare(
      `INSERT INTO messages (job_id, sender_id, receiver_id, body) VALUES (?, ?, ?, ?)`
    )
    .run(jobId, me, otherId, body);
  const message = db
    .prepare(
      `SELECT id, sender_id, receiver_id, body, read_at, created_at FROM messages WHERE id = ?`
    )
    .get(result.lastInsertRowid);

  res.status(201).json({ message });
});

// GET /api/messages/unread-count — for the navbar badge
router.get('/unread-count', requireAuth, (req, res) => {
  const c = db
    .prepare('SELECT COUNT(*) AS c FROM messages WHERE receiver_id = ? AND read_at IS NULL')
    .get(req.user.id).c;
  res.json({ unread: c });
});

export default router;