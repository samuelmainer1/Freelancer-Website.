import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/bids/:id/review  — client reviews the freelancer, or freelancer reviews the client
router.post('/bids/:id/review', requireAuth, (req, res) => {
  const row = db
    .prepare(
      `SELECT b.*, j.client_id, j.status AS job_status, j.title AS job_title
       FROM bids b JOIN jobs j ON j.id = b.job_id
       WHERE b.id = ?`
    )
    .get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Bid not found.' });

  const me = req.user.id;
  const isClientOfJob = row.client_id === me;
  const isFreelancerOnBid = row.freelancer_id === me;

  if (!isClientOfJob && !isFreelancerOnBid) {
    return res.status(403).json({ error: 'You are not a party to this bid.' });
  }

  if (row.status !== 'accepted' || row.job_status !== 'awarded') {
    return res
      .status(400)
      .json({ error: 'You can leave a review once the bid has been accepted.' });
  }

  // Client reviews the freelancer; freelancer reviews the client.
  const revieweeId = isClientOfJob ? row.freelancer_id : row.client_id;

  const { rating, comment } = req.body || {};
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5.' });
  }

  const existing = db
    .prepare('SELECT id FROM reviews WHERE bid_id = ? AND reviewer_id = ?')
    .get(row.id, me);
  const text = comment ? String(comment).trim().slice(0, 1500) : null;

  if (existing) {
    db.prepare('UPDATE reviews SET rating = ?, comment = ? WHERE id = ?').run(
      r,
      text,
      existing.id
    );
  } else {
    db.prepare(
      `INSERT INTO reviews (job_id, bid_id, reviewer_id, reviewee_id, rating, comment)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(row.job_id, row.id, me, revieweeId, r, text);
  }

  const review = db
    .prepare('SELECT * FROM reviews WHERE bid_id = ? AND reviewer_id = ?')
    .get(row.id, me);
  res.status(existing ? 200 : 201).json({ review });
});

export default router;