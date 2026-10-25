import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const JOB_CARD_SELECT = `
  SELECT j.id, j.title, j.category, j.budget_min, j.budget_max, j.deadline,
         j.status, j.created_at, u.name AS client_name,
         (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id) AS bid_count
  FROM jobs j
  JOIN users u ON u.id = j.client_id
`;

function profilePayload(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    headline: row.headline || null,
    bio: row.bio || null,
    location: row.location || null,
    company: row.company || null,
    website: row.website || null,
    skills: row.skills
      ? String(row.skills)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    hourly_rate: row.hourly_rate != null ? row.hourly_rate : null,
    avatar: row.avatar || null,
    portfolio: row.portfolio || null,
    is_public: row.is_public == null ? 1 : Number(row.is_public),
    is_verified: row.is_verified == null ? 0 : Number(row.is_verified),
    member_since: row.created_at,
  };
}

// Aggregate rating stats + latest reviews written about a user
function reviewsFor(userId) {
  const summary = db
    .prepare(
      `SELECT COUNT(*) AS count, AVG(rating) AS average
       FROM reviews WHERE reviewee_id = ?`
    )
    .get(userId);
  const list = db
    .prepare(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              j.id AS job_id, j.title AS job_title,
              u.id AS reviewer_id, u.name AS reviewer_name, u.role AS reviewer_role
       FROM reviews r
       JOIN jobs j  ON j.id = r.job_id
       JOIN users u ON u.id = r.reviewer_id
       WHERE r.reviewee_id = ?
       ORDER BY r.created_at DESC
       LIMIT 20`
    )
    .all(userId);
  return {
    count: summary.count || 0,
    average: summary.count ? Math.round(summary.average * 10) / 10 : null,
    reviews: list,
  };
}

// PUT /api/users/me  (auth) — update my own profile
router.put('/me', requireAuth, (req, res) => {
  const me = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!me) return res.status(404).json({ error: 'User not found.' });

  const b = req.body || {};
  const text = (v, cur, max) =>
    v == null ? cur : String(v).trim().slice(0, max) || null;
  let rate = me.hourly_rate;
  if (b.hourly_rate != null && b.hourly_rate !== '') {
    const n = Number(b.hourly_rate);
    rate = isNaN(n) || n < 0 ? null : n;
  } else if (b.hourly_rate === '') {
    rate = null;
  }
  let skills = me.skills;

  if (me.role === 'freelancer' && b.skills != null) {
    skills =
      String(b.skills)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12)
        .join(',') || null;
  }

  // Avatar is an inline image data URL (no file storage needed). Cap size, allow images only.
  let avatar = me.avatar;
  if (b.avatar === '') {
    avatar = null;
  } else if (b.avatar != null) {
    const a = String(b.avatar);
    if (!/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(a)) {
      return res.status(400).json({ error: 'Avatar must be a PNG, JPEG, GIF or WebP image.' });
    }
    if (a.length > 800000) {
      return res.status(400).json({ error: 'Avatar image is too large (max ~600 KB).' });
    }
    avatar = a;
  }

  // Freelancers can opt out of the public directory
  const isPublic =
    b.is_public == null ? me.is_public ?? 1 : b.is_public === true || b.is_public === 1 || b.is_public === '1' ? 1 : 0;

  db.prepare(
    `UPDATE users SET headline = ?, bio = ?, location = ?, company = ?,
       website = ?, skills = ?, hourly_rate = ?, avatar = ?, portfolio = ?, is_public = ?
     WHERE id = ?`
  ).run(
    text(b.headline, me.headline, 120),
    text(b.bio, me.bio, 2000),
    text(b.location, me.location, 80),
    text(b.company, me.company, 120),
    text(b.website, me.website, 200),
    skills,
    rate,
    avatar,
    text(b.portfolio, me.portfolio, 800),
    isPublic,
    me.id
  );

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(me.id);
  res.json({ profile: profilePayload(row) });
});

// Freelancer track record: money earned, jobs won, bid win-rate and the rating
// spread shown as a 5→1 star breakdown on the profile.
function freelancerStats(userId) {
  const bids = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) AS active_bids,
         SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS won_jobs,
         SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_bids,
         COUNT(*)                                              AS total_bids
       FROM bids WHERE freelancer_id = ?`
    )
    .get(userId);

  // Earnings = value of every awarded job. There is no payments table yet, so
  // this is the contracted amount, which is the honest number to show.
  const earned = db
    .prepare(
      `SELECT COALESCE(SUM(b.amount), 0) AS total
       FROM bids b JOIN jobs j ON j.id = b.job_id
       WHERE b.freelancer_id = ? AND b.status = 'accepted'`
    )
    .get(userId).total;

  const totalBids = bids.total_bids || 0;
  const wonJobs = bids.won_jobs || 0;

  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  db.prepare(
    'SELECT rating, COUNT(*) AS c FROM reviews WHERE reviewee_id = ? GROUP BY rating'
  )
    .all(userId)
    .forEach((r) => {
      breakdown[r.rating] = r.c;
    });

  return {
    active_bids: bids.active_bids || 0,
    won_jobs: wonJobs,
    total_bids: totalBids,
    rejected_bids: bids.rejected_bids || 0,
    earned_total: Math.round(earned * 100) / 100,
    win_rate: totalBids ? Math.round((wonJobs / totalBids) * 100) : null,
    rating_breakdown: breakdown,
  };
}

// GET /api/users/:id — public professional profile + activity
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(404).json({ error: 'User not found.' });
  }
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'User not found.' });
  const profile = profilePayload(row);

  if (row.role === 'client') {
    const jobs = db
      .prepare(
        `${JOB_CARD_SELECT} WHERE j.client_id = ? ORDER BY j.created_at DESC LIMIT 20`
      )
      .all(row.id);
    return res.json({ profile, jobs, ...reviewsFor(row.id) });
  }

  // Freelancer: track record + recent won jobs
  const won_jobs = db
    .prepare(
      `SELECT j.id, j.title, j.status, j.created_at, u.name AS client_name,
              b.amount, b.days
       FROM jobs j
       JOIN bids b ON b.job_id = j.id
       JOIN users u ON u.id = j.client_id
       WHERE b.freelancer_id = ? AND b.status = 'accepted'
       ORDER BY j.created_at DESC
       LIMIT 10`
    )
    .all(row.id);

  res.json({
    profile,
    stats: freelancerStats(row.id),
    won_jobs,
    ...reviewsFor(row.id),
  });
});

// GET /api/users?role=freelancer&search=&skill=&min_rate=&max_rate=&min_rating=&page=
// Public directory of freelancers (skills / rate / rating filters + pagination)
router.get('/', (req, res) => {
  const role = req.query.role === 'client' ? 'client' : 'freelancer';
  const conditions = ['u.role = ?', 'COALESCE(u.is_public, 1) = 1'];
  const params = [role];

  const search = String(req.query.search || '').trim();
  if (search) {
    conditions.push('(u.name LIKE ? OR u.headline LIKE ? OR u.bio LIKE ? OR u.skills LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  const skill = String(req.query.skill || '').trim();
  if (skill) {
    conditions.push('(u.skills LIKE ?)');
    params.push(`%${skill}%`);
  }

  const num = (v) => {
    const n = Number(v);
    return v !== undefined && v !== '' && Number.isFinite(n) ? n : null;
  };
  const minRate = num(req.query.min_rate);
  const maxRate = num(req.query.max_rate);
  if (minRate != null) {
    conditions.push('u.hourly_rate IS NOT NULL AND u.hourly_rate >= ?');
    params.push(minRate);
  }
  if (maxRate != null) {
    conditions.push('u.hourly_rate IS NOT NULL AND u.hourly_rate <= ?');
    params.push(maxRate);
  }

  const order = req.query.sort || '';
  const orderSql =
    order === 'rating' ? 'avg_rating DESC, review_count DESC'
    : order === 'rate' ? 'u.hourly_rate ASC'
    : order === 'name' ? 'u.name ASC'
    : 'review_count DESC, u.created_at DESC';

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(48, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
  const offset = (page - 1) * limit;

  // Ratings are aggregated subqueries so they can be filtered/sorted in SQL.
  const base = `
    SELECT u.id, u.name, u.role, u.headline, u.bio, u.location, u.skills,
           u.hourly_rate, u.avatar, u.portfolio, u.website, u.company, u.created_at,
           COALESCE(rv.cnt, 0) AS review_count,
           ROUND(rv.avg, 1) AS avg_rating,
           (SELECT COUNT(*) FROM bids b
              JOIN jobs j ON j.id = b.job_id
             WHERE b.freelancer_id = u.id AND b.status = 'accepted') AS jobs_done
    FROM users u
    LEFT JOIN (
      SELECT reviewee_id, COUNT(*) AS cnt, AVG(rating) AS avg
      FROM reviews GROUP BY reviewee_id
    ) rv ON rv.reviewee_id = u.id
  `;

  if (req.query.min_rating !== undefined && req.query.min_rating !== '') {
    const minRating = Number(req.query.min_rating);
    if (Number.isFinite(minRating)) {
      conditions.push('COALESCE(rv.avg, 0) >= ?');
      params.push(minRating);
    }
  }
  const where = `WHERE ${conditions.join(' AND ')} `;

  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM (${base} ${where}) `)
    .get(...params).c;

  const rows = db
    .prepare(`${base} ${where} ORDER BY ${orderSql} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  const freelancers = rows.map((r) => ({
    ...profilePayload(r),
    review_count: r.review_count || 0,
    average_rating: r.avg_rating,
    jobs_done: r.jobs_done || 0,
  }));

  res.json({
    freelancers,
    page,
    limit,
    total,
    total_pages: Math.max(1, Math.ceil(total / limit)),
  });
});

export default router;