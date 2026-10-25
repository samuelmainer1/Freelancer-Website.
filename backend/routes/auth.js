import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { requireAuth, SECRET } from '../middleware/auth.js';

const router = Router();

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatar: row.avatar || null,
  };
}

function signToken(user) {
  return jwt.sign({ id: user.id, name: user.name, role: user.role }, SECRET, { expiresIn: '7d' });
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password and role are required.' });
  }
  if (!['client', 'freelancer'].includes(role)) {
    return res.status(400).json({ error: 'Role must be "client" or "freelancer".' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (!/^\S+@\S+\.\S+$/.test(String(email))) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const hash = bcrypt.hashSync(String(password), 10);
  try {
    const result = db
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(String(name).trim(), String(email).trim().toLowerCase(), hash, role);
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    const user = publicUser(row);
    res.status(201).json({ token: signToken(user), user });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    throw e;
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const row = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email).trim().toLowerCase());
  if (!row || !bcrypt.compareSync(String(password), row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const user = publicUser(row);
  res.json({ token: signToken(user), user });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: 'User no longer exists.' });
  res.json({ user: publicUser(row) });
});

export default router;
