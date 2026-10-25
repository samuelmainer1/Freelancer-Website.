import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { BID_COST, connectBalance, spendConnects } from './connects.js';

const router = Router();

// POST /api/jobs/:id/bids  (freelancers only) — place or update a bid
router.post('/jobs/:id/bids', requireAuth, requireRole('freelancer'), (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(Number(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  if (job.status !== 'open') {
    return res.status(400).json({ error: 'This job is no longer accepting bids.' });
  }
  const { amount, days, proposal } = req.body || {};
  const amt = Number(amount);
  const d = Number(days);
  if (!amt || isNaN(amt) || amt <= 0) {
    return res.status(400).json({ error: 'Please enter a valid bid amount.' });
  }
  if (!d || isNaN(d) || d < 1) {
    return res.status(400).json({ error: 'Delivery time must be at least 1 day.' });
  }
  if (!proposal || !String(proposal).trim()) {
    return res.status(400).json({ error: 'Please write a short proposal.' });
  }

  // One bid per freelancer per job — re-bidding updates it.
  const existing = db
    .prepare('SELECT id FROM bids WHERE job_id = ? AND freelancer_id = ?')
    .get(job.id, req.user.id);

  // Connects are only spent on a *new* bid; editing an existing proposal is
  // free so freelancers can keep their pitch sharp.
  if (!existing) {
    const balance = connectBalance(req.user.id);
    if (balance < BID_COST) {
      return res.status(402).json({
        error: `You have no Connects left. Each new bid costs ${BID_COST} Connect, and you can buy more to keep applying.`,
        code: 'INSUFFICIENT_CONNECTS',
        required_connects: BID_COST,
        balance,
      });
    }
  }

  db.exec('BEGIN');
  try {
    if (!existing && !spendConnects(req.user.id, BID_COST)) {
      db.exec('ROLLBACK');
      return res.status(402).json({
        error: 'You have no Connects left. Buy more to keep bidding.',
        code: 'INSUFFICIENT_CONNECTS',
        required_connects: BID_COST,
        balance: connectBalance(req.user.id),
      });
    }
    db.prepare(
      `INSERT INTO bids (job_id, freelancer_id, amount, days, proposal)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(job_id, freelancer_id) DO UPDATE SET
         amount = excluded.amount,
         days = excluded.days,
         proposal = excluded.proposal,
         created_at = datetime('now')`
    ).run(job.id, req.user.id, amt, d, String(proposal).trim());
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  // Must not rely on lastInsertRowid here: upserts report the last *inserted*
  // row globally, so updating an existing bid would return someone else's id.
  const saved = db
    .prepare('SELECT * FROM bids WHERE job_id = ? AND freelancer_id = ?')
    .get(job.id, req.user.id);
  res.status(201).json({
    bid: saved,
    charged_connects: existing ? 0 : BID_COST,
    connect_balance: connectBalance(req.user.id),
  });
});

// GET /api/jobs/:id/bids  (auth) — owner sees all bids, freelancers see their own
router.get('/jobs/:id/bids', requireAuth, (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(Number(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  if (req.user.id === job.client_id) {
    const bids = db
      .prepare(
        `SELECT b.*, u.name AS freelancer_name, u.email AS freelancer_email,
                u.headline AS freelancer_headline, u.avatar AS freelancer_avatar,
                r.id AS review_id, r.rating AS review_rating, r.comment AS review_comment,
                (SELECT rv.id FROM reviews rv
                  WHERE rv.bid_id = b.id AND rv.reviewer_id = j.client_id) AS client_review_id,
                (SELECT ROUND(AVG(r2.rating), 1) FROM reviews r2
                  WHERE r2.reviewee_id = b.freelancer_id) AS freelancer_rating,
                (SELECT COUNT(*) FROM reviews r2
                  WHERE r2.reviewee_id = b.freelancer_id) AS freelancer_rating_count
         FROM bids b JOIN users u ON u.id = b.freelancer_id
         JOIN jobs j ON j.id = b.job_id
         LEFT JOIN reviews r ON r.bid_id = b.id AND r.reviewer_id = b.freelancer_id
         WHERE b.job_id = ?
         ORDER BY CASE b.status WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                  b.amount ASC`
      )
      .all(job.id);
    return res.json({ is_owner: true, bids });
  }

  const own = db
    .prepare(
      `SELECT b.*, u.name AS freelancer_name FROM bids b
       JOIN users u ON u.id = b.freelancer_id
       WHERE b.job_id = ? AND b.freelancer_id = ?`
    )
    .all(job.id, req.user.id);
  res.json({ is_owner: false, bids: own });
});

// GET /api/bids/mine  (freelancers only) — all of my bids
router.get('/bids/mine', requireAuth, requireRole('freelancer'), (req, res) => {
  const bids = db
    .prepare(
      `SELECT b.*, j.title AS job_title, j.status AS job_status,
              j.client_id AS client_id, u.name AS client_name, u.avatar AS client_avatar,
              (SELECT r.id FROM reviews r
                WHERE r.bid_id = b.id AND r.reviewer_id = b.freelancer_id) AS client_review_id,
              (SELECT r.rating FROM reviews r
                WHERE r.bid_id = b.id AND r.reviewer_id = b.freelancer_id) AS client_review_rating
       FROM bids b
       JOIN jobs j ON j.id = b.job_id
       JOIN users u ON u.id = j.client_id
       WHERE b.freelancer_id = ?
       ORDER BY b.created_at DESC`
    )
    .all(req.user.id);
  res.json({ bids });
});

// POST /api/bids/:id/accept  (job owner only) — award the job
router.post('/bids/:id/accept', requireAuth, requireRole('client'), (req, res) => {
  const row = db
    .prepare(
      `SELECT b.*, j.client_id, j.status AS job_status, j.title AS job_title
       FROM bids b JOIN jobs j ON j.id = b.job_id
       WHERE b.id = ?`
    )
    .get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Bid not found.' });
  if (row.client_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only accept bids on your own jobs.' });
  }
  if (row.job_status !== 'open') {
    return res.status(400).json({ error: 'This job is no longer open.' });
  }

  db.exec('BEGIN');
  try {
    db.prepare("UPDATE bids SET status = 'accepted' WHERE id = ?").run(row.id);
    db.prepare("UPDATE bids SET status = 'rejected' WHERE job_id = ? AND id != ?").run(
      row.job_id,
      row.id
    );
    db.prepare("UPDATE jobs SET status = 'awarded' WHERE id = ?").run(row.job_id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.json({ ok: true });
});

export default router;
