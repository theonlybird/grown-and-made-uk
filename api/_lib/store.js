/* Where submissions and suggestions live.
 *
 * Vercel Blob in production, a directory on disk when GM_STORE_DIR is set.
 * The local backend is not a convenience: it is what makes the endpoints
 * testable off Vercel, so the validation and token logic can be exercised
 * without a network round trip to a store that costs money per operation.
 *
 * Two collections, addressed by prefix:
 *   submissions/  listing updates from update.html, reviewed on the admin page
 *   suggestions/  new businesses from submit.html, reviewed on the same page
 * They are kept apart rather than sharing a `kind` because they carry
 * different shapes and different status vocabularies, and because listing one
 * should never pay the cost of reading the other.
 *
 * One JSON blob per record. At a few hundred over a campaign, listing and
 * reading them individually is cheap and needs no index to keep consistent.
 * If this ever grows into the thousands, add one.
 */
const fs = require('fs');
const path = require('path');

const SUBMISSIONS = 'submissions/';
const SUGGESTIONS = 'suggestions/';
const localDir = () => process.env.GM_STORE_DIR;

async function blob() {
  // @vercel/blob is ESM; this file is CommonJS, like api/ai-search.js.
  return await import('@vercel/blob');
}

function localName(key) {
  return key.replace(/\//g, '__');
}

function localPath(key) {
  return path.join(localDir(), localName(key));
}

async function put(key, value) {
  const body = JSON.stringify(value, null, 2);
  if (localDir()) {
    fs.mkdirSync(localDir(), { recursive: true });
    fs.writeFileSync(localPath(key), body);
    return;
  }
  const { put: blobPut } = await blob();
  await blobPut(key, body, {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true,
  });
}

async function get(key) {
  if (localDir()) {
    const p = localPath(key);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  }
  const { get: blobGet } = await blob();
  // access is required and throws if omitted -- it is not inferred from the
  // store. useCache:false so a status just written by the admin page reads
  // back immediately rather than after the CDN catches up.
  const res = await blobGet(key, { access: 'private', useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  const text = await new Response(res.stream).text();
  return JSON.parse(text);
}

async function listAll(prefix) {
  if (!prefix) throw new Error('listAll needs a collection prefix');
  if (localDir()) {
    if (!fs.existsSync(localDir())) return [];
    // Same '/' -> '__' transform put() uses, so the filter matches what is
    // actually on disk rather than the logical prefix.
    const want = localName(prefix);
    return fs.readdirSync(localDir())
      .filter((f) => f.startsWith(want))
      .map((f) => JSON.parse(fs.readFileSync(path.join(localDir(), f), 'utf8')));
  }
  const { list } = await blob();
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    cursor = page.cursor;
    const batch = await Promise.all(page.blobs.map((b) => get(b.pathname)));
    out.push(...batch.filter(Boolean));
  } while (cursor);
  return out;
}

function keyFor(prefix, id) {
  return prefix + String(id || '') + '.json';
}

module.exports = { put, get, listAll, keyFor, SUBMISSIONS, SUGGESTIONS };
