"""Build per-player attribute data for rosters.json.

Adds to each player:  "a": "H,W,LETTERS,SRC"
  H, W     height (inches) and weight (lbs), 0 if unknown
  LETTERS  one letter per position rating, 'A'=-12 ... 'M'=0 ... 'Y'=+12, offset from overall
  SRC      what the ratings came from: c = combine, s = stats, z = size; empty = estimate
Usage: python3 -I attrs.py rosters.json data.json players.csv combine.csv pss.csv out.json
"""
import sys, json, csv, re, random, math

ros_p, data_p, pl_p, cb_p, pss_p, def_p, out_p = sys.argv[1:8]

KEYS = {  # must match ATTR_KEYS in engine.js
    'QB': ['arm', 'acc', 'pkt', 'mob'],
    'RB': ['spd', 'pow', 'elu', 'hnd'],
    'WR': ['spd', 'hnd', 'rte', 'phy'],
    'TE': ['blk', 'hnd', 'spd', 'rte'],
    'OL': ['pbk', 'rbk', 'str', 'ftw'],
    'DL': ['prs', 'rdf', 'str', 'qck'],
    'LB': ['tkl', 'cov', 'prs', 'spd'],
    'DB': ['cov', 'spd', 'bsk', 'tkl'],
    'K': ['kpw', 'kac'],
    'P': ['kpw', 'kac'],
}

def nk(n):
    n = str(n or '').lower()
    n = re.sub(r"[.'’]", '', n).replace('-', ' ')
    n = re.sub(r'\b(jr|sr|ii|iii|iv|v)\b', '', n)
    return re.sub(r'\s+', ' ', n).strip()

def f(x):
    try:
        v = float(x)
        return v if v == v else None
    except (TypeError, ValueError):
        return None

def ht(s):
    s = str(s or '')
    m = re.match(r'^(\d)-(\d+)$', s)
    if m: return int(m.group(1)) * 12 + int(m.group(2))
    v = f(s)
    return int(v) if v and 60 < v < 90 else None

R = json.load(open(ros_p))
D = json.load(open(data_p))

# ---- PFR draft rows, keyed by year-pick ----
draft = {}
for y, rows in D['drafts'].items():
    if not y.isdigit(): continue
    for r in rows:
        try: draft[(int(y), int(r['Pick']))] = r
        except (KeyError, ValueError): pass
# ---- 1970 rosters: size by name ----
size70 = {}
for t, rows in D['rosters'].items():
    for r in rows:
        h, w = ht(r.get('Ht')), f(r.get('Wt'))
        if h and w: size70[nk(r.get('Player'))] = (h, w, r.get('Player-additional'))

# ---- nflverse players ----
pl_by_pfr, pl_by_nb, pl_by_nr = {}, {}, {}
for r in csv.DictReader(open(pl_p)):
    h, w = f(r['height']), f(r['weight'])
    rec = {'h': int(h) if h and 60 < h < 90 else None, 'w': w if w and 140 < w < 420 else None, 'gsis': r['gsis_id'], 'pfr': r['pfr_id']}
    if r['pfr_id']: pl_by_pfr[r['pfr_id']] = rec
    k = nk(r['display_name'])
    b = r['birth_date'][:4]
    if b.isdigit(): pl_by_nb.setdefault((k, int(b)), rec)
    rs = r['rookie_season']
    if rs.isdigit(): pl_by_nr.setdefault((k, int(rs)), rec)

# ---- combine ----
cb_by_pfr, cb_by_ny = {}, {}
for r in csv.DictReader(open(cb_p)):
    rec = {k: f(r[k]) for k in ['forty', 'bench', 'vertical', 'broad_jump', 'cone', 'shuttle']}
    rec['h'], rec['w'] = ht(r['ht']), f(r['wt'])
    if r['pfr_id']: cb_by_pfr[r['pfr_id']] = rec
    dy = r['draft_year'] or r['season']
    if dy.isdigit(): cb_by_ny[(nk(r['player_name']), int(dy))] = rec

# ---- season stats (regular season), summed by gsis id ----
SUMK = ['games', 'completions', 'attempts', 'passing_yards', 'passing_tds', 'interceptions', 'sacks', 'carries', 'rushing_yards',
        'rushing_tds', 'rushing_fumbles', 'receptions', 'targets', 'receiving_yards', 'receiving_tds', 'receiving_fumbles', 'receiving_yards_after_catch']
pss = {}
for r in csv.DictReader(open(pss_p)):
    if r['season_type'] != 'REG': continue
    a = pss.setdefault(r['player_id'], {k: 0.0 for k in SUMK})
    for k in SUMK: a[k] += f(r[k]) or 0

DEFK = ['games', 'def_tackles_solo', 'def_tackles_for_loss', 'def_sacks', 'def_qb_hits', 'def_interceptions', 'def_pass_defended', 'def_fumbles_forced']
dfs = {}
for r in csv.DictReader(open(def_p)):
    if r['season_type'] != 'REG' or not r['player_id'] or r['player_id'] == '0': continue
    a = dfs.setdefault(r['player_id'], {k: 0.0 for k in DEFK})
    for k in DEFK: a[k] += f(r[k]) or 0

# ---- features per player ----
feats = []  # (player, grp, dict)
for p in R['players']:
    g = p['g']
    if g not in KEYS: continue
    k = nk(p['n'])
    dr = draft.get(tuple(p['d'])) if p.get('d') else None
    if dr and nk(dr['Player']) != k: dr = None
    pfr = dr.get('-9999') if dr else None
    pl = (pl_by_pfr.get(pfr) if pfr else None) or (pl_by_nb.get((k, p['b'])) if p.get('b') else None) or pl_by_nr.get((k, p['f']))
    cb = (cb_by_pfr.get(pfr) if pfr else None) or (cb_by_pfr.get(pl['pfr']) if pl and pl['pfr'] else None) or (cb_by_ny.get((k, p['d'][0])) if p.get('d') else None)
    st = pss.get(pl['gsis']) if pl and pl['gsis'] else None
    h = (pl and pl['h']) or (cb and cb['h']) or (size70.get(k, (None,))[0] if p['f'] <= 1970 else None)
    w = (pl and pl['w']) or (cb and cb['w']) or (size70.get(k, (None, None))[1] if p['f'] <= 1970 else None)
    x = {'h': h, 'w': w}
    if cb:
        for kk in ['forty', 'bench', 'vertical', 'broad_jump', 'cone', 'shuttle']: x[kk] = cb[kk]
    src = set()
    if cb and any(cb[kk] for kk in ['forty', 'bench', 'vertical', 'cone', 'shuttle']): src.add('c')
    if h and w: src.add('z')
    # draft-row career numbers
    G = f(dr.get('G')) if dr else None
    if dr and G and G >= 8:
        att, cmp_, yds, td, it = (f(dr.get(c)) or 0 for c in ['Att', 'Cmp', 'Yds', 'TD', 'Int'])
        if g == 'QB' and att >= 150:
            x['cmp%'] = (cmp_ / att, att); x['ypa'] = (yds / att, att); x['int%'] = (it / att, att); x['td%'] = (td / att, att); src.add('s')
        rec = f(dr.get('Rec'))
        if g in ('RB', 'WR', 'TE') and rec is not None: x['rpg'] = (rec / G, G); src.add('s')
        sk = f(dr.get('Sk'))
        if g in ('DL', 'LB', 'DB') and sk is not None: x['skpg'] = (sk / G, G); src.add('s')
        solo = f(dr.get('Solo'))
        if g in ('DL', 'LB', 'DB') and solo: x['tpg'] = (solo / G, G); src.add('s')
        x['pbr'] = ((f(dr.get('PB')) or 0) + 2 * (f(dr.get('AP1')) or 0)) / max(1, G / 16)
    if st:
        gm = st['games'] or 1
        if g == 'QB' and st['attempts'] >= 150:
            a = st['attempts']
            x.setdefault('cmp%', (st['completions'] / a, a)); x.setdefault('ypa', (st['passing_yards'] / a, a))
            x.setdefault('int%', (st['interceptions'] / a, a)); x.setdefault('td%', (st['passing_tds'] / a, a))
            x['sk%'] = (st['sacks'] / (a + st['sacks']), a)
            src.add('s')
        if st['carries'] >= 40:
            x['ypc'] = (st['rushing_yards'] / st['carries'], st['carries']); x['rtd'] = (st['rushing_tds'] / st['carries'], st['carries']); src.add('s')
            x['qbrun'] = (st['rushing_yards'] / gm, gm)
        if st['targets'] >= 30:
            ypr = st['receiving_yards'] / max(1, st['receptions'])
            # deep targets are caught less often: adjust catch rate for depth
            x['ctch'] = (st['receptions'] / st['targets'] + 0.025 * (ypr - 11.5), st['targets']); x['ypr'] = (ypr, st['receptions'])
            x['yac'] = (st['receiving_yards_after_catch'] / max(1, st['receptions']), st['receptions'])
            x.setdefault('rpg', (st['receptions'] / gm, gm)); src.add('s')
        tch = st['carries'] + st['receptions']
        if tch >= 60: x['fum'] = ((st['rushing_fumbles'] + st['receiving_fumbles']) / tch, tch)
    df = dfs.get(pl['gsis']) if pl and pl['gsis'] else None
    if df and g in ('DL', 'LB', 'DB') and df['games'] >= 16:
        gm = df['games']
        x['skpg'] = (df['def_sacks'] / gm, gm); x['tpg'] = (df['def_tackles_solo'] / gm, gm)
        x['hit'] = ((df['def_qb_hits'] + df['def_sacks']) / gm, gm); x['tfl'] = (df['def_tackles_for_loss'] / gm, gm)
        x['ipg'] = (df['def_interceptions'] / gm, gm); x['pdpg'] = (df['def_pass_defended'] / gm, gm); x['ff'] = (df['def_fumbles_forced'] / gm, gm)
        src.add('s')
    feats.append((p, g, x, src))

# ---- z-scores within position group ----
def stats_of(g, key):
    vals = []
    for _, gg, x, _ in feats:
        if gg != g or x.get(key) is None: continue
        v = x[key]
        vals.append(v[0] if isinstance(v, tuple) else v)
    if len(vals) < 20: return None
    m = sum(vals) / len(vals)
    sd = math.sqrt(sum((v - m) ** 2 for v in vals) / len(vals)) or 1
    return m, sd

ZS = {}
def z(g, x, key, shrink=0, sign=1):
    v = x.get(key)
    if v is None: return None
    if (g, key) not in ZS: ZS[(g, key)] = stats_of(g, key)
    s = ZS[(g, key)]
    if not s: return None
    n = None
    if isinstance(v, tuple): v, n = v
    zz = (v - s[0]) / s[1]
    if shrink and n is not None: zz *= n / (n + shrink)
    return max(-3.5, min(3.5, zz * sign))

def mix(*parts):
    """weighted average of available parts: (weight, value-or-None)"""
    a = b = 0.0
    for wgt, v in parts:
        if v is None: continue
        a += wgt * v; b += wgt
    return a / b if b else None

DBG = {"Lamar Jackson", "Calvin Johnson", "Randy Moss"}
rng = random.Random(1970)
LET = 'ABCDEFGHIJKLMNOPQRSTUVWXY'
counts = {}
for p, g, x, src in feats:
    H = z(g, x, 'h'); Wz = z(g, x, 'w')
    fast = mix((1, z(g, x, 'forty', sign=-1)), (0.4, z(g, x, 'broad_jump')), (0.3, z(g, x, 'vertical')))
    agile = mix((1, z(g, x, 'cone', sign=-1)), (1, z(g, x, 'shuttle', sign=-1)))
    bench = z(g, x, 'bench')
    # within a position, heavy for his height usually means slower
    slim = -(Wz - 0.6 * H) if Wz is not None and H is not None else (-Wz * 0.6 if Wz is not None else None)
    spd = fast if fast is not None else (0.8 * slim if slim is not None else None)
    pb = x.get('pbr')
    if g == 'QB':
        v = [mix((1, z(g, x, 'ypa', 300)), (0.25, H), (0.15, Wz)),
             z(g, x, 'cmp%', 400),
             mix((1, z(g, x, 'int%', 400, -1)), (0.6, z(g, x, 'td%', 400)), (0.5, z(g, x, 'sk%', 400, -1))),
             mix((1, z(g, x, 'qbrun', 10)), (0.8, fast), (0.3, slim))]
    elif g == 'RB':
        v = [mix((1, spd), (0.3, z(g, x, 'ypc', 150))),
             mix((1, Wz), (0.5, bench), (0.5, z(g, x, 'rtd', 150))),
             mix((1, z(g, x, 'ypc', 150)), (0.7, agile), (0.3, z(g, x, 'fum', 200, -1)), (0.5 if x.get('ypc') is None and agile is None else 0, (min(2.5, pb * 1.2) - 0.3) if pb is not None else None)),
             mix((1, z(g, x, 'rpg', 20)), (0.8, z(g, x, 'ctch', 60)))]
    elif g == 'WR':
        v = [mix((1, spd), (0.3 if fast is not None else 1.2, z(g, x, 'ypr', 60))),
             mix((1, z(g, x, 'ctch', 80)), (0.3, z(g, x, 'fum', 200, -1))),
             mix((1, z(g, x, 'rpg', 30)), (0.6, agile), (0.3, z(g, x, 'yac', 60))),
             mix((1, H), (0.8, Wz), (0.3, z(g, x, 'vertical')))]
    elif g == 'TE':
        v = [mix((1, Wz), (0.5, bench), (0.4, z(g, x, 'rpg', 30, -1))),
             mix((1, z(g, x, 'ctch', 60)), (0.5, z(g, x, 'rpg', 30))),
             spd,
             mix((1, z(g, x, 'rpg', 30)), (0.5, agile), (0.3, z(g, x, 'ypr', 40)))]
    elif g == 'OL':
        v = [mix((1, H), (0.8, agile), (0.5, fast)),
             mix((1, Wz), (0.6, bench)),
             mix((1, bench), (0.6, Wz)),
             mix((1, agile), (0.8, fast), (0.3, slim))]
    elif g == 'DL':
        v = [mix((1, z(g, x, 'skpg', 60)), (0.7, z(g, x, 'hit', 30)), (0.4, fast)),
             mix((1, Wz), (0.6, z(g, x, 'tpg', 60)), (0.6, z(g, x, 'tfl', 30))),
             mix((1, bench), (0.6, Wz)),
             mix((1, fast), (0.6, agile), (0.3, slim))]
    elif g == 'LB':
        v = [mix((1, z(g, x, 'tpg', 60)), (0.5, z(g, x, 'tfl', 30)), (0.3, z(g, x, 'ff', 30)), (0.3, Wz)),
             mix((1, z(g, x, 'pdpg', 30)), (0.6, z(g, x, 'ipg', 30)), (0.8, spd), (0.6, agile), (0.3, z(g, x, 'skpg', 60, -1))),
             mix((1, z(g, x, 'skpg', 60)), (0.6, z(g, x, 'hit', 30))),
             spd]
    elif g == 'DB':
        v = [mix((1.2, z(g, x, 'pdpg', 30)), (1, spd), (0.6, agile), (0.4, H), (0.4, (min(2.5, pb * 1.5) - 0.3) if pb is not None else None)),
             spd,
             mix((1.5, z(g, x, 'ipg', 30)), (0.6, z(g, x, 'pdpg', 30)), (0.5, z(g, x, 'vertical')), (0.4, H), (0.4, (min(2.5, pb * 1.5) - 0.3) if pb is not None else None)),
             mix((1, z(g, x, 'tpg', 60)), (0.6, Wz))]
    else:  # K, P: nothing measured
        v = [None, None]
    # small seeded variety so missing data doesn't give everyone flat ratings
    if 0: print(p["n"], g, [None if vv is None else round(vv,2) for vv in v], {k: (round(x[k][0],3) if isinstance(x[k],tuple) else x[k]) for k in x})
    v = [(vv if vv is not None else 0) + rng.gauss(0, 0.28 if vv is not None else 0.7) for vv in v]
    m = sum(v) / len(v)
    off = [max(-12, min(12, round((vv - m) * 5))) for vv in v]
    s = ''.join(c for c in 'csz' if c in src)
    p['a'] = f"{x['h'] or 0},{int(x['w'] or 0)},{''.join(LET[o + 12] for o in off)},{s}"
    counts[g] = counts.get(g, 0) + 1

json.dump(R, open(out_p, 'w'), separators=(',', ':'))
have_size = sum(1 for p in R['players'] if p.get('a') and not p['a'].startswith('0,'))
print('players', len(R['players']), 'with size', have_size, counts)
src = {}
for p in R['players']:
    if p.get('a'): k = p['a'].split(',')[3]; src[k] = src.get(k, 0) + 1
print('sources', src)
