/* Website and Instagram values, cleaned before they are stored.
 *
 * Both forms are public, and whatever lands in the queue is later shown on
 * /admin and, once approved, copied into businesses.json and printed as an
 * href on the map. So a value is only accepted if it is plainly an http(s)
 * address, and it is stored in the form the URL parser gives back -- which
 * percent-encodes quotes and spaces, so nothing stored here can break out of
 * an attribute. `javascript:` and friends are refused outright.
 *
 * Each function returns '' for an empty value, the cleaned string for a good
 * one, and null for one that should be refused.
 */

function normaliseWebsite(value) {
  const v = String(value == null ? '' : value).trim();
  if (!v) return '';
  // A bare "example.co.uk" is how most people type it. Anything that already
  // names a scheme keeps it, so "javascript:..." is parsed as itself and fails.
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : 'https://' + v;
  let u;
  try { u = new URL(withScheme); } catch (e) { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname)) return null;
  if (u.username || u.password) return null;
  return u.href;
}

// Instagram handles: letters, digits, full stops and underscores, max 30.
const HANDLE = /^[A-Za-z0-9._]{1,30}$/;
// Instagram's own paths, which look like handles but are posts, reels etc.
const NOT_A_HANDLE = new Set(['p', 'reel', 'reels', 'stories', 'explore', 'tv', 'accounts']);
const igUrl = (handle) => 'https://www.instagram.com/' + handle + '/';

function normaliseInstagram(value) {
  const v = String(value == null ? '' : value).trim();
  if (!v) return '';
  const bare = v.replace(/^@/, '');
  if (HANDLE.test(bare)) return igUrl(bare);
  const site = normaliseWebsite(v);
  if (!site) return null;
  const u = new URL(site);
  if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null;
  const handle = u.pathname.split('/').filter(Boolean)[0] || '';
  return HANDLE.test(handle) && !NOT_A_HANDLE.has(handle.toLowerCase()) ? igUrl(handle) : null;
}

module.exports = { normaliseWebsite, normaliseInstagram };
