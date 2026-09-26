#!/usr/bin/env node
/**
 * Regression harness for stage-one retrieval.
 *
 * Runs against the GENERATED api/ai-search.js, not the library, so it tests
 * what actually deploys — including the inlining step, which is where a silent
 * drift between the tagging vocabulary and the search vocabulary would show up.
 *
 * Each case asserts on the shortlist that gets handed to the model. It does not
 * call Gemini: the bug being guarded against was never in the ranking, it was
 * that the right businesses never reached the model in the first place.
 *
 * Usage:  node scripts/test-search.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { stageOneFilter, expandQuery, BUSINESS_CATALOG } = require('../api/ai-search.js');

// ---------------------------------------------------------------------------
// The page's own search engine: assets/search.js, the file index.html loads,
// run against the real listings and the real place gazetteer. It answers
// whenever the API is slow, rate-limited or down, and it decides places,
// audience and the results banner even when the API answers.
// ---------------------------------------------------------------------------
function loadLocalSearch() {
  const root = path.join(__dirname, '..');
  const ctx = {
    console,
    window: {},
    BUSINESSES: JSON.parse(fs.readFileSync(path.join(root, 'data/businesses.json'), 'utf8')),
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/query-expand.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/search.js'), 'utf8'), ctx);
  ctx.__places = JSON.parse(fs.readFileSync(path.join(root, 'data/uk-places.json'), 'utf8'));
  vm.runInContext('Gazetteer.set(__places)', ctx);
  const run = q => {
    const result = ctx.localSearch(q);
    const headline = ctx.localHeadlineData(result);
    return { result, headline, banner: ctx.buildHeadline(headline) };
  };
  run.ctx = ctx;
  return run;
}

if (typeof stageOneFilter !== 'function') {
  console.error('stageOneFilter not found — did you run scripts/update-search-api.js?');
  process.exit(1);
}

const cases = [
  // --- the reported fault: food terms that no tag label contains ---
  { q: 'sausages',        expectTags: ['pork & bacon'], expectCategory: 'farm', minInCategory: 5 },
  { q: 'british cider',   expectTags: ['drinks & spirits'], expectCategory: 'farm', minInCategory: 3 },
  { q: 'ale',             expectTags: ['drinks & spirits'], expectCategory: 'farm', minInCategory: 3 },
  { q: 'vegetables',      expectTags: ['fruit & veg'], expectCategory: 'farm', minInCategory: 10 },
  { q: 'raw milk',        expectTags: ['dairy & cheese'], expectCategory: 'farm', minInCategory: 5 },
  { q: 'veg box',         expectTags: ['fruit & veg'], expectCategory: 'farm', minInCategory: 5 },

  // --- kitchen-table words that appear in no product feed ---
  { q: 'bangers',         expectTags: ['pork & bacon'], expectCategory: 'farm', minInCategory: 5 },
  { q: 'spuds',           expectTags: ['fruit & veg'], expectCategory: 'farm', minInCategory: 5 },
  { q: 'a joint of beef', expectTags: ['beef'], expectCategory: 'farm', minInCategory: 3 },
  { q: 'sourdough',       expectTags: ['bread & bakery'], expectCategory: 'farm', minInCategory: 2 },
  { q: 'somewhere with a butcher', expectTags: ['pork & bacon'], expectCategory: 'farm', minInCategory: 5 },

  // --- non-food controls: these worked before and must still work ---
  { q: 'knitted vests',   expectTags: ['knitwear', 'vests & waistcoats'], expectCategory: 'clothing', minInCategory: 5 },
  { q: 'kitchen knife',   expectTags: ['cutlery & knives'], expectCategory: 'cutlery', minInCategory: 3 },
  // The catalogue never writes "fork" — Sheffield makers write "cutlery" — so
  // the lexicon has to carry it, or fuzzy matching turns it into "pork".
  { q: 'sheffield fork',  expectTags: ['cutlery & knives'], expectCategory: 'cutlery', minInCategory: 3 },
  { q: 'spoons',          expectTags: ['cutlery & knives'], expectCategory: 'cutlery', minInCategory: 2 },
  { q: 'pet food bowls',  expectTags: ['bowls'], expectCategory: 'ceramics', minInCategory: 3 },
  { q: 'wellies',         expectTags: ['footwear & boots'], expectCategory: 'clothing', minInCategory: 2 },

  // --- precision: the word-boundary bug and the head-noun rule ---
  { q: 'ale',             mustNotExpandTo: ['bread & bakery'] },
  { q: 'cake tin',        mustNotExpandTo: ['bread & bakery'] },
  { q: 'glasses case',    mustNotExpandTo: ['glasses'] },
];

let failures = 0;
const line = (ok, text) => console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${text}`);

console.log(`\nstage-one retrieval — ${BUSINESS_CATALOG.length} businesses\n`);

for (const c of cases) {
  const exp = expandQuery(c.q);
  const shortlist = stageOneFilter(c.q, BUSINESS_CATALOG, 40);
  const problems = [];

  for (const t of (c.expectTags || [])) {
    if (!exp.tags.includes(t)) problems.push(`did not expand to "${t}" (got: ${exp.tags.join(', ') || 'nothing'})`);
  }
  for (const t of (c.mustNotExpandTo || [])) {
    if (exp.tags.includes(t)) problems.push(`wrongly expanded to "${t}"`);
  }
  if (c.expectCategory) {
    const n = shortlist.filter(s => s.c === c.expectCategory).length;
    if (n < c.minInCategory) {
      problems.push(`only ${n} ${c.expectCategory} businesses in the shortlist, wanted >= ${c.minInCategory}`);
    }
  }
  if (shortlist.length === 0) problems.push('empty shortlist');

  if (problems.length) {
    failures++;
    line(false, `"${c.q}"`);
    problems.forEach(p => console.log(`          ${p}`));
  } else {
    const top = shortlist.slice(0, 3).map(s => s.i).join(', ');
    line(true, `"${c.q}"`.padEnd(34) + `-> [${exp.tags.join(', ') || '-'}]  ${top}`);
  }
}

// A false "no results" is the failure that started this. Nothing that names a
// product should ever hand the model an all-wrong shortlist.
// ---------------------------------------------------------------------------
// Judgement words must not change the answer.
//
// Ranking on "sustainable" or "ethical" would mean this map deciding which
// businesses are more sustainable than others, on no evidence. Mechanically it
// was already doing so: the word appears in enough descriptions to score.
// ---------------------------------------------------------------------------
console.log('\njudgement words are ignored — same results as the bare noun\n');

const local = loadLocalSearch();
const ids = list => list.map(b => b.id || b.i).join(',');

const neutrality = [
  { bare: 'jumper', dressed: ['sustainable jumper', 'nice jumper', 'ethical jumper', 'the best quality jumper'] },
  { bare: 'mugs',   dressed: ['eco friendly mugs', 'lovely mugs'] },
  { bare: 'beef',   dressed: ['premium beef'] },
];

for (const { bare, dressed } of neutrality) {
  const apiBase = ids(stageOneFilter(bare, BUSINESS_CATALOG, 40));
  const localBase = ids(local(bare).result.matches);
  for (const q of dressed) {
    const apiSame = ids(stageOneFilter(q, BUSINESS_CATALOG, 40)) === apiBase;
    const localSame = ids(local(q).result.matches) === localBase;
    const echoed = local(q).headline.productTerm || '';
    const clean = !/sustainab|ethic|eco|nice|lovely|best|quality|premium/i.test(echoed);
    const ok = apiSame && localSame && clean;
    if (!ok) failures++;
    line(ok, `"${q}"`.padEnd(34) + `api ${apiSame ? '=' : '≠'}  page ${localSame ? '=' : '≠'}  echoes "${echoed}"`);
  }
}

// "organic" is a certified claim, not an opinion, and must still bite.
{
  const differs = ids(stageOneFilter('organic beef', BUSINESS_CATALOG, 40)) !== ids(stageOneFilter('beef', BUSINESS_CATALOG, 40));
  if (!differs) failures++;
  line(differs, '"organic beef" still differs from "beef" (certified, not subjective)');
}

// ---------------------------------------------------------------------------
// A place must be a place the user typed.
//
// "jumper" widens to include "cardigan"; Cardigan is a town in Ceredigion, so
// the widened word was read as a location the user had asked for. Every
// knitwear search then apologised for being "a bit further afield" than a
// place nobody had mentioned.
// ---------------------------------------------------------------------------
console.log('\nplaces come from the user, not from synonym widening\n');

const placeCases = [
  { q: 'jumper',              expectPlace: null,       expectQuality: 'exact' },
  { q: 'sustainable jumper',  expectPlace: null,       expectQuality: 'exact' },
  { q: 'cardigans',           expectPlace: null,       expectQuality: 'exact' },
  // Typed place names must still work, including when the place shares its
  // name with a garment. "partial" rather than "wider": Hiut Denim really is
  // in Cardigan, so the honest answer is "the one match there, then others".
  { q: 'jumper in cardigan',  expectPlace: 'Cardigan', expectQuality: 'partial' },
  { q: 'wool jumper cornwall', expectPlace: 'Cornwall' },
];

for (const c of placeCases) {
  const h = local(c.q).headline;
  const got = h.locationTerm;
  const problems = [];
  if ((got || null) !== c.expectPlace) problems.push(`locationTerm ${JSON.stringify(got)}, wanted ${JSON.stringify(c.expectPlace)}`);
  if (c.expectQuality && h.matchQuality !== c.expectQuality) problems.push(`matchQuality "${h.matchQuality}", wanted "${c.expectQuality}"`);
  if (problems.length) {
    failures++;
    line(false, `"${c.q}"`);
    problems.forEach(p => console.log(`          ${p}`));
  } else {
    line(true, `"${c.q}"`.padEnd(34) + `place: ${got || 'none'}  (${h.matchQuality})`);
  }
}

// ---------------------------------------------------------------------------
// Qualifiers rank but never admit.
//
// "handmade bowl" used to return Hurdwick Handmade Bag Company, Alex Monroe
// and Drakes. None of them make bowls; they simply have the word in their name
// or copy. The noun decides who is eligible; the qualifier only orders them.
// ---------------------------------------------------------------------------
console.log('\nqualifiers boost, but never make a business eligible\n');

{
  const bowlMakers = new Set(
    BUSINESS_CATALOG.filter(b => (b.pt || []).includes('bowls')).map(b => b.i)
  );
  const apiIntruders = stageOneFilter('handmade bowl', BUSINESS_CATALOG, 40)
    .filter(b => !bowlMakers.has(b.i) && b.c !== 'ceramics');
  const pageIntruders = local('handmade bowl').result.matches
    .filter(b => !bowlMakers.has(b.id) && b.category !== 'ceramics');

  const okApi = apiIntruders.length === 0;
  const okPage = pageIntruders.length === 0;
  if (!okApi) failures++;
  if (!okPage) failures++;
  line(okApi, `"handmade bowl" — api returns no non-bowl makers` +
    (okApi ? '' : ` (got ${apiIntruders.slice(0, 4).map(b => b.i).join(', ')})`));
  line(okPage, `"handmade bowl" — page returns no non-bowl makers` +
    (okPage ? '' : ` (got ${pageIntruders.slice(0, 4).map(b => b.id).join(', ')})`));
}

// The boost must still do its job: organic farms should out-rank non-organic
// ones on an organic query, without changing who is eligible.
{
  const organicFirst = local('organic beef').result.matches
    .slice(0, 3).filter(b => /organic/i.test(b.name + ' ' + b.description)).length >= 2;
  if (!organicFirst) failures++;
  line(organicFirst, '"organic beef" still ranks organic farms into the top 3');

  const same = ids(local('organic beef').result.matches.filter(b => b.category !== 'farm'));
  if (same !== '') failures++;
  line(same === '', '"organic beef" returns farm shops only');
}

// A query made only of qualifiers has no noun to fall back on, and must still
// return something rather than nothing.
{
  const r = local('organic').result.matches;
  const ok = r.length > 0;
  if (!ok) failures++;
  line(ok, `"organic" alone still returns results (${r.length})`);
}

// ---------------------------------------------------------------------------
// A spelling correction must be declared, not applied quietly.
//
// Darlington is in County Durham, Dartington is in Devon, and they are one
// letter apart. Searching the first silently returned two businesses in the
// second under the banner "Here are some UK businesses we think you'll love".
// ---------------------------------------------------------------------------
console.log('\nspelling corrections are declared, not silent\n');

const correctionCases = [
  // Darlington used to be "corrected" to Dartington, 350 miles away. It is
  // now simply a place we know (see the gazetteer block below).
  { q: 'darlington',      expect: null },
  { q: 'sheffild knives', expect: ['sheffild', 'sheffield'],    banner: /No results for <b>Sheffild<\/b>.*Sheffield/ },
  // Not corrections: exact hits, and the stemmer's own doubled-letter repairs
  // ("cornwal" reaches Cornwall by collapsing "ll", so it is the same word).
  { q: 'dartington',      expect: null },
  { q: 'cornwal',         expect: null },
  { q: 'sausages',        expect: null },
  // A word the lexicon recognises is a real product term and must never be
  // corrected. "sheffield fork" was returning farm shops under "No results for
  // Fork, showing Pork instead."
  { q: 'fork',            expect: null },
  { q: 'sheffield fork',  expect: null },
];

for (const c of correctionCases) {
  const { result, banner } = local(c.q);
  const fixes = result.corrections || [];
  const problems = [];

  if (c.expect === null) {
    if (fixes.length) problems.push(`announced a correction it should not have: ${JSON.stringify(fixes)}`);
    if (/No results for/.test(banner)) problems.push('banner claims a correction');
  } else {
    const got = fixes.length ? [fixes[0].from, fixes[0].to] : null;
    if (!got || got[0] !== c.expect[0] || got[1] !== c.expect[1]) {
      problems.push(`corrections ${JSON.stringify(got)}, wanted ${JSON.stringify(c.expect)}`);
    }
    if (c.banner && !c.banner.test(banner)) problems.push(`banner reads: ${banner}`);
    if (!result.matches.length) problems.push('no results to show');
  }

  if (problems.length) {
    failures++;
    line(false, `"${c.q}"`);
    problems.forEach(p => console.log(`          ${p}`));
  } else {
    const shown = banner.replace(/<\/?b>/g, '').replace(/&mdash;/g, '—').replace(/&rsquo;/g, '’');
    line(true, `"${c.q}"`.padEnd(34) + shown.slice(0, 62));
  }
}

// A fuzzy correction may not change the first letter. Typos happen in the
// middle and at the end of words; a changed initial is a different word.
{
  const { result, banner } = local('sheffield fork');
  const farms = result.matches.filter(b => b.category === 'farm');
  const cutlers = result.matches.filter(b => b.category === 'cutlery');
  const ok = farms.length === 0 && cutlers.length >= 3 && !/Pork/i.test(banner);
  if (!ok) failures++;
  line(ok, `"sheffield fork" — ${cutlers.length} cutlers, ${farms.length} farm shops` +
    (ok ? '' : ` | ${banner}`));
}

// ---------------------------------------------------------------------------
// Places are geography, not wording.
//
// "scottish pork" used to return three Scottish farms and twenty-five English
// ones under a banner claiming they all matched, because a business was only
// findable as Scottish if its copy happened to use the word. Five of the ten
// Scottish farm shops on the map never do.
// ---------------------------------------------------------------------------
console.log('\nplace searches match on nation and county\n');

const businesses = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/businesses.json'), 'utf8')
);

{
  const everyScottishFarm = businesses
    .filter(b => b.category === 'farm' && b.nation === 'Scotland').length;

  // A nation is a filter (22 Sep 2026): "scottish pork" shows Scottish pork
  // and nothing else, rather than Scottish first and English after.
  const { result, headline, banner } = local('scottish pork');
  const allScots = result.matches.length > 0 && result.matches.every(b => b.nation === 'Scotland');
  if (!allScots) failures++;
  line(allScots, `"scottish pork" — all ${result.matches.length} results are in Scotland`);

  const exact = headline.matchQuality === 'exact'
    && banner === `${result.matches.length} matches for Scottish reared pork below`;
  if (!exact) failures++;
  line(exact, `"scottish pork" — banner reads "${banner}"`);

  line(true, `   for reference: ${everyScottishFarm} Scottish farm shops on the map`);
}

{
  const { result, headline } = local('welsh cheese');
  const ok = result.matches.length > 0 && result.matches.every(b => b.nation === 'Wales');
  if (!ok) failures++;
  line(ok, `"welsh cheese" — ${result.inPlace} in Wales, all first (${headline.matchQuality})`);
}

// A nation reads as where the thing is from, with the right verb: cheese and
// jam are made, tomatoes grown, lamb reared (22 Sep 2026).
for (const [q, want] of [['scottish pork', /^\d+ match(es)? for Scottish reared pork below$/],
                         ['welsh cheese', /^\d+ match(es)? for Welsh made cheese below$/],
                         ['scottish cheese', /^\d+ match(es)? for Scottish made cheese below$/],
                         ['northern irish cheese', /^\d+ match(es)? for Northern Irish made cheese below$/],
                         ['northern irish beef', /^\d+ match(es)? for Northern Irish reared beef below$/],
                         ['northern irish jam', /Northern Irish made jam/],
                         ['english tomatoes', /English grown tomatoes/],
                         ['english eggs', /^\d+ match(es)? for English eggs below$/],
                         ['jam in cornwall', /British made jam in Cornwall/],
                         ['honey devon', /British made honey in Devon/],
                         ['vegetables devon', /British grown vegetables in Devon/],
                         ['lamb wales', /Welsh reared lamb/]]) {
  const b = local(q).banner;
  const ok = want.test(b) && !/Northern Northern|grown cheese|grown jam/.test(b);
  if (!ok) failures++;
  line(ok, `"${q}"`.padEnd(28) + b.replace(/&rsquo;/g, '’').slice(0, 70) + (ok ? '' : ` — wanted ${want}`));
}

// The border is where a latitude rule fails. Newcastle sits at 54.97 and
// Northumberland reaches 55.31; Hawick and Carlisle are half a degree apart on
// opposite sides. All of these must land in the right country.
console.log('');
const borderCases = [
  ['big-fox-apparel', 'England'], ['barbour', 'England'], ['ivy-and-rigg', 'England'],
  ['chapman-bags', 'England'], ['jim-malone', 'England'], ['errington-reay', 'England'],
  ['william-lockie', 'Scotland'], ['begg-x-co', 'Scotland'], ['lochcarron', 'Scotland'],
  ['hiut-denim', 'Wales'], ['broughgammon-farm', 'Northern Ireland'],
];
for (const [id, want] of borderCases) {
  const b = businesses.find(x => x.id === id);
  const ok = b && b.nation === want;
  if (!ok) failures++;
  line(ok, `${id.padEnd(24)} ${b ? b.town : '(missing)'} -> ${b ? b.nation : '?'}`.slice(0, 74));
}


// ---------------------------------------------------------------------------
// A place we have no makers in is still a place.
//
// Every place vocabulary was built from the catalogue, so a town became a word
// only once someone there was listed. "Leeds jumper" was not answered with
// "nothing in Leeds" — Leeds was stemmed to "led", scored as a product, and
// dropped from the query, leaving a banner that claimed an exact match. Fifteen
// of the fifty largest towns and cities in the UK behaved that way.
//
// The rule: if the user typed a place, the result must know it, whether or not
// there is anything there.
// ---------------------------------------------------------------------------
console.log('\nplaces are recognised whether or not we have anyone there\n');

const GAZETTEER_TOWNS = [
  'London', 'Birmingham', 'Glasgow', 'Liverpool', 'Bristol', 'Manchester',
  'Sheffield', 'Leeds', 'Edinburgh', 'Leicester', 'Coventry', 'Bradford',
  'Cardiff', 'Belfast', 'Nottingham', 'Kingston upon Hull', 'Newcastle upon Tyne',
  'Stoke-on-Trent', 'Southampton', 'Derby', 'Portsmouth', 'Brighton', 'Plymouth',
  'Northampton', 'Reading', 'Luton', 'Wolverhampton', 'Bolton', 'Aberdeen',
  'Bournemouth', 'Norwich', 'Swindon', 'Swansea', 'Milton Keynes',
  'Southend-on-Sea', 'Middlesbrough', 'Peterborough', 'Sunderland', 'Warrington',
  'Huddersfield', 'Slough', 'Oxford', 'York', 'Poole', 'Ipswich', 'Telford',
  'Cambridge', 'Dundee', 'Gloucester', 'Blackpool'
];

{
  const missed = GAZETTEER_TOWNS.filter(t => !local(`${t} jumper`).result.place.length);
  const ok = missed.length === 0;
  if (!ok) failures++;
  line(ok, `all ${GAZETTEER_TOWNS.length} of the largest UK towns and cities name a place` +
    (ok ? '' : ` — dropped: ${missed.join(', ')}`));
}

// One county from each nation, plus the two spellings people actually type.
const countyCases = [
  'Rutland', 'Herefordshire', 'Northumberland', 'West Sussex',   // England
  'Perthshire', 'Argyll and Bute', 'Caithness', 'Midlothian',    // Scotland
  'Powys', 'Ceredigion', 'Monmouthshire', 'Vale of Glamorgan',   // Wales
  'County Down', 'Co. Fermanagh', 'County Tyrone', 'Armagh',     // Northern Ireland
];
{
  const missed = countyCases.filter(c => !local(`${c} pottery`).result.place.length);
  const ok = missed.length === 0;
  if (!ok) failures++;
  line(ok, `counties of all four nations name a place` +
    (ok ? '' : ` — dropped: ${missed.join(', ')}`));
}

// The specific manglings. Each of these was a real place turned into something
// else by a repair step that assumed an unknown word must be a misspelt
// product: the stemmer collapsed the doubled letter in Leeds, splitJoined broke
// Wakefield in half, and fuzzy matching moved the rest around the country.
const manglings = [
  ['Leeds jumper', 'leeds'],
  ['Hull cheese', 'hull'],
  ['Coventry watch', 'coventry'],
  ['Sunderland knitwear', 'sunderland'],
  ['Cardiff jumper', 'cardiff'],
  ['Oxford cheese', 'oxford'],
  ['Swindon knife', 'swindon'],
];
for (const [q, want] of manglings) {
  const { result, banner } = local(q);
  const problems = [];
  if (!result.place.includes(want)) problems.push(`place is ${JSON.stringify(result.place)}, wanted ${want}`);
  if ((result.corrections || []).length) problems.push(`invented a correction: ${JSON.stringify(result.corrections)}`);
  if (/we think you&rsquo;ll love$/.test(banner)) problems.push('banner claims an exact match');
  if (problems.length) {
    failures++;
    line(false, `"${q}"`);
    problems.forEach(p => console.log(`          ${p}`));
  } else {
    line(true, `"${q}"`.padEnd(26) + banner.replace(/<\/?b>/g, '').replace(/&rsquo;/g, '’').slice(0, 58));
  }
}

// A two-word place is one place. "Milton Keynes jumper" read as a place called
// Milton and a product called keynes, and said so out loud.
console.log('');
const phraseCases = [
  ['Milton Keynes jumper',      /in Milton Keynes/],
  ['Kingston upon Hull cheese', /in Kingston upon Hull/],
  ['tomatoes isle of wight',    /in Isle of Wight/],
  ['vale of glamorgan cheese',  /in Vale of Glamorgan/],
  ['tyne and wear knitwear',    /in Tyne and Wear/],
  ['pottery stoke on trent',    /in Stoke on Trent/],
];
for (const [q, want] of phraseCases) {
  const { banner } = local(q);
  const ok = want.test(banner);
  if (!ok) failures++;
  line(ok, `"${q}"`.padEnd(30) + (ok ? 'reads as one place' : `— got: ${banner}`));
}

// ---------------------------------------------------------------------------
// A street is not a place. Weetons is on Leeds Road in Harrogate, Portmeirion
// is on London Road in Stoke-on-Trent, and putting the country's cities into
// the vocabulary would have turned both into local matches.
// ---------------------------------------------------------------------------
console.log('');
const streetCases = [
  ['Leeds cheese',   'weetons',     'Leeds Road, Harrogate'],
  ['London pottery', 'portmeirion', 'London Road, Stoke-on-Trent'],
];
for (const [q, id, why] of streetCases) {
  const { result } = local(q);
  const inPlace = result.matches.slice(0, result.inPlace);
  const ok = !inPlace.some(b => b.id === id);
  if (!ok) failures++;
  line(ok, `"${q}"`.padEnd(18) + `${why} is not a match` + (ok ? '' : ' — it was counted'));
}

// Only what the place actually contains. These were all counted before: a
// London pottery for a Stoke search, a Fermanagh one for County Down.
{
  const { result } = local('pottery stoke on trent');
  const inPlace = result.matches.slice(0, result.inPlace);
  const strays = inPlace.filter(b => !/stoke|trent/i.test([b.town, b.address].join(' ')));
  const ok = strays.length === 0 && inPlace.length >= 6;
  if (!ok) failures++;
  line(ok, `"pottery stoke on trent" — ${inPlace.length} in place, none of them elsewhere` +
    (ok ? '' : ` — strays: ${strays.map(b => b.name).join(', ')}`));
}
{
  const { result } = local('county down pottery');
  const inPlace = result.matches.slice(0, result.inPlace);
  const ok = inPlace.length > 0 && inPlace.every(b => /down/i.test([b.town, b.address, b.county].join(' ')));
  if (!ok) failures++;
  line(ok, `"county down pottery" — ${inPlace.length} in place, all of them in Co. Down` +
    (ok ? '' : ` — got: ${inPlace.map(b => b.town).join(', ')}`));
}

// ---------------------------------------------------------------------------
// WHO THE GARMENT IS FOR
//
// "mens jackets" returned forty jacket makers, several of whom sell only
// womenswear. The words were being scored as product terms, and whole-word
// matching means "men" matches neither "Menswear" nor the menswear tag — so
// the audience did nothing at all.
//
// The rule: an audience can only ever RULE A BUSINESS OUT. A listing whose
// audience we have not established still appears, below the confirmed ones.
// ---------------------------------------------------------------------------
console.log('\naudience — a gendered search never shows a business that excludes that gender\n');

const audienceOf = b => (Array.isArray(b.audience) ? b.audience : null);
const excludes = (b, who) => { const a = audienceOf(b); return !!a && a.length && !a.includes(who); };

const audienceCases = [
  ['mens jackets', 'men'], ["men's coats", 'men'], ['gents shoes', 'men'],
  ['womens knitwear', 'women'], ['ladies coats', 'women'],
  ['kids jumpers', 'children'], ['childrens clothes', 'children'],
];
for (const [q, who] of audienceCases) {
  const { result } = local(q);
  const wrong = result.matches.filter(b => excludes(b, who));
  const ok = result.matches.length > 0 && wrong.length === 0;
  if (!ok) failures++;
  line(ok, `"${q}"`.padEnd(22) + `${result.matches.length} results, none of them excludes ${who}` +
    (ok ? '' : ` — got ${wrong.slice(0, 4).map(b => b.name).join(', ') || 'nothing at all'}`));
}

// The three that were reported. Each dresses women (Gushlow & Cole children
// too) and none of them dresses men, so none may answer a menswear search.
for (const id of ['gushlow-cole', 'frimble', 'findra-clothing']) {
  const { result } = local('mens jackets');
  const ok = !result.matches.some(b => b.id === id);
  if (!ok) failures++;
  line(ok, `"mens jackets"`.padEnd(22) + `${id} is not offered`);
}

// …and the same businesses must still answer the search they DO fit.
{
  const { result } = local('womens jackets');
  const ok = result.matches.some(b => b.id === 'gushlow-cole');
  if (!ok) failures++;
  line(ok, `"womens jackets"`.padEnd(22) + 'gushlow-cole is still offered');
}

// Confirmed before unclassified, so an unfinished audit costs ranking rather
// than correctness.
{
  const { result } = local('mens jackets');
  const firstUnknown = result.matches.findIndex(b => !audienceOf(b));
  const lastKnown = result.matches.map(b => !!audienceOf(b)).lastIndexOf(true);
  const ok = firstUnknown === -1 || lastKnown < firstUnknown;
  if (!ok) failures++;
  line(ok, `"mens jackets"`.padEnd(22) + 'confirmed menswear ranks above the unclassified');
}

// An audience is not a product. "mens" must not make a business eligible on
// its own, and it must not stop the product term doing its work: the jackets
// in "mens jackets" still have to be jackets.
{
  // Compared against the product, not against the capped result set for
  // "jackets": narrowing by audience lets businesses that sat at rank 41
  // through, and they are correct answers, not strays.
  const jacketish = /jacket|coat|outerwear|anorak|parka|waxed/i;
  const { result } = local('mens jackets');
  const strays = result.matches.filter(b =>
    !jacketish.test([b.name, b.subcategory, b.description, (b.product_tags || []).join(' ')].join(' ')));
  const ok = strays.length === 0;
  if (!ok) failures++;
  line(ok, `"mens jackets"`.padEnd(22) + 'every result actually makes jackets' +
    (ok ? '' : ` — strays: ${strays.map(b => b.name).join(', ')}`));
}

// An audience on its own is a real search, not gibberish.
{
  const { result } = local('womenswear');
  const ok = result.matches.length > 0 && !result.matches.some(b => excludes(b, 'women'));
  if (!ok) failures++;
  line(ok, `"womenswear"`.padEnd(22) + `${result.matches.length} results, all of them dressing women`);
}

// ---------------------------------------------------------------------------
// PLACE FIRST (22 Sep 2026)
//
// A word that names a place is a place. A nation filters; anything smaller
// goes first and everything else follows nearest first. The banner's count
// and the grid's divider come from the same function.
// ---------------------------------------------------------------------------
console.log('\nplace first — the gazetteer, nations as filters, nearest first\n');
{
  const { ctx } = local;
  const check = (label, ok, extra) => { if (!ok) failures++; line(ok, label + (ok || !extra ? '' : ` — ${extra}`)); };
  const nondecreasing = (list, places) => {
    const d = list.map(b => Math.min(...places.filter(p => !p.strict && p.distance).map(p => p.distance(b))));
    return d.every((x, i) => i === 0 || x >= d[i - 1] - 1e-9);
  };

  // The two that were reported.
  for (const [q, want] of [['wakefield cheese', 'Wakefield'], ['chelmsford pottery', 'Chelmsford'],
                           ['basingstoke knitwear', 'Basingstoke'], ['cheese in wakefield', 'Wakefield']]) {
    const { result, banner } = local(q);
    const afield = result.matches.slice(result.inPlace);
    check(`"${q}"`.padEnd(26) + `names ${want}, nearest first, no correction`,
      result.places.some(p => p.label === want) && !(result.corrections || []).length
        && banner.includes(want) && result.matches.length > 0 && nondecreasing(afield, result.places),
      banner);
  }

  // Nations filter.
  for (const [q, n] of [['english cheese', 'England'], ['cheese from england', 'England'],
                        ['scottish knitwear', 'Scotland'], ['welsh pottery', 'Wales'],
                        ['northern irish beef', 'Northern Ireland'], ['english', 'England']]) {
    const { result } = local(q);
    const strays = result.matches.filter(b => b.nation !== n);
    check(`"${q}"`.padEnd(26) + `${result.matches.length} results, all in ${n}`,
      result.matches.length > 0 && strays.length === 0, strays.slice(0, 3).map(b => b.name).join(', '));
  }

  // Adjectives and regions.
  for (const [q, want] of [['cornish cheese', 'Cornwall'], ['lake district', 'the Lake District'],
                           ['highlands knitwear', 'the Highlands'], ['cotswolds knitwear', 'the Cotswolds'],
                           ['north wales farm shop', 'North Wales'], ['kentish apples', 'Kent'],
                           ['caithness pottery', 'Caithness'], ['peak district cheese', 'the Peak District']]) {
    const { result, banner } = local(q);
    check(`"${q}"`.padEnd(26) + `reads as ${want}`, result.places.some(p => p.label === want) && banner.includes(want), banner);
  }
  {
    const { result } = local('lake district');
    const inPlace = result.matches.slice(0, result.inPlace);
    check(`"lake district"`.padEnd(26) + `${inPlace.length} in place, all in Cumbria`,
      inPlace.length > 0 && inPlace.every(b => /cumbria/i.test([b.county, b.address, b.town].join(' '))),
      inPlace.map(b => b.name).join(', '));
  }

  // The banner's count is the divider's position, always.
  for (const q of ['highlands knitwear', 'midlands pottery', 'shetland jumper', 'yorkshire cheese',
                   'cotswolds knitwear', 'north wales farm shop', 'wakefield cheese', 'jumper in cardigan',
                   'london leather', 'pottery stoke on trent']) {
    const { result } = local(q);
    const seam = ctx.arrangeByPlace(result.matches, result.places).near.length;
    check(`"${q}"`.padEnd(26) + `banner count ${result.inPlace} = divider ${seam}`, seam === result.inPlace);
  }

  // A place mentioned in a description is not where the business is.
  {
    const { result } = local('shetland jumper');
    const inPlace = result.matches.slice(0, result.inPlace);
    check(`"shetland jumper"`.padEnd(26) + 'Charl Knitwear (Norfolk) is not counted as in Shetland',
      !inPlace.some(b => b.id === 'charl-knitwear') && inPlace.every(b => b.nation === 'Scotland'),
      inPlace.map(b => b.name).join(', '));
  }

  // Product words stay products; everyday-word places need a preposition.
  for (const [q, place] of [['cheddar', null], ['chelsea boots', null], ['wool jumper', null], ['beer', null],
                            ['cardigans', null], ['sale', null], ['oxford shoes', null],
                            ['cheese near sale', 'Sale'], ['jumper in cardigan', 'Cardigan'], ['oxford cheese', 'Oxford']]) {
    const { result } = local(q);
    const got = result.places.map(p => p.label).join(',') || null;
    check(`"${q}"`.padEnd(26) + `place ${got || 'none'}`, got === place, `wanted ${place || 'none'}`);
  }
  {
    const { result } = local('chelsea boots');
    const footwear = result.matches.filter(b => /boot|shoe|footwear/i.test([b.subcategory, b.description, (b.product_tags || []).join(' ')].join(' ')));
    check(`"chelsea boots"`.padEnd(26) + `${footwear.length} of ${result.matches.length} results make footwear`,
      result.matches.length > 0 && footwear.length === result.matches.length);
  }

  // Gifts are an intent, not a misspelling of a hat maker.
  for (const q of ['christmas', 'christmas gifts', 'presents', 'birthday present for dad', 'gifts in york']) {
    const { result, banner } = local(q);
    const cats = new Set(result.matches.map(b => b.category));
    check(`"${q}"`.padEnd(26) + `${result.matches.length} results across ${cats.size} trades, no correction`,
      result.matches.length > 0 && !(result.corrections || []).length && cats.size >= 3 && /Gift ideas/i.test(banner), banner);
  }

  // A place on its own is a real search.
  for (const q of ['wakefield', 'darlington', 'scotland', 'isle of skye']) {
    const { result, banner } = local(q);
    check(`"${q}"`.padEnd(26) + `${result.matches.length} results`, result.matches.length > 0 && result.places.length === 1, banner);
  }

  // "near me" is a request to sort by distance, not a place or a product.
  {
    const r1 = local('cheese near me').result;
    check(`"cheese near me"`.padEnd(26) + 'asks for distance, searches cheese, names no place',
      r1.nearMe && !r1.nearMeOnly && r1.places.length === 0 && r1.product.includes('cheese') && r1.matches.length > 0);
    const r2 = local('near me').result;
    check(`"near me"`.padEnd(26) + 'is a sort on its own, not a search', r2.nearMe && r2.nearMeOnly);
    const r3 = local('nearest farm shop').result;
    check(`"nearest farm shop"`.padEnd(26) + 'asks for distance', r3.nearMe && r3.matches.length > 0);
    const h = ctx.localHeadlineData(local('scottish cheese').result);
    const b = ctx.buildHeadline(Object.assign({}, h, { nearYou: true }));
    check(`"scottish cheese" + near`.padEnd(26) + b, /^\d+ matches for Scottish made cheese, nearest to you first$/.test(b));
    const hw = ctx.localHeadlineData(local('wakefield cheese').result);
    const bw = ctx.buildHeadline(Object.assign({}, hw, { nearYou: true }));
    check(`"wakefield cheese" + near`.padEnd(26) + 'the place still leads', /in Wakefield/.test(bw) && !/nearest to you/.test(bw), bw);
  }

  // A word we could not read is admitted.
  {
    const { banner } = local('wool zzqxv');
    check(`"wool zzqxv"`.padEnd(26) + 'admits the word it did not recognise', /didn&rsquo;t recognise &ldquo;zzqxv/.test(banner), banner);
  }
}

// ---------------------------------------------------------------------------
// Pets. "dog bowl" used to read as an unknown word plus bowls. The pet word
// is now a product; the words that follow it ("collar", "bed", "lead") are
// read as part of it; and prints, pendants and tweed checks that merely
// contain the word "dog" are not dog goods.
// ---------------------------------------------------------------------------
console.log('\npets — a dog is a product, a dog print is not\n');
{
  const { mapToVocab } = require('./lib/product-vocab');
  const check = (label, ok, extra) => { if (!ok) failures++; line(ok, label + (ok || !extra ? '' : ` — ${extra}`)); };
  const tagging = [
    ['Pet Bowl', true], ['Dog Collar', true], ['Dog Lead', true], ['Daltons Luxury Sheepskin Dog Bed Rugs', true],
    ['Dog Jumper', true], ['Crafting Pet Rugs', true],
    ['Navy Kelso "Shaggy Dog" Brushed Shetland Jumper', false], ['Womens Socks Dog & Spots - Lime Green', false],
    ["It's a Dog's Life Hunter Green Silk Scarf", false], ['Dog Tag', false],
  ];
  for (const [title, want] of tagging) {
    const got = mapToVocab(title).includes('pet accessories');
    check(`${JSON.stringify(title)}`.slice(0, 50).padEnd(52) + (want ? 'is pet goods' : 'is not'), got === want);
  }
  for (const q of ['dog', 'dog bowl', 'dog collar', 'dog bed', 'puppy toys', 'pet food']) {
    const { result } = local(q);
    check(`"${q}"`.padEnd(26) + 'understood as pet goods, no unknown words',
      !(result.unknown || []).length && expandQuery(q).tags.includes('pet accessories'), (result.unknown || []).join(','));
  }
  check(`"dogtooth jacket"`.padEnd(26) + 'is not a dog', !expandQuery('dogtooth jacket').tags.includes('pet accessories'));
  check(`"dog tooth tweed"`.padEnd(26) + 'is not a dog', !expandQuery('dog tooth tweed').tags.includes('pet accessories'));

  // The reviewed lists applied on 26 Sep 2026. Emma Alington makes the one
  // actual dog bowl; resellers of other brands' pet goods were held back.
  const ids = q => local(q).result.matches.map(b => b.id);
  const dogBowl = ids('dog bowl');
  check(`"dog bowl"`.padEnd(26) + 'Emma Alington in the top two', dogBowl.slice(0, 2).includes('emma-alington'), dogBowl.slice(0, 4).join(','));
  const collar = ids('dog collar');
  check(`"dog collar"`.padEnd(26) + `${collar.length} makers, no resellers`,
    collar.includes('chapman-bags') && !collar.some(id => ['campbells-of-beauly', 'rhug-estate', 'palava'].includes(id)));
  for (const [q, min] of [['bowls', 25], ['mugs', 25], ['vases', 15]]) {
    const n = ids(q).length;
    check(`"${q}"`.padEnd(26) + `${n} potteries (the shops' own categories)`, n >= min);
  }
  // A gallery's shop is not the potter's: shared feeds were not merged.
  const B = local.ctx.BUSINESSES;
  const gallery = ['jim-malone', 'jane-hamlyn', 'walter-keeler', 'brookhouse-pottery'];
  check('gallery-linked potters'.padEnd(26) + 'kept their hand tags only',
    gallery.every(id => !(B.find(b => b.id === id).product_tags || []).includes('vases')));
}

console.log('');
if (failures) {
  console.log(`${failures} failing assertion(s)\n`);
  process.exit(1);
}
console.log(`all assertions passed\n`);
