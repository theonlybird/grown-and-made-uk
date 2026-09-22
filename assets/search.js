/* ==========================================================================
   Grown and Made UK — the site search engine.

   Everything that turns what a visitor typed into an ordered list of
   businesses lives here: reading the query, recognising places, products and
   who it is for, scoring, and the sentence above the results. index.html owns
   the page (state, chips, rendering, the AI call); this file owns the rules.
   scripts/test-search.js loads this same file, so the tests exercise exactly
   what ships.

   A classic script, not a module: its top-level declarations are shared with
   the page's inline script, which is how index.html calls localSearch() and
   friends. It reads the page's BUSINESSES array at call time.

   THE RULES, in the order they matter
   1. A place the visitor names is the first thing the results honour.
      - A nation ("English", "Scotland", "Welsh") is a filter: only businesses
        in that nation are shown, ever.
      - Anything smaller (a county, a region, a town) comes first, and then
        everything else follows NEAREST FIRST, so "wakefield cheese" shows the
        cheese makers closest to Wakefield even when none is in it.
      - A word that is a place is a place. The only exceptions are words that
        are also real products on this map ("cardigan", "cheddar", "beer",
        "wool"), which stay products unless the visitor writes "in", "near" or
        "from" before them, and a short list of place names that are everyday
        words ("Street", "Sale", "Deal", "March", "Box").
   2. The product decides who is eligible; qualifiers ("organic", "handmade")
      and audience ("mens") only rank or rule out.
   3. Nothing is changed quietly. A spelling correction is declared, a word we
      could not read is admitted, and the banner never claims a match quality
      the list does not have. The banner's count and the "further afield"
      divider come from the same function, arrangeByPlace(), so they cannot
      disagree.
   ========================================================================== */
'use strict';

/* --------------------------------------------------------------------------
   Text helpers
-------------------------------------------------------------------------- */

// Queries, place names and addresses are all flattened the same way, so that
// "Bishop's Stortford", "bishops stortford" and "St. Albans"/"Saint Albans"
// meet in the middle.
function normalisePlace(s) {
  return String(s == null ? '' : s).toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\s+/g, ' ')
    .trim();
}
const placeText = normalisePlace;

const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Match on word boundaries. Substring matching is what made "Chatsworth" a hit
// for "hat" and put a Derbyshire farm shop top of a hat search.
function hasWord(haystack, word) {
  return new RegExp('\\b' + escRe(word) + 's?\\b', 'i').test(haystack);
}

// A place name in an address is only a place when it is not a street name.
// Weetons is on Leeds Road in Harrogate, and there is a London Road in
// Stoke-on-Trent. No trailing "s" either: places are not pluralised.
const STREET_WORD = '(?!\\s+(road|rd|street|st|lane|ln|way|avenue|ave|close|drive|crescent|terrace|mews|parade|walk))';
function hasPlaceWord(haystack, word) {
  const parts = placeText(word).split(' ').filter(Boolean);
  if (!parts.length) return false;
  const pattern = parts.map(w => w === 'county' ? '(?:county|co)' : escRe(w)).join('\\s+');
  return new RegExp('\\b' + pattern + '\\b' + STREET_WORD, 'i').test(placeText(haystack));
}

function kmBetween(lat1, lng1, lat2, lng2) {
  const R = 6371, t = Math.PI / 180;
  const dLat = (lat2 - lat1) * t, dLng = (lng2 - lng1) * t;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * t) * Math.cos(lat2 * t) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Stable pseudo-random order from an id. Used where there is no relevance to
// rank on ("christmas gifts", "womenswear"), so the page is not always led by
// whoever sits first in the alphabet.
function idHash(id) {
  let h = 2166136261;
  for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Place names are proper nouns whatever the user typed, but the small joining
// words stay lower case: "Isle of Skye", "Stoke-on-Trent".
const PLACE_MINOR = new Set(['of','on','upon','the','in','and','le','sur','under','by','de','la']);
function titleCasePlace(s) {
  return String(s).split(/\s+/).map((w, i) => {
    if (i > 0 && PLACE_MINOR.has(w.toLowerCase())) return w.toLowerCase();
    return w.split('-').map((part, j) =>
      (j > 0 && PLACE_MINOR.has(part.toLowerCase()))
        ? part.toLowerCase()
        : part.charAt(0).toUpperCase() + part.slice(1)
    ).join('-');
  }).join(' ');
}

/* --------------------------------------------------------------------------
   THE GAZETTEER — data/uk-places.json

   About 4,700 UK towns and cities (1,000 people or more, plus every
   administrative seat) from GeoNames, each with the county-level areas it sits
   in. Built by scripts/build-places.py. Loaded once, after the listings; until
   it arrives the fallback lists below keep the biggest places working.

   It answers three questions:
     place(name)  — is this a town, and where is it?
     area(name)   — is this a county/council area, and where is its middle?
     areasOf(b)   — which areas is this business in? Read from the nearest
                    gazetteer place to its pin, so it does not depend on the
                    county field, which is blank for 48 listings and says
                    "London" or "Glasgow" for others.
-------------------------------------------------------------------------- */
const Gazetteer = (function () {
  let data = null, byName = null, byArea = null, loading = null;
  const nearestCache = new Map();

  function set(d) {
    data = d;
    byName = new Map();
    // places arrive sorted by population, so the first of any name wins:
    // "Newport" is the Welsh city, not the village in Essex.
    d.places.forEach((p, i) => { if (!byName.has(p[0])) byName.set(p[0], i); });
    byArea = new Map(d.areas.map((a, i) => [a[0], i]));
    nearestCache.clear();
    if (typeof membersCache !== 'undefined') membersCache.clear();
    resetSearchCaches();
  }

  function load(url) {
    if (data) return Promise.resolve(true);
    if (!loading) {
      loading = fetch(url || 'data/uk-places.json')
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(d => { set(d); return true; })
        .catch(e => { loading = null; console.warn('[search] gazetteer unavailable:', e && e.message); return false; });
    }
    return loading;
  }

  function place(key) {
    if (!data) return null;
    const k = data.aliases[key] || key;
    const i = byName.get(k);
    return i == null ? null : data.places[i];
  }
  function area(key) {
    if (!data) return null;
    const i = byArea.get(key);
    return i == null ? null : data.areas[i];
  }
  function areasOf(b) {
    if (!data || typeof b.lat !== 'number') return null;
    let hit = nearestCache.get(b.id);
    if (hit) return hit;
    const P = data.places, k = Math.cos(b.lat * Math.PI / 180);
    let best = null, bd = Infinity;
    for (let i = 0; i < P.length; i++) {
      const dy = P[i][1] - b.lat, dx = (P[i][2] - b.lng) * k;
      const d = dy * dy + dx * dx;
      if (d < bd) { bd = d; best = P[i]; }
    }
    hit = new Set(best ? best[5].map(j => data.areas[j][0]) : []);
    nearestCache.set(b.id, hit);
    return hit;
  }
  // Every gazetteer place inside an area: the nearest of them is how far a
  // business is from the area's edge, which is what "nearest" should mean.
  const membersCache = new Map();
  function membersOf(key) {
    if (!data) return [];
    let m = membersCache.get(key);
    if (m) return m;
    const i = byArea.get(key);
    m = i == null ? [] : data.places.filter(p => p[5].indexOf(i) !== -1).map(p => [p[1], p[2]]);
    membersCache.set(key, m);
    return m;
  }
  function parentsOf(key) { return (data && data.parents && data.parents[key]) || []; }
  function placeNames() { return data ? [...byName.keys(), ...Object.keys(data.aliases)] : []; }
  function areaNames() { return data ? data.areas.map(a => a[0]) : []; }

  return { set, load, place, area, areasOf, membersOf, parentsOf, placeNames, areaNames, ready: () => !!data };
})();

// Used before the gazetteer has loaded, and if it never does. The 50 largest
// towns and cities (whereig.com) and the counties of all four nations.
const UK_LARGEST_TOWNS = [
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
const UK_COUNTY_NAMES = [
  'Bedfordshire', 'Berkshire', 'Bristol', 'Buckinghamshire', 'Cambridgeshire',
  'Cheshire', 'Cornwall', 'Cumbria', 'Cumberland', 'Westmorland', 'Derbyshire',
  'Devon', 'Dorset', 'County Durham', 'East Riding of Yorkshire', 'East Sussex',
  'Essex', 'Gloucestershire', 'Greater London', 'Greater Manchester',
  'Hampshire', 'Herefordshire', 'Hertfordshire', 'Isle of Wight', 'Kent',
  'Lancashire', 'Leicestershire', 'Lincolnshire', 'Merseyside', 'Norfolk',
  'North Yorkshire', 'Northamptonshire', 'Northumberland', 'Nottinghamshire',
  'Oxfordshire', 'Rutland', 'Shropshire', 'Somerset', 'South Yorkshire',
  'Staffordshire', 'Suffolk', 'Surrey', 'Tyne and Wear', 'Warwickshire',
  'West Midlands', 'West Sussex', 'West Yorkshire', 'Wiltshire', 'Worcestershire',
  'Aberdeenshire', 'Angus', 'Argyll', 'Ayrshire', 'Banffshire', 'Berwickshire',
  'Bute', 'Caithness', 'Clackmannanshire', 'Dumfriesshire', 'Dunbartonshire',
  'East Lothian', 'Fife', 'Inverness-shire', 'Kincardineshire', 'Kinross-shire',
  'Kirkcudbrightshire', 'Lanarkshire', 'Midlothian', 'Moray', 'Nairnshire',
  'Orkney', 'Peeblesshire', 'Perthshire', 'Renfrewshire', 'Ross-shire',
  'Roxburghshire', 'Selkirkshire', 'Shetland', 'Stirlingshire', 'Sutherland',
  'West Lothian', 'Wigtownshire',
  'Argyll and Bute', 'Dumfries and Galloway', 'East Ayrshire', 'East Dunbartonshire',
  'East Renfrewshire', 'Falkirk', 'Highland', 'Inverclyde', 'North Ayrshire',
  'North Lanarkshire', 'Perth and Kinross', 'Scottish Borders', 'South Ayrshire',
  'South Lanarkshire', 'Stirling', 'West Dunbartonshire', 'Western Isles',
  'Outer Hebrides', 'Na h-Eileanan Siar',
  'Anglesey', 'Brecknockshire', 'Caernarfonshire', 'Cardiganshire',
  'Carmarthenshire', 'Denbighshire', 'Flintshire', 'Glamorgan', 'Merionethshire',
  'Monmouthshire', 'Montgomeryshire', 'Pembrokeshire', 'Radnorshire',
  'Blaenau Gwent', 'Bridgend', 'Caerphilly', 'Ceredigion', 'Conwy', 'Gwynedd',
  'Isle of Anglesey', 'Merthyr Tydfil', 'Neath Port Talbot', 'Newport',
  'Powys', 'Rhondda Cynon Taf', 'Torfaen', 'Vale of Glamorgan', 'Wrexham',
  'County Antrim', 'County Armagh', 'County Down', 'County Fermanagh',
  'County Londonderry', 'County Tyrone', 'Derry'
];

/* --------------------------------------------------------------------------
   NATIONS — a filter, never a preference.
-------------------------------------------------------------------------- */
const NATION_WORDS = {
  england: 'england', english: 'england',
  scotland: 'scotland', scottish: 'scotland', scots: 'scotland',
  wales: 'wales', welsh: 'wales', cymru: 'wales',
  'northern ireland': 'northern ireland', 'northern irish': 'northern ireland',
  irish: 'northern ireland', ulster: 'northern ireland',
};
const NATION_OF = { england: 'England', scotland: 'Scotland', wales: 'Wales', 'northern ireland': 'Northern Ireland' };

/* --------------------------------------------------------------------------
   REGIONS — names that are neither a nation nor a single county.
   Either a set of areas (the gazetteer's county keys), or a circle / box for
   places with no administrative boundary: national parks, islands, the
   historic Scottish and Welsh counties people still use.
-------------------------------------------------------------------------- */
const MIDLANDS_E = ['derbyshire','nottinghamshire','leicestershire','rutland','lincolnshire','northamptonshire'];
const MIDLANDS_W = ['herefordshire','shropshire','staffordshire','warwickshire','west midlands','worcestershire'];
const circle = (lat, lng, km) => ({ centre: [lat, lng], km });
const REGION_DEFS = [
  { names: ['yorkshire', 'yorks', 'god s own county'], areas: ['yorkshire'] },
  { names: ['sussex'], areas: ['sussex'] },
  { names: ['midlands', 'the midlands'], label: 'the Midlands', areas: MIDLANDS_E.concat(MIDLANDS_W) },
  { names: ['east midlands'], label: 'the East Midlands', areas: MIDLANDS_E },
  { names: ['west midlands'], label: 'the West Midlands', areas: MIDLANDS_W },
  { names: ['east anglia'], areas: ['norfolk','suffolk','cambridgeshire'] },
  { names: ['west country', 'south west', 'south west england'], label: 'the West Country',
    areas: ['cornwall','devon','somerset','dorset','wiltshire','gloucestershire','bristol'] },
  { names: ['north east', 'north east england'], label: 'the North East', areas: ['northumberland','tyne and wear','county durham'] },
  { names: ['north west', 'north west england'], label: 'the North West', areas: ['cumbria','lancashire','greater manchester','merseyside','cheshire'] },
  { names: ['south east', 'south east england'], label: 'the South East',
    areas: ['kent','surrey','sussex','hampshire','berkshire','oxfordshire','buckinghamshire','isle of wight'] },
  { names: ['home counties'], label: 'the Home Counties', areas: ['surrey','kent','essex','hertfordshire','buckinghamshire','berkshire'] },
  { names: ['north wales'], areas: ['anglesey','gwynedd','conwy','denbighshire','flintshire','wrexham'] },
  { names: ['south wales'], areas: ['glamorgan','gwent','carmarthenshire'] },
  { names: ['mid wales'], areas: ['powys','ceredigion'] },
  { names: ['west wales'], areas: ['pembrokeshire','carmarthenshire','ceredigion'] },
  { names: ['highlands', 'the highlands', 'scottish highlands', 'highland'], label: 'the Highlands', areas: ['highland'],
    test: b => b.nation === 'Scotland' && b.lat >= 56.55 && b.lng <= -3.0, centre: [57.35, -4.6] },
  { names: ['hebrides', 'the hebrides', 'outer hebrides', 'inner hebrides', 'western isles'], label: 'the Hebrides', areas: ['eilean siar'],
    test: b => b.nation === 'Scotland' && b.lng <= -5.75 && b.lat >= 55.6, centre: [57.6, -6.6] },
  { names: ['cotswolds', 'the cotswolds', 'cotswold'], label: 'the Cotswolds', km0: 35,
    test: b => b.lat >= 51.55 && b.lat <= 52.25 && b.lng >= -2.45 && b.lng <= -1.55, centre: [51.9, -1.95] },
  // National parks and other landscapes: rough circles, generous enough to
  // take in the market towns on their edges.
  { label: 'the Lake District', names: ['lake district', 'the lake district', 'lakes', 'the lakes', 'lakeland'], ...circle(54.47, -3.09, 30) },
  { label: 'the Peak District', names: ['peak district', 'the peak district', 'the peak', 'peaks', 'the peaks'], ...circle(53.33, -1.78, 24) },
  { label: 'the Yorkshire Dales', names: ['yorkshire dales', 'the dales', 'dales'], ...circle(54.25, -2.12, 28) },
  { label: 'the North York Moors', names: ['north york moors'], ...circle(54.38, -0.88, 24) },
  { label: 'the New Forest', names: ['new forest', 'the new forest'], ...circle(50.86, -1.6, 15) },
  { names: ['dartmoor'], ...circle(50.57, -3.92, 18) },
  { names: ['exmoor'], ...circle(51.13, -3.65, 16) },
  { names: ['snowdonia', 'eryri'], ...circle(52.95, -3.88, 30) },
  { label: 'the Brecon Beacons', names: ['brecon beacons', 'bannau brycheiniog', 'the beacons'], ...circle(51.88, -3.43, 25) },
  { label: 'the South Downs', names: ['south downs', 'the south downs'], ...circle(50.93, -0.85, 32) },
  { label: 'the Norfolk Broads', names: ['norfolk broads', 'the broads', 'broads'], ...circle(52.68, 1.55, 18) },
  { label: 'the Cairngorms', names: ['cairngorms', 'the cairngorms'], ...circle(57.08, -3.6, 35) },
  { label: 'Loch Lomond and the Trossachs', names: ['loch lomond', 'trossachs', 'the trossachs'], ...circle(56.15, -4.55, 25) },
  // Islands
  { names: ['isle of skye', 'skye'], ...circle(57.3, -6.2, 35) },
  { names: ['isle of mull', 'mull'], ...circle(56.45, -5.95, 22) },
  { names: ['islay', 'isle of islay'], ...circle(55.78, -6.2, 18) },
  { names: ['isle of arran', 'arran'], ...circle(55.58, -5.23, 13) },
  { names: ['isle of lewis', 'lewis', 'isle of harris', 'harris', 'lewis and harris'], ...circle(58.05, -6.6, 45) },
  { names: ['uist', 'south uist', 'north uist', 'benbecula'], ...circle(57.4, -7.35, 35) },
  // Historic counties with no modern council of their own
  { names: ['caithness'], ...circle(58.45, -3.35, 35) },
  { names: ['sutherland'], ...circle(58.1, -4.4, 45) },
  { names: ['ross shire', 'ross and cromarty', 'easter ross', 'wester ross'], ...circle(57.6, -5.0, 50) },
  { names: ['inverness shire'], ...circle(57.2, -4.8, 60) },
  { names: ['nairnshire', 'nairn'], ...circle(57.55, -3.88, 15) },
  { names: ['banffshire'], ...circle(57.5, -3.0, 25) },
  { names: ['kincardineshire'], ...circle(56.95, -2.4, 20) },
  { names: ['berwickshire'], ...circle(55.75, -2.35, 20) },
  { names: ['roxburghshire'], ...circle(55.45, -2.6, 25) },
  { names: ['selkirkshire'], ...circle(55.5, -3.0, 15) },
  { names: ['peeblesshire'], ...circle(55.65, -3.25, 18) },
  { names: ['kirkcudbrightshire'], ...circle(55.0, -4.1, 30) },
  { names: ['wigtownshire'], ...circle(54.87, -4.7, 25) },
  { names: ['bute', 'isle of bute'], ...circle(55.83, -5.08, 10) },
  { names: ['montgomeryshire'], ...circle(52.6, -3.4, 30) },
  { names: ['radnorshire'], ...circle(52.3, -3.3, 20) },
  { names: ['brecknockshire', 'breconshire'], ...circle(51.95, -3.4, 25) },
];
const REGION_BY_NAME = new Map();
REGION_DEFS.forEach(r => r.names.forEach(n => REGION_BY_NAME.set(n, r)));

// Adjectives people put in front of a product. Resolved to the place so the
// banner reads "in Cornwall", not "in Cornish" — the fix "welsh" already had.
const PLACE_ADJECTIVES = {
  cornish: 'cornwall', kentish: 'kent', cumbrian: 'cumbria', northumbrian: 'northumberland',
  hebridean: 'hebrides', orcadian: 'orkney', shetlander: 'shetland', lakeland: 'lake district',
  londoner: 'london', londoners: 'london', mancunian: 'manchester', glaswegian: 'glasgow',
  liverpudlian: 'liverpool', brummie: 'birmingham', geordie: 'newcastle upon tyne',
  devonian: 'devon', yorks: 'yorkshire', lancs: 'lancashire', glos: 'gloucestershire',
  oxon: 'oxfordshire', hants: 'hampshire', herts: 'hertfordshire', bucks: 'buckinghamshire',
  beds: 'bedfordshire', berks: 'berkshire', notts: 'nottinghamshire', wilts: 'wiltshire',
  worcs: 'worcestershire', northants: 'northamptonshire', staffs: 'staffordshire',
  cambs: 'cambridgeshire', leics: 'leicestershire', lincs: 'lincolnshire', derbys: 'derbyshire',
  salop: 'shropshire', 'co down': 'county down', 'co antrim': 'county antrim',
  'co armagh': 'county armagh', 'co fermanagh': 'county fermanagh',
  'co tyrone': 'county tyrone', 'co londonderry': 'county londonderry', 'co durham': 'county durham',
};

// Places whose names are everyday words. Recognised only after "in", "near",
// "from" and the like, so "sale" is not a town in Greater Manchester and "box"
// is not a village in Wiltshire unless someone says so.
const PLACE_COMMON_WORDS = new Set([
  'ash','banks','barking','battle','beer','bow','box','bray','bridge','castor','cheddar','church',
  'clare','cooling','cove','crook','croft','cults','dale','deal','dollar','eye','fleet','flint',
  'ford','forth','grain','grove','hay','healing','hill','hillside','hoo','hook','hope','law','lea',
  'lee','locking','march','mere','moss','over','pant','par','plains','pool','rake','rock','rode',
  'rye','sale','saline','sandwich','sandy','send','settle','shaw','stock','stone','street','sway',
  'tong','tumble','valley','wall','warden','ware','wick','wing','wool','stilton','normandy',
  'alexandria','houston','melbourne','washington','gotham','orwell','waterloo','down',
  'ham','keith','leslie','logan','douglas',
]);

// Place names that, in front of one particular noun, name a style of product
// rather than a place: Chelsea boots are not from Chelsea, and a search for
// Oxford shoes should not be a search of Oxford.
const PRODUCT_PHRASES = {
  'chelsea boot': 'boots', 'chelsea boots': 'boots',
  'oxford shoe': 'shoes', 'oxford shoes': 'shoes', 'oxford brogues': 'brogues',
  'derby shoe': 'shoes', 'derby shoes': 'shoes', 'derby boots': 'boots',
  'wellington boot': 'boots', 'wellington boots': 'boots',
  'harris tweed': 'tweed', 'fair isle': 'knitwear',
  'double gloucester': 'cheese', 'bakewell tart': 'bread', 'bakewell tarts': 'bread',
  'eccles cake': 'bread', 'eccles cakes': 'bread', 'windsor chair': 'chairs',
};

/* --------------------------------------------------------------------------
   Word lists
-------------------------------------------------------------------------- */
const STOP_WORDS = new Set(['the','a','an','and','or','for','in','on','at','to','of','with',
  'who','sell','sells','selling','make','makes','maker','makers','making','which','what',
  'can','are','is','do','does','find','looking','me','my','i','want','need','buy','british','uk',
  'britain','united','kingdom','great','gb','idea','ideas','day','shop','shops','place','places',
  // "made in wales" is a place, not a product called "made".
  'made','grown','produced','manufactured','crafted','sourced','based','company','companies',
  // Prepositions that introduce a place. Read for their position before this
  // list is applied, so "jumper in Cardigan" is still told from "cardigans".
  'near','nearby','around','close','by','from','nr']);
// "shop" is a stop word only where it adds nothing; "farm shop" is caught as
// a phrase below, before this list is applied.
const KEEP_PHRASES = new Set(['farm shop', 'farm shops']);

// Judgement words. Dropped before anything is scored or echoed back, so
// "sustainable jumper" returns exactly what "jumper" returns: this map has no
// evidence that one business is more ethical than another.
const SUBJECTIVE_WORDS = new Set([
  'nice','good','great','lovely','beautiful','pretty','cool','stylish','smart',
  'best','better','finest','top','favourite','decent','proper','amazing',
  'sustainable','sustainably','ethical','ethically','eco','ecofriendly','conscious',
  'responsible','responsibly','green','planet','friendly','natural',
  'quality','luxury','luxurious','premium','exclusive','artisan','artisanal',
  'affordable','cheap','budget','expensive','value','reasonable',
  'some','any','something','anything','really','very','quite','lots','bit',
]);

// Checkable claims about how something is made. They rank, but never admit.
const QUALIFIER_WORDS = new Set([
  'organic','organics','handmade','handcrafted','handwoven','handstitched','handthrown',
  'traditional','traditionally','heritage','bespoke','custom','vintage','artisanal',
  'small','batch','local','locally','seasonal','free','range','grass','fed','wild',
]);

// Gift intent. Not a product, so never scored: "christmas gifts" used to be
// read as a misspelling of Christys' (a hat maker) and returned one result.
const GIFT_WORDS = new Set([
  'gift','gifts','gifting','present','presents','christmas','xmas','birthday','birthdays',
  'stocking','stockings','filler','fillers','secret','santa','anniversary','valentine',
  'valentines','treat','treats','wedding','presies','pressies',
]);

// Who the garment is for. An audience can only rule a business out.
const AUDIENCE_WORDS = {
  men:'men', mens:'men', man:'men', menswear:'men', gent:'men', gents:'men',
  gentlemen:'men', gentlemens:'men', male:'men', males:'men', him:'men', his:'men',
  dad:'men', dads:'men', father:'men', fathers:'men', husband:'men', boyfriend:'men',
  grandad:'men', grandpa:'men', brother:'men',
  women:'women', womens:'women', woman:'women', womans:'women', womenswear:'women',
  lady:'women', ladies:'women', ladys:'women', female:'women', females:'women',
  her:'women', hers:'women', mum:'women', mums:'women', mother:'women', mothers:'women',
  wife:'women', girlfriend:'women', gran:'women', grandma:'women', nan:'women', sister:'women',
  child:'children', childs:'children', children:'children', childrens:'children',
  childrenswear:'children', kid:'children', kids:'children', kidswear:'children',
  baby:'children', babies:'children', toddler:'children', toddlers:'children',
  infant:'children', infants:'children', boy:'children', boys:'children',
  girl:'children', girls:'children'
};

// Three answers, not two: yes / unknown (not yet classified — shown, but
// below the confirmed) / no (recorded, and the one asked for is not in it).
function audienceVerdict(b, wanted) {
  if (!wanted || !wanted.length) return 'yes';
  const au = Array.isArray(b.audience) ? b.audience : null;
  if (!au || !au.length) return 'unknown';
  return wanted.some(w => au.includes(w)) ? 'yes' : 'no';
}
function byAudience(list, wanted) {
  if (!wanted || !wanted.length) return list;
  const yes = [], unknown = [];
  list.forEach(b => (audienceVerdict(b, wanted) === 'unknown' ? unknown : yes).push(b));
  return yes.concat(unknown);
}

// Spellings people type, mapped to the words the catalogue uses.
const SYNONYMS = {
  wooly:'wool', woolly:'wool', woollen:'wool', woolen:'wool', wollen:'wool',
  jumper:'knitwear', jumpers:'knitwear', sweater:'knitwear', sweaters:'knitwear',
  pullover:'knitwear', cardigan:'knitwear', knit:'knitwear', knitted:'knitwear',
  cashmeres:'cashmere', tweeds:'tweed', linens:'linen',
  pot:'pottery', pots:'pottery', ceramic:'ceramics', crockery:'ceramics',
  mug:'mugs', bowl:'bowls', plate:'plates',
  knife:'knives', cutler:'cutlery', silverware:'cutlery',
  boot:'boots', shoe:'shoes', trainer:'trainers',
  coat:'coats', jacket:'jackets', shirt:'shirts', trouser:'trousers',
  ring:'rings', necklace:'necklaces', earring:'earrings', watches:'watch',
  cheeses:'cheese', veg:'vegetables', vegetable:'vegetables', meats:'meat',
};

// Words for a whole trade. Checked before the catalogue's own words, because
// "food" appears in a single listing's copy and "scottish food" should mean
// the Scottish farm shops, not that one listing.
const TRADE_WORDS = {
  clothes:'clothing', garments:'clothing', garment:'clothing', apparel:'clothing', clobber:'clothing',
  food:'farm', foods:'farm', groceries:'farm', grocery:'farm', produce:'farm',
};

// Words that mean the same thing to a British shopper. Used for scoring only;
// the banner echoes what was typed.
const TERM_GROUPS = [
  ['jumper','jumpers','sweater','sweaters','sweatshirt','sweatshirts','pullover',
   'pullovers','knitwear','knit','knits','knitted','cardigan','cardigans','guernsey','gansey'],
  ['wool','woollen','woolen','wooly','woolly','lambswool','merino','fleece'],
  ['coat','coats','jacket','jackets','outerwear','anorak','parka'],
  ['shoe','shoes','boot','boots','footwear','brogue','brogues'],
  ['bag','bags','satchel','satchels','holdall','rucksack','backpack'],
  ['pot','pots','pottery','ceramic','ceramics','stoneware','earthenware','porcelain'],
  ['mug','mugs','cup','cups','teacup','teacups'],
  ['knife','knives','cutlery','blade','blades'],
  ['pan','pans','cookware','saucepan','skillet'],
  ['hat','hats','cap','caps','headwear','beanie'],
  ['scarf','scarves','shawl','wrap'],
  ['ring','rings','necklace','necklaces','earring','earrings','jewellery','jewelry'],
  ['cheese','cheeses','dairy','creamery'],
  ['veg','vegetable','vegetables','produce','greengrocer']
];
const GROUP_OF = {};
TERM_GROUPS.forEach(g => g.forEach(w => { GROUP_OF[w] = g; }));

// Canonical product tags implied by a query, via the shared lexicon
// (assets/query-expand.js). [] if that file failed to load.
function expandToTags(query) {
  try {
    const api = (typeof window !== 'undefined' ? window : globalThis).BBQueryExpand;
    if (!api || typeof api.expandQuery !== 'function') return [];
    return api.expandQuery(String(query || '')).tags || [];
  } catch (e) {
    return [];
  }
}

/* --------------------------------------------------------------------------
   Vocabularies. Built lazily from BUSINESSES and the gazetteer, and thrown
   away when either changes.
-------------------------------------------------------------------------- */
let SEARCH_VOCAB = null, PRODUCT_VOCAB = null, CORRECTION_VOCAB = null,
    PLACE_VOCAB = null, PLACE_PHRASES = null, CATALOGUE_TOWNS = null;
const TYPED_CACHE = new Map();
function resetSearchCaches() {
  SEARCH_VOCAB = PRODUCT_VOCAB = CORRECTION_VOCAB = PLACE_VOCAB = PLACE_PHRASES = CATALOGUE_TOWNS = null;
  TYPED_CACHE.clear();
}
const catalogue = () => (typeof BUSINESSES !== 'undefined' && Array.isArray(BUSINESSES)) ? BUSINESSES : [];

// Every distinct word the catalogue contains, names included, so a search for
// a maker's own name ("barbour") is always understood.
function buildVocab() {
  if (SEARCH_VOCAB) return SEARCH_VOCAB;
  const words = new Set();
  catalogue().forEach(b => {
    [b.name, b.town, b.category, b.subcategory, b.description, (b.product_tags || []).join(' ')]
      .join(' ').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').split(' ')
      .forEach(w => { if (w.length > 2 && !STOP_WORDS.has(w)) words.add(w); });
  });
  SEARCH_VOCAB = words;
  return words;
}

// Words that name a product: the curated fields only.
function buildProductVocab() {
  if (PRODUCT_VOCAB) return PRODUCT_VOCAB;
  const prods = new Set();
  const add = w => {
    if (w.length < 3) return;
    prods.add(w);
    prods.add(w.endsWith('s') ? w.slice(0, -1) : w + 's');
  };
  catalogue().forEach(b => {
    [b.category, b.subcategory, (b.product_tags || []).join(' ')].join(' ')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').forEach(add);
  });
  ['hat','cap','coat','jacket','jumper','sweater','sock','shirt','boot','shoe','bag',
   'scarf','glove','belt','wallet','mug','bowl','plate','vase','knife','ring','watch',
   'leather','wool','woollen','cashmere','tweed','linen','silver','gold','ceramic',
   'beer','cheddar','stilton','cider','gin','rye','leek','ham','sandwich']
    .forEach(add);
  // A subcategory like "Harris Tweed" or "Sheffield cutlery" must not turn
  // the place in it into a product; the place wins those.
  const places = placeVocabRaw();
  [...prods].forEach(w => { if (places.has(w) && !PLACE_COMMON_WORDS.has(w)) prods.delete(w); });
  ['cardigan', 'cardigans'].forEach(w => prods.add(w));
  PRODUCT_VOCAB = prods;
  return prods;
}

// Words a misspelling may be corrected INTO. Product words, words that recur
// across listings, and places — but not a single business's name, which is
// how "christmas" became "Christys'" and returned one hat maker.
function buildCorrectionVocab() {
  if (CORRECTION_VOCAB) return CORRECTION_VOCAB;
  const counts = new Map();
  catalogue().forEach(b => {
    const seen = new Set();
    [b.category, b.subcategory, (b.product_tags || []).join(' '), b.description].join(' ')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').forEach(w => {
        if (w.length > 2 && !STOP_WORDS.has(w) && !seen.has(w)) { seen.add(w); counts.set(w, (counts.get(w) || 0) + 1); }
      });
  });
  const out = new Set();
  counts.forEach((n, w) => { if (n >= 2) out.add(w); });
  buildProductVocab().forEach(w => out.add(w));
  Object.values(SYNONYMS).forEach(w => out.add(w));
  TERM_GROUPS.forEach(g => g.forEach(w => out.add(w)));
  buildPlaceVocab().forEach(w => { if (w.indexOf(' ') === -1) out.add(w); });
  CORRECTION_VOCAB = out;
  return out;
}

// Towns written in the listings themselves, including villages too small for
// the gazetteer ("Hathersage"). Only the town and county fields: addresses are
// full of "Unit", "Mill" and "Studio".
function catalogueTowns() {
  if (CATALOGUE_TOWNS) return CATALOGUE_TOWNS;
  const m = new Map();
  catalogue().forEach(b => {
    [b.town, b.county].filter(Boolean).forEach(f => {
      String(f).split(/[,(/]/).map(normalisePlace).filter(Boolean).forEach(name => {
        if (!m.has(name)) m.set(name, []);
        m.get(name).push(b);
      });
    });
  });
  CATALOGUE_TOWNS = m;
  return m;
}

// Every place name we know, before the everyday-word filter.
function placeVocabRaw() {
  if (PLACE_VOCAB) return PLACE_VOCAB;
  const places = new Set();
  const add = n => { const k = normalisePlace(n); if (k.length > 2) places.add(k); };
  Object.keys(NATION_WORDS).forEach(add);
  REGION_BY_NAME.forEach((_, n) => add(n));
  Object.keys(PLACE_ADJECTIVES).forEach(add);
  Gazetteer.placeNames().forEach(add);
  Gazetteer.areaNames().forEach(add);
  UK_LARGEST_TOWNS.concat(UK_COUNTY_NAMES).forEach(n => {
    add(n);
    const k = normalisePlace(n);
    if (k.indexOf('county ') === 0) add('co ' + k.slice(7));
  });
  catalogueTowns().forEach((_, n) => add(n));
  // Distinctive parts of the big multi-word names, so "keynes", "tyne" and
  // "stoke" still land. Not for every gazetteer name: "market", "green" and
  // "end" are parts too.
  const STOP_PARTS = new Set(['north','south','east','west','greater','isle','isles','city','county',
    'vale','upon','on','of','and','the','sea','royal','new','old','port','st','mid','central',
    'shire','wear','down','siar','eileanan','under','by','le']);
  UK_LARGEST_TOWNS.concat(UK_COUNTY_NAMES).forEach(n => {
    normalisePlace(n).split(' ').forEach(w => { if (w.length > 3 && !STOP_PARTS.has(w)) places.add(w); });
  });
  PLACE_VOCAB = places;
  return places;
}
function buildPlaceVocab() { return placeVocabRaw(); }

// Is this word (or phrase) a place? Everyday-word places only count when the
// visitor introduced them with a preposition.
function isPlaceWord(t, allowCommon) {
  if (!t) return false;
  if (!allowCommon && PLACE_COMMON_WORDS.has(t)) return false;
  return placeVocabRaw().has(t);
}

// Multi-word names, read as one before the query is split into words.
function buildPlacePhrases() {
  if (PLACE_PHRASES) return PLACE_PHRASES;
  const p = new Set();
  placeVocabRaw().forEach(n => { if (n.indexOf(' ') !== -1) p.add(n); });
  Object.keys(PRODUCT_PHRASES).forEach(n => p.add(n));
  KEEP_PHRASES.forEach(n => p.add(n));
  PLACE_PHRASES = p;
  return p;
}

/* --------------------------------------------------------------------------
   Spelling repair — only ever into CORRECTION_VOCAB.
-------------------------------------------------------------------------- */
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

// Longer words tolerate more error; short ones must be near-exact. The first
// letter must survive: fork/pork, lamp/lamb, wool/tool are different words.
function fuzzyHit(token, vocab) {
  if (vocab.has(token)) return token;
  const budget = token.length >= 7 ? 2 : token.length >= 4 ? 1 : 0;
  if (!budget) return null;
  let best = null, bestD = 99;
  for (const w of vocab) {
    if (Math.abs(w.length - token.length) > budget) continue;
    if (w[0] !== token[0]) continue;
    const d = editDistance(token, w);
    // Ties go to the shorter, commoner-looking word, then alphabetically, so
    // the answer does not depend on the order businesses were added.
    if (d <= budget && (d < bestD || (d === bestD && best && (w.length < best.length || (w.length === best.length && w < best))))) {
      best = w; bestD = d;
    }
  }
  return best;
}

// "wooltrousers" -> ["wool","trousers"]. Both halves must be product words:
// a split that produces a place ("wakefield" -> "ware field") is not a reading
// of what was typed.
function splitJoined(token, vocab) {
  if (token.length < 6) return null;
  const places = placeVocabRaw();
  const ok = w => vocab.has(w) && !places.has(w);
  for (let i = 3; i <= token.length - 3; i++) {
    const left = token.slice(0, i), right = token.slice(i);
    if (ok(left) && ok(right)) return [left, right];
  }
  for (let i = 3; i <= token.length - 3; i++) {
    const left = token.slice(0, i), right = token.slice(i);
    if (ok(left)) { const r = fuzzyHit(right, vocab); if (r && ok(r)) return [left, r]; }
    if (ok(right)) { const l = fuzzyHit(left, vocab); if (l && ok(l)) return [l, right]; }
  }
  return null;
}

// Light stemmer: collapse doubled letters and shave common endings, so
// "woollens" reaches "wool" and "cornwal" reaches "cornwall".
function stem(w) {
  return w.replace(/([a-z])\1+/g, '$1').replace(/(ings|ing|ies|ied|ers|er|ens|en|ed|es|s|y)$/, '');
}
function stemHit(token, vocab) {
  const t = stem(token);
  if (!t || t.length < 3) return null;
  if (vocab.has(t)) return t;
  for (const w of vocab) if (stem(w) === t) return w;
  return null;
}

/* --------------------------------------------------------------------------
   READING THE QUERY
-------------------------------------------------------------------------- */
function normaliseQuery(query) {
  const vocab = buildVocab();
  const fixVocab = buildCorrectionVocab();
  const raw = normalisePlace(query).split(' ').filter(Boolean);
  const terms = [];         // what we score against (widened)
  const display = [];       // what the visitor meant, for the banner
  const typed = new Set();  // only these may name a place
  const audience = [];
  const audienceDisplay = []; // "mens", echoed in front of a product, never scored
  const corrections = [];
  const unknown = [];       // words we could not read, admitted in the banner
  const boost = [];         // "chelsea" in "chelsea boots": ranks, never admits
  let understood = 0, gift = false;

  // Words introduced with "in", "near" and the like are places if they can be.
  const PLACE_PREPS = new Set(['in', 'near', 'around', 'from', 'by', 'at', 'nr']);
  const placePreferred = new Set();
  const markPreferred = (i, value) => { if (i > 0 && PLACE_PREPS.has(raw[i - 1])) placePreferred.add(value); };

  // Phrases first, longest first: "newcastle upon tyne", "north wales",
  // "chelsea boots", "farm shop".
  const phrases = buildPlacePhrases();
  const phraseAt = new Map(), inside = new Set();
  for (let n = 5; n >= 2; n--) {
    for (let i = 0; i + n <= raw.length; i++) {
      let free = true;
      for (let k = i; k < i + n; k++) if (inside.has(k) || phraseAt.has(k)) free = false;
      if (!free) continue;
      const phrase = raw.slice(i, i + n).join(' ');
      if (!phrases.has(phrase)) continue;
      phraseAt.set(i, phrase);
      for (let k = i + 1; k < i + n; k++) inside.add(k);
    }
  }

  const seen = new Set();
  const take = (word, shown) => {
    if (shown && !display.includes(shown)) display.push(shown);
    typed.add(word);
    const group = GROUP_OF[word] || [word];
    group.forEach(g => {
      if (seen.has(g)) return;
      if (g === word || vocab.has(g)) { seen.add(g); terms.push(g); }
    });
  };
  const takePlace = (key, shown, i) => {
    placePreferred.add(key);
    if (!display.includes(shown)) display.push(shown);
    typed.add(key);
    if (!seen.has(key)) { seen.add(key); terms.push(key); }
    understood++;
  };

  raw.forEach((tok, i) => {
    if (inside.has(i)) return;
    if (phraseAt.has(i)) {
      const phrase = phraseAt.get(i);
      if (PRODUCT_PHRASES[phrase]) {
        const noun = PRODUCT_PHRASES[phrase];
        boost.push(phrase.split(' ')[0]);
        take(noun, phrase);
        understood++;
        return;
      }
      if (KEEP_PHRASES.has(phrase)) { take('farm', 'farm shop'); understood++; return; }
      if (NATION_WORDS[phrase]) { takePlace(NATION_WORDS[phrase], NATION_WORDS[phrase], i); return; }
      if (PLACE_ADJECTIVES[phrase]) { takePlace(PLACE_ADJECTIVES[phrase], PLACE_ADJECTIVES[phrase], i); return; }
      takePlace(phrase, phrase, i);
      return;
    }
    if (!tok || tok.length < 2) return;
    if (STOP_WORDS.has(tok)) return;
    if (AUDIENCE_WORDS[tok]) {
      const who = AUDIENCE_WORDS[tok];
      if (!audience.includes(who)) audience.push(who);
      if (!audienceDisplay.includes(tok)) audienceDisplay.push(tok);
      understood++;
      return;
    }
    if (SUBJECTIVE_WORDS.has(tok)) return;
    if (GIFT_WORDS.has(tok)) { gift = true; understood++; return; }
    if (TRADE_WORDS[tok]) { take(TRADE_WORDS[tok], tok); understood++; return; }
    if (NATION_WORDS[tok]) { takePlace(NATION_WORDS[tok], NATION_WORDS[tok], i); return; }
    if (PLACE_ADJECTIVES[tok]) { takePlace(PLACE_ADJECTIVES[tok], PLACE_ADJECTIVES[tok], i); return; }
    // "jumper in Cardigan", "cheese from Sale": the preposition decides.
    if (i > 0 && PLACE_PREPS.has(raw[i - 1]) && isPlaceWord(tok, true)) { takePlace(tok, tok, i); return; }
    if (vocab.has(tok)) { take(tok, tok); understood++; return; }
    // The shared lexicon knows real product words the catalogue never spells
    // ("fork", "sausages"); those are never corrected into something else.
    if (expandToTags(tok).length) { take(tok, tok); understood++; return; }
    // A place is a place, before any repair step gets to treat it as a
    // misspelt product. That ordering is the whole Wakefield/Chelmsford fix.
    if (isPlaceWord(tok)) { take(tok, tok); understood++; return; }
    const syn = SYNONYMS[tok];
    if (syn) { take(syn, tok); understood++; return; }
    const split = splitJoined(tok, fixVocab);
    if (split) {
      if (split.join('') !== tok) corrections.push({ from: tok, to: split.join(' ') });
      split.forEach(p => take(p, p));
      understood++;
      return;
    }
    // The stemmer only reaches the same word typed sloppily ("cornwal"), so
    // it is not announced; the banner shows the word it landed on.
    const stemmed = stemHit(tok, fixVocab);
    if (stemmed) { take(stemmed, isPlaceWord(stemmed) ? stemmed : tok); understood++; return; }
    const near = fuzzyHit(tok, fixVocab);
    if (near) {
      if (near !== tok) { corrections.push({ from: tok, to: near }); take(near, null); }
      else take(near, tok);
      understood++;
      return;
    }
    unknown.push(tok);
    take(tok, tok); // searched on, but admitted as not understood
  });

  const tags = expandToTags(query);
  if (tags.length) understood++;

  return { terms, understood, display, tags, typed, placePreferred, corrections, audience,
           audienceDisplay, unknown, gift, boost };
}

// Product or place? A word that names a product wins even if a town shares
// it (people search for cardigans far more than for Cardigan), unless the
// visitor put "in" in front of it. Words only there because a synonym group
// widened them can never be places.
function classifyTerms(terms, typed, placePreferred) {
  const prods = buildProductVocab();
  const product = [], place = [];
  terms.forEach(t => {
    if (placePreferred && placePreferred.has(t) && isPlaceWord(t, true)) { place.push(t); return; }
    if (prods.has(t) || expandToTags(t).length) product.push(t);
    else if (isPlaceWord(t) && (!typed || typed.has(t))) place.push(t);
    else product.push(t);
  });
  return { product, place };
}

/* --------------------------------------------------------------------------
   PLACES — from a word to a test and a centre.
-------------------------------------------------------------------------- */
function mentions(b, key) {
  return hasPlaceWord([b.town, b.address, b.county].filter(Boolean).join(' '), key);
}

// Is this business in this county/area? Its own county field decides when it
// names an area we know ("Co. Armagh" is Armagh, whatever district the pin's
// nearest town sits in); otherwise the pin does, through the gazetteer.
function ownArea(b) {
  if (!b.county) return null;
  let k = normalisePlace(b.county);
  k = PLACE_ADJECTIVES[k] || k;
  return Gazetteer.area(k) ? k : null;
}
function inArea(b, key) {
  if (mentions(b, key)) return true;
  const own = ownArea(b);
  if (own) {
    if (own === key || Gazetteer.parentsOf(own).indexOf(key) !== -1) return true;
    // "West Yorkshire" cannot say whether a business is in Wakefield, which is
    // inside it; only the pin can. Any other named county is a firm no.
    if (Gazetteer.parentsOf(key).indexOf(own) === -1) return false;
  }
  const near = Gazetteer.areasOf(b);
  return !!(near && near.has(key));
}
function meanOf(list) {
  const pts = list.filter(b => typeof b.lat === 'number');
  if (!pts.length) return null;
  return [pts.reduce((s, b) => s + b.lat, 0) / pts.length, pts.reduce((s, b) => s + b.lng, 0) / pts.length];
}
// How far from a town's pin still counts as "in" it. Deliberately tight: the
// nearest-first ordering after it is what serves the rest of the area.
function townRadiusKm(pop) {
  return pop >= 1000000 ? 15 : pop >= 250000 ? 7 : pop >= 100000 ? 5 : pop >= 25000 ? 4 : 3;
}

function resolvePlace(term, label) {
  const key = normalisePlace(term);
  const shown = label || titleCasePlace(key);
  if (NATION_OF[key]) {
    const n = NATION_OF[key];
    return { key, label: n, kind: 'nation', strict: true, centre: null, test: b => b.nation === n, distance: () => 0 };
  }
  const nearestOf = pts => b => {
    if (typeof b.lat !== 'number' || !pts.length) return Infinity;
    let d = Infinity;
    for (const p of pts) { const k = kmBetween(b.lat, b.lng, p[0], p[1]); if (k < d) d = k; }
    return d;
  };
  const region = REGION_BY_NAME.get(key);
  if (region) {
    const areas = region.areas || [];
    let centre = region.centre || null;
    if (!centre && areas.length) {
      const cs = areas.map(a => Gazetteer.area(a)).filter(Boolean);
      if (cs.length) centre = [cs.reduce((s, a) => s + a[1], 0) / cs.length, cs.reduce((s, a) => s + a[2], 0) / cs.length];
    }
    const test = b => {
      if (region.km && typeof b.lat === 'number' && kmBetween(b.lat, b.lng, region.centre[0], region.centre[1]) <= region.km) return true;
      if (region.test && region.test(b)) return true;
      if (areas.length && areas.some(a => inArea(b, a))) return true;
      return region.names.some(n => n.length > 4 && mentions(b, n));
    };
    if (!centre) centre = meanOf(catalogue().filter(test));
    // Distance to the region: to its edge where we know one (the nearest town
    // inside it, or the rim of its circle), otherwise to its middle.
    const pts = [].concat(...areas.map(a => Gazetteer.membersOf(a)));
    const toEdge = pts.length ? nearestOf(pts) : null;
    const distance = b => {
      if (typeof b.lat !== 'number') return Infinity;
      if (region.km) return Math.max(0, kmBetween(b.lat, b.lng, region.centre[0], region.centre[1]) - region.km);
      if (toEdge) return toEdge(b);
      return centre ? Math.max(0, kmBetween(b.lat, b.lng, centre[0], centre[1]) - (region.km0 || 0)) : Infinity;
    };
    return { key, label: region.label || shown, kind: 'region', strict: false, centre, test, distance };
  }
  const area = Gazetteer.area(key);
  if (area) {
    const test = b => inArea(b, key);
    return { key, label: shown, kind: 'area', strict: false, centre: [area[1], area[2]], test,
             distance: nearestOf(Gazetteer.membersOf(key)) };
  }
  const town = Gazetteer.place(key);
  if (town) {
    const r = townRadiusKm(town[3]);
    const test = b => (typeof b.lat === 'number' && kmBetween(b.lat, b.lng, town[1], town[2]) <= r) || mentions(b, key);
    return { key, label: shown, kind: 'town', strict: false, centre: [town[1], town[2]], test,
             distance: b => typeof b.lat === 'number' ? kmBetween(b.lat, b.lng, town[1], town[2]) : Infinity };
  }
  // A village only the listings know about, or a county name before the
  // gazetteer has loaded: matched on the words, centred on who matches.
  const test = b => mentions(b, key);
  const here = catalogue().filter(test);
  return { key, label: shown, kind: 'named', strict: false, centre: meanOf(here), test,
           distance: nearestOf(here.filter(b => typeof b.lat === 'number').map(b => [b.lat, b.lng])) };
}

function resolvePlaces(keys, labels) {
  const out = [], seen = new Set();
  (keys || []).forEach((k, i) => {
    const p = resolvePlace(k, labels && labels[i]);
    if (!seen.has(p.key)) { seen.add(p.key); out.push(p); }
  });
  return out;
}

// Is this business in any of the places? Kept for callers that only need a yes.
function matchesPlace(b, places) {
  return (places || []).some(p => p.test(b));
}

/* The one function that decides what is "in the place" and what is further
   afield. The banner's count and the grid's divider both come from here.
     - a nation filters: anything outside it is dropped
     - other places partition: in-place first, in the order given
     - then everything else, nearest first where the place has a centre */
function arrangeByPlace(list, places) {
  places = places || [];
  if (!places.length) return { near: list, afield: [], nearest: false, strict: false };
  const nations = places.filter(p => p.strict), others = places.filter(p => !p.strict);
  const pool = nations.length ? list.filter(b => nations.some(p => p.test(b))) : list;
  if (!others.length) return { near: pool, afield: [], nearest: false, strict: nations.length > 0 };
  const near = [], afield = [];
  pool.forEach(b => (others.some(p => p.test(b)) ? near : afield).push(b));
  const measured = others.filter(p => p.distance);
  if (measured.length) {
    const dist = new Map(afield.map(b => [b.id, Math.min(...measured.map(p => p.distance(b)))]));
    afield.sort((x, y) => dist.get(x.id) - dist.get(y.id));
  }
  return { near, afield, nearest: measured.length > 0, strict: nations.length > 0 };
}

// Roughly how many miles outside the named place a business is, for the
// "further afield" cards. Null inside it, and for nations.
function milesFrom(b, places) {
  const others = (places || []).filter(p => !p.strict && p.distance);
  if (!others.length || others.some(p => p.test(b))) return null;
  const km = Math.min(...others.map(p => p.distance(b)));
  return isFinite(km) ? km / 1.609 : null;
}

/* --------------------------------------------------------------------------
   LOCAL SEARCH — exhaustive, in the browser. Used on its own when the AI is
   unavailable, and alongside it every time to supply places and recall.
-------------------------------------------------------------------------- */
const MAX_RESULTS = 40;

function localSearch(query) {
  const q = normaliseQuery(query);
  const queryTags = q.tags || [];
  const { product, place } = classifyTerms(q.terms, q.typed, q.placePreferred);
  const shown = classifyTerms(q.display, q.typed, q.placePreferred);
  const places = resolvePlaces(place);
  const empty = { matches: [], terms: q.terms, understood: q.understood, product: [], place: [], places: [],
                  inPlace: 0, nearest: false, strict: false, productDisplay: [], placeDisplay: [],
                  corrections: q.corrections, audience: q.audience, unknown: q.unknown, gift: q.gift };
  if ((!q.terms.length || !q.understood) && !queryTags.length && !q.audience.length && !q.gift) return empty;

  const qualifiers = product.filter(t => QUALIFIER_WORDS.has(t));
  const core = product.filter(t => !QUALIFIER_WORDS.has(t));
  const coreTerms = core.length ? core : product;
  const boostTerms = (core.length ? qualifiers : []).concat(q.boost || []);

  const scored = catalogue().map(b => {
    const tags = (b.product_tags || []).join(' ');
    const kind = [b.category, b.subcategory].join(' ');
    const name = b.name || '', desc = b.description || '';
    let productScore = 0, qualScore = 0;
    const ownTags = (b.product_tags || []).map(t => String(t).toLowerCase());
    queryTags.forEach(t => { if (ownTags.indexOf(t) !== -1) productScore += 14; });
    coreTerms.forEach(t => {
      if (hasWord(tags, t)) productScore += 12;
      if (hasWord(kind, t)) productScore += 8;
      if (hasWord(name, t)) productScore += 6;
      if (hasWord(desc, t)) productScore += 4;
    });
    boostTerms.forEach(t => {
      if (hasWord(tags, t) || hasWord(kind, t)) qualScore += 6;
      else if (hasWord(name, t) || hasWord(desc, t)) qualScore += 4;
    });
    return { b, productScore, qualScore };
  });

  // The product decides who is eligible. With no product (a place on its
  // own, "christmas gifts", "womenswear") everyone is.
  const hasProduct = coreTerms.length > 0 || queryTags.length > 0;
  let eligible = (hasProduct ? scored.filter(s => s.productScore > 0) : scored)
    .filter(s => audienceVerdict(s.b, q.audience) !== 'no');

  const rank = s => s.productScore * 3 + s.qualScore;
  if (hasProduct) {
    eligible.sort((x, y) => rank(y) - rank(x) || x.b.name.localeCompare(y.b.name));
  } else if (q.gift) {
    // Gifts: a spread across the trades rather than forty of one. Makers
    // before farm shops, each trade in a stable shuffled order.
    const byCat = new Map();
    eligible.slice().sort((x, y) => idHash(x.b.id) - idHash(y.b.id)).forEach(s => {
      if (!byCat.has(s.b.category)) byCat.set(s.b.category, []);
      byCat.get(s.b.category).push(s);
    });
    const cats = ['clothing', 'ceramics', 'jewellery', 'cutlery', 'farm'].filter(c => byCat.has(c));
    const spread = [];
    for (let i = 0; spread.length < eligible.length; i++) {
      let any = false;
      cats.forEach(c => { const s = byCat.get(c)[i]; if (s) { spread.push(s); any = true; } });
      if (!any) break;
    }
    eligible = spread;
  } else {
    eligible.sort((x, y) => idHash(x.b.id) - idHash(y.b.id));
  }

  let list = eligible.map(s => s.b);
  const arranged = arrangeByPlace(list, places);
  let near = arranged.near;
  // With no product to rank on, "in the place" is best read nearest first too.
  const mid = (places.find(p => !p.strict && p.centre) || {}).centre;
  if (!hasProduct && !q.gift && mid) {
    near = near.slice().sort((x, y) => kmBetween(x.lat, x.lng, mid[0], mid[1]) - kmBetween(y.lat, y.lng, mid[0], mid[1]));
  }
  // For a gift search the audience only rules makers out: ranking confirmed
  // menswear first would turn "present for dad" into forty clothing shops.
  const rankBy = q.gift && !hasProduct ? [] : q.audience;
  near = byAudience(near, rankBy);
  const afield = arranged.nearest ? arranged.afield : byAudience(arranged.afield, rankBy);
  const matches = near.concat(afield).slice(0, MAX_RESULTS);

  return {
    matches, terms: q.terms, understood: q.understood, product, place, places,
    corrections: q.corrections, audience: q.audience, audienceRank: rankBy.length > 0,
    unknown: q.unknown, gift: q.gift && !hasProduct,
    // "mens jackets" reads back as "mens jackets"; "for dad" on its own, with
    // no product, is not a product to echo.
    productDisplay: shown.product.length ? q.audienceDisplay.concat(shown.product) : [],
    placeDisplay: shown.place,
    inPlace: Math.min(near.length, matches.length),
    nearest: arranged.nearest, strict: arranged.strict,
  };
}

// Translate a local result into what buildHeadline expects, so both engines
// word their results the same way.
function localHeadlineData(local) {
  const grownWords = /\b(farm|food|produce|veg|fruit|meat|beef|lamb|pork|dairy|cheese|milk|egg|honey|flour|grain|bread)\b/i;
  const looksGrown = local.matches.length
    ? local.matches.filter(b => b.category === 'farm').length > local.matches.length / 2
    : grownWords.test(local.product.join(' '));
  const prodWords = local.productDisplay && local.productDisplay.length ? local.productDisplay : local.product;
  const labels = (local.places || []).map(p => p.label);
  return {
    productTerm: prodWords.length ? prodWords.join(' ') : null,
    // The places as we understood them ("Cornwall" for "cornish"), never a
    // widened synonym: if they did not type a place, there is no place.
    locationTerm: labels.length ? labels.join(' and ') : null,
    madeOrGrown: looksGrown ? 'grown' : 'made',
    matchQuality: headlineQuality(local.places, local.inPlace, local.matches.length),
    inPlace: local.inPlace,
    nearest: local.nearest,
    strict: local.strict,
    gift: local.gift,
    unknown: local.unknown || [],
    corrections: local.corrections || [],
    matches: local.matches
  };
}

// exact: everything shown is in the place (or no place was named)
// partial: some in the place, then others
// wider: none in the place
function headlineQuality(places, inPlace, total) {
  const others = (places || []).filter(p => !p.strict);
  if (!others.length) return 'exact';
  if (!inPlace) return 'wider';
  return inPlace < total ? 'partial' : 'exact';
}

/* --------------------------------------------------------------------------
   THE BANNER — honest about how good the match is.
-------------------------------------------------------------------------- */
function buildHeadline(result) {
  const esc = t => String(t).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const quality = (result && result.matchQuality) || 'exact';
  const verb = (result && result.madeOrGrown === 'grown') ? 'grown' : 'made';
  const product = result && result.productTerm ? esc(result.productTerm) : '';
  // Labels come already cased ("the Lake District", "Stoke on Trent").
  const place = result && result.locationTerm ? esc(result.locationTerm) : '';
  const none = !result || !result.matches || result.matches.length === 0;
  const nearest = !!(result && result.nearest);
  const gift = !!(result && result.gift) && !product;
  const what = product ? `British ${verb} ${product}` : gift ? 'gift ideas' : 'British makers and growers';
  const What = product ? what : gift ? 'Gift ideas from British makers' : 'British makers and growers';

  // Declared, not applied quietly: Darlington and Dartington are one letter
  // and 350 miles apart.
  const fixes = (result && result.corrections) || [];
  let prefix = '';
  if (fixes.length && !none) {
    const from = fixes.map(c => esc(titleCasePlace(c.from))).join(', ');
    const to = fixes.map(c => esc(titleCasePlace(c.to))).join(', ');
    if (quality === 'exact' && !place) return `No results for <b>${from}</b> &mdash; showing results for <b>${to}</b> instead.`;
    prefix = `No results for <b>${from}</b>, showing <b>${to}</b> instead. `;
  }
  // A word we could not read is admitted, not silently searched on.
  const unknown = (result && result.unknown) || [];
  if (unknown.length && !none) {
    prefix += `We didn&rsquo;t recognise &ldquo;${esc(unknown.join(' '))}&rdquo;. `;
  }

  if (none) {
    if (product && place) return `We couldn&rsquo;t find any British ${verb} ${product} in ${place} just yet.`;
    if (product) return `We couldn&rsquo;t find any British ${verb} ${product} just yet.`;
    if (place) return `We don&rsquo;t have anyone in ${place} just yet.`;
    return 'We couldn&rsquo;t find a good match for that just yet.';
  }
  if (place && quality === 'exact') return prefix + `${What} in ${place}`;
  if (place && quality === 'partial') {
    const n = result.inPlace || 0;
    const then = nearest ? 'then the nearest others.' : 'then others further afield.';
    return prefix + `${n} match${n === 1 ? '' : 'es'} for ${what} in ${place} below, ${then}`;
  }
  if (place) {
    return prefix + (nearest
      ? `Nothing in ${place} yet for ${what}, so here are the nearest.`
      : `We couldn&rsquo;t find ${what} in ${place}, but think you&rsquo;ll love these a bit further afield.`);
  }
  if (quality === 'loose' && product) {
    return prefix + `We couldn&rsquo;t find an exact match for British ${verb} ${product}, but think you&rsquo;ll love these.`;
  }
  if (gift) return prefix + 'Gift ideas from British makers';
  return prefix + 'Here are some UK businesses we think you&rsquo;ll love';
}

/* --------------------------------------------------------------------------
   AS-YOU-TYPE FILTER — cheap and literal, so the list follows the keyboard.
   Every word typed must start a word somewhere in the listing. Enter runs the
   full search above.
-------------------------------------------------------------------------- */
function typedMatch(b, q) {
  const parts = normalisePlace(q).split(' ').filter(Boolean);
  if (!parts.length) return true;
  let words = TYPED_CACHE.get(b.id);
  if (!words) {
    words = normalisePlace([b.name, b.town, b.county, b.address, b.subcategory, b.category,
      (b.product_tags || []).join(' '), b.description].filter(Boolean).join(' ')).split(' ');
    TYPED_CACHE.set(b.id, words);
  }
  return parts.every(p => words.some(w => w.startsWith(p)));
}
