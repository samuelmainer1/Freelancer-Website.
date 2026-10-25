import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Connects are the platform's bid credits. One Connect is spent when a
// freelancer bids on a job they have not bid on before; editing an existing bid
// is free so people can refine their proposal without being penalised.
export const BID_COST = 1;
export const STARTING_CONNECTS = 10;

// Bundles get cheaper per Connect as they get bigger.
export const CONNECT_PACKAGES = [
  { id: 'starter', name: 'Starter', connects: 10, price_usd: 5, best_value: false },
  { id: 'standard', name: 'Standard', connects: 40, price_usd: 15, best_value: true },
  { id: 'pro', name: 'Pro', connects: 100, price_usd: 30, best_value: false },
];

export function connectBalance(userId) {
  const row = db.prepare('SELECT connect_balance FROM users WHERE id = ?').get(userId);
  return row?.connect_balance ?? STARTING_CONNECTS;
}

// Deduct Connects atomically. Returns true when the balance covered the cost.
// The WHERE clause keeps two concurrent bids from both spending the last one.
export function spendConnects(userId, amount) {
  const result = db
    .prepare(
      'UPDATE users SET connect_balance = connect_balance - ? WHERE id = ? AND connect_balance >= ?'
    )
    .run(amount, userId, amount);
  return result.changes === 1;
}

// GET /api/connects  (freelancers only) — balance, bundles and recent purchases
router.get('/connects', requireAuth, requireRole('freelancer'), (req, res) => {
  const purchases = db
    .prepare(
      `SELECT id, package_id, connects, amount_usd, created_at
       FROM connect_purchases WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 20`
    )
    .all(req.user.id);
  const spent = db
    .prepare(
      `SELECT COUNT(*) AS total FROM bids WHERE freelancer_id = ?`
    )
    .get(req.user.id).total;
  res.json({
    balance: connectBalance(req.user.id),
    bid_cost: BID_COST,
    total_spent: spent,
    packages: CONNECT_PACKAGES,
    purchases,
  });
});

// POST /api/connects/purchase  (freelancers only) — buy a bundle
// There is no payment processor wired up: the purchase is recorded and credited
// immediately. Swapping in Stripe/PSP means validating a receipt here before
// crediting, which is why the ledger and credit share one transaction.
router.post('/connects/purchase', requireAuth, requireRole('freelancer'), (req, res) => {
  const pkg = CONNECT_PACKAGES.find((p) => p.id === req.body?.package_id);
  if (!pkg) {
    return res.status(400).json({ error: 'Unknown Connects package.' });
  }

  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO connect_purchases (user_id, package_id, connects, amount_usd)
       VALUES (?, ?, ?, ?)`
    ).run(req.user.id, pkg.id, pkg.connects, pkg.price_usd);
    db.prepare('UPDATE users SET connect_balance = connect_balance + ? WHERE id = ?').run(
      pkg.connects,
      req.user.id
    );
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  res.status(201).json({
    balance: connectBalance(req.user.id),
    purchased: { package_id: pkg.id, connects: pkg.connects, amount_usd: pkg.price_usd },
  });
});

export default router;
