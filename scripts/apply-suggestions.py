#!/usr/bin/env python3
"""Scaffold approved new-business suggestions into draft listing records.

    python3 scripts/apply-suggestions.py ~/Downloads/approved-suggestions.json
    python3 scripts/apply-suggestions.py --merge

The admin page approves; this scaffolds; you finish the record by hand; --merge
puts the finished ones on the map. Three steps rather than one because a
suggestion carries roughly half a listing: it has the name, website and address,
and it has none of the things that decide whether the listing is any good --
the tier, the pin, the evidence note.

So the first pass writes to data/pending-additions.json, NOT to businesses.json.
A record with a missing tier or a null pin would break the map if it reached it,
and nothing that cannot render should ever be one careless commit away from
being live. --merge is the gate: it refuses to move a record until every field
a listing needs is filled in.

What stays manual, deliberately:
  tier            the whole point of gold-and-silver.html is that it is judged
  lat / lng       see the pin-precision rule; never pin a home address
  evidence_note   the reasoning, in your words
  description     one or two lines, in plain English
  subcategory     picked from what the category already uses
  town/county/nation  search keys, and town is never published

Logos, Shopify product harvesting and the public note draft are separate steps
-- see the add-a-business checklist in the project notes.
"""
import argparse, json, os, re, sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data', 'businesses.json')
PENDING = os.path.join(ROOT, 'data', 'pending-additions.json')

# The form's option lists -> the dataset's own vocabulary.
CATEGORY = {
    'Farm shop': 'farm',
    'Clothing & accessories': 'clothing',
    'Pottery & crockery': 'ceramics',
    'Jewellery': 'jewellery',
    'Other UK maker': '',          # no safe mapping -- you choose
}
LISTING_TYPE = {
    'Physical shop': 'shop',
    'Online only': 'online_only',
    'Both': 'both',
}

# Everything a live record needs before it can go on the map.
REQUIRED = ['id', 'name', 'category', 'subcategory', 'tier', 'listing_type',
            'town', 'address', 'lat', 'lng', 'website', 'description',
            'evidence_note', 'tier_confidence', 'source', 'nation']


def slug(name):
    s = re.sub(r'[^a-z0-9]+', '-', (name or '').lower()).strip('-')
    return s or 'business'


def unique_id(base, taken):
    if base not in taken:
        return base
    n = 2
    while '%s-%d' % (base, n) in taken:
        n += 1
    return '%s-%d' % (base, n)


def scaffold(sug, taken):
    b = sug.get('business') or {}
    ev = sug.get('evidence') or {}
    bid = unique_id(slug(b.get('name')), taken)
    # Key order matches an existing record so the eventual diff reads naturally.
    return {
        'id': bid,
        'name': b.get('name', ''),
        'category': CATEGORY.get(b.get('category'), ''),
        'subcategory': '',
        'tier': '',
        'listing_type': LISTING_TYPE.get(b.get('listing_type'), ''),
        'town': '',
        'address': b.get('address', ''),
        'lat': None,
        'lng': None,
        'website': b.get('website', ''),
        'instagram': b.get('instagram', ''),
        'description': '',
        'evidence_note': '',
        'tier_confidence': '',
        'logo': 'assets/logos/%s.png' % bid,
        # Marks how this one arrived, so sweep batches and public suggestions
        # can be told apart later.
        'source': 'user-suggestion-verified-%s' % date.today().strftime('%Y-%m'),
        'product_tags': [],
        'nation': '',
        'county': '',
        # Not part of the schema -- stripped on merge. Kept here so the work
        # left to do travels with the draft instead of living in your head.
        '_from_suggestion': {
            'suggestion_id': sug.get('suggestion_id'),
            'submitted_at': sug.get('submitted_at'),
            'made_in_uk': ev.get('made_in_uk', ''),
            'materials': ev.get('materials', ''),
            'links': ev.get('links', ''),
            'relationship': (sug.get('from') or {}).get('relationship', ''),
            'duplicate_of': sug.get('duplicate_of'),
        },
    }


def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path) as fh:
        return json.load(fh)


def write_json(path, obj):
    with open(path, 'w') as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False)
        fh.write('\n')


def cmd_scaffold(args):
    sugs = load_json(args.approved, [])
    data = load_json(DATA, [])
    pending = load_json(PENDING, [])

    taken = {r['id'] for r in data} | {r['id'] for r in pending}
    by_domain = {}
    for r in data:
        m = re.sub(r'^www\.', '', re.sub(r'^https?://', '', r.get('website') or '').split('/')[0].lower())
        if m:
            by_domain[m] = r

    added, skipped, warnings = [], [], []
    for s in sugs:
        b = s.get('business') or {}
        existing_sug = {p.get('_from_suggestion', {}).get('suggestion_id') for p in pending}
        if s.get('suggestion_id') in existing_sug:
            skipped.append((b.get('name'), 'already scaffolded'))
            continue
        dupe = s.get('duplicate_of') or by_domain.get(b.get('domain') or '')
        if dupe:
            name = dupe['name'] if isinstance(dupe, dict) else dupe.get('name')
            warnings.append((b.get('name'), 'same website as %s — check before finishing' % name))
        rec = scaffold(s, taken)
        taken.add(rec['id'])
        pending.append(rec)
        added.append(rec)

    if args.dry_run:
        for r in added:
            print('  would scaffold  %-28s %s' % (r['name'][:28], r['id']))
        print('\n(dry run — nothing written)')
        return

    if added:
        write_json(PENDING, pending)
    for r in added:
        print('  scaffolded  %-28s %s' % (r['name'][:28], r['id']))
    print('\n%d draft%s in data/pending-additions.json' % (len(added), '' if len(added) == 1 else 's'))
    for name, why in skipped:
        print('  skipped %s — %s' % (name, why))
    if warnings:
        print('\n%d POSSIBLE DUPLICATE%s:' % (len(warnings), '' if len(warnings) == 1 else 'S'))
        for name, why in warnings:
            print('  %s — %s' % (name, why))
    if added:
        print('\nNext: fill in tier, subcategory, lat/lng, town, description,')
        print('evidence_note, tier_confidence, nation and county on each draft,')
        print('then run:  python3 scripts/apply-suggestions.py --merge')


def cmd_merge(args):
    pending = load_json(PENDING, [])
    if not pending:
        print('Nothing in data/pending-additions.json.')
        return
    data = load_json(DATA, [])
    taken = {r['id'] for r in data}

    ready, holding = [], []
    for rec in pending:
        missing = [f for f in REQUIRED if rec.get(f) in (None, '', [])]
        if rec['id'] in taken:
            holding.append((rec, ['id "%s" is already on the map' % rec['id']]))
        elif missing:
            holding.append((rec, ['missing ' + ', '.join(missing)]))
        else:
            ready.append(rec)

    for rec, why in holding:
        print('  holding   %-28s %s' % (rec.get('name', '?')[:28], '; '.join(why)))
    for rec in ready:
        print('  merging   %-28s %s (%s, %s)' % (rec['name'][:28], rec['id'], rec['tier'], rec['category']))

    if args.dry_run:
        print('\n(dry run — nothing written)')
        return
    if not ready:
        print('\nNothing complete enough to merge yet.')
        return

    for rec in ready:
        clean = {k: v for k, v in rec.items() if not k.startswith('_')}
        data.append(clean)
    write_json(DATA, data)
    write_json(PENDING, [r for r in pending if r not in ready])
    print('\n%d record%s added to data/businesses.json — check the diff before committing'
          % (len(ready), '' if len(ready) == 1 else 's'))
    print('Still to do for each: logo, Shopify harvest, product index rescore,')
    print('a public_note if Silver, contacts — see the add-a-business checklist.')
    print('Then mark them Added on the admin page.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('approved', nargs='?', help='approved-suggestions.json from the admin page')
    ap.add_argument('--merge', action='store_true', help='move finished drafts into businesses.json')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    if args.merge:
        cmd_merge(args)
    elif args.approved:
        cmd_scaffold(args)
    else:
        ap.error('give an approved-suggestions.json, or --merge')


if __name__ == '__main__':
    main()
