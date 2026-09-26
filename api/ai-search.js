// GENERATED FILE — do not edit by hand.
// Rebuild with: node scripts/update-search-api.js
// The lexicon below is serialised from scripts/lib/product-vocab.js, the
// expander is copied verbatim from scripts/lib/query-expand.js and the handler
// from scripts/templates/ai-search.handler.js. Edit those.
// The business catalogue is NOT in this file: it is read from
// data/businesses.json when the function starts.
const QUERY_LEXICON = {"version":7,"vocab":[["mugs","\\b(mug|beaker)s?\\b","i","ceramics"],["bowls","\\b(bowls?|dish(es)?)\\b","i","ceramics"],["plates","\\b(plate|platter|charger)s?\\b","i","ceramics"],["tableware","\\b(tableware|dinner ?sets?|teapots?|jugs?|cup and saucer)\\b","i","ceramics"],["pottery","\\b(pottery|ceramic|stoneware|porcelain|earthenware)","i","ceramics"],["vases","\\b(vase|urn)s?\\b","i","ceramics"],["tins & storage","\\b(storage tin|bread bin|caddy|canister)s?\\b","i","homeware"],["candles & holders","\\b(candle|candlestick|candle ?holder)s?\\b","i","homeware"],["cushions & throws","\\b(cushion|throw pillow)s?\\b","i","textiles"],["flowerpots","\\b(flower ?pot|planter|garden pot|terracotta pot)s?\\b","i","garden"],["knitwear","\\b(jumper|sweater|knitwear|cardigan|pullover|knit)s?\\b","i","clothing"],["cashmere & merino","\\b(cashmere|merino|lambswool)\\b","i","clothing"],["vests & waistcoats","\\b(waistcoat|gilet|body ?warmer|vest)s?\\b","i","clothing"],["coats & jackets","\\b(coat|jacket|parka|anorak|mac|smock)s?\\b","i","clothing"],["shirts","\\b(shirt)s?\\b","i","clothing"],["suits & trousers","\\b(suit|trouser|chino|blazer)s?\\b","i","clothing"],["jeans & denim","\\b(jean|denim)s?\\b","i","clothing"],["socks","\\b(sock|hosiery)s?\\b","i","clothing"],["underwear & nightwear","\\b(boxer|underwear|pyjama|nightwear|loungewear|dressing gown|brief)s?\\b","i","clothing"],["activewear","\\b(activewear|sportswear|base ?layer|legging)s?\\b","i","clothing"],["dresses","\\b(dress(?!ing\\b|\\s*stud|\\s*shirt)(es)?\\b|frock|ball ?gown|wedding gown)","i","clothing"],["womenswear","\\b(womens?|women's|ladies'?|blouses?|skirts?)\\b","i","clothing"],["childrenswear","\\b(child(ren)?s?wear|kids ?wear|babygrows?|rompers?|toddler|infant)\\b|\\bbaby(?! ?(leaf|leaves|potato|carrot|corn|beet|spinach|kale|gem|plum|new))","i","clothing"],["workwear & aprons","\\b(apron|workwear|overall|dungaree|boiler ?suit)s?\\b","i","clothing"],["tweed & woven goods","\\b(tweed|tartan|blanket|throw|woven|cloth by the metre)s?\\b","i","textiles"],["hats & caps","\\b(hat|cap|beanie|beret)s?\\b","i","accessories"],["scarves & accessories","\\b(scarf|scarves|shawl|glove|mitten|tie|pocket ?square|wrap)s?\\b","i","accessories"],["braces & belts","\\b(brace|belt|suspender)s?\\b","i","accessories"],["umbrellas","\\b(umbrella)s?\\b","i","accessories"],["glasses","\\b(glasses|sunglasses|eyeglasses|spectacles|eyewear|optical frames?|reading glasses)\\b","i","accessories"],["bags & leather goods","\\b(bag|satchel|rucksack|backpack|holdall|wallet|purse|luggage)s?\\b","i","bags"],["footwear & boots","\\b(shoe|boot|slipper|sandal|trainer|sneaker|loafer|brogue)s?\\b","i","footwear"],["jewellery","\\b(ring|necklace|pendant|earring|bracelet|brooch|jewel)","i","jewellery"],["cufflinks & signets","\\b(cufflink|signet)s?\\b","i","jewellery"],["silverware","\\b(silverware|sterling silver|hallmark)","i","silverware"],["watches","\\b(watch|chronometer|timepiece)(es)?\\b","i","watches"],["cutlery & knives","\\b(knife|knive|cutlery|blade|cleaver|fork|spoon|flatware|canteen of cutlery)s?\\b","i","cutlery"],["cookware","\\b(pan|skillet|casserole|stockpot|frying ?pan|wok)s?\\b","i","cookware"],["boards & blocks","\\b(chopping ?board|serving ?board|knife ?block)s?\\b","i","cookware"],["pet accessories","\\b(dog|puppy|pet|cat)s?'?s? ?(bowl|bed|collar|lead|leash|coat|jumper|rug|blanket|bandana|bow ?tie|toy|treat|food|accessor(y|ie))s?\\b","i","pet"],["drinks & spirits","\\b(gin|whisky|whiskey|beer|ale|cider|wine|rum|vodka|liqueur)s?\\b","i","drink"],["bread & bakery","\\b(bread|loaf|loaves|cake|pastry|pastries|bakery|scone)s?\\b","i","food"],["dairy & cheese","\\b(cheese|butter|milk|yoghurt)s?\\b","i","food"],["beef","\\b(beef|brisket|sirloin|ribeye|rib-eye)\\b","i","food"],["lamb","\\b(lamb|mutton|hogget)\\b","i","food"],["pork & bacon","\\b(pork|bacon|sausage|gammon|ham)s?\\b","i","food"],["poultry","\\b(chicken|turkey|duck|goose|poultry)s?\\b","i","food"],["game & venison","\\b(venison|game|pheasant|partridge|rabbit)s?\\b","i","food"],["fruit & veg","\\b(vegetable|veg box|fruit|potato|apple|salad)(e?s)?\\b","i","food"],["eggs","\\b(egg)s?\\b","i","food"],["preserves & honey","\\b(jam|marmalade|chutney|preserve|honey)s?\\b","i","food"],["flour & grain","\\b(flours?|grains?|spelt|wholemeal|porridge oats|rolled oats|pearl barley)\\b","i","food"]],"extra":[["pork & bacon","\\b(banger|chipolata|salami|chorizo|charcuterie|cured meat|pancetta|prosciutto|pig|hog roast|pork pie|scratching)s?\\b","i","food"],["beef","\\b(steak|mince|burger|joint of beef|topside|silverside|braising steak|ox ?tail|bone broth|cow|cattle|bullock)s?\\b","i","food"],["lamb","\\b(chop|shank|sheep|ewe|shoulder of lamb)s?\\b","i","food"],["poultry","\\b(free ?range chicken|christmas turkey|bird|drumstick|thigh|wing)s?\\b","i","food"],["game & venison","\\b(wild meat|grouse|woodcock|hare|wild boar)s?\\b","i","food"],["pork & bacon","\\b(butcher|butchery|butchers'?)\\b","i","food"],["fruit & veg","\\b(spud|tattie|greens|veggie|veg|produce|seasonal veg|root veg|leek|carrot|onion|cabbage|kale|tomato|strawberr|raspberr|asparagus|pumpkin|squash|sprout|bean|pea|beetroot|parsnip|rhubarb|plum|pear|cherr|berr)(y|ies|e?s)?\\b","i","food"],["fruit & veg","\\b(p\\.?y\\.?o\\.?|pick your own|pick-your-own|greengrocer|market garden)\\b","i","food"],["dairy & cheese","\\b(raw milk|milk vending|milk station|cheddar|brie|stilton|wensleydale|cheesemonger|creamery|dairy|cream|ice ?cream|kefir|curd)s?\\b","i","food"],["bread & bakery","\\b(sourdough|baker|bakehouse|bun|roll|pie|tart|croissant|doughnut|donut|biscuit|shortbread|flapjack|brownie|crumpet)s?\\b","i","food"],["eggs","\\b(free ?range egg|duck egg|egg box|dozen eggs)s?\\b","i","food"],["preserves & honey","\\b(pickle|relish|conserve|curd|marmite|beeswax|beekeep|apiar)(y|ies|e?s)?\\b","i","food"],["flour & grain","\\b(oat|oatmeal|porridge|granola|muesli|rye|mill|milled|stoneground|stone ?ground|pasta|rice|lentil|pulse)s?\\b","i","food"],["dairy & cheese","\\b(deli|delicatessen|farm ?shop|food hall|farm ?gate|farmers'? market)\\b","i","food"],["drinks & spirits","\\b(perry|mead|cordial|juice|squash drink|lager|stout|bitter|real ale|craft beer|brewer|brewery|distiller|distillery|cider ?press|orchard|vineyard|kombucha|tonic)(y|ies|e?s)?\\b","i","drink"],["knitwear","\\b(knitted|knitting|hand ?knit|woolly|woollen|wool jumper|aran|fair ?isle|guernsey|gansey)s?\\b","i","clothing"],["bags & leather goods","\\b(glasses case|spectacle case|phone case|pencil case|wash ?bag|dopp kit|card holder|key ?fob)s?\\b","i","bags"],["footwear & boots","\\b(wellie|wellington|welly|footwear|cobbler|shoemaker)s?\\b","i","footwear"],["cutlery & knives","\\b(cutler|penknife|pocket ?knife|chef'?s knife|kitchen knife|sharpen)(y|ies|e?s)?\\b","i","cutlery"],["bags & leather goods","\\b(leather ?goods|leatherwork|saddler|tote)s?\\b","i","bags"],["jewellery","\\b(engagement|wedding band|goldsmith|silversmith|jeweller)s?\\b","i","jewellery"],["pottery","\\b(potter|kiln|thrown|wheel ?thrown|studio pottery)s?\\b","i","ceramics"],["pet accessories","\\b(dog(?! ?tooth)|dogs|puppy|puppies|pet|pets|kennel|dog ?walking)s?\\b","i","pet"]],"objectNouns":["tin","bin","jar","knife","knives","board","bowl","dish","plate","platter","mug","cup","saucer","jug","pot","stand","dome","cloth","towel","napkin","apron","sock","shirt","t-shirt","tee","jumper","sweater","hat","cap","bag","cushion","throw","blanket","print","card","candle","soap","tray","coaster","spoon","fork","server","slice","tester","holder","cover","case","pouch","sleeve","chain","cord","strap","stand","lanyard","loop","scarf","tie","ring","necklace","earring","charm","pendant","brooch"],"motifProne":["drinks & spirits","bread & bakery","dairy & cheese","beef","lamb","pork & bacon","poultry","game & venison","fruit & veg","eggs","preserves & honey","flour & grain","glasses"],"groupCategories":{"clothing":["clothing"],"textiles":["clothing"],"accessories":["clothing"],"footwear":["clothing"],"bags":["clothing"],"pet":["clothing","ceramics","farm"],"ceramics":["ceramics"],"homeware":["ceramics","cutlery"],"garden":["ceramics"],"jewellery":["jewellery"],"watches":["jewellery"],"silverware":["jewellery"],"cutlery":["cutlery"],"cookware":["cutlery"],"food":["farm"],"drink":["farm"]},"foodTags":["drinks & spirits","bread & bakery","dairy & cheese","beef","lamb","pork & bacon","poultry","game & venison","fruit & veg","eggs","preserves & honey","flour & grain"]};

/**
 * Query expansion and candidate scoring.
 *
 * ---------------------------------------------------------------------------
 * IMPORTANT: the whole of this file is inlined verbatim into api/ai-search.js
 * by scripts/update-search-api.js. It must stay dependency-free and must not
 * reference anything outside the `lexicon` object handed to it. Everything
 * below the EXPORTS marker is stripped during that copy.
 * ---------------------------------------------------------------------------
 *
 * Why this exists
 *
 * The tagging side has always had a careful vocabulary: `sausage` is a
 * `pork & bacon` product, `cider` is `drinks & spirits`. The search side had
 * none. It compared the user's words against the tag LABELS, so a search for
 * "sausages" never met the tag "pork & bacon" and scored zero — the query then
 * fell through to a padded shortlist of whatever sat first in the file, and the
 * model quite reasonably reported no results.
 *
 * So: run the query through the same lexicon that produced the tags, and match
 * canonical tag against canonical tag.
 *
 * Three deliberate differences from tagging:
 *
 *   1. NO NOISE STRIPPING. NOISE exists because "Whiskey Nubuck" is a colour
 *      and "Honey Cream" is a polish — problems that only arise in a shop's own
 *      product titles. A person who types "honey" means honey. Stripping the
 *      query would delete the search term.
 *
 *   2. HEAD-NOUN SUPPRESSION IS KEPT. "cake tin" is still a tin when someone
 *      searches for it, so the modifier rule earns its place on both sides.
 *
 *   3. QUERY_EXTRA IS ADDED. Kitchen-table words ("bangers", "spuds", "a joint
 *      of beef") never appear in a product feed, so they must not influence
 *      tagging — but they are exactly what people type.
 */

function createQueryExpander(lexicon) {
  const build = ([tag, source, flags, group]) => [tag, new RegExp(source, flags), group];
  const VOCAB = lexicon.vocab.map(build);
  const EXTRA = lexicon.extra.map(build);
  const ALL = VOCAB.concat(EXTRA);
  const MOTIF_PRONE = new Set(lexicon.motifProne);
  const FOOD_TAGS = new Set(lexicon.foodTags);
  const GROUP_CATEGORIES = lexicon.groupCategories;
  const TAG_GROUP = new Map(ALL.map(([tag, , group]) => [tag, group]));
  const OBJECT_AFTER = new RegExp('\\b(?:' + lexicon.objectNouns.join('|') + ')s?\\b', 'i');

  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'for', 'in', 'on', 'at', 'to', 'of', 'with',
    'who', 'sell', 'sells', 'selling', 'sold', 'buy', 'buying', 'make', 'makes',
    'maker', 'makers', 'making', 'made', 'which', 'what', 'where', 'can', 'are',
    'is', 'do', 'does', 'find', 'looking', 'near', 'me', 'my',
    // "english" is NOT here: it names a nation, and "english cheese" must
    // only ever mean cheese from England (22 Sep 2026).
    'any', 'some', 'from', 'british', 'britain', 'uk', 'local',

    // Judgement words. Scoring on these would mean the map deciding which
    // businesses are more sustainable, more ethical or nicer than the others,
    // which it has no evidence for. "sustainable" appears in enough
    // descriptions to be a real search term, so it was quietly ranking on
    // whose marketing copy used the word. "sustainable jumper" must return
    // exactly what "jumper" returns.
    //
    // Not here, deliberately: "organic", "handmade", "traditional",
    // "heritage" — checkable claims about how something is made, not opinions
    // about whether it is good.
    'nice', 'good', 'great', 'lovely', 'beautiful', 'pretty', 'cool', 'stylish',
    'smart', 'best', 'better', 'finest', 'top', 'favourite', 'decent', 'proper',
    'amazing', 'sustainable', 'sustainably', 'ethical', 'ethically', 'eco',
    'ecofriendly', 'conscious', 'responsible', 'responsibly', 'green', 'planet',
    'friendly', 'natural', 'quality', 'luxury', 'luxurious', 'premium',
    'exclusive', 'artisan', 'artisanal', 'affordable', 'cheap', 'budget',
    'expensive', 'value', 'reasonable', 'something', 'anything', 'really',
    'very', 'quite', 'lots', 'bit',
  ]);

  // Qualifiers: checkable claims about HOW something is made. Kept, and they
  // do count — but only as a boost on a business that already makes the thing
  // asked for. A qualifier can never make a business eligible on its own.
  //
  // "handmade bowl" was returning Hurdwick Handmade Bag Company, Alex Monroe
  // and Drakes, none of whom make bowls, purely on the word appearing in their
  // name or copy. "organic beef" is unaffected: organic farms match "beef"
  // too, so they stay eligible and still take the boost.
  const QUALIFIER_WORDS = new Set([
    'organic', 'organics', 'handmade', 'handcrafted', 'handwoven', 'handstitched',
    'handthrown', 'traditional', 'traditionally', 'heritage', 'bespoke', 'custom',
    'vintage', 'artisanal', 'small', 'batch', 'local', 'locally', 'seasonal',
    'free', 'range', 'grass', 'fed', 'wild',
  ]);

  // Adjectival forms of the nations. Each business carries its nation in the
  // place field, so mapping the adjective onto the noun is all that is needed.
  const NATION_WORDS = {
    scottish: 'scotland', scots: 'scotland', scotland: 'scotland',
    welsh: 'wales', cymru: 'wales', wales: 'wales',
    english: 'england', england: 'england',
    irish: 'northern ireland', ulster: 'northern ireland',
  };

  // A nation named in the query is a filter, not a preference: the shortlist
  // handed to the model only contains businesses in it. The page enforces the
  // same rule on whatever comes back.
  const NATION_PATTERNS = [
    [/\b(english|england)\b/, 'England'],
    [/\b(scottish|scots|scotland)\b/, 'Scotland'],
    [/\b(welsh|wales|cymru)\b/, 'Wales'],
    [/\b(northern ireland|northern irish|irish|ulster)\b/, 'Northern Ireland'],
  ];
  function nationsIn(qClean) {
    // "north wales" and "scottish borders" are regions, not the whole nation
    // -- but they are still inside it, so the filter holds for them too.
    return NATION_PATTERNS.filter(([re]) => re.test(qClean)).map(([, n]) => n);
  }

  /** Is the matched word modifying something else? "cake tin" is a tin. */
  function isModifier(text, matchIndex, matchLength) {
    const after = String(text).slice(matchIndex + matchLength, matchIndex + matchLength + 40);
    const words = after.trim().split(/\s+/).slice(0, 3).join(' ');
    return OBJECT_AFTER.test(words);
  }

  /**
   * Map a user's query to canonical product tags.
   * Returns { tags: [...], groups: [...], categories: [...], tokens: [...] }
   */
  function expandQuery(query) {
    const raw = String(query || '');
    const tags = new Set();

    for (const [tag, re, group] of ALL) {
      const m = raw.match(re);
      if (!m) continue;
      if (MOTIF_PRONE.has(tag) && isModifier(raw, m.index, m[0].length)) continue;
      tags.add(tag);
    }

    const groups = new Set();
    for (const tag of tags) {
      const g = TAG_GROUP.get(tag);
      if (g) groups.add(g);
    }

    // Which slices of the map could plausibly answer this. Used only for the
    // fallback: a food query should fall back to farm shops, not to whatever
    // happens to sit at the top of the file.
    const categories = new Set();
    for (const g of groups) {
      for (const c of (GROUP_CATEGORIES[g] || [])) categories.add(c);
    }

    const qClean = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const all = qClean.split(/\s+/).filter(t => t.length > 2 && !STOP_WORDS.has(t));

    // "handmade bowl" is a bowl search qualified by handmade. Split them so
    // eligibility can rest on the noun. If everything they typed was a
    // qualifier there is no noun to fall back on, so let them act as one.
    const core = all.filter(t => !QUALIFIER_WORDS.has(t));
    const tokens = core.length ? core : all;
    const qualifiers = core.length ? all.filter(t => QUALIFIER_WORDS.has(t)) : [];

    return {
      tags: [...tags],
      groups: [...groups],
      categories: [...categories],
      tokens,
      qualifiers,
      qClean,
      isFood: [...tags].some(t => FOOD_TAGS.has(t)),
    };
  }

  /**
   * Stage one of two-stage retrieval: narrow the catalogue to a shortlist the
   * model can rank cheaply.
   */
  function stageOneFilter(query, catalog, maxCandidates) {
    const limit = maxCandidates || 40;
    if (!query || typeof query !== 'string') return catalog.slice(0, limit);

    const q = expandQuery(query);
    if (!q.qClean) return catalog.slice(0, limit);

    const nations = nationsIn(q.qClean);
    if (nations.length) {
      catalog = catalog.filter(item => nations.some(n => (', ' + (item.t || '')).endsWith(', ' + n)));
    }

    const queryTags = new Set(q.tags);

    const scored = catalog.map(item => {
      let score = 0;
      const fields = [item.n, item.c, item.s, item.t, item.d];
      const textNorm = ' ' + fields.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
      const ptList = (item.pt || []).map(p => String(p).toLowerCase());

      // Whole-query phrase hit, e.g. "sheffield steel".
      if (q.qClean.length >= 3 && textNorm.includes(' ' + q.qClean + ' ')) score += 20;

      // The important one: canonical tag against canonical tag. This is what
      // connects "sausages" to a business tagged `pork & bacon`.
      ptList.forEach(pt => {
        if (queryTags.has(pt)) score += 18;
      });

      // Literal word matches, as a backstop for anything the lexicon missed
      // (place names, maker names, materials). Word-boundary matched: the old
      // substring test scored "ale" against "Kels*ale*" and "wholes*ale*".
      const wordIn = (field, t) =>
        (' ' + String(field).toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ').includes(' ' + t + ' ');

      q.tokens.forEach(t => {
        if (wordIn(ptList.join(' '), t)) score += 10;
        // "scottish" has to reach a business filed under Scotland.
        if (NATION_WORDS[t] && wordIn(item.t, NATION_WORDS[t])) score += 8;
        if (wordIn(item.t, t)) score += 8;
        if (wordIn(item.c, t)) score += 8;
        if (wordIn(item.s, t)) score += 6;
        if (wordIn(item.n, t)) score += 6;
        if (wordIn(item.d, t)) score += 3;
      });

      // Qualifiers rank but never admit, so they are added only once the
      // business has already scored on the product itself.
      let boost = 0;
      if (score > 0) {
        q.qualifiers.forEach(t => {
          if (wordIn(ptList.join(' '), t) || wordIn(item.s, t) || wordIn(item.c, t)) boost += 4;
          else if (wordIn(item.n, t) || wordIn(item.d, t)) boost += 2;
        });
      }

      return { item, score: score + boost };
    });

    scored.sort((a, b) => b.score - a.score);
    const matched = scored.filter(s => s.score > 0).map(s => s.item);

    if (matched.length >= limit) return matched.slice(0, limit);

    // Fallback. The old version padded with the first N businesses in file
    // order, which for a food query meant handing the model forty clothing
    // brands and letting it conclude that nobody in Britain sells sausages.
    //
    // Pad from the categories the query actually implies instead. For food
    // that means farm shops, where near-total recall is the right behaviour:
    // almost any farm shop sells vegetables, and "here are the farm shops
    // near you" beats "no results" every time.
    const matchedIds = new Set(matched.map(m => m.i));
    const wanted = new Set(q.categories);
    const inCategory = wanted.size
      ? catalog.filter(c => !matchedIds.has(c.i) && wanted.has(c.c))
      : [];

    let out = [...matched, ...inCategory].slice(0, limit);

    // Only if we still have nothing to show does catalogue order come back,
    // and never for a query we understood well enough to categorise.
    if (!out.length) {
      out = catalog.slice(0, limit);
    }
    return out;
  }

  return { expandQuery, stageOneFilter };
}

const { expandQuery, stageOneFilter } = createQueryExpander(QUERY_LEXICON);

/* ==========================================================================
   The catalogue the model chooses from.

   This used to be a copy of businesses.json frozen into this file whenever
   scripts/update-search-api.js was run. Nothing reminded anyone to run it, so
   the copy went stale: the nine businesses added on 17 Sep 2026 were on the
   map but could never be picked by the AI search, because the model was only
   ever shown the list as it stood on the 16th.

   It is now built from data/businesses.json when the function starts, so the
   AI search always sees exactly what the map shows. `require` is traced by
   Vercel's bundler, so the file ships with the function. If that ever fails,
   the same file is fetched from the site itself -- the pattern
   api/update-listing.js already relies on in production.
   ========================================================================== */
function compact(b) {
  return {
    i: b.id,
    n: b.name,
    c: b.category,
    s: b.subcategory,
    // Town, county and nation travel together as the place field. A Fife farm
    // shop writes neither "Fife" nor "Scotland" in its town, so without these
    // the model could only place it if the description happened to say so.
    t: [b.town, b.county, b.nation].filter(Boolean).join(', '),
    d: b.description,
    tr: b.tier,
    pt: b.product_tags || [],
    // Who this business dresses, where we have established it. Absent means not
    // yet classified, NOT unisex -- the page ranks those below confirmed matches
    // rather than hiding them, and enforces the exclusion itself in visible().
    au: b.audience || undefined
  };
}

let BUSINESS_CATALOG = null;
try {
  BUSINESS_CATALOG = require('../data/businesses.json').map(compact);
} catch (e) {
  console.warn('[ai-search] businesses.json not bundled, will fetch it:', String(e.message).split('\n')[0]);
}

let fetchedCatalog = null;
let fetchedAt = 0;
async function catalogue(req) {
  if (BUSINESS_CATALOG) return BUSINESS_CATALOG;
  if (fetchedCatalog && Date.now() - fetchedAt < 5 * 60 * 1000) return fetchedCatalog;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto']
    || (/^(localhost|127\.0\.0\.1)/.test(host || '') ? 'http' : 'https');
  const res = await fetch(proto + '://' + host + '/data/businesses.json');
  if (!res.ok) throw new Error('Could not read the listing data (HTTP ' + res.status + ')');
  fetchedCatalog = (await res.json()).map(compact);
  fetchedAt = Date.now();
  return fetchedCatalog;
}

/* ==========================================================================
   Who may call this.

   Every search here is paid for with the Gemini key, so the endpoint is not
   left open to the whole internet. None of this is authentication -- a
   determined script can fake an Origin header -- but it stops other sites
   using the key from a browser, and it caps what one caller can cost. The
   real ceiling is the quota set on the key in Google Cloud.

   Whatever is refused here, the page carries on: index.html treats any
   non-200 as "use the local search", which is a slightly worse search, not a
   broken one.
   ========================================================================== */
const MAX_QUERY = 200;              // characters; the longest real search is a sentence

const ALLOWED_ORIGIN = [
  /^https:\/\/(www\.)?grownandmade\.uk$/,
  // The Vercel project's own address and its preview deployments, under the
  // current name and the one it is due to be renamed to.
  /^https:\/\/(buybritishmap|grown-and-made-uk)(-[a-z0-9-]+)?\.vercel\.app$/,
  // Local test harnesses.
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
];
function originOk(req) {
  const o = req.headers.origin;
  // Browsers always send Origin on a POST, same-site included, so a missing
  // one means a script rather than the page.
  return Boolean(o) && ALLOWED_ORIGIN.some(re => re.test(o));
}

/* Per-IP limit, held in the warm function's memory. Vercel runs several
   instances, so this is per instance -- enough to blunt a loop hammering the
   key, not a precise quota. A person searching never gets near it. */
const RATE = { windowMs: 60 * 1000, max: 15 };
const hits = new Map();
function rateLimited(req) {
  const ip = String(req.headers['x-real-ip']
    || (req.headers['x-forwarded-for'] || '').split(',')[0]
    || (req.socket && req.socket.remoteAddress) || 'unknown').trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {           // don't let the map grow without bound
    for (const [k, v] of hits) if (!v.some(t => now - t < RATE.windowMs)) hits.delete(k);
  }
  return recent.length > RATE.max;
}

/* The GET diagnostic lists the models the key can use. Useful when search
   breaks, but not something to hand to anyone who asks, and every call costs
   a ListModels request. Gated behind the /admin password:
     curl -H "Authorization: Bearer <ADMIN_PASSWORD>" https://www.grownandmade.uk/api/ai-search */
const crypto = require('crypto');
function adminOk(req) {
  const want = process.env.ADMIN_PASSWORD || '';
  const got = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!want || !got) return false;
  const h = (v) => crypto.createHash('sha256').update(v).digest();
  return crypto.timingSafeEqual(h(want), h(got));
}

/* A hung request to Google must not hold the visitor's search, or the
   function, open. Each call gets its own limit and the whole search gets a
   deadline, after which the page falls back to local search. */
const CALL_TIMEOUT_MS = 8000;
const SEARCH_DEADLINE_MS = 12000;

// Preference order, not a fixed list. Google retires models and restricts old
// ones to existing users without warning, which is what broke this twice: the
// 1.5 family went first, then 2.5-flash became unavailable to new keys.
//
// So we ASK the API which models this key can actually use (ListModels) and
// intersect that with this order. Anything unknown but matching the fallback
// pattern is appended, so a future rename can't take search offline again.
// Cheapest-capable first. The 2.5 family is deliberately near the BOTTOM: it
// is listed to every key but 404s for projects created after Google restricted
// it, so putting it first just buys a wasted round trip on every cold start.
const MODEL_PREFERENCE = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3-flash-preview',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash'
];

// Discovery is cached in module scope: Vercel keeps the container warm between
// requests, so this usually costs one extra call per cold start, not per search.
let cachedModels = null;
let cachedAt = 0;
const MODEL_CACHE_MS = 10 * 60 * 1000;

const https = require('https');

function httpsJson(urlStr, method, payloadStr, timeoutMs) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = https.request(options, res => {
      let responseData = '';
      res.on('data', chunk => { responseData += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: responseData });
      });
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs || CALL_TIMEOUT_MS, () => {
      req.destroy(new Error('Gemini did not answer within ' + (timeoutMs || CALL_TIMEOUT_MS) + 'ms'));
    });
    if (payloadStr) req.write(payloadStr);
    req.end();
  });
}

async function listUsableModels(apiKey) {
  try {
    const res = await httpsJson(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      'GET', null, 4000
    );
    if (res.statusCode !== 200) return null;
    const resData = JSON.parse(res.body);
    if (!resData.models) return null;
    return resData.models
      .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace(/^models\//, ''));
  } catch (e) {
    return null;
  }
}

// Models that ListModels advertises but that actually 404 on generateContent.
// Google lists the 2.5 family to every key, then refuses the call for projects
// created after it was restricted ("no longer available to new users"). So
// being listed does NOT mean being usable, and the only way to find out is to
// try. Once a model has refused us, stop paying a round trip to ask it again.
const deadModels = new Set();

// Models that refuse thinkingConfig: { thinkingBudget: 0 } with a 400. Sent
// without it from then on, for as long as this instance is warm.
const thinkingRejected = new Set();

// Build the ordered list of models to try, from what the key can actually use.
async function resolveCandidates(apiKey) {
  const now = Date.now();
  if (cachedModels && (now - cachedAt) < MODEL_CACHE_MS) {
    return liveOnly(cachedModels);
  }

  const usable = await listUsableModels(apiKey);
  let ordered;

  if (!usable || !usable.length) {
    // Discovery failed; fall back to the static preference order.
    ordered = MODEL_PREFERENCE.slice();
  } else {
    const preferred = MODEL_PREFERENCE.filter(m => usable.includes(m));
    // Any other plain flash model the key can see, newest-looking first, as a
    // backstop against Google renaming everything again. Excludes image, tts,
    // audio, robotics and research variants, which can't do this job.
    const extras = usable
      .filter(m => /^gemini-[\d.]+-flash(-lite)?$/.test(m) && !preferred.includes(m))
      .sort()
      .reverse();
    ordered = [...preferred, ...extras];
  }

  cachedModels = ordered;
  cachedAt = now;
  return liveOnly(ordered);
}

// Never hand back an empty list: if everything has been blacklisted, the
// blacklist is more likely stale than the truth, so clear it and try again.
function liveOnly(list) {
  const live = list.filter(m => !deadModels.has(m));
  if (live.length) return live;
  deadModels.clear();
  return list;
}

module.exports = async function handler(req, res) {
  // No CORS headers: the page calls this from its own origin, which needs
  // none, and every other origin is meant to be refused by the browser.
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY environment variable is missing on server.'
    });
  }

  if (req.method === 'GET') {
    // Looks exactly like a missing route to anyone without the password.
    if (!adminOk(req)) return res.status(404).json({ error: 'Not found' });
    // no-store: this endpoint exists for diagnosis, and a cached copy showing
    // yesterday's model list is worse than useless when search is broken.
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    const models = await listUsableModels(apiKey);
    const candidates = await resolveCandidates(apiKey);
    return res.status(200).json({
      keyPresent: true,
      keyLength: String(apiKey).length,
      modelsVisibleToThisKey: models,
      preferenceOrder: MODEL_PREFERENCE,
      resolvedCandidates: candidates,
      willUse: candidates[0] || null
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  if (!originOk(req)) {
    return res.status(403).json({ error: 'Search is only available from grownandmade.uk.' });
  }
  if (rateLimited(req)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many searches in a minute. Try again shortly.' });
  }

  const query = body && body.query ? String(body.query).trim() : '';
  if (!query) return res.status(400).json({ error: 'Query parameter is required.' });
  if (query.length > MAX_QUERY) {
    return res.status(400).json({ error: 'That search is too long.' });
  }

  let BUSINESSES_FOR_SEARCH;
  try {
    BUSINESSES_FOR_SEARCH = await catalogue(req);
  } catch (e) {
    console.error('[ai-search] catalogue unavailable:', e.message);
    return res.status(503).json({ error: 'Search could not read the listings just now.' });
  }
  const startedAt = Date.now();

  // Stage 1 Two-Stage Retrieval
  const shortlistedCatalog = stageOneFilter(query, BUSINESSES_FOR_SEARCH, 40);
  const catalogStr = JSON.stringify(shortlistedCatalog);

  const systemInstruction = `You are the Grown and Made AI Search Assistant.
Analyze the user's natural language request and find the best matching British makers from the provided candidate catalog.

CRITICAL INSTRUCTIONS:
1. Understand regional synonyms (e.g. Yorkshire = Sheffield, Leeds; Scotland = Hawick, Edinburgh; Wales = Gwynedd; Cotswolds = Chipping Campden).
2. Match materials, craft techniques, product terms and tags (e.g. pet food bowls = ceramics/pottery pet bowls; knitted vests = woollen waistcoats/gilets; kitchen knife = forged cutlery/blades).
1b. Respect who the shopper is buying for. "au" on a catalog entry lists the audiences that business actually dresses — men, women, children. If the query names an audience ("mens jackets", "something for my daughter"), never return a business whose "au" excludes it. An entry with no "au" has not been classified yet and may be returned. An audience is a filter, never a reason to match: "mens jackets" still has to be jackets.
1c. A nation is a filter. If the user says English, Scottish, Welsh or Northern Irish (or names the nation), return ONLY businesses in that nation; the catalog below has already been limited to it.
2a. IGNORE subjective adjectives entirely — sustainable, ethical, eco, green, nice, best, quality, luxury, affordable and the like. This directory does not rank businesses on those claims and has no evidence with which to do so, so "sustainable jumper" must return exactly what "jumper" returns. Certified or factual descriptors ARE meaningful and should be matched: organic, handmade, traditional, heritage.
3. Return ONLY a valid JSON object matching this exact structure:
{
  "query": ${JSON.stringify(query)},
  "productTerm": "the plural everyday noun for what they want, e.g. jumpers, watches, jewellery, venison, mugs. Lowercase. Null if they named no product. STRIP subjective adjectives: 'sustainable jumper', 'nice jumper' and 'the best quality jumper' all have the productTerm 'jumpers'.",
  "locationTerm": "the place they asked for exactly as a person would say it, e.g. Darlington, Norfolk, Cornwall. Null if they named no place. Only ever a place the user actually typed — never infer one from the product.",
  "madeOrGrown": "made or grown - use grown for food, produce, meat and farm goods; made for everything else",
  "matchQuality": "exact if you found businesses that genuinely satisfy BOTH the product and the location; wider if you found the right product but had to go outside the requested area; loose if you could only find loosely related businesses",
  "matches": [
    { "id": "exact-business-id-from-catalog" }
  ]
}
4. Limit matches to the top 1-12 most relevant businesses.
4a. IMPORTANT: never return an empty matches array. If nothing matches well, set matchQuality to "wider" or "loose" and still return the closest alternatives from the catalog.
4b. Be honest in matchQuality. If the user asked for a town and the nearest match is a county away, that is "wider", not "exact".
5. DO NOT include markdown formatting like \`\`\`json. Return raw JSON string only.

CANDIDATE CATALOG:
${catalogStr}`;

  function buildPayload(model, withThinkingOff) {
    // The answer is a dozen ids and three short fields -- a few hundred
    // tokens. The cap only matters if something (a prompt injection in the
    // query, say) talks the model into writing an essay on our bill.
    const generationConfig = { temperature: 0.2, maxOutputTokens: 2048 };
    // Disable thinking everywhere it is supported. Thinking tokens bill as
    // OUTPUT, which is the expensive side, and this task is retrieval over a
    // 40-item shortlist — it gains nothing from deliberation.
    // NB: matching on model names missed 'gemini-flash-latest', which left
    // thinking ON for the default model. Invert the test instead: only the
    // older families lack the parameter.
    if (withThinkingOff && !/^gemini-(1\.5|2\.0)/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    return JSON.stringify({
      contents: [{ parts: [{ text: systemInstruction }, { text: `User Search Query: "${query}"` }] }],
      generationConfig
    });
  }

  let lastStatus = 0, lastBody = '', triedModels = [], attempts = [];

  const MODEL_CANDIDATES = await resolveCandidates(apiKey);

  for (const model of MODEL_CANDIDATES) {
    // Out of time: stop working down the list and let the page search locally.
    if (Date.now() - startedAt > SEARCH_DEADLINE_MS) break;
    triedModels.push(model);
    const call = (thinkingOff) => httpsJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      'POST', buildPayload(model, thinkingOff)
    );
    let apiRes;
    try {
      apiRes = await call(!thinkingRejected.has(model));
      const keyProblem = r => /api key/i.test(String(r.body));
      /* 400 INVALID_ARGUMENT with thinking switched off: the model behind an
         alias has changed to one that will not take thinkingBudget: 0 (found
         23 Sep 2026, when every live search was failing this way and the page
         was quietly falling back to local search). Ask again without it, and
         remember not to send it to this model again. */
      if (apiRes.statusCode === 400 && !keyProblem(apiRes) && !thinkingRejected.has(model)
          && Date.now() - startedAt < SEARCH_DEADLINE_MS) {
        const retry = await call(false);
        if (retry.statusCode === 200) thinkingRejected.add(model);
        apiRes = retry;
      }
    } catch (err) {
      return res.status(502).json({ error: 'Could not reach the Gemini API.', details: err.message });
    }

    lastStatus = apiRes.statusCode;
    lastBody = apiRes.body;

    let attemptMsg = '';
    try { attemptMsg = JSON.parse(apiRes.body)?.error?.message || ''; } catch (e) {}
    attempts.push({ model, status: apiRes.statusCode, message: attemptMsg.slice(0, 200) });

    // 404 means this key may never call this model — remember it, so we stop
    // wasting a round trip on it. 429 is temporary, so don't blacklist it.
    if (apiRes.statusCode === 404) { deadModels.add(model); continue; }
    if (apiRes.statusCode === 429) continue;
    // A request this model will not accept may suit the next one on the list
    // -- unless the problem is the key, which no model will fix.
    if (apiRes.statusCode === 400 && !/api key/i.test(String(apiRes.body))) continue;
    if (apiRes.statusCode !== 200) break;

    try {
      const geminiData = JSON.parse(apiRes.body);
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) {
        return res.status(502).json({
          error: 'Gemini returned no text.',
          finishReason: geminiData.candidates?.[0]?.finishReason || null,
          usage: geminiData.usageMetadata || null
        });
      }
      const clean = text.replace(/^\`\`\`json\s*/i, '').replace(/^\`\`\`\s*/i, '').replace(/\s*\`\`\`$/i, '').trim();
      const parsed = JSON.parse(clean);
      parsed._model = model;
      parsed._stageOneCandidateCount = shortlistedCatalog.length;
      return res.status(200).json(parsed);
    } catch (err) {
      return res.status(502).json({
        error: 'Gemini replied but the response could not be parsed as JSON.',
        details: String(lastBody).slice(0, 500)
      });
    }
  }

  let googleMessage = '';
  try { googleMessage = JSON.parse(lastBody)?.error?.message || ''; } catch (e) {}

  // Report the most actionable failure, not just the last one.
  const quota = attempts.find(a => a.status === 429);
  const notFound = attempts.find(a => a.status === 404);
  let fix = '';
  let reportStatus = lastStatus;
  let reportMessage = googleMessage;

  if (quota) {
    reportStatus = 429;
    reportMessage = quota.message || googleMessage;
    fix = 'Free-tier quota for ' + quota.model + ' is exhausted. Either wait for the daily reset (midnight Pacific) or enable billing on the Google Cloud project behind this API key to move to a paid tier.';
  } else if (notFound) {
    reportStatus = 404;
    reportMessage = notFound.message || googleMessage;
    fix = 'None of the models this key can use accepted the request. GET /api/ai-search to see the resolved candidate list.';
    // A stale cache is the likeliest cause of every candidate 404ing, so force
    // rediscovery on the next request rather than staying broken until restart.
    cachedModels = null;
  } else if (lastStatus === 400) {
    fix = 'The API key was rejected or the request was malformed. Check GEMINI_API_KEY in Vercel.';
  } else if (lastStatus === 403) {
    fix = 'The API key is not authorised. Check key restrictions in Google AI Studio / Cloud Console.';
  }

  return res.status(reportStatus || 502).json({
    error: `Gemini API error (status ${reportStatus}).`,
    googleMessage: reportMessage,
    fix,
    triedModels,
    attempts,
    details: String(lastBody).slice(0, 500)
  });
};

// Exposed for scripts/test-search.js, which asserts against the file that
// actually deploys rather than against the library it was generated from.
// Vercel only cares that the default export is callable; extra properties on
// it are ignored.
module.exports.stageOneFilter = stageOneFilter;
module.exports.expandQuery = expandQuery;
module.exports.BUSINESS_CATALOG = BUSINESS_CATALOG;
