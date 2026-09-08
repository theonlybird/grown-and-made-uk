/* County and country for a listing, worked out twice and only trusted when the
 * two agree.
 *
 * Why twice. A town name on its own is not enough: "Newbury" resolves to a
 * hamlet in Somerset before the Berkshire town, and a maker filed under the
 * wrong county quietly stops appearing in searches for their own. A point is
 * unambiguous, so the pin the business placed is the primary source. But a
 * reverse geocode returns administrative names — "City of Stoke-on-Trent",
 * "Powys - Powys" — which are not the names this site uses, and a bad
 * coordinate would be believed without question.
 *
 * So: the pin is reverse-geocoded, scripts/lib/uk-regions.js reads the county
 * out of their own text as a second opinion, and only agreement is applied.
 * A disagreement is put in front of Theo instead of resolved by a guess. That
 * is the same posture as crossCheck() in uk-regions.js, which exists because a
 * rule confidently filing a Cumbrian maker under Scotland is the sort of quiet
 * error this directory cannot afford.
 */

/* The library lives in scripts/, outside the function's own directory. If the
 * bundler ever fails to trace it we lose the second opinion, not the
 * submission — so this must never throw at import time. */
let classify = null;
try {
  ({ classify } = require('../../scripts/lib/uk-regions'));
} catch (e) {
  console.warn('uk-regions unavailable, pin reading will stand alone:', e.message);
}

const TIMEOUT_MS = 3000;

/* "City of Stoke-on-Trent" -> "Stoke-on-Trent", "Powys - Powys" -> "Powys".
   Administrative dressing this site does not use. */
function tidyCounty(name) {
  if (!name) return '';
  let n = String(name).split(' - ')[0].trim();
  n = n.replace(/^(City|County|Borough|District)\s+of\s+/i, '');
  n = n.replace(/\s+(City|Borough|District|Council|Unitary Authority)$/i, '');
  return n.trim();
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

/* "Berkshire" vs "West Berkshire", "Powys" vs "Powys - Powys": the pin returns
   the administrative unit, the text the everyday county, and one usually
   contains the other. Anything looser than this should be a disagreement. */
function compatible(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

async function reverse(lat, lng) {
  const url = 'https://api.postcodes.io/postcodes?lon=' + encodeURIComponent(lng)
    + '&lat=' + encodeURIComponent(lat) + '&limit=1&radius=2000';
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error('postcodes.io HTTP ' + res.status);
  const body = await res.json();
  const hit = (body.result || [])[0];
  if (!hit) return null;
  return {
    county: tidyCounty(hit.admin_county || hit.admin_district),
    country: hit.country || '',
    district: hit.admin_district || '',
    parish: hit.parish || '',
  };
}

/**
 * @param {{lat:number,lng:number}} point   where the pin now sits
 * @param {{town:string,address:string}} text  what they typed
 * @returns {Promise<object|null>} the two readings and whether they agree
 */
async function locate(point, text) {
  if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') return null;

  let pin = null, error = '';
  try {
    pin = await reverse(point.lat, point.lng);
  } catch (e) {
    error = e.name === 'TimeoutError' ? 'postcodes.io timed out' : e.message;
  }

  let read = null;
  if (classify) {
    try {
      const c = classify({ town: text.town || '', address: text.address || '' });
      read = { county: c.county || '', nation: c.nation || '', matched: c.matched || '' };
    } catch (e) { /* second opinion only; never fatal */ }
  }

  if (!pin && !read) return error ? { error } : null;

  /* Country first: both sources always produce one, and a mismatch there is
     the serious kind — a Welsh maker filed as English is worse than a county
     spelt the administrative way. */
  const countryAgrees = !pin || !read || !pin.country || !read.nation
    ? null
    : norm(pin.country) === norm(read.nation);

  let county = '', nation = '', agrees = null, why = '';

  if (countryAgrees === false) {
    agrees = false;
    why = 'the pin is in ' + pin.country + ' but the address reads as ' + read.nation;
  } else if (pin && read && read.county) {
    agrees = compatible(pin.county, read.county);
    // House style wins when they agree: "Berkshire", not "West Berkshire".
    county = agrees ? read.county : '';
    nation = agrees ? read.nation : '';
    if (!agrees) why = 'the pin says ' + (pin.county || 'nowhere in particular')
      + ' but the address says ' + read.county;
  } else if (pin && pin.county) {
    // They named no county — the usual case now the field asks for a town.
    agrees = true;
    county = pin.county;
    nation = pin.country || (read && read.nation) || '';
    why = 'from the pin; their text names no county';
  } else if (read && read.county) {
    agrees = true;
    county = read.county;
    nation = read.nation;
    why = 'from their text; the pin could not be resolved';
  }

  return {
    county, nation, agrees, why, error: error || undefined,
    pin: pin ? { county: pin.county, country: pin.country, district: pin.district, parish: pin.parish } : null,
    text: read || null,
  };
}

module.exports = { locate, tidyCounty, compatible };
