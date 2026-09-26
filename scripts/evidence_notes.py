"""Internal tier reasoning, kept off the public site.

Every listing's evidence_note -- precedents, confidence, the hedges about what
could and could not be established -- is written for whoever decides the tier.
It used to sit on each record in data/businesses.json, which the site serves to
anyone at /data/businesses.json. Nothing on the site reads it, so since
26 Sep 2026 it lives here instead: data/evidence-notes.json, keyed by business
id, gitignored, never deployed. Keep a copy outside the repo.

    from evidence_notes import load, save, attach
    notes = load()            # {id: note}
    attach(records, notes)    # sets record['evidence_note'] in memory only
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, 'data', 'evidence-notes.json')


def load(required=True):
    if not os.path.exists(PATH):
        if required:
            sys.stderr.write('warning: data/evidence-notes.json not found -- '
                             'internal notes will read as empty\n')
        return {}
    with open(PATH, encoding='utf-8') as fh:
        return json.load(fh)


def save(notes):
    with open(PATH, 'w', encoding='utf-8') as fh:
        json.dump(notes, fh, indent=2, ensure_ascii=False)
        fh.write('\n')


def attach(records, notes=None):
    """Give each record its note, in memory only. Never write the result back
    to businesses.json."""
    notes = load() if notes is None else notes
    for r in records:
        r['evidence_note'] = notes.get(r['id'], '')
    return records
