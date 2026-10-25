import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// SQLite database file (auto-created on first run)
export const db = new DatabaseSync(path.join(__dirname, 'app.db'));

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('client','freelancer')),
    headline      TEXT,
    bio           TEXT,
    location      TEXT,
    company       TEXT,
    website       TEXT,
    skills        TEXT,
    hourly_rate   REAL,
    avatar        TEXT,
    portfolio     TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'Other',
    budget_min  REAL,
    budget_max  REAL,
    deadline    TEXT,
    status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','awarded','closed')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bids (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id        INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount        REAL NOT NULL,
    days          INTEGER NOT NULL,
    proposal      TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (job_id, freelancer_id)
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_bids_job    ON bids(job_id);
  CREATE INDEX IF NOT EXISTS idx_bids_user   ON bids(freelancer_id);
`);

// Ratings & reviews: on an accepted bid, each party may review the other once
// (UNIQUE (bid_id, reviewer_id)) — client reviews freelancer and vice versa.
db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    bid_id      INTEGER NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
    reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (bid_id, reviewer_id)
  );
  CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
`);

// Direct messages between a client and a freelancer, scoped to a job
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id     INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    read_at    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(job_id, sender_id, receiver_id);
  CREATE INDEX IF NOT EXISTS idx_messages_inbox  ON messages(receiver_id, read_at);
`);

// Lightweight migrations for databases created by older versions
function ensureColumn(table, column, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
}
[
  ['headline', 'TEXT'],
  ['bio', 'TEXT'],
  ['location', 'TEXT'],
  ['company', 'TEXT'],
  ['website', 'TEXT'],
  ['skills', 'TEXT'],
  ['hourly_rate', 'REAL'],
  ['avatar', 'TEXT'],
  ['portfolio', 'TEXT'],
  ['is_public', 'INTEGER DEFAULT 1'],
  // Bid credits ("Connects"). New freelancers start with a few so they can bid
  // immediately; each bid on a new job costs one and they top up by buying more.
  ['connect_balance', 'INTEGER DEFAULT 10'],
  // Admin-granted trust badge (ID check, etc). Read-only for users.
  ['is_verified', 'INTEGER DEFAULT 0'],
].forEach(([col, type]) => ensureColumn('users', col, type));

// Connects purchases. Kept as a ledger rather than just bumping the balance so
// there is an auditable trail of what was bought, when and for how much.
db.exec(`
  CREATE TABLE IF NOT EXISTS connect_purchases (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    package_id  TEXT NOT NULL,
    connects    INTEGER NOT NULL CHECK (connects > 0),
    amount_usd  REAL NOT NULL CHECK (amount_usd >= 0),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_connect_purchases_user
    ON connect_purchases(user_id, created_at);
`);

// Migrate older reviews tables that had `bid_id ... UNIQUE` (one review per bid)
// to `UNIQUE (bid_id, reviewer_id)` so client and freelancer can each leave one.
(() => {
  const sql = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'reviews'")
    .get()?.sql;
  if (!sql || !/bid_id\s+INTEGER\s+NOT\s+NULL\s+UNIQUE/i.test(sql)) return;

  db.exec('BEGIN');
  try {
    db.exec(`
      ALTER TABLE reviews RENAME TO reviews_old;
      CREATE TABLE reviews (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        bid_id      INTEGER NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
        reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reviewee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment     TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (bid_id, reviewer_id)
      );
      INSERT INTO reviews (id, job_id, bid_id, reviewer_id, reviewee_id, rating, comment, created_at)
        SELECT id, job_id, bid_id, reviewer_id, reviewee_id, rating, comment, created_at
        FROM reviews_old;
      DROP TABLE reviews_old;
      CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
    `);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('reviews migration failed:', err.message);
  }
})();

// Seed demo data on first run only
function seed() {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (c > 0) return;

  const hash = bcrypt.hashSync('password123', 10);
  const insUser = db.prepare(
    `INSERT INTO users
       (name, email, password_hash, role, headline, bio, location, company, website, skills, hourly_rate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const alice = insUser.run(
    'Alice Chen',
    'alice@demo.com',
    hash,
    'client',
    'Product lead hiring great builders',
    'I lead product at a fast-growing SaaS company and post design, development and marketing projects here. I value clear communication, honest timelines and pixel-perfect execution.',
    'San Francisco, CA',
    null,
    null,
    null,
    null
  ).lastInsertRowid;
  const sarah = insUser.run(
    'Sarah Kim',
    'sarah@demo.com',
    hash,
    'client',
    'Founder at StartupCo — specialty coffee, powered by software',
    'Founder of a specialty coffee startup. We roast our own beans and sell online. I hire freelancers for branding, web and mobile work and growth marketing as the company scales.',
    'Seattle, WA',
    'StartupCo',
    'https://startupco.example.com',
    null,
    null
  ).lastInsertRowid;
  const joe = insUser.run(
    'Joe Rivera',
    'joe@demo.com',
    hash,
    'freelancer',
    'Full-stack developer — React, Node & Python',
    'Full-stack developer with 7 years of experience shipping web apps for startups. I specialize in React front-ends backed by Node or Python, with automated tests, clean handover docs and honest timelines.',
    'Austin, TX',
    null,
    null,
    'React,TypeScript,Node.js,Python,PostgreSQL,REST APIs',
    65
  ).lastInsertRowid;

  const maya = insUser.run(
    'Maya Patel',
    'maya@demo.com',
    hash,
    'freelancer',
    'Product designer & Flutter developer',
    'Designer turned developer who takes products from first sketch to app-store release. Recent projects include a coffee brand kit and a Flutter shopping app. I sweat the details and communicate daily.',
    'Toronto, ON',
    null,
    null,
    'UI/UX Design,Figma,Design Systems,Flutter,Brand Identity,Logo Design',
    55
  ).lastInsertRowid;

  const insJob = db.prepare(
    `INSERT INTO jobs (client_id, title, description, category, budget_min, budget_max, deadline)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const j1 = insJob.run(
    alice,
    'Build a React analytics dashboard',
    'We need an experienced React developer to build an analytics dashboard for our SaaS product. Charts, filters, role-based access, and a clean responsive UI. Figma designs are ready; we use TypeScript and Vite.',
    'Web Development',
    2000,
    5000,
    '2026-12-15'
  ).lastInsertRowid;
  const j2 = insJob.run(
    sarah,
    'Design a logo and brand kit for a coffee startup',
    "Looking for a designer to create a modern logo, color palette, and brand guidelines for our specialty coffee brand. Deliverables: vector files, social media banners, and packaging mockups.",
    'Design',
    300,
    800,
    '2026-11-20'
  ).lastInsertRowid;
  const j3 = insJob.run(
    alice,
    'Write 10 SEO blog posts for a fintech blog',
    'We need 10 well-researched, SEO-optimized blog posts (1000+ words each) about personal finance and budgeting apps. Python-heavy topics not required; strong writing samples needed.',
    'Writing',
    500,
    1000,
    '2026-12-01'
  ).lastInsertRowid;
  const j4 = insJob.run(
    sarah,
    'Flutter app: bug fixes and store release',
    'Our Flutter e-commerce app has a few crashes on Android 14 and we need help publishing a stable release to both stores. Experience with release pipelines required.',
    'Mobile Development',
    700,
    1500,
    '2026-11-30'
  ).lastInsertRowid;
  const j5 = insJob.run(
    alice,
    'Set up Google Ads campaign for an online store',
    'Need a marketing specialist to structure and launch Google Search + Shopping campaigns for our Shopify store. Include keyword research and a 3-month optimization plan.',
    'Marketing',
    250,
    600,
    '2026-11-25'
  ).lastInsertRowid;

  // A wider spread of open jobs so the feed, category filters and pagination
  // all have realistic content to work with.
  const moreJobs = [
    // [client, title, description, category, budget_min, budget_max, deadline]
    [sarah, 'Redesign our Shopify storefront for mobile', 'Our coffee store converts poorly on phones. We need a mobile-first redesign of the product, cart and checkout pages that keeps our existing theme and apps intact.', 'Web Development', 1500, 3500, '2026-12-20'],
    [alice, 'Build a REST API for a booking system', 'Looking for a backend developer to build a documented REST API (Node/Express or FastAPI) for appointments and availability, with Postgres and automated tests.', 'Web Development', 2000, 4500, '2026-12-30'],
    [sarah, 'Fix Core Web Vitals on our marketing site', 'Lighthouse scores are in the 40s on mobile. Need someone to audit and fix LCP/CLS issues: image handling, fonts, render-blocking scripts.', 'Web Development', 400, 900, '2026-11-18'],
    [alice, 'React Native app for our event check-in', 'We need a small React Native app for staff to scan QR codes at event check-in, work offline and sync when back online. iOS and Android.', 'Mobile Development', 2500, 6000, '2027-01-15'],
    [sarah, 'Add push notifications to our Flutter app', 'Our Flutter app needs push notifications for order updates and promotions, including deep links into the right screen from the notification tap.', 'Mobile Development', 300, 800, '2026-11-28'],
    [alice, 'Brand identity refresh for a B2B SaaS', 'Refresh our logo, type system and colour palette, plus templates for pitch decks and social. We are repositioning from SMB to mid-market.', 'Design', 2000, 4000, '2026-12-10'],
    [sarah, 'Packaging illustration for a seasonal blend', 'Need a hand-drawn illustration for our winter blend packaging (front label), plus a version for social. Print-ready vector preferred.', 'Design', 350, 700, '2026-11-22'],
    [alice, 'Design system audit and Figma cleanup', 'Our Figma library has drifted from the live product. Need an audit, consolidated components and a documented spacing/type scale.', 'Design', 1200, 2500, '2026-12-18'],
    [sarah, 'Write product descriptions for 30 coffee SKUs', 'Need 30 short, warm, sensory product descriptions (80–120 words each) for our online store, matching our brand voice guide.', 'Writing', 400, 900, '2026-11-20'],
    [alice, 'Technical documentation for our public API', 'Write developer-facing docs for our REST API: quickstart, auth, endpoint reference and 5 worked examples. We use OpenAPI already.', 'Writing', 800, 2000, '2026-12-22'],
    [sarah, 'Email sequence for a coffee subscription launch', 'Write a 6-email welcome and launch sequence from first signup to first purchase. We use Klaviyo. Need subject lines and A/B variants.', 'Marketing', 500, 1100, '2026-11-26'],
    [alice, 'SEO audit and content plan for a SaaS blog', 'Audit 120 existing posts, identify cannibalisation and decayed pages, and produce a prioritised 6-month content plan with keyword targets.', 'Marketing', 700, 1800, '2026-12-05'],
    [sarah, 'Build a sales forecast model in Python', 'We need a monthly SKU-level demand forecast from 3 years of sales history, with seasonality, confidence intervals and a clean notebook plus summary dashboard.', 'Data & AI', 1500, 3500, '2026-12-28'],
    [alice, 'Fine-tune a classifier for support tickets', 'Classify inbound support tickets into 12 categories. We have 40k labelled tickets. Need an evaluation harness and a small explainable model.', 'Data & AI', 3000, 7000, '2027-01-20'],
    [alice, 'Postgres query tuning for a slow dashboard', 'Our reporting dashboard takes 40s to load. Need index analysis, query rewrites and possibly materialised views. Read-only copy of prod available.', 'Data & AI', 600, 1500, '2026-11-24'],
    [sarah, 'Edit a 3-minute brand film', 'We shot a 3-minute brand film. Need editing, colour correction, sound cleanup and a 30-second cutdown for social. Footage is ~4 hours of 4K.', 'Video & Audio', 700, 1600, '2026-12-02'],
    [alice, 'Record voiceover for product explainer', 'A 90-second animated product explainer needs a warm, confident voiceover. Script is final. Need WAV + MP3 with clean processing.', 'Video & Audio', 200, 500, '2026-11-19'],
    [sarah, 'Podcast editing for 8 episodes', 'Clean up and edit 8 recorded episodes (45–60 min): remove filler, level audio, add music stings and chapter markers. Deliver as MP3 with show notes.', 'Video & Audio', 800, 1800, '2026-12-15'],
    [alice, 'Automate weekly reporting with n8n', 'Pull numbers from Stripe and HubSpot weekly, build a summary sheet and post it to Slack. Prefer a no-code/low-code workflow we can maintain.', 'Other', 400, 900, '2026-11-27'],
    [sarah, 'Virtual assistant for order operations', 'Part-time help triaging customer emails, updating order statuses in Shopify and coordinating with our roastery. 10 hours/week, ongoing.', 'Other', 300, 600, '2026-12-08'],
  ];
  moreJobs.forEach(([client, title, description, category, budget_min, budget_max, deadline]) =>
    insJob.run(client, title, description, category, budget_min, budget_max, deadline)
  );

  const insBid = db.prepare(
    'INSERT INTO bids (job_id, freelancer_id, amount, days, proposal) VALUES (?, ?, ?, ?, ?)'
  );
  insBid.run(j1, joe, 3200, 21, 'I have built 5+ React dashboards with Recharts and role-based access. Timeline includes QA and handover docs.');
  insBid.run(j1, maya, 2800, 18, 'TypeScript + Vite is my daily stack. I can reuse your Figma tokens to ship a pixel-perfect dashboard in under 3 weeks.');
  insBid.run(j3, joe, 750, 10, 'Finance writer with published clips on budgeting apps. Includes keyword research and 2 revision rounds.');
  insBid.run(j4, maya, 900, 7, 'Fixing Android 14 crashes and setting up shorebird/Play Console release. 7 days including store review.');

  // Portfolio links for freelancers
  db.prepare('UPDATE users SET portfolio = ? WHERE id = ?').run(
    'GitHub: https://github.com/joerivera, Portfolio: https://joerivera.dev',
    joe
  );
  db.prepare('UPDATE users SET portfolio = ? WHERE id = ?').run(
    'Dribbble: https://dribbble.com/mayapatel, Portfolio: https://mayapatel.design',
    maya
  );

  // A completed (awarded) job + two reviews so ratings are visible in the demo
  const j6 = insJob.run(
    sarah,
    'Build a landing page for our coffee subscription',
    'One-page marketing site for our new coffee subscription box. Needs a hero, product grid, testimonials and an email signup form. Copy is ready; we need design + build.',
    'Web Development',
    600,
    1200,
    '2026-09-30'
  ).lastInsertRowid;
  const acceptedBid = insBid.run(
    j6,
    joe,
    950,
    9,
    'I will design and build a fast, responsive landing page (React + Tailwind) with the email form wired to your provider. Includes 2 revision rounds.'
  ).lastInsertRowid;
  db.prepare("UPDATE bids SET status = 'accepted' WHERE id = ?").run(acceptedBid);
  db.prepare("UPDATE jobs SET status = 'awarded' WHERE id = ?").run(j6);
  db.prepare(
    `INSERT INTO reviews (job_id, bid_id, reviewer_id, reviewee_id, rating, comment)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    j6,
    acceptedBid,
    sarah,
    joe,
    5,
    'Joe delivered ahead of schedule and the landing page looks fantastic. Clear communication every day — would hire again without hesitation.'
  );
  const mayaBid = insBid.run(
    j6,
    maya,
    1150,
    14,
    'I can hand off a polished Figma file plus a built page. Happy to work alongside whoever ships it.'
  ).lastInsertRowid;
  db.prepare("UPDATE bids SET status = 'rejected' WHERE id = ?").run(mayaBid);
  db.prepare(
    `INSERT INTO reviews (job_id, bid_id, reviewer_id, reviewee_id, rating, comment)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    j6,
    mayaBid,
    joe,
    sarah,
    5,
    'Sarah gave a crystal-clear brief, quick feedback and paid promptly. A perfect client to work with.'
  );

  // A couple of earlier completed jobs so the profile stats (earnings, jobs
  // done, win rate) have something real to show on a fresh database.
  const history = [
    [sarah, 'Shopify theme tweaks for the subscription page', 'Small set of Liquid template changes to the subscription flow plus a mobile QA pass.', 'Web Development', 700, 1400, '2026-06-18', joe, 1180, 12, 5,
      'Fast, careful work and he flagged two bugs we did not know about.'],
    [alice, 'Internal analytics dashboard (phase 1)', 'First slice of an internal KPI dashboard: charts, date filters and CSV export.', 'Data & AI', 2500, 4000, '2026-07-30', joe, 3200, 24, 4,
      'Solid delivery. Timeline slipped by two days but he communicated early and made it right.'],
    [alice, 'Marketing site refresh — brand kit to build', 'Apply new brand guidelines across the marketing site. Figma file is production ready.', 'Design', 900, 1600, '2026-08-21', maya, 1350, 16, 5,
      'Maya is a brilliant designer and extremely organised. The handoff was flawless.'],
  ];
  for (const [client, title, description, category, bmin, bmax, deadline, who, amount, days, rating, comment] of history) {
    const jobId = insJob.run(client, title, description, category, bmin, bmax, deadline).lastInsertRowid;
    const bidId = insBid.run(jobId, who, amount, days, 'Delivered end to end with documentation and a handover call.').lastInsertRowid;
    db.prepare("UPDATE bids SET status = 'accepted' WHERE id = ?").run(bidId);
    db.prepare("UPDATE jobs SET status = 'awarded' WHERE id = ?").run(jobId);
    db.prepare(
      `INSERT INTO reviews (job_id, bid_id, reviewer_id, reviewee_id, rating, comment)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(jobId, bidId, client, who, rating, comment);
  }

  // Verified badges: identity-checked accounts get the trust mark. This is an
  // admin action in the real product, not something users can set themselves.
  db.prepare(
    "UPDATE users SET is_verified = 1 WHERE email IN ('joe@demo.com', 'sarah@demo.com')"
  ).run();
}
seed();
