/* Receives a listing update from update.html.
 *
 * Nothing here changes the site. Every submission is stored for review and
 * applied by hand afterwards, which is what lets the token be a modest gate
 * rather than a real authentication system: the worst a forged token could
 * achieve is putting a suggestion in a queue Theo reads.
 *
 * Two things are deliberately not trusted from the client:
 *   - which fields may change  (allow-list, everything else is dropped)
 *   - what the old value was   (re-read from businesses.json server-side, so
 *                               the review screen can't be shown a fake before)
 */
const crypto = require('crypto');
const store = require('./_lib/store');

const EDITABLE = {
  name: 120, website: 300, instagram: 200,
  address: 300, town: 120, description: 600,
};
const MAX_BODY = 24 * 1024;

let catalogue = null;      // cached for the life of the warm function
let catalogueAt = 0;

async function businesses(req) {
  if (catalogue && Date.now() - catalogueAt < 5 * 60 * 1000) return catalogue;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  // Vercel always sets x-forwarded-proto. The localhost fallback is what lets
  // this endpoint be exercised against a local harness rather than only in
  // production, which is the difference between testing it and hoping.
  const proto = req.headers['x-forwarded-proto']
    || (/^(localhost|127\.0\.0\.1)/.test(host || '') ? 'http' : 'https');
  const res = await fetch(proto + '://' + host + '/data/businesses.json');
  if (!res.ok) throw new Error('Could not read the listing data');
  catalogue = await res.json();
  catalogueAt = Date.now();
  return catalogue;
}

function tokenFor(id, secret) {
  return crypto.createHmac('sha256', secret).update(id).digest('hex').slice(0, 10);
}

function tokenOk(id, given, secret) {
  const want = Buffer.from(tokenFor(id, secret));
  const got = Buffer.from(String(given || ''));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/* Great Britain and Ireland, generously. Anything outside is a bug or a joke,
   and either way is not worth putting in front of a human. */
const UK = { minLat: 49.5, maxLat: 61.2, minLng: -8.8, maxLng: 2.1 };
const round5 = (n) => Math.round(n * 1e5) / 1e5;

function pinFrom(raw, record) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.lat), lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < UK.minLat || lat > UK.maxLat || lng < UK.minLng || lng > UK.maxLng) return null;
  const to = { lat: round5(lat), lng: round5(lng) };
  const from = { lat: round5(Number(record.lat)), lng: round5(Number(record.lng)) };
  // Same spot to five decimals (about a metre) is not a change.
  if (to.lat === from.lat && to.lng === from.lng) return null;
  return { from, to, metres: metresBetween(from, to) };
}

function metresBetween(a, b) {
  const R = 6371000, t = Math.PI / 180;
  const dLat = (b.lat - a.lat) * t, dLng = (b.lng - a.lng) * t;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

const clean = (v, max) =>
  String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.UPDATE_LINK_SECRET;
  if (!secret) {
    console.error('UPDATE_LINK_SECRET is not set on the server');
    return res.status(500).json({ error: 'The form is not configured yet' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY) return res.status(413).json({ error: 'That was too long to send' });
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Could not read that' }); }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Could not read that' });
  }
  if (body._hp) {                                   // honeypot, quietly accepted
    return res.status(200).json({ ok: true });
  }

  const id = clean(body.id, 80);
  if (!id || !tokenOk(id, body.token, secret)) {
    return res.status(403).json({ error: 'That link is not valid — email hello@grownandmade.uk and we will send a fresh one' });
  }

  let record;
  try {
    record = (await businesses(req)).find((b) => b.id === id);
  } catch (e) {
    console.error('catalogue read failed:', e.message);
    return res.status(503).json({ error: 'We could not reach our records just now' });
  }
  if (!record) return res.status(404).json({ error: 'We could not find that listing' });

  // Only allow-listed fields, and only where the value actually differs.
  const changes = {};
  const submitted = body.changes && typeof body.changes === 'object' ? body.changes : {};
  for (const field of Object.keys(EDITABLE)) {
    if (!Object.prototype.hasOwnProperty.call(submitted, field)) continue;
    const to = clean(submitted[field], EDITABLE[field]);
    const from = clean(record[field], EDITABLE[field]);
    if (to !== from) changes[field] = { from: record[field] || '', to };
  }

  const appeal = body.appeal && typeof body.appeal === 'object' ? {
    question: clean(body.appeal.question, 300),
    answer: clean(body.appeal.answer, 1000),
    link: clean(body.appeal.link, 300),
  } : null;
  if (appeal && !appeal.answer && !appeal.link) {
    return res.status(400).json({ error: 'A tier review needs something we can check' });
  }

  const notes = clean(body.notes, 2000);
  const removal = body.removal === true;
  /* The portal will not submit without this ticked. It is what makes an empty
     submission worth storing: for most of the 474 the useful answer is "yes,
     all correct", and that has to be recordable, not rejected as nothing. */
  const confirmed = body.confirmed === true;
  /* The dragged pin. Deliberately NOT in EDITABLE — that allow-list guards
     the text fields, and coordinates need their own check: a number, inside
     the UK, and actually different from where the record already sits. Like
     everything else here it is a suggestion in a queue, not a write. */
  const pin = pinFrom(body.pin, record);

  if (!Object.keys(changes).length && !appeal && !notes && !removal && !confirmed && !pin) {
    return res.status(400).json({ error: 'Nothing was changed' });
  }

  const now = new Date();
  const submission = {
    submission_id: now.toISOString().replace(/[:.]/g, '-') + '-' + id,
    business_id: id,
    business_name: record.name,
    tier: record.tier,
    category: record.category,
    submitted_at: now.toISOString(),
    from: {
      name: clean(body.from_name, 120),
      email: clean(body.from_email, 200),
    },
    changes,
    appeal,
    removal,
    notes,
    confirmed,
    pin,
    /* Split on arrival so the two never have to be told apart later: a
       correction is a batch job, a tier appeal is a judgement call. */
    kind: appeal ? 'tier-appeal' : removal ? 'removal'
      : (Object.keys(changes).length || notes || pin) ? 'correction' : 'confirmation',
    status: 'new',
    reviewed_at: null,
    review_note: '',
  };

  try {
    await store.put(store.keyFor(submission), submission);
  } catch (e) {
    console.error('store failed:', e.message);
    return res.status(503).json({ error: 'We could not save that just now' });
  }

  return res.status(200).json({ ok: true, kind: submission.kind });
};

module.exports.tokenFor = tokenFor;
