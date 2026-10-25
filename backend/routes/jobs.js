import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const JOB_SELECT = `
  SELECT j.*, u.name AS client_name, u.avatar AS client_avatar,
    (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id) AS bid_count,
    (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.reviewee_id = j.client_id)
      AS client_rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.reviewee_id = j.client_id) AS client_review_count
  FROM jobs j
  JOIN users u ON u.id = j.client_id
`;

// Validates an optional deadline (YYYY-MM-DD, today or later). Returns an error string or null.
function deadlineError(deadline) {
  if (!deadline) return null;
  const s = String(deadline).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return 'Deadline must be a date in YYYY-MM-DD format.';
  }
  const d = new Date(`${s}T00:00:00Z`);
  if (isNaN(d.getTime())) return 'Please enter a valid deadline date.';
  const today = new Date();
  const todayStr = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  )
    .toISOString()
    .slice(0, 10);
  if (s < todayStr) return 'Deadline cannot be in the past.';
  return null;
}

// POST /api/jobs  (clients only) — create a job
router.post('/', requireAuth, requireRole('client'), (req, res) => {
  const { title, description, category, budget_min, budget_max, deadline } = req.body || {};
  if (!title || !description || !String(title).trim() || !String(description).trim()) {
    return res.status(400).json({ error: 'Title and description are required.' });
  }
  const min = budget_min === '' || budget_min == null ? null : Number(budget_min);
  const max = budget_max === '' || budget_max == null ? null : Number(budget_max);
  if ((min != null && (isNaN(min) || min < 0)) || (max != null && (isNaN(max) || max < 0))) {
    return res.status(400).json({ error: 'Budget values must be positive numbers.' });
  }
  if (min != null && max != null && min > max) {
    return res.status(400).json({ error: 'Minimum budget cannot exceed maximum budget.' });
  }
  const dlErr = deadlineError(deadline);
  if (dlErr) return res.status(400).json({ error: dlErr });

  const result = db
    .prepare(
      `INSERT INTO jobs (client_id, title, description, category, budget_min, budget_max, deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      String(title).trim(),
      String(description).trim(),
      category || 'Other',
      min,
      max,
      deadline || null
    );
  const row = db.prepare(`${JOB_SELECT} WHERE j.id = ?`).get(result.lastInsertRowid);
  res.status(201).json({ job: row });
});

// GET /api/jobs/mine  (clients only) — jobs I posted, with bid stats
router.get('/mine', requireAuth, requireRole('client'), (req, res) => {
  const rows = db
    .prepare(
      `${JOB_SELECT}
       WHERE j.client_id = ?
       ORDER BY j.created_at DESC`
    )
    .all(req.user.id);
  const withStats = rows.map((j) => {
    const s = db
      .prepare('SELECT COUNT(*) AS c, MIN(amount) AS lowest FROM bids WHERE job_id = ?')
      .get(j.id);
    return { ...j, bid_count: s.c, lowest_bid: s.c > 0 ? s.lowest : null };
  });
  res.json({ jobs: withStats });
});

// GET /api/jobs?search=&category=&page=&limit=  — public feed of open jobs (paginated)
router.get('/', (req, res) => {
  const { search = '', category = '' } = req.query;
  const conditions = ["j.status = 'open'"];
  const params = [];
  if (search) {
    conditions.push('(j.title LIKE ? OR j.description LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s);
  }
  if (category) {
    conditions.push('j.category = ?');
    params.push(category);
  }
  const where = conditions.join(' AND ');

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
  const offset = (page - 1) * limit;

  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM jobs j WHERE ${where}`)
    .get(...params).c;

  const rows = db
    .prepare(`${JOB_SELECT} WHERE ${where} ORDER BY j.created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  res.json({
    jobs: rows,
    page,
    limit,
    total,
    total_pages: Math.max(1, Math.ceil(total / limit)),
    has_more: offset + rows.length < total,
  });
});

// GET /api/jobs/:id — public job detail
router.get('/:id', (req, res) => {
  const row = db.prepare(`${JOB_SELECT} WHERE j.id = ?`).get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Job not found.' });
  res.json({ job: row });
});

// PUT /api/jobs/:id  (owner only) — edit an open job
router.put('/:id', requireAuth, requireRole('client'), (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(Number(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  if (job.client_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own jobs.' });
  }
  if (job.status !== 'open') {
    return res.status(400).json({ error: 'Only open jobs can be edited.' });
  }

  const b = req.body || {};
  const title = b.title == null ? job.title : String(b.title).trim();
  const description = b.description == null ? job.description : String(b.description).trim();
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required.' });
  }
  if (title.length > 120) {
    return res.status(400).json({ error: 'Title must be 120 characters or fewer.' });
  }

  const num = (v, cur) => (v === '' || v == null ? null : Number(v));
  const min = num(b.budget_min, job.budget_min);
  const max = num(b.budget_max, job.budget_max);
  if ((min != null && (isNaN(min) || min < 0)) || (max != null && (isNaN(max) || max < 0))) {
    return res.status(400).json({ error: 'Budget values must be positive numbers.' });
  }
  if (min != null && max != null && min > max) {
    return res.status(400).json({ error: 'Minimum budget cannot exceed maximum budget.' });
  }

  const deadline = b.deadline === undefined ? job.deadline : b.deadline || null;
  const dlErr = deadlineError(deadline);
  if (dlErr) return res.status(400).json({ error: dlErr });

  db.prepare(
    `UPDATE jobs SET title = ?, description = ?, category = ?, budget_min = ?,
       budget_max = ?, deadline = ? WHERE id = ?`
  ).run(
    title.slice(0, 120),
    description,
    b.category ? String(b.category).slice(0, 60) : job.category,
    min,
    max,
    deadline,
    job.id
  );

  res.json({ job: db.prepare(`${JOB_SELECT} WHERE j.id = ?`).get(job.id) });
});

// POST /api/jobs/:id/close  (owner only) — close without awarding
router.post('/:id/close', requireAuth, requireRole('client'), (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(Number(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  if (job.client_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only close your own jobs.' });
  }
  if (job.status !== 'open') {
    return res.status(400).json({ error: 'Only open jobs can be closed.' });
  }
  db.prepare("UPDATE jobs SET status = 'closed' WHERE id = ?").run(job.id);
  res.json({ ok: true });
});

export default router;
