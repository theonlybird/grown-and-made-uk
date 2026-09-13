/* Receives a new-business suggestion from submit.html.
 *
 * Replaces the Formspree route, which delivered these by email. An email is a
 * bad home for work that arrives in tens per week and has to be judged, chased
 * and remembered: there is no state on a message. Here each suggestion is a
 * stored record with a status, reviewed on the admin page beside listing
 * updates.
 *
 * Like api/update-listing.js, nothing here changes the site. A suggestion is a
 * row in a queue; adding a business is still a human decision followed by a
 * git diff. That is why this endpoint needs no token: the worst a flood of
 * forged suggestions achieves is a queue that needs clearing, and the honeypot
 * plus the per-field caps keep that cheap.
 */
const store = require('./_lib/store');

const MAX_BODY = 24 * 1024;

/* field -> max length. Anything not named here is dropped, so a forged payload
   cannot smuggle extra keys into the stored record. */
const FIELDS = {
  business_name: 160,
  website: 300,
  instagram: 200,
  category: 60,
  listing_type: 40,
  address: 300,
  made_in_uk: 1500,
  materials: 1500,
  evidence_links: 800,
  submitter_name: 120,
  email: 200,
  relationship: 60,
};
const REQUIRED = [
  'business_name', 'website', 'category', 'listing_type',
  'address', 'made_in_uk', 'submitter_name', 'email', 'relationship',
];

/* The form's own option lists. Kept server-side so the stored value is always
   one of a known set and the queue can filter on it. */
const CATEGORIES = ['Farm shop', 'Clothing & accessories', 'Pottery & crockery', 'Jewellery', 'Other UK maker'];
const LISTING_TYPES = ['Physical shop', 'Online only', 'Both'];
const RELATIONSHIPS = ['I own or run it', 'I work there', "I'm a customer / fan", 'Other'];

const clean = (v, max) =>
  String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

/* Multi-line fields keep their line breaks -- evidence links one per line is
   how people write them, and flattening that makes the card harder to read. */
const cleanMulti = (v, max) =>
  String(v == null ? '' : v).replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const MULTILINE = new Set(['made_in_uk', 'materials', 'evidence_links']);

/* Deliberately loose. This is a contact address for a human to reply to, not a
   credential -- rejecting an unusual but valid address costs a listing. */
const looksLikeEmail = (s) => /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(s);

function domainOf(url) {
  if (!url) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

let catalogue = null;
let catalogueAt = 0;

/* Same shape as the fetch in update-listing.js. Duplicated rather than shared
   so that adding this endpoint cannot break the live update portal; fold the
   two together next time either is touched for another reason. */
async function businesses(req) {
  if (catalogue && Date.now() - catalogueAt < 5 * 60 * 1000) return catalogue;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto']
    || (/^(localhost|127\.0\.0\.1)/.test(host || '') ? 'http' : 'https');
  const res = await fetch(proto + '://' + host + '/data/businesses.json');
  if (!res.ok) throw new Error('Could not read the listing data');
  catalogue = await res.json();
  catalogueAt = Date.now();
  return catalogue;
}

/* The single most useful thing on a review card at fifty a week: is this one
   already on the map? Matched on registrable domain, so a link to a product
   page still matches the listing's home page. Never blocks a submission --
   the suggester may know something we do not, and a wrong auto-reject is
   worse than a card that says "check this". */
async function duplicateOf(req, website) {
  const domain = domainOf(website);
  if (!domain) return null;
  const hit = (await businesses(req)).find((b) => domainOf(b.website) === domain);
  return hit ? { id: hit.id, name: hit.name, tier: hit.tier } : null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY) return res.status(413).json({ error: 'That was too long to send' });
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Could not read that' }); }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Could not read that' });
  }
  /* Honeypot. _gotcha is the name the form already carries from its Formspree
     days; _hp matches the update portal. Either one filled means a bot, and a
     bot is told everything went fine so it has nothing to tune against. */
  if (body._gotcha || body._hp) {
    return res.status(200).json({ ok: true });
  }

  const fields = {};
  for (const [name, max] of Object.entries(FIELDS)) {
    fields[name] = MULTILINE.has(name) ? cleanMulti(body[name], max) : clean(body[name], max);
  }

  const missing = REQUIRED.filter((f) => !fields[f]);
  if (missing.length) {
    return res.status(400).json({ error: 'Some answers are missing', missing });
  }
  if (!looksLikeEmail(fields.email)) {
    return res.status(400).json({ error: 'That email address does not look right' });
  }
  if (!domainOf(fields.website)) {
    return res.status(400).json({ error: 'That website address does not look right' });
  }
  /* Unknown option values mean a payload that did not come from the form.
     Stored anyway would mean a queue you cannot filter, so reject instead. */
  if (!CATEGORIES.includes(fields.category)) {
    return res.status(400).json({ error: 'Please choose a category from the list' });
  }
  if (!LISTING_TYPES.includes(fields.listing_type)) {
    return res.status(400).json({ error: 'Please say whether it is a shop, online, or both' });
  }
  if (!RELATIONSHIPS.includes(fields.relationship)) {
    return res.status(400).json({ error: 'Please choose your connection from the list' });
  }

  /* Never at the cost of the suggestion: an unreachable catalogue leaves the
     duplicate flag null and the row still lands in the queue. */
  let duplicate = null;
  try {
    duplicate = await duplicateOf(req, fields.website);
  } catch (e) {
    console.error('duplicate check failed:', e.message);
  }

  const now = new Date();
  const suggestion = {
    suggestion_id: now.toISOString().replace(/[:.]/g, '-') + '-'
      + (domainOf(fields.website).replace(/[^a-z0-9]+/g, '-') || 'suggestion'),
    submitted_at: now.toISOString(),
    business: {
      name: fields.business_name,
      website: fields.website,
      instagram: fields.instagram,
      category: fields.category,
      listing_type: fields.listing_type,
      address: fields.address,
      domain: domainOf(fields.website),
    },
    evidence: {
      made_in_uk: fields.made_in_uk,
      materials: fields.materials,
      links: fields.evidence_links,
    },
    from: {
      name: fields.submitter_name,
      email: fields.email,
      relationship: fields.relationship,
    },
    duplicate_of: duplicate,
    /* pending -> dismissed | approved -> added. Four, not three: approving a
       suggestion and actually listing it are days apart, and without the last
       one there is no way to tell which approved rows are already done. */
    status: 'pending',
    dismiss_reason: '',
    reviewed_at: null,
    review_note: '',
  };

  try {
    await store.put(store.keyFor(store.SUGGESTIONS, suggestion.suggestion_id), suggestion);
  } catch (e) {
    console.error('store failed:', e.message);
    return res.status(503).json({ error: 'We could not save that just now' });
  }

  return res.status(200).json({ ok: true });
};
