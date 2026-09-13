/* The review queues behind admin.html.
 *
 * Two collections, one password: listing updates from the update portal, and
 * new-business suggestions from submit.html. They share this endpoint and the
 * gate but nothing else -- different shapes, different status vocabularies.
 *
 * One shared password in an environment variable. That is the right weight for
 * a queue read by one person: it keeps the page off the open web without
 * introducing accounts, sessions or a user table to look after. It is checked
 * with a timing-safe compare and never sent back.
 *
 * Approving here does NOT change the site. It marks the submission approved;
 * scripts/apply-submissions.py writes approved changes into businesses.json,
 * which then goes through git like every other change to the data. Nothing
 * edits the live dataset from a web form.
 */
const crypto = require('crypto');
const store = require('./_lib/store');

function passwordOk(given) {
  const want = Buffer.from(process.env.ADMIN_PASSWORD || '');
  const got = Buffer.from(String(given || ''));
  if (!want.length) return false;
  // Hash both sides so a length difference doesn't leak through the compare.
  const h = (b) => crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(h(want), h(got));
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body) return res.status(400).json({ error: 'Could not read that' });

  if (!process.env.ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD is not set on the server');
    return res.status(500).json({ error: 'The review page is not configured yet' });
  }
  if (!passwordOk(body.password)) {
    // Deliberately slow, to make guessing tedious.
    await new Promise((r) => setTimeout(r, 600));
    return res.status(401).json({ error: 'Wrong password' });
  }

  try {
    if (body.action === 'list') {
      const all = await store.listAll(store.SUBMISSIONS);
      all.sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));
      return res.status(200).json({ ok: true, submissions: all });
    }

    if (body.action === 'set-status') {
      const allowed = ['new', 'approved', 'rejected', 'applied'];
      if (!allowed.includes(body.status)) {
        return res.status(400).json({ error: 'Unknown status' });
      }
      const key = store.keyFor(store.SUBMISSIONS, body.submission_id);
      const sub = await store.get(key);
      if (!sub) return res.status(404).json({ error: 'That submission is gone' });
      sub.status = body.status;
      sub.reviewed_at = new Date().toISOString();
      sub.review_note = String(body.review_note || '').slice(0, 1000);
      await store.put(key, sub);
      return res.status(200).json({ ok: true, submission: sub });
    }

    if (body.action === 'list-suggestions') {
      const all = await store.listAll(store.SUGGESTIONS);
      all.sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));
      return res.status(200).json({ ok: true, suggestions: all });
    }

    if (body.action === 'set-suggestion-status') {
      /* 'added' is stamped by scripts/apply-suggestions.py rather than by a
         button, for the same reason 'applied' is on the submissions side: it
         should mean the record is really in businesses.json, not that someone
         meant to do it. */
      const allowed = ['pending', 'dismissed', 'approved', 'added'];
      if (!allowed.includes(body.status)) {
        return res.status(400).json({ error: 'Unknown status' });
      }
      /* A fixed list, not free text. A reason you can filter and count is
         worth more than a note nobody rereads -- and it makes the same
         business arriving twice a second of work. */
      const reasons = ['', 'not-uk-made', 'already-listed', 'retailer-not-maker',
        'cannot-verify', 'out-of-scope', 'other'];
      const reason = String(body.dismiss_reason || '');
      if (!reasons.includes(reason)) {
        return res.status(400).json({ error: 'Unknown dismissal reason' });
      }
      const key = store.keyFor(store.SUGGESTIONS, body.suggestion_id);
      const sug = await store.get(key);
      if (!sug) return res.status(404).json({ error: 'That suggestion is gone' });
      sug.status = body.status;
      sug.dismiss_reason = body.status === 'dismissed' ? reason : '';
      sug.reviewed_at = new Date().toISOString();
      sug.review_note = String(body.review_note || '').slice(0, 1000);
      await store.put(key, sug);
      return res.status(200).json({ ok: true, suggestion: sug });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('admin action failed:', e.message);
    return res.status(503).json({ error: 'Could not reach the store' });
  }
};
