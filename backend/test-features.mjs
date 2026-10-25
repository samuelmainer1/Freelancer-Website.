// End-to-end API test for messages, directory, client reviews, job edit, pagination.
//
// Safe to run repeatedly against the same app.db: each section creates the data
// it needs and asserts on scoped results rather than global counts.
const BASE = 'http://localhost:4000/api';

// Upper bound on a single rate-limit wait. The general limiter resets in a
// second or two; the login limiter can be minutes away, and in that case it's
// clearer to fail fast with an explanation than to hang.
const MAX_RATE_LIMIT_WAIT_MS = 65_000;

// Wrapper for every API call. Retries once the rate-limit window has rolled
// over, so a tripped limiter shows up as a short wait rather than a confusing
// assertion failure ("Too many requests"). The real limiter is never weakened.
async function call(method, path, token, body, attempt = 0) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }

  // Rate-limited: wait out the window and retry instead of recording a bogus
  // failure. The two limiters differ a lot in duration:
  //   - general API  : 300/min  -> reset is ~1s away
  //   - login/register: 30/15min -> reset can be hundreds of seconds away
  // `Retry-After` (seconds) is the most reliable signal; fall back to the
  // draft-7 `RateLimit` header's `reset` when it's absent.
  if (res.status === 429 && attempt < 3) {
    const retryAfter = Number(res.headers.get('retry-after'));
    const reset = Number((res.headers.get('ratelimit') || '').match(/reset=(\d+)/)?.[1]);
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Number.isFinite(reset) && reset > 0
          ? Math.max(reset * 1000, 1000)
          : 30000;

    if (waitMs > MAX_RATE_LIMIT_WAIT_MS) {
      console.error(
        `\n  ABORT  rate limited for another ${Math.ceil(waitMs / 1000)}s ` +
          `(too long to wait). The login limiter allows 30 attempts / 15 min; ` +
          `each run logs in 4 users. Wait for it to reset, then re-run.`
      );
      process.exit(1);
    }

    console.log(`  WAIT  rate limited on ${method} ${path}, retrying in ${Math.ceil(waitMs / 1000)}s`);
    await new Promise((r) => setTimeout(r, waitMs + 250));
    return call(method, path, token, body, attempt + 1);
  }

  return { status: res.status, data };
}

const login = async (email) => {
  const res = await call('POST', '/auth/login', null, { email, password: 'password123' });
  if (!res.data?.token) {
    console.error(
      `\n  ABORT  could not log in as ${email} (status ${res.status}): ` +
        `${res.data?.error ?? 'no token returned'}\n` +
        `         Is the backend running on :4000, and are the demo users seeded?`
    );
    process.exit(1);
  }
  return res.data.token;
};

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${extra ? ` -> ${JSON.stringify(extra).slice(0, 400)}` : ''}`);
  }
}

const run = async () => {
  const sarah = await login('sarah@demo.com');
  const joe = await login('joe@demo.com');
  const maya = await login('maya@demo.com');
  const alice = await login('alice@demo.com');

  const meS = await call('GET', '/auth/me', sarah);
  const meJ = await call('GET', '/auth/me', joe);
  const meA = await call('GET', '/auth/me', alice);
  const sId = meS.data.user.id;
  const jId = meJ.data.user.id;
  const aId = meA.data.user.id;
  console.log(`users: sarah=${sId} joe=${jId} alice=${aId}`);

  console.log('\n== 1. Job pagination ==');
  const p1 = await call('GET', '/jobs?limit=2&page=1');
  check('page 1 returns 2 jobs', p1.data.jobs?.length === 2, p1.data);
  check('pagination meta present', typeof p1.data.total === 'number' && p1.data.total_pages >= 1, p1.data);
  const p2 = await call('GET', '/jobs?limit=2&page=2');
  check(
    'page 2 differs from page 1',
    p2.data.jobs?.length > 0 && p2.data.jobs[0].id !== p1.data.jobs[0].id,
    { p1: p1.data.jobs?.map((j) => j.id), p2: p2.data.jobs?.map((j) => j.id) }
  );

  console.log('\n== 2. Deadline validation ==');
  const past = await call('POST', '/jobs', sarah, {
    title: 'Past deadline job',
    description: 'should be rejected',
    deadline: '2000-01-01',
  });
  check('past deadline rejected (400)', past.status === 400, past.data);
  const bad = await call('POST', '/jobs', sarah, {
    title: 'Bad format',
    description: 'x',
    deadline: 'not-a-date',
  });
  check('malformed deadline rejected (400)', bad.status === 400, bad.data);
  const future = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const newJob = await call('POST', '/jobs', sarah, {
    title: 'Temp job for edit test',
    description: 'edit me',
    category: 'Writing',
    budget_min: 100,
    budget_max: 200,
    deadline: future,
  });
  check('valid future deadline accepted (201)', newJob.status === 201, newJob.data);
  const jobId = newJob.data.job?.id;

  console.log('\n== 3. Job editing ==');
  const edit = await call('PUT', `/jobs/${jobId}`, sarah, { title: 'Edited title', budget_max: 250 });
  check('owner can edit open job (200)', edit.status === 200 && edit.data.job?.title === 'Edited title', edit.data);
  check('budget_max updated', edit.data.job?.budget_max === 250, edit.data.job);
  const editByOther = await call('PUT', `/jobs/${jobId}`, alice, { title: 'hijack' });
  check('non-owner cannot edit (403)', editByOther.status === 403, editByOther.data);
  const badEdit = await call('PUT', `/jobs/${jobId}`, sarah, { budget_min: 500, budget_max: 100 });
  check('min > max rejected on edit (400)', badEdit.status === 400, badEdit.data);

  console.log('\n== 4. Freelancer directory ==');
  const dir = await call('GET', '/users');
  check('directory returns freelancers', dir.status === 200 && dir.data.freelancers?.length >= 2, dir.data);
  check(
    'only freelancers listed',
    (dir.data.freelancers || []).every((f) => f.role === 'freelancer'),
    dir.data.freelancers?.map((f) => f.role)
  );
  check(
    'rating fields present',
    (dir.data.freelancers || []).every((f) => 'average_rating' in f && 'review_count' in f),
    dir.data.freelancers?.[0]
  );
  const bySkill = await call('GET', '/users?skill=React');
  check('skill filter works', bySkill.data.freelancers?.length >= 1, bySkill.data);
  const byRate = await call('GET', '/users?max_rate=60');
  check(
    'max_rate filter works',
    (byRate.data.freelancers || []).every((f) => f.hourly_rate == null || f.hourly_rate <= 60),
    byRate.data.freelancers?.map((f) => f.hourly_rate)
  );
  const bySearch = await call('GET', '/users?search=Joe');
  check(
    'name search works',
    (bySearch.data.freelancers || []).some((f) => /joe/i.test(f.name)),
    bySearch.data.freelancers?.map((f) => f.name)
  );
  const byRating = await call('GET', '/users?min_rating=4');
  check(
    'min_rating filter works',
    (byRating.data.freelancers || []).every((f) => (f.average_rating || 0) >= 4),
    byRating.data.freelancers?.map((f) => f.average_rating)
  );
  const sorted = await call('GET', '/users?sort=rating');
  check('sort=rating returns 200', sorted.status === 200, sorted.status);
  const clientsDir = await call('GET', '/users?role=client');
  check(
    'role=client supported',
    (clientsDir.data.freelancers || []).every((c) => c.role === 'client'),
    clientsDir.data
  );

  console.log('\n== 5. Messaging ==');
  const bidRes = await call('POST', `/jobs/${jobId}/bids`, joe, {
    amount: 150,
    days: 3,
    proposal: 'I can do this well.',
  });
  check('joe bids on job (200/201)', [200, 201].includes(bidRes.status), bidRes.data);
  const bidId = bidRes.data.bid?.id;

  const notBidder = await call('POST', `/jobs/${jobId}/messages/${aId}`, sarah, { body: 'hi' });
  check('cannot message non-bidder (403)', notBidder.status === 403, notBidder.data);

  const send1 = await call('POST', `/jobs/${jobId}/messages/${jId}`, sarah, { body: 'Hi Joe, quick question?' });
  check('client sends message to bidder (201)', send1.status === 201, send1.data);
  const send2 = await call('POST', `/jobs/${jobId}/messages/${sId}`, joe, { body: 'Sure, go ahead!' });
  check('freelancer replies (201)', send2.status === 201, send2.data);
  check('reply is addressed to the client', send2.data.message?.receiver_id === sId, send2.data.message);

  const empty = await call('POST', `/jobs/${jobId}/messages/${sId}`, joe, { body: '   ' });
  check('empty message rejected (400)', empty.status === 400, empty.data);

  const unread = await call('GET', '/unread-count', joe);
  check('freelancer has 1 unread before reading', unread.data.unread === 1, unread.data);

  const thread = await call('GET', `/jobs/${jobId}/messages/${jId}`, sarah);
  check('thread has 2 messages', thread.data.messages?.length === 2, thread.data.messages);
  check('thread returns counterpart', thread.data.other?.id === jId, thread.data.other);

  const unreadAfter = await call('GET', '/unread-count', joe);
  check('client reading did not clear joe unread', unreadAfter.data.unread === 1, unreadAfter.data);

  const joeThread = await call('GET', `/jobs/${jobId}/messages/${sId}`, joe);
  check('freelancer reads thread (2 msgs)', joeThread.data.messages?.length === 2, joeThread.data.messages);
  const unreadJoe = await call('GET', '/unread-count', joe);
  check('reading clears unread', unreadJoe.data.unread === 0, unreadJoe.data);

  const inbox = await call('GET', '/inbox', sarah);
  // Scope to the job this section messaged: the seed already contains threads
  // between Sarah and Joe (e.g. the awarded landing-page job), so asserting a
  // total count of 1 was only true on a pristine database.
  const inboxThread = (inbox.data.threads || []).find((t) => Number(t.job_id) === Number(jobId));
  check('client inbox has a thread for this job', !!inboxThread, {
    jobId,
    threads: (inbox.data.threads || []).map((t) => t.job_id),
  });
  check('inbox thread names the freelancer', Number(inboxThread?.user_id) === Number(jId), inboxThread);
  check('inbox shows last message', inboxThread?.last_message === 'Sure, go ahead!', inboxThread);

  const outsider = await call('GET', `/jobs/${jobId}/messages/${sId}`, alice);
  check('outsider blocked from thread (403)', outsider.status === 403, outsider.data);

  console.log('\n== 6. Client reviews (bidirectional) ==');
  const acceptBid = await call('POST', `/bids/${bidId}/accept`, sarah);
  check('sarah accepts joe bid (200)', acceptBid.status === 200, acceptBid.data);

  const clientReview = await call('POST', `/bids/${bidId}/review`, sarah, {
    rating: 5,
    comment: 'Great work!',
  });
  check('client reviews freelancer (201)', clientReview.status === 201, clientReview.data);
  const fwdReview = await call('POST', `/bids/${bidId}/review`, joe, {
    rating: 4,
    comment: 'Clear brief, fast payment.',
  });
  check('freelancer reviews client on SAME bid (201)', fwdReview.status === 201, fwdReview.data);
  check('reciprocal review points at client', fwdReview.data.review?.reviewee_id === sId, {
    got: fwdReview.data.review?.reviewee_id,
    expected: sId,
  });

  const update = await call('POST', `/bids/${bidId}/review`, sarah, { rating: 4, comment: 'Updated.' });
  check('client can update own review (200)', update.status === 200 && update.data.review?.rating === 4, update.data);
  check('update did not create a duplicate', update.data.review?.id === clientReview.data.review?.id, update.data);

  const mayaReview = await call('POST', `/bids/${bidId}/review`, maya, { rating: 5, comment: 'sneaky' });
  check('unrelated freelancer blocked (403)', mayaReview.status === 403, mayaReview.data);
  const badRating = await call('POST', `/bids/${bidId}/review`, sarah, { rating: 9 });
  check('rating > 5 rejected (400)', badRating.status === 400, badRating.data);

  console.log('\n== 7. Client rating surfaces on job cards ==');
  const profileSarah = await call('GET', `/users/${sId}`);
  check('client profile shows review count', profileSarah.data.count >= 1, profileSarah.data.count);
  const feed = await call('GET', '/jobs?limit=50');
  const withRating = (feed.data.jobs || []).find((j) => j.client_id === sId && j.client_review_count > 0);
  check(
    'a job card exposes client_rating',
    !!withRating && withRating.client_rating != null,
    withRating && { id: withRating.id, rating: withRating.client_rating, n: withRating.client_review_count }
  );

  console.log('\n== 8. Job detail (precedence fix) ==');
  const detail = await call('GET', `/jobs/${jobId}`);
  check('job detail by id works', detail.status === 200 && detail.data.job?.id === jobId, detail.data);
  const missing = await call('GET', '/jobs/99999');
  check('missing job returns 404', missing.status === 404, missing.data);

  console.log('\n== 9. Freelancer reviews the client (bidirectional) ==');

  // Section 6 already has Joe review the bid it awards, so by the time we get
  // here there is no unreviewed accepted bid left in the seed. Award a fresh
  // one so this section proves a *create* (201) rather than an update (200).
  const sIdNum = Number(sId);
  const feed9 = await call('GET', '/jobs?limit=50');
  const openSarahJob = (feed9.data.jobs || []).find(
    (j) => Number(j.client_id) === sIdNum && j.status === 'open' && Number(j.id) !== Number(jobId)
  );
  check('an open job by the client is available to award', !!openSarahJob, {
    jobId,
    sId,
    open: (feed9.data.jobs || [])
      .filter((j) => Number(j.client_id) === sIdNum)
      .map((j) => ({ id: j.id, status: j.status })),
  });
  const ownBid = await call('POST', `/jobs/${openSarahJob?.id}/bids`, joe, {
    amount: 300,
    days: 4,
    proposal: 'Bid created by section 9 to test reviewing a client.',
  });
  check('joe creates a fresh bid for the review test', ownBid.status === 201, ownBid.data);
  const ownBidId = ownBid.data?.bid?.id;
  const ownAccept = await call('POST', `/bids/${ownBidId}/accept`, sarah);
  check('client accepts the fresh bid', ownAccept.status === 200, ownAccept.data);

  // What the UI actually consumes: every accepted bid must expose the client
  // id (for the avatar/name link) and explicit null review fields when
  // unreviewed, otherwise My Bids cannot render the form.
  const mine = await call('GET', '/bids/mine', joe);
  const joeBids = mine.data?.bids || [];
  const accepted = joeBids.find((b) => b.status === 'accepted' && !b.client_review_id);

  check('/bids/mine exposes client_id', joeBids.some((b) => b.client_id != null), joeBids[0]);
  check('/bids/mine exposes client_review_id', joeBids.every((b) => 'client_review_id' in b));
  check('an unreviewed accepted bid is available to test with', !!accepted, {
    accepted: joeBids.filter((b) => b.status === 'accepted').map((b) => ({
      id: b.id,
      reviewed: !!b.client_review_id,
    })),
  });

  if (accepted) {
    const before = await call('GET', `/users/${accepted.client_id}`);
    const beforeCount = before.data?.count ?? 0;

    const posted = await call('POST', `/bids/${accepted.id}/review`, joe, {
      rating: 4,
      comment: 'Clear brief and quick to respond.',
    });
    check('freelancer creates a review on the client (201)', posted.status === 201, posted.data);
    check('review is attributed to the client', posted.data?.review?.reviewee_id === accepted.client_id, posted.data?.review);

    const after = await call('GET', `/users/${accepted.client_id}`);
    check(
      'client review count increased',
      (after.data?.count ?? 0) === beforeCount + 1,
      { before: beforeCount, after: after.data?.count }
    );

    const reread = await call('GET', '/bids/mine', joe);
    const bidAfter = (reread.data?.bids || []).find((b) => b.id === accepted.id);
    check('bid now reports client_review_id', bidAfter?.client_review_id != null, bidAfter);
    check(
      'bid reports the rating the form will prefill',
      bidAfter?.client_review_rating === 4,
      bidAfter?.client_review_rating
    );
    check(
      '/bids/mine still returns one row per bid',
      (reread.data?.bids || []).filter((b) => b.id === accepted.id).length === 1
    );

    const updated = await call('POST', `/bids/${accepted.id}/review`, joe, {
      rating: 5,
      comment: 'Even better than expected.',
    });
    check('review can be updated, not duplicated', updated.status === 200, updated.data);
    check(
      'update reuses the same review row',
      updated.data?.review?.id === posted.data?.review?.id,
      { first: posted.data?.review?.id, second: updated.data?.review?.id }
    );
    const afterUpdate = await call('GET', `/users/${accepted.client_id}`);
    check(
      'updating a review does not change the count',
      (afterUpdate.data?.count ?? 0) === beforeCount + 1,
      { after: afterUpdate.data?.count }
    );

    // A third party on the same bid must not be able to review.
    const outsider = await call('POST', `/bids/${accepted.id}/review`, maya, {
      rating: 1,
      comment: 'Not involved.',
    });
    check('uninvolved freelancer blocked from reviewing', outsider.status === 403, outsider.data);
  }

  console.log('\n== 10. Directory privacy toggle (is_public) ==');
  const meBefore = await call('GET', `/users/${(await call('GET', '/auth/me', joe)).data.user.id}`);
  check('profile exposes is_public', meBefore.data?.profile?.is_public != null, meBefore.data?.profile);

  await call('PUT', '/users/me', joe, { is_public: false });
  const hidden = await call('GET', '/users?limit=50');
  check(
    'hidden freelancer drops out of the directory',
    !(hidden.data?.freelancers || []).some((f) => f.name === 'Joe Rivera'),
    (hidden.data?.freelancers || []).map((f) => f.name)
  );
  const stillPublicProfile = await call('GET', `/users/${meBefore.data.profile.id}`);
  check('hidden freelancer profile still reachable', stillPublicProfile.status === 200);

  await call('PUT', '/users/me', joe, { is_public: true });
  const shown = await call('GET', '/users?limit=50');
  check(
    'freelancer reappears after opting back in',
    (shown.data?.freelancers || []).some((f) => f.name === 'Joe Rivera')
  );

  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  process.exit(fail ? 1 : 0);
};

run().catch((e) => {
  console.error('TEST CRASH', e);
  process.exit(1);
});


