#!/usr/bin/env python3
"""Who supplies the makers on the map: the upstream UK mills, spinners, tanneries and clay houses.

    python3 scripts/build-supplier-register.py

Reads data/supplier-register.json (catalogue + links businesses confirmed directly)
and scans the internal evidence notes for each supplier's aliases, then writes
SUPPLIER-REGISTER.md. Both inputs and the output are internal (gitignored).
A confirmed link outranks an inferred one; an evidence-note match is only as good
as the note, so check the note before quoting it publicly.
"""
import json, os, re, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
reg = json.load(open(os.path.join(ROOT, 'data', 'supplier-register.json')))
biz = {b['id']: b for b in json.load(open(os.path.join(ROOT, 'data', 'businesses.json')))}
notes = json.load(open(os.path.join(ROOT, 'data', 'evidence-notes.json')))
S = reg['suppliers']
links = collections.defaultdict(dict)   # supplier -> {business_id: source}
for c in reg['confirmed']:
    for s in c['suppliers']:
        links[s][c['business_id']] = 'confirmed by the business, %s (%s)' % (c['date'], c['via'])
for key, s in S.items():
    for bid, note in notes.items():
        if bid not in biz or bid == s.get('map_id') or bid in links[key]:
            continue
        if any(re.search(r'\b' + re.escape(a) + r"(?:'?s)?\b", note, re.I) for a in s['aliases']):
            links[key][bid] = 'named in our evidence note'
out = ['# Supplier register', '',
       'Upstream UK suppliers named by businesses on the map, built by `scripts/build-supplier-register.py` from `data/supplier-register.json` and the internal evidence notes. INTERNAL: not for the public repo.', '',
       '"Confirmed" means the business told us directly. "Evidence note" means our own research named the supplier: re-check before quoting it publicly. A few evidence-note matches may be negatives (e.g. "not Stead"), so read the note.', '']
ranked = sorted(S, key=lambda k: (-len(links[k]), S[k]['name']))
tot = sum(1 for k in S if links[k])
out += ['**%d suppliers linked to %d businesses on the map.**' % (tot, len({b for k in S for b in links[k]})), '',
        '| Supplier | Kind | Where | On the map itself | Businesses |', '|---|---|---|---|---|']
for k in ranked:
    if links[k]:
        s = S[k]; out.append('| %s | %s | %s | %s | %d |' % (s['name'], s['kind'], s['place'], 'yes' if s.get('map_id') else '', len(links[k])))
out.append('')
for k in ranked:
    if not links[k]: continue
    s = S[k]; out += ['## %s (%s, %s)' % (s['name'], s['kind'], s['place']), '']
    for bid, src in sorted(links[k].items(), key=lambda kv: (not kv[1].startswith('confirmed'), biz[kv[0]]['name'])):
        b = biz[bid]; out.append('- **%s** (%s, %s, %s): %s' % (b['name'], b['tier'].title(), b['category'], b.get('town', ''), src))
    out.append('')
unused = [S[k]['name'] for k in S if not links[k]]
if unused: out += ['## In the catalogue, no business linked yet', '', ', '.join(unused), '']
open(os.path.join(ROOT, 'SUPPLIER-REGISTER.md'), 'w').write('\n'.join(out))
print('\n'.join(out[:8 + tot + 2]))
