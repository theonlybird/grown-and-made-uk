#!/usr/bin/env python3
"""Build data/uk-places.json, the gazetteer the site search uses to know that
Wakefield, Chelmsford and Basingstoke are places.

    python3 scripts/build-places.py [--src DIR]

Why it exists. Every place the search recognised used to come from the
catalogue itself or from a hand-typed list of the 50 largest towns, so a town
became a word only once a maker there was listed. "wakefield cheese" was read
as a misspelling ("Ware Field"), and "chelmsford pottery" quietly dropped
Chelmsford and claimed an exact match.

Source: GeoNames (https://www.geonames.org), CC BY 4.0 -- credited in the map's
attribution line. Two files from https://download.geonames.org/export/dump/:
GB.zip (unzipped to GB.txt) and admin2Codes.txt. Pass --src for a folder that
already holds them; otherwise they are downloaded (needs network, so run this
somewhere that has it).

What goes in: every populated place of 1,000 people or more, plus every
administrative seat whatever its size -- about 4,700 places across the four
nations. Each one carries the county-level areas it sits in, so the page can
tell that a business near Ossett is in Wakefield, West Yorkshire and
Yorkshire without trusting whatever the county field happens to say.

Output (all keys normalised the way the page normalises a query: lower case,
"&" -> "and", apostrophes dropped, anything else non-alphanumeric -> space,
"saint" -> "st"):

    { "v": 1, "source": "...",
      "areas":  [[key, lat, lng], ...],          # centroid of the member places
      "places": [[key, lat, lng, pop, nation, [area index, ...]], ...],
      "aliases": { "hull": "kingston upon hull", ... },
      "parents": { "west yorkshire": ["yorkshire"], ... } }  # true containment only

Re-run it only if the place list itself needs to change; nothing about the
catalogue feeds into it.
"""
import argparse, csv, io, json, os, re, sys, urllib.request, zipfile
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'uk-places.json')
BASE = 'https://download.geonames.org/export/dump/'
MIN_POP = 1000
NATION = {'ENG': 'E', 'SCT': 'S', 'WLS': 'W', 'NIR': 'N'}


def norm(s):
    s = s.lower().replace('&', ' and ').replace("'", '').replace('’', '')
    s = re.sub(r'[^a-z0-9]+', ' ', s).strip()
    s = re.sub(r'\bsaint\b', 'st', s)
    return re.sub(r'\s+', ' ', s)


# GeoNames' admin2 names, tidied into the name a visitor would type.
PREFIX = re.compile(r'^(the |city and borough of |city and county of |city of |royal borough of |'
                    r'metropolitan borough of |borough of |district of |county of |sir )')
SUFFIX = re.compile(r' (county borough|city|islands|council)$')


def area_key(name):
    k = norm(name)
    k = PREFIX.sub('', k)
    k = SUFFIX.sub('', k)
    if k == 'bournemouth christchurch and poole':
        return 'bournemouth christchurch and poole'
    return k


# admin2 key -> the ceremonial / historic / group names it also answers to.
# England: ceremonial counties. Scotland and Wales: the historic county names
# people still search by. Northern Ireland: the six counties (the council
# districts straddle them, so a district can belong to two).
EXTRA = {
    # South / West Yorkshire
    **{k: ['south yorkshire', 'yorkshire'] for k in ['barnsley', 'doncaster', 'rotherham', 'sheffield']},
    **{k: ['west yorkshire', 'yorkshire'] for k in ['bradford', 'calderdale', 'kirklees', 'leeds', 'wakefield']},
    'north yorkshire': ['yorkshire'], 'york': ['north yorkshire', 'yorkshire'],
    'middlesbrough': ['north yorkshire', 'yorkshire'], 'redcar and cleveland': ['north yorkshire', 'yorkshire'],
    'east riding of yorkshire': ['yorkshire', 'east yorkshire'],
    'kingston upon hull': ['east riding of yorkshire', 'yorkshire', 'east yorkshire'],
    # Somerset, Dorset, Bristol, Gloucestershire
    'bath and north east somerset': ['somerset'], 'north somerset': ['somerset'],
    'bournemouth christchurch and poole': ['dorset'],
    'south gloucestershire': ['gloucestershire'],
    # West Midlands (metropolitan county)
    **{k: ['west midlands'] for k in ['birmingham', 'coventry', 'dudley', 'sandwell', 'solihull', 'walsall', 'wolverhampton']},
    # Lancashire, Greater Manchester, Merseyside, Cheshire
    'blackburn with darwen': ['lancashire'], 'blackpool': ['lancashire'],
    **{k: ['greater manchester'] for k in ['bolton', 'bury', 'manchester', 'oldham', 'rochdale',
                                           'salford', 'stockport', 'tameside', 'trafford', 'wigan']},
    **{k: ['merseyside'] for k in ['liverpool', 'knowsley', 'sefton', 'st helens', 'wirral']},
    **{k: ['cheshire'] for k in ['halton', 'warrington', 'cheshire east', 'cheshire west and chester']},
    # Home counties and the south
    **{k: ['berkshire'] for k in ['bracknell forest', 'reading', 'slough', 'west berkshire',
                                  'windsor and maidenhead', 'wokingham']},
    'brighton and hove': ['east sussex', 'sussex'], 'east sussex': ['sussex'], 'west sussex': ['sussex'],
    'milton keynes': ['buckinghamshire'],
    'peterborough': ['cambridgeshire'],
    'isles of scilly': ['cornwall'],
    **{k: ['county durham', 'durham'] for k in ['darlington', 'hartlepool', 'stockton on tees']},
    'county durham': ['durham'],
    'derby': ['derbyshire'],
    **{k: ['devon'] for k in ['plymouth', 'torbay']},
    **{k: ['essex'] for k in ['southend on sea', 'thurrock']},
    **{k: ['tyne and wear'] for k in ['gateshead', 'newcastle upon tyne', 'north tyneside', 'south tyneside', 'sunderland']},
    **{k: ['hampshire'] for k in ['portsmouth', 'southampton']},
    'medway': ['kent'],
    'greater london': ['london'],
    'leicester': ['leicestershire'],
    **{k: ['lincolnshire'] for k in ['north lincolnshire', 'north east lincolnshire']},
    **{k: ['bedfordshire'] for k in ['luton', 'bedford', 'central bedfordshire']},
    **{k: ['northamptonshire'] for k in ['north northamptonshire', 'west northamptonshire']},
    'nottingham': ['nottinghamshire'],
    'telford and wrekin': ['shropshire'],
    'stoke on trent': ['staffordshire'],
    'swindon': ['wiltshire'],
    'cumbria': ['cumberland', 'westmorland'],
    # Scotland
    'perth and kinross': ['perthshire', 'kinross', 'kinross shire'],
    'scottish borders': ['borders'],
    'dumfries and galloway': ['dumfriesshire', 'galloway', 'dumfries'],
    'eilean siar': ['western isles', 'outer hebrides', 'na h eileanan siar', 'hebrides'],
    'argyll and bute': ['argyll'],
    **{k: ['ayrshire'] for k in ['east ayrshire', 'north ayrshire', 'south ayrshire']},
    **{k: ['lanarkshire'] for k in ['north lanarkshire', 'south lanarkshire']},
    **{k: ['dunbartonshire'] for k in ['east dunbartonshire', 'west dunbartonshire']},
    'east renfrewshire': ['renfrewshire'],
    'stirling': ['stirlingshire'],
    'aberdeen': ['aberdeenshire'],
    # Wales
    'ceredigion': ['cardiganshire'],
    'anglesey': ['isle of anglesey', 'ynys mon'],
    'gwynedd': ['caernarfonshire', 'merionethshire'],
    **{k: ['glamorgan'] for k in ['cardiff', 'vale of glamorgan', 'bridgend', 'rhondda cynon taf',
                                  'merthyr tydfil', 'swansea', 'neath port talbot']},
    **{k: ['gwent'] for k in ['newport', 'torfaen', 'blaenau gwent', 'caerphilly', 'monmouthshire']},
    # Northern Ireland: districts -> counties
    'antrim and newtownabbey': ['county antrim'],
    'mid and east antrim': ['county antrim'],
    'causeway coast and glens': ['county antrim', 'county londonderry'],
    'belfast': ['county antrim'],
    'lisburn and castlereagh': ['county antrim', 'county down'],
    'ards and north down': ['county down'],
    'newry mourne and down': ['county down', 'county armagh'],
    'armagh city banbridge and craigavon': ['county armagh', 'county down'],
    'derry city and strabane': ['county londonderry', 'county tyrone', 'derry'],
    'fermanagh and omagh': ['county fermanagh', 'county tyrone'],
    'mid ulster': ['county tyrone', 'county londonderry'],
}

# Short names people actually type for places GeoNames spells in full.
ALIASES = {
    'hull': 'kingston upon hull',
    'newcastle': 'newcastle upon tyne',
    'stoke': 'stoke on trent',
    'southend': 'southend on sea',
    'the potteries': 'stoke on trent',
    'brum': 'birmingham',
    'edinburgh city': 'edinburgh',
}


def fetch(src, name):
    path = os.path.join(src, name)
    if os.path.exists(path):
        return path
    os.makedirs(src, exist_ok=True)
    if name == 'GB.txt':
        data = urllib.request.urlopen(BASE + 'GB.zip').read()
        zipfile.ZipFile(io.BytesIO(data)).extract('GB.txt', src)
    else:
        urllib.request.urlretrieve(BASE + name, path)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(ROOT, '.geonames'))
    a = ap.parse_args()

    admin2 = {}
    with open(fetch(a.src, 'admin2Codes.txt'), encoding='utf8') as fh:
        for line in fh:
            code, name = line.rstrip('\n').split('\t')[:2]
            if code.startswith('GB.'):
                admin2[code] = area_key(name)

    places = []
    with open(fetch(a.src, 'GB.txt'), encoding='utf8') as fh:
        for r in csv.reader(fh, delimiter='\t', quoting=csv.QUOTE_NONE):
            if r[6] != 'P' or r[10] not in NATION:
                continue
            pop = int(r[14] or 0)
            if pop < MIN_POP and not r[7].startswith('PPLA') and r[7] != 'PPLC':
                continue
            a2 = admin2.get('GB.%s.%s' % (r[10], r[11]))
            keys = []
            if a2:
                keys.append(a2)
                keys.extend(EXTRA.get(a2, []))
            places.append((norm(r[2]), round(float(r[4]), 4), round(float(r[5]), 4),
                           pop, NATION[r[10]], keys))

    # Areas and their centroids (plain mean of the member places).
    members = defaultdict(list)
    for p in places:
        for k in p[5]:
            members[k].append(p)
    area_names = sorted(members)
    index = {k: i for i, k in enumerate(area_names)}
    areas = [[k,
              round(sum(p[1] for p in members[k]) / len(members[k]), 4),
              round(sum(p[2] for p in members[k]) / len(members[k]), 4)]
             for k in area_names]

    # Which bigger names each area belongs to, for a business whose own county
    # field names the area outright ("West Yorkshire" is in "yorkshire"). Only
    # true containment: the NI districts that straddle two counties are left
    # out, or County Armagh would be read as part of County Down.
    GROUPS = {'yorkshire', 'sussex', 'london', 'durham', 'east yorkshire', 'county durham',
              'east riding of yorkshire', 'greater london'}
    parents = defaultdict(set)
    for k, extras in EXTRA.items():
        if k.startswith(('antrim', 'mid ', 'causeway', 'belfast', 'lisburn', 'ards', 'newry',
                         'armagh', 'derry', 'fermanagh')):
            continue
        parents[k].update(extras)
        for e in extras:
            parents[e].update(x for x in extras if x != e and x in GROUPS)
    for k in list(parents):
        parents[k].discard(k)

    out = {
        'v': 1,
        'source': 'GeoNames (geonames.org), CC BY 4.0. Built by scripts/build-places.py.',
        'areas': areas,
        'places': [[p[0], p[1], p[2], p[3], p[4], sorted(index[k] for k in set(p[5]))]
                   for p in sorted(places, key=lambda p: -p[3])],
        'aliases': ALIASES,
        'parents': {k: sorted(v) for k, v in sorted(parents.items()) if v},
    }
    with open(OUT, 'w', encoding='utf8') as fh:
        json.dump(out, fh, separators=(',', ':'))
    print('%d places, %d areas -> %s (%d KB)'
          % (len(places), len(areas), os.path.relpath(OUT, ROOT), os.path.getsize(OUT) // 1024))


if __name__ == '__main__':
    main()
