import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { db } from './db.js';
import { USING_DEV_SECRET } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import bidRoutes from './routes/bids.js';
import userRoutes from './routes/users.js';
import reviewRoutes from './routes/reviews.js';
import messageRoutes from './routes/messages.js';
import connectRoutes from './routes/connects.js';

const app = express();

// Only trust X-Forwarded-* from a proxy we control; needed for correct
// rate-limit IPs behind a reverse proxy.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

app.use(helmet());

// CORS: allow-list the frontend origin(s). CORS_ORIGINS is a comma-separated
// list; defaults to the Vite dev server.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // No Origin header = same-origin, curl, or a server-to-server call.
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} is not allowed by CORS`));
    },
  })
);

app.use(express.json({ limit: '2mb' })); // avatars are inline data URLs

// Throttle login/register attempts to blunt credential stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

// General API ceiling, generous enough not to affect normal browsing.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Public stats for the landing page
app.get('/api/stats', (_req, res) => {
  const s = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM jobs WHERE status = 'open') AS open_jobs,
        (SELECT COUNT(*) FROM bids) AS total_bids,
        (SELECT COUNT(*) FROM users WHERE role = 'freelancer') AS freelancers,
        (SELECT COUNT(*) FROM users WHERE role = 'client') AS clients`
    )
    .get();
  res.json(s);
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api', bidRoutes);
app.use('/api', reviewRoutes);
app.use('/api', messageRoutes);
app.use('/api', connectRoutes);
app.use('/api/users', userRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Client errors (bad JSON, rejected CORS origin) are not server faults, so
  // don't log them as crashes or report 500 to the caller.
  if (err.message?.includes('not allowed by CORS')) {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.type === 'entity.parse.failed' ? 'Malformed JSON body.' : err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ FreelanceMarketplace API running on http://localhost:${PORT}`);
  if (USING_DEV_SECRET) {
    console.warn(
      '⚠️  Using the built-in dev JWT secret. Set JWT_SECRET before deploying (required when NODE_ENV=production).'
    );
  }
});
