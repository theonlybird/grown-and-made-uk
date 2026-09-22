const fs = require('fs');
const path = require('path');
const { serializeLexicon } = require('./lib/product-vocab');

const dataPath = path.join(__dirname, '../data/businesses.json');
const apiPath = path.join(__dirname, '../api/ai-search.js');
const clientPath = path.join(__dirname, '../assets/query-expand.js');
const expanderPath = path.join(__dirname, 'lib/query-expand.js');

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// The deployed function is a single file with no imports, so the query
// expander is inlined here rather than required at runtime. It is COPIED, not
// retyped: scripts/lib/query-expand.js is the only implementation, and the
// lexicon is serialised straight out of product-vocab.js. That is what stops
// the tagging side and the search side drifting apart, which is the fault this
// whole change exists to fix.
const expanderSource = fs.readFileSync(expanderPath, 'utf8')
  .split('// --- EXPORTS (stripped when inlined into the API) ---')[0]
  .trimEnd();

const lexiconJson = JSON.stringify(serializeLexicon());

// The handler is ordinary JavaScript in its own file, so it can be read and
// edited without the escaping a template literal needs. Everything below the
// comment block at its top is copied in verbatim.
const handlerPath = path.join(__dirname, 'templates/ai-search.handler.js');
const handlerSource = fs.readFileSync(handlerPath, 'utf8')
  .replace(/^\/\*[\s\S]*?\*\/\s*/, '');

// No catalogue here any more. It used to be frozen into the generated file,
// which went stale the first time a business was added without re-running
// this script; the function now reads data/businesses.json itself.
const apiCode = `// GENERATED FILE — do not edit by hand.
// Rebuild with: node scripts/update-search-api.js
// The lexicon below is serialised from scripts/lib/product-vocab.js, the
// expander is copied verbatim from scripts/lib/query-expand.js and the handler
// from scripts/templates/ai-search.handler.js. Edit those.
// The business catalogue is NOT in this file: it is read from
// data/businesses.json when the function starts.
const QUERY_LEXICON = ${lexiconJson};

${expanderSource}

const { expandQuery, stageOneFilter } = createQueryExpander(QUERY_LEXICON);

${handlerSource}`;

fs.writeFileSync(apiPath, apiCode);

// The browser needs the same lexicon. index.html has its own local search,
// used whenever the API is slow, rate-limited or down — and it had exactly the
// same blind spot: a word the catalogue does not literally contain counts as
// "not understood", which is what produced "No results for sausages" even
// while the map was full of butchers. One source, three consumers.
const clientCode = `/* GENERATED FILE — do not edit by hand.
   Rebuild with: node scripts/update-search-api.js
   Source: scripts/lib/query-expand.js + scripts/lib/product-vocab.js */
(function (root) {
  var QUERY_LEXICON = ${lexiconJson};

${expanderSource.split('\n').map(l => (l ? '  ' + l : l)).join('\n')}

  var api = createQueryExpander(QUERY_LEXICON);
  root.BBQueryExpand = { expandQuery: api.expandQuery, lexiconVersion: QUERY_LEXICON.version };
})(typeof window !== 'undefined' ? window : this);
`;
fs.writeFileSync(clientPath, clientCode);

const tagged = data.filter(b => b.product_tags && b.product_tags.length).length;
console.log(`assets/query-expand.js rebuilt.`);
console.log(`api/ai-search.js rebuilt.`);
console.log(`  businesses      : ${data.length} (${tagged} with product tags) — read at runtime, not embedded`);
console.log(`  lexicon version : ${JSON.parse(lexiconJson).version}`);
console.log(`  query terms     : ${JSON.parse(lexiconJson).vocab.length} shop-side + ${JSON.parse(lexiconJson).extra.length} search-side`);
