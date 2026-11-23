/* Gridiron GM — simulation engine (no DOM). Works in browser and Node. */
(function (root) {
'use strict';

/* ---------- random helpers ---------- */
const R = {
  int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
  pick: a => a[Math.floor(Math.random() * a.length)],
  norm: () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
  shuffle: a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  poisson: l => { const L = Math.exp(-Math.max(0.01, l)); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }
};
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };

/* ---------- league history data ---------- */
// [pfr franchise code, abbr, city, nickname, conference, division]
const TEAMS_1970 = [
  ['clt','BAL','Baltimore','Colts','AFC','East'], ['nwe','BOS','Boston','Patriots','AFC','East'],
  ['buf','BUF','Buffalo','Bills','AFC','East'], ['mia','MIA','Miami','Dolphins','AFC','East'],
  ['nyj','NYJ','New York','Jets','AFC','East'],
  ['cin','CIN','Cincinnati','Bengals','AFC','Central'], ['cle','CLE','Cleveland','Browns','AFC','Central'],
  ['oti','HOU','Houston','Oilers','AFC','Central'], ['pit','PIT','Pittsburgh','Steelers','AFC','Central'],
  ['den','DEN','Denver','Broncos','AFC','West'], ['kan','KC','Kansas City','Chiefs','AFC','West'],
  ['rai','OAK','Oakland','Raiders','AFC','West'], ['sdg','SD','San Diego','Chargers','AFC','West'],
  ['dal','DAL','Dallas','Cowboys','NFC','East'], ['nyg','NYG','New York','Giants','NFC','East'],
  ['phi','PHI','Philadelphia','Eagles','NFC','East'], ['crd','STL','St. Louis','Cardinals','NFC','East'],
  ['was','WAS','Washington','Redskins','NFC','East'],
  ['chi','CHI','Chicago','Bears','NFC','Central'], ['det','DET','Detroit','Lions','NFC','Central'],
  ['gnb','GB','Green Bay','Packers','NFC','Central'], ['min','MIN','Minnesota','Vikings','NFC','Central'],
  ['atl','ATL','Atlanta','Falcons','NFC','West'], ['ram','LA','Los Angeles','Rams','NFC','West'],
  ['nor','NO','New Orleans','Saints','NFC','West'], ['sfo','SF','San Francisco','49ers','NFC','West']
];

// League changes applied at the start of each listed season.
const EVENTS = {
  1971: [{ t: 'rename', pfr: 'nwe', city: 'New England', abbr: 'NE' }],
  1976: [{ t: 'expand', team: ['sea','SEA','Seattle','Seahawks','NFC','West'] },
         { t: 'expand', team: ['tam','TB','Tampa Bay','Buccaneers','AFC','West'] }],
  1977: [{ t: 'realign', pfr: 'sea', conf: 'AFC', div: 'West' }, { t: 'realign', pfr: 'tam', conf: 'NFC', div: 'Central' }],
  1982: [{ t: 'rename', pfr: 'rai', city: 'Los Angeles', abbr: 'LARD' }],
  1984: [{ t: 'rename', pfr: 'clt', city: 'Indianapolis', abbr: 'IND' }],
  1988: [{ t: 'rename', pfr: 'crd', city: 'Phoenix', abbr: 'PHX' }],
  1994: [{ t: 'rename', pfr: 'crd', city: 'Arizona', abbr: 'ARI' }],
  1995: [{ t: 'rename', pfr: 'ram', city: 'St. Louis', abbr: 'STL' }, { t: 'rename', pfr: 'rai', city: 'Oakland', abbr: 'OAK' },
         { t: 'expand', team: ['car','CAR','Carolina','Panthers','NFC','West'] },
         { t: 'expand', team: ['jax','JAX','Jacksonville','Jaguars','AFC','Central'] }],
  1996: [{ t: 'rename', pfr: 'cle', newPfr: 'rav', city: 'Baltimore', name: 'Ravens', abbr: 'BAL' }],
  1997: [{ t: 'rename', pfr: 'oti', city: 'Tennessee', abbr: 'TEN' }],
  1999: [{ t: 'rename', pfr: 'oti', name: 'Titans' }, { t: 'expand', team: ['cle','CLE','Cleveland','Browns','AFC','Central'] }],
  2002: [{ t: 'expand', team: ['htx','HOU','Houston','Texans','AFC','South'] },
         { t: 'realignAll', map: {
           AFC: { East: ['buf','mia','nwe','nyj'], North: ['rav','cin','cle','pit'], South: ['htx','clt','jax','oti'], West: ['den','kan','rai','sdg'] },
           NFC: { East: ['dal','nyg','phi','was'], North: ['chi','det','gnb','min'], South: ['atl','car','nor','tam'], West: ['crd','ram','sfo','sea'] } } }],
  2016: [{ t: 'rename', pfr: 'ram', city: 'Los Angeles', abbr: 'LAR' }],
  2017: [{ t: 'rename', pfr: 'sdg', city: 'Los Angeles', abbr: 'LAC' }],
  2020: [{ t: 'rename', pfr: 'rai', city: 'Las Vegas', abbr: 'LV' }, { t: 'rename', pfr: 'was', name: 'Football Team' }],
  2022: [{ t: 'rename', pfr: 'was', name: 'Commanders' }]
};

function rules(y) {
  return {
    games: y === 1982 ? 9 : (y === 1987 ? 15 : (y < 1978 ? 14 : (y < 2021 ? 16 : 17))),
    playoffPerConf: y === 1982 ? 8 : (y < 1978 ? 4 : (y < 1990 ? 5 : (y < 2020 ? 6 : 7))),
    strike: y === 1982 || y === 1987,
    draftRounds: y <= 1976 ? 17 : (y <= 1992 ? 12 : (y === 1993 ? 8 : 7)),
    rosterMax: y <= 1973 ? 40 : (y === 1974 ? 47 : (y <= 1977 ? 43 : (y <= 1992 ? 45 : 53))),
    regOT: y >= 1974,
    tiesCountHalf: y >= 1972,
    salaryCap: y >= 1994
  };
}

/* ---------- positions ---------- */
const GRPS = ['QB','RB','WR','TE','OL','DL','LB','DB','K','P'];
const STARTERS = { QB: 1, RB: 2, WR: 2, TE: 1, OL: 5, DL: 4, LB: 3, DB: 4, K: 1, P: 1 };
// Who is on the field: QB, five linemen, a kicker and punter, plus the skill and defensive
// personnel that the team's schemes use (three receivers, two tight ends, a 3-4, a nickel...).
function formation(c) {
  const F = Object.assign({}, STARTERS), o = c && SCHEME[c.os], d = c && SCHEME[c.ds];
  if (o && o.pers) Object.assign(F, o.pers);
  if (d && d.pers) Object.assign(F, d.pers);
  return F;
}
function startersFor(L, tid) { return formation(L.teams[tid] && L.teams[tid].coach); }
function offPers(F) { return `${F.RB}${F.TE} personnel: ${F.RB} RB, ${F.TE} TE, ${F.WR} WR`; }
function defPers(F) { const n = F.DB === 5 ? ' nickel' : F.DB === 6 ? ' dime' : ''; return `${F.DL}-${F.LB}${F.DB === 4 ? '' : '-' + F.DB}${n}: ${F.DL} DL, ${F.LB} LB, ${F.DB} DB`; }
function persLabel(F) { return offPers(F) + ' · ' + defPers(F); }
const MIX40 = { QB: 3, RB: 4, WR: 4, TE: 2, OL: 8, DL: 6, LB: 5, DB: 6, K: 1, P: 1 };
const POSMAP = {
  QB: 'QB', RB: 'RB', HB: 'RB', FB: 'RB', TB: 'RB',
  WR: 'WR', FL: 'WR', SE: 'WR', SR: 'WR', E: 'WR',
  TE: 'TE',
  T: 'OL', G: 'OL', C: 'OL', OT: 'OL', OG: 'OL', OL: 'OL', LT: 'OL', RT: 'OL', LG: 'OL', RG: 'OL', LS: 'OL',
  DE: 'DL', DT: 'DL', DL: 'DL', NT: 'DL', LDE: 'DL', RDE: 'DL', LDT: 'DL', RDT: 'DL', LE: 'DL', RE: 'DL', MG: 'DL',
  LB: 'LB', MLB: 'LB', OLB: 'LB', ILB: 'LB', LLB: 'LB', RLB: 'LB', LILB: 'LB', RILB: 'LB', LOLB: 'LB', ROLB: 'LB',
  CB: 'DB', S: 'DB', FS: 'DB', SS: 'DB', DB: 'DB', LCB: 'DB', RCB: 'DB', RS: 'DB', LS2: 'DB',
  K: 'K', PK: 'K', P: 'P'
};
const DISPLAY_POS = { OL: ['T','G','C'], DL: ['DE','DT'], DB: ['CB','S'] };

function grpOf(pos, wt) {
  const first = String(pos || '').toUpperCase().split(/[-\/,]/)[0].replace(/[^A-Z]/g, '');
  if (POSMAP[first]) return POSMAP[first];
  const w = num(wt);
  if (w >= 245) return Math.random() < 0.5 ? 'OL' : 'DL';
  if (w >= 215) return 'LB';
  if (w > 0) return 'DB';
  return R.pick(['OL','DL','LB','DB']);
}

/* ---------- generated players ---------- */
const FIRST = ['Bill','Bob','Jim','Tom','John','Mike','Dave','Dan','Joe','Ron','Larry','Gary','Steve','Ken','Rich','Don','Jerry','Terry','Ray','Fred','Walt','Carl','Earl','Lee','Roy','Gene','Chuck','Mel','Ed','Hal','Willie','Leroy','Curtis','Otis','Reggie','Ted','Phil','Rod','Wayne','Doug','Paul','Mark','Greg','Tim','Chris','Pat','Glenn','Ernie','Vince','Al'];
const LAST = ['Johnson','Williams','Brown','Jones','Miller','Davis','Wilson','Anderson','Taylor','Thomas','Moore','Martin','Jackson','White','Harris','Clark','Lewis','Walker','Hall','Allen','Young','King','Wright','Hill','Scott','Green','Baker','Nelson','Carter','Mitchell','Roberts','Turner','Phillips','Campbell','Parker','Evans','Edwards','Collins','Stewart','Morris','Murphy','Cook','Rogers','Reed','Bailey','Bell','Cooper','Howard','Ward','Cox','Brooks','Gray','Hughes','Price','Sanders','Bennett','Wood','Barnes','Ross','Henderson','Coleman','Jenkins','Perry','Powell','Long','Patterson','Foster','Butler','Simmons','Bryant'];
const COLLEGES = ['Alabama','USC','Ohio State','Notre Dame','Texas','Michigan','Grambling','Nebraska','Oklahoma','Penn State','LSU','Purdue','Tennessee','Jackson State','Arizona State','UCLA','Florida A&M','Houston','Stanford','Iowa','Missouri','Southern','Kansas','Ole Miss','Syracuse'];

function genName() { return R.pick(FIRST) + ' ' + R.pick(LAST); }

function mkPlayer(L, o) {
  const p = Object.assign({ id: L.nextId++, name: genName(), pos: '', grp: 'LB', age: 24, ovr: 50, pot: 55, team: -1, inj: 0, yrs: 0, college: '', real: false, hist: {} }, o);
  if (!p.pos) p.pos = DISPLAY_POS[p.grp] ? R.pick(DISPLAY_POS[p.grp]) : p.grp;
  L.players[p.id] = p;
  return p;
}

function genPlayer(L, grp, team, mean, ageRange) {
  const age = R.int(ageRange[0], ageRange[1]);
  const ovr = clamp(Math.round(mean + R.norm() * 7), 35, 85);
  const pot = clamp(ovr + (age < 26 ? R.int(0, 12) : R.int(0, 3)), ovr, 95);
  return mkPlayer(L, { grp, team, age, ovr, pot, yrs: Math.max(0, age - 22), college: R.pick(COLLEGES), real: false });
}

/* ---------- position ratings ----------
   Every player has 2-4 ratings for his position that average out to his overall. Real players'
   strengths come from real data (rosters.json "a": height, weight, Combine results and career
   stats from nflverse and Pro-Football-Reference); everyone else gets a profile from his size.
   p.at holds each rating's offset from overall; age moves speed down and know-how up. */
const ATTR_KEYS = {
  QB: ['arm', 'acc', 'pkt', 'mob'], RB: ['spd', 'pow', 'elu', 'hnd'], WR: ['spd', 'hnd', 'rte', 'phy'], TE: ['blk', 'hnd', 'spd', 'rte'],
  OL: ['pbk', 'rbk', 'str', 'ftw'], DL: ['prs', 'rdf', 'str', 'qck'], LB: ['tkl', 'cov', 'prs', 'spd'], DB: ['cov', 'spd', 'bsk', 'tkl'],
  K: ['kpw', 'kac'], P: ['kpw', 'kac']
};
const ATTR_NAME = { arm: 'Arm strength', acc: 'Accuracy', pkt: 'Pocket presence', mob: 'Mobility', spd: 'Speed', pow: 'Power', elu: 'Elusiveness', hnd: 'Hands',
  rte: 'Route running', phy: 'Size and strength', blk: 'Blocking', pbk: 'Pass blocking', rbk: 'Run blocking', str: 'Strength', ftw: 'Footwork',
  prs: 'Pass rush', rdf: 'Run defense', qck: 'Quickness', tkl: 'Tackling', cov: 'Coverage', bsk: 'Ball skills', kpw: 'Leg strength', kac: 'Accuracy' };
const ATTR_SHORT = { arm: 'ARM', acc: 'ACC', pkt: 'PKT', mob: 'MOB', spd: 'SPD', pow: 'POW', elu: 'ELU', hnd: 'HND', rte: 'RTE', phy: 'PHY', blk: 'BLK', pbk: 'PBK', rbk: 'RBK',
  str: 'STR', ftw: 'FTW', prs: 'RSH', rdf: 'RUN', qck: 'QCK', tkl: 'TKL', cov: 'COV', bsk: 'BALL', kpw: 'LEG', kac: 'ACC' };
// how age moves each rating (relative to the others): athletic ones fade after 28, learned ones grow into the late 20s
const ATTR_ATH = { spd: 1, mob: 1, qck: 1, elu: 0.8, ftw: 0.5, kpw: 0.4, pow: 0.3 };
const ATTR_IQ = { acc: 1, pkt: 1, rte: 1, cov: 0.6, pbk: 0.6, tkl: 0.4, blk: 0.4, bsk: 0.5, kac: 0.6, hnd: 0.3, rdf: 0.3 };
// which way a heavier-than-usual body pushes each rating
const ATTR_SIZE = { pow: 1, str: 1, rbk: 1, rdf: 1, blk: 1, phy: 1, arm: 0.3, tkl: 0.4, spd: -1, qck: -1, mob: -0.8, elu: -0.8, ftw: -0.7, cov: -0.4, rte: -0.3, prs: -0.2, pbk: 0.2 };
// typical height (in) and weight (lb) by position, modern era
const SIZE = { QB: [75, 222, 2, 12], RB: [70.5, 214, 2, 14], WR: [72.5, 198, 2.3, 13], TE: [76.5, 252, 1.4, 10], OL: [76.5, 308, 1.4, 14],
  DL: [75.5, 285, 1.8, 22], LB: [74, 240, 1.5, 10], DB: [71.5, 197, 1.8, 10], K: [72.5, 200, 2, 15], P: [74.5, 214, 2, 15] };
function seeded(p, salt) {
  let h = 2166136261 ^ (p.id || 0) ^ (salt || 0); const s = String(p.name || '');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function seededNorm(rnd) { return Math.sqrt(-2 * Math.log(Math.max(1e-9, rnd()))) * Math.cos(2 * Math.PI * rnd()); }
function centerAt(a) { const m = a.reduce((s, x) => s + x, 0) / a.length; return a.map(x => clamp(Math.round(x - m), -14, 14)); }
// The real-data entry for this player, if rosters.json has him.
function realFor(p) {
  if (!REAL) return null;
  const d = p.draft && p.draft.year ? p.draft.year + '-' + p.draft.pick : p.realPick && p.reveal ? p.reveal + '-' + p.realPick.pick : null;
  if (d && REAL.byDraft[d] && nameKey(REAL.byDraft[d].n) === nameKey(p.name)) return REAL.byDraft[d];
  const list = REAL.byName[nameKey(p.name)]; if (!list) return null;
  const b = p.rc ? p.rc.y0 - p.rc.a0 : null;
  const same = list.filter(rp => rp.g === p.grp);
  const pool = same.length ? same : list;
  if (b == null || pool.length === 1) return pool[0];
  return pool.slice().sort((x, y) => Math.abs((x.b || b) - b) - Math.abs((y.b || b) - b))[0];
}
function decodeA(s) {
  const [h, w, l, src] = String(s).split(',');
  return { h: +h || 0, w: +w || 0, off: (l || '').split('').map(c => c.charCodeAt(0) - 77), src: src || '' };
}
// Give a player his ratings profile (once). Real players wait for rosters.json to load.
function ensureAttrs(p, year) {
  const keys = ATTR_KEYS[p.grp]; if (!keys) return false;
  if (p.at && p.at.length === keys.length && p.atG === p.grp) return true;
  const rnd = seeded(p, 7);
  let off = null, src = '';
  if (p.real && !p.me) {
    if (!REAL || !REAL.hasA) return false; // wait for the ratings data
    const rp = realFor(p);
    if (rp && rp.a && rp.g === p.grp) { const A = decodeA(rp.a); if (A.off.length === keys.length) { off = A.off; src = A.src || 'e'; } if (A.h) p.hin = A.h; if (A.w) p.wt = A.w; }
  }
  if (!p.hin && p.ht) p.hin = htInches(p.ht);
  const S = SIZE[p.grp], y = year || (p.draft && p.draft.year) || (p.rc && p.rc.y0) || 2000;
  const old = Math.max(0, Math.min(30, 2005 - y)) / 30; // lighter linemen in the 1970s
  if (!p.hin) p.hin = Math.round(S[0] - (p.grp === 'OL' || p.grp === 'DL' ? old : 0) + seededNorm(rnd) * S[2]);
  if (!p.wt) p.wt = Math.round(S[1] * (1 - old * (p.grp === 'OL' ? 0.17 : p.grp === 'DL' ? 0.12 : 0.05)) + seededNorm(rnd) * S[3]);
  if (!off) {
    // no real data: a profile from his frame plus some individuality
    const heavy = clamp((p.wt - S[1] * (1 - old * 0.1)) / S[3] - 0.5 * (p.hin - S[0]) / S[2], -2.5, 2.5);
    off = keys.map(k => (ATTR_SIZE[k] || 0) * heavy * 2.2 + seededNorm(rnd) * 4);
    src = '';
  }
  p.at = centerAt(off);
  p.atG = p.grp; p.atSrc = src;
  return true;
}
// [{k, name, short, v}] — his ratings today (they average to his overall)
function attrs(p, base) {
  const keys = ATTR_KEYS[p.grp]; if (!keys) return [];
  const o = base == null ? p.ovr : base;
  if (!ensureAttrs(p)) return keys.map(k => ({ k, name: ATTR_NAME[k], short: ATTR_SHORT[k], v: o, est: true }));
  const age = p.age || 25, B = p.atB || {};
  const raw = keys.map((k, i) => p.at[i] + (B[k] || 0) - (ATTR_ATH[k] || 0) * Math.max(0, age - 28) * 1.6 + (ATTR_IQ[k] || 0) * clamp(age - 25, -3, 5) * 0.9);
  const m = raw.reduce((s, x) => s + x, 0) / raw.length;
  return keys.map((k, i) => ({ k, name: ATTR_NAME[k], short: ATTR_SHORT[k], v: clamp(Math.round(o + raw[i] - m), 20, 99) }));
}
function attrOf(p, k, base) { const a = attrs(p, base).find(x => x.k === k); return a ? a.v : (base == null ? p.ovr : base); }
// how far a rating sits above (+) or below (-) his overall
function attrDelta(p, k) { const a = attrs(p).find(x => x.k === k); return a ? a.v - p.ovr : 0; }
function topAttr(p) { const a = attrs(p); if (!a.length) return null; return a.slice().sort((x, y) => y.v - x.v)[0]; }
function attrSource(p) {
  ensureAttrs(p);
  const s = p.atSrc || '';
  if (p.me) return 'Your build and training';
  if (!p.real) return 'Estimated from his size';
  if (!REAL) return 'Real data still loading';
  const parts = []; if (s.includes('c')) parts.push('Combine'); if (s.includes('s')) parts.push('career stats'); if (s.includes('z')) parts.push('height and weight');
  return parts.length ? 'Based on ' + parts.join(', ') : 'Estimated (no measurements on record)';
}
function ensureAllAttrs(L) { for (const id in L.players) { const p = L.players[id]; if (p.team >= -3 && !p.retiredYear && !(p.at && p.atG === p.grp)) ensureAttrs(p); } }
// rosters.json changed (new ratings data): real players re-read theirs; training and position changes are kept
function refreshAttrs(L) { ensureAllAttrs(L); }
function bodyText(p) { ensureAttrs(p); return p.hin ? `${htText(p.hin)}, ${p.wt} lb` : ''; }
// What kind of player he is ("Dual threat", "Deep threat", "Run stuffer"...), from how his ratings lean
function playerType(p) {
  const S = CAREER_STYLES[p.grp]; if (!S) return null;
  const A = attrs(p); if (A.length < 2) return null;
  const d = A.map(a => a.v - p.ovr), nd = Math.sqrt(d.reduce((s, x) => s + x * x, 0));
  const spread = Math.max(...A.map(a => a.v)) - Math.min(...A.map(a => a.v));
  if (spread < 6 || !nd) return { id: 'bal', name: 'Balanced', blurb: 'No big strength or weakness' };
  let best = null, bc = 0;
  for (const [id, label, w] of S) {
    if (id === 'bal') continue;
    const v = A.map(a => w[a.k] || 0), nv = Math.sqrt(v.reduce((s, x) => s + x * x, 0)); if (!nv) continue;
    const c = d.reduce((s, x, i) => s + x * v[i], 0) / (nd * nv);
    if (c > bc) { bc = c; best = [id, label]; }
  }
  if (!best || bc < 0.55) return { id: 'bal', name: 'Balanced', blurb: 'No style stands out' };
  const [name, blurb] = best[1].split(': ');
  return { id: best[0], name, blurb: blurb || '' };
}
function htText(inches) { return inches ? `${Math.floor(inches / 12)}'${inches % 12}"` : ''; }
// Training or a position change: shift a rating relative to the others.
function bumpAttr(p, k, d) { p.atB = p.atB || {}; p.atB[k] = clamp((p.atB[k] || 0) + d, -12, 12); }
// Keep what carries over when a player changes position (speed is speed).
function remapAttrs(p, fromG) {
  const oldK = ATTR_KEYS[fromG] || [], old = {}; if (p.at) oldK.forEach((k, i) => old[k] = p.at[i] + ((p.atB || {})[k] || 0));
  const keys = ATTR_KEYS[p.grp]; if (!keys) return;
  const rnd = seeded(p, 11);
  const ALIAS = { spd: ['mob', 'qck'], mob: ['spd', 'qck'], qck: ['spd', 'mob'], str: ['pow', 'phy', 'blk'], pow: ['str', 'phy'], phy: ['str', 'pow'], blk: ['rbk', 'pbk', 'str'],
    rbk: ['blk', 'str'], pbk: ['blk', 'ftw'], ftw: ['qck', 'spd'], hnd: ['bsk'], bsk: ['hnd'], rte: ['cov'], cov: ['rte'], tkl: ['rdf'], rdf: ['tkl'], prs: ['qck'], elu: ['spd', 'mob'] };
  const carry = k => { if (old[k] != null) return old[k]; for (const a of ALIAS[k] || []) if (old[a] != null) return old[a]; return null; };
  p.at = centerAt(keys.map(k => carry(k) != null ? carry(k) : (ATTR_SIZE[k] || 0) * clamp((p.wt - SIZE[p.grp][1]) / SIZE[p.grp][3], -2, 2) * 2 + seededNorm(rnd) * 2));
  p.atB = {}; p.atG = p.grp;
}
// How a scheme uses each rating: offense keys run/deep/quick/qbRun/misd, defense rush/cover/box/disg
const ATTR_AFF = { arm: { deep: 1 }, acc: { quick: 1 }, pkt: { quick: 0.4, misd: 0.5 }, mob: { qbRun: 1.6, misd: 0.4 }, spd: { deep: 0.8, cover: 0.6, disg: 0.3 },
  pow: { run: 1 }, elu: { misd: 0.6, run: 0.4 }, hnd: { quick: 0.8 }, rte: { quick: 0.9 }, phy: { deep: 0.6 }, blk: { run: 0.9 }, pbk: { deep: 0.6, quick: 0.3 },
  rbk: { run: 1 }, str: { run: 0.4, box: 0.6 }, ftw: { misd: 0.7 }, prs: { rush: 1 }, rdf: { box: 1 }, qck: { rush: 0.5, disg: 0.5 }, tkl: { box: 0.8 },
  cov: { cover: 1 }, bsk: { cover: 0.7, disg: 0.4 } };
// +/- points of scheme fit from his ratings, with the rating that matters most
function attrFit(p, s) {
  if (!s || !s.a) return { v: 0, k: null };
  const A = attrs(p); let v = 0, best = null, bv = 0;
  for (const a of A) {
    const aff = ATTR_AFF[a.k]; if (!aff) continue;
    let w = 0; for (const d in aff) w += aff[d] * ((s.a[d] != null ? s.a[d] : 0.5) - 0.5);
    const c = (a.v - p.ovr) * w * 0.9; v += c;
    if (Math.abs(c) > Math.abs(bv)) { bv = c; best = a; }
  }
  return { v: clamp(v, -8, 8), k: best, c: bv };
}

function genRoster(L, tid, size, mean) {
  const mix = Object.assign({}, MIX40);
  const extra = ['OL','DB','DL','LB','WR','RB','TE'];
  let n = 40, i = 0;
  while (n < size) { mix[extra[i % extra.length]]++; n++; i++; }
  for (const g of GRPS) for (let k = 0; k < mix[g]; k++) genPlayer(L, g, tid, (mean || 56) + (k < STARTERS[g] ? 6 : -2), [22, 31]);
}

/* ---------- PFR CSV import ---------- */
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); rows.push(row); row = []; f = '';
    } else f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

function cleanName(s) { return String(s || '').replace(/\s*HOF\s*$/i, '').replace(/[*+]/g, '').trim(); }

function parsePFR(text) {
  const rows = parseCSV(String(text || '').replace(/^﻿/, '').trim()).filter(r => r.some(c => c.trim()));
  const hi = rows.findIndex(r => r.some(c => c.trim() === 'Player'));
  if (hi < 0) throw new Error('No "Player" column found. Copy the CSV text from Share & Export → Get table as CSV.');
  const idx = {};
  rows[hi].forEach((h, i) => { h = h.trim(); if (h && !(h in idx)) idx[h] = i; });
  const get = (r, k) => (k in idx ? (r[idx[k]] || '').trim() : '');
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    const name = cleanName(get(r, 'Player'));
    if (!name || name === 'Player' || /team total/i.test(name)) continue;
    const o = {}; for (const k in idx) o[k] = get(r, k);
    o.Player = name; out.push(o);
  }
  const kind = ('Rnd' in idx || 'Pick' in idx) ? 'draft' : (('AV' in idx || 'GS' in idx || 'Wt' in idx) ? 'roster' : 'unknown');
  if (kind === 'unknown') throw new Error('This doesn\'t look like a roster or draft table.');
  if (!out.length) throw new Error('The table has a header but no player rows.');
  return { kind, rows: out };
}

/* ---------- jersey numbers & ring of honor ---------- */
const NUM_RANGES = { QB: [[1, 19]], K: [[1, 19]], P: [[1, 19]], RB: [[20, 49]], DB: [[20, 49]], WR: [[80, 89], [10, 19]], TE: [[80, 89], [40, 49]],
  OL: [[50, 79]], DL: [[60, 79], [90, 99]], LB: [[50, 59], [90, 99]] };
function retiredNums(L, tid) { return new Set(((L.teams[tid] || {}).ring || []).map(r => r.num)); }
function ensureNumbers(L) {
  const byTeam = {};
  for (const id in L.players) { const p = L.players[id]; if (p.team >= 0) (byTeam[p.team] = byTeam[p.team] || []).push(p); }
  for (const tid in byTeam) {
    const used = new Set(), ret = retiredNums(L, +tid);
    const list = byTeam[tid].sort((a, b) => (b.yrs || 0) - (a.yrs || 0));
    const need = [];
    for (const p of list) {
      const n = p.nums && p.nums[tid] != null ? p.nums[tid] : p.num;
      if (n && !used.has(n) && !ret.has(n)) { used.add(n); p.num = n; (p.nums = p.nums || {})[tid] = n; } else need.push(p);
    }
    for (const p of need) {
      const ranges = NUM_RANGES[p.grp] || [[1, 99]];
      let n = null;
      for (const [a, b] of ranges) { const opts = []; for (let k = a; k <= b; k++) if (!used.has(k) && !ret.has(k)) opts.push(k); if (opts.length) { n = R.pick(opts); break; } }
      if (n == null) for (let k = 1; k <= 99; k++) if (!used.has(k) && !ret.has(k)) { n = k; break; }
      used.add(n); p.num = n; (p.nums = p.nums || {})[tid] = n;
    }
  }
}
function seasonsWith(p, tid) { return Object.values(p.hist || {}).filter(h => h.tm === tid).length; }
function ringEligible(L, tid) {
  const inRing = new Set(((L.teams[tid] || {}).ring || []).map(r => r.id));
  return Object.values(L.retired || {}).filter(p => !inRing.has(p.id) && seasonsWith(p, tid) >= 3)
    .sort((a, b) => careerScore(b) - careerScore(a));
}
function retireNumber(L, tid, pid, by) {
  const t = L.teams[tid], p = getP(L, pid); if (!t || !p) return 'Player not found.';
  t.ring = t.ring || [];
  if (t.ring.some(r => r.id === pid)) return 'His number is already retired.';
  const num = (p.nums && p.nums[tid]) || p.num || null;
  if (num && t.ring.some(r => r.num === num)) return `#${num} is already retired for another player.`;
  t.ring.push({ id: pid, name: p.name, pos: p.pos, num, y: L.year, seasons: seasonsWith(p, tid), by: by || 'user' });
  addNews(L, `${t.city} ${t.name} retire ${num ? '#' + num + ' for ' : 'the number of '}${p.pos} ${p.name}${by === 'ai' ? '' : ''}.`);
  return null;
}
function aiRingCheck(L, p) {
  // the team he played the most seasons for may honor him
  const cnt = {}; Object.values(p.hist || {}).forEach(h => { if (h.tm != null) cnt[h.tm] = (cnt[h.tm] || 0) + 1; });
  const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]; if (!best) return;
  const tid = +best[0], n = best[1]; if (tid === L.user) return;
  const t = L.teams[tid]; if (!t || (t.ring || []).some(r => r.id === p.id)) return;
  if ((p.hof > 0 && n >= 4) || (n >= 10 && (p.peak || 0) >= 80)) retireNumber(L, tid, p.id, 'ai');
}

function playerFromRoster(L, r, tid) {
  const grp = grpOf(r.Pos, r.Wt);
  const age = num(r.Age) || 25, g = num(r.G), gs = num(r.GS), av = num(r.AV);
  const yrs = /rook/i.test(r.Yrs) ? 0 : num(r.Yrs);
  let ovr;
  if (grp === 'K' || grp === 'P') ovr = 58 + av * 3 + (g >= 10 ? 6 : 0) + R.int(-3, 3);
  else ovr = 44 + av * 2.6 + Math.min(gs, 14) * 0.7 + (g > 0 ? 2 : 0) + R.int(-2, 2);
  ovr = clamp(Math.round(ovr), 38, 97);
  const growth = age <= 25 ? R.int(2, 12) * (27 - age) / 5 : R.int(0, 2);
  const pot = clamp(Math.round(ovr + growth), ovr, 99);
  const pos = String(r.Pos || '').toUpperCase().split(/[-\/]/)[0] || '';
  return mkPlayer(L, { name: r.Player, pos: pos || undefined, grp, age, ovr, pot, team: tid, yrs, college: r['College/Univ'] || '', real: true, num: num(r['No.']) || undefined });
}

// Scouting: what teams knew in the spring of the draft. Based on where the player
// was really picked plus a small bump for big programs. It ignores his NFL career.
const BIG_SCHOOLS = /^(Alabama|USC|Southern California|Ohio St|Notre Dame|Texas|Michigan|Nebraska|Oklahoma|Penn St|LSU|Tennessee|UCLA|Southern Cal|Arkansas|Georgia|Florida|Miami|Auburn|Stanford|Purdue|Michigan St|Mississippi|Ole Miss)/i;
const SMALL_POWERS = /^(Grambling|Jackson St|Southern|Florida A&M|Tennessee St|Alcorn|Prairie View|Texas Southern|Morgan St|Maryland-Eastern Shore)/i;
function slotGrade(overall) { return 50 + 31 * Math.exp(-(Math.max(1, overall) - 1) / 70); }
function collegeBump(c) { c = String(c || ''); return BIG_SCHOOLS.test(c) ? 2 : (SMALL_POWERS.test(c) ? 1 : 0); }

// The last season the imported data covers. Players whose career runs to here are still active,
// so their careers are projected forward instead of judged on a few seasons.
const DATA_LAST = 2025;
// Approximate Value isn't equal across positions: quarterbacks pile it up, tight ends, kickers and
// punters get little. Each position is scaled to the same footing before it becomes a rating.
const POS_AV = { QB: 0.86, RB: 1.08, WR: 1.04, TE: 1.6, OL: 0.98, DL: 0.97, LB: 0.96, DB: 1.08, K: 1.6, P: 2.0 };
// Above 88 ratings get harder to earn, so 99 is for the very best of all time.
function compressTop(x) { return x <= 88 ? x : 88 + 11 * (1 - Math.exp(-(x - 88) / 14)); }
function realCareer(r, year, grp) {
  const pick = num(r.Pick) || 300, to = num(r.To);
  let wav = Math.max(0, num(r.wAV)), pb = num(r.PB), ap = num(r.AP1);
  const s = to ? Math.max(0, Math.min(to, DATA_LAST) - year + 1) : 0;
  const prior = 1.5 + 7 * Math.exp(-(pick - 1) / 50); // AV a season that a pick like this usually gives
  const rate = s ? wav / s : 0;
  if (to >= DATA_LAST - 1) {
    const k = 2, left = Math.max(0, 10 - s) * 0.85, br = (wav + prior * k) / (s + k);
    wav += br * left; pb += pb / (s + k) * left; ap += ap / (s + k) * left;
  }
  const quick = s >= 1 && s <= 6 && rate >= prior * 1.15 && rate >= 5;
  wav *= POS_AV[grp] || 1;
  return { score: 45 + Math.sqrt(wav) * 4.2 + pb * 0.8 + ap * 1.0, quick, played: s > 0, s };
}
function noiseFor(s) { return s >= 5 ? 2.5 : s >= 2 ? 3.5 : s === 1 ? 4.5 : 5; }
function prospectFromDraft(L, r, year) {
  const grp = grpOf(r.Pos, 0);
  const overall = num(r.Pick) || 300;
  const slot = slotGrade(overall), college = r['College/Univ'] || '';
  // What he actually becomes: mostly his real (or projected) career, a little draft slot, plus some luck.
  const C = realCareer(r, year, grp);
  // The more real seasons we know about, the less luck: about ±5 for unknowns, ±2.5 for veterans.
  // Draft slot only matters much when we don't know how his career went: a proven late-rounder
  // (5+ real seasons) is judged almost entirely on what he did, not where he was picked.
  const ws = C.s >= 5 ? 0.05 : C.s >= 2 ? 0.1 : 0.2;
  const pot = clamp(Math.round(compressTop(ws * slot + (1 - ws) * C.score - 2.5 + R.norm() * noiseFor(C.s))), 40, 99);
  // Players who were good from day one start close to their ceiling.
  const ovr = C.quick ? clamp(pot - R.int(4, 8), 36, 84) : clamp(pot - R.int(8, 18), 36, 80);
  const scout = clamp(Math.round(slot + collegeBump(college) + R.norm() * 4), 40, 92);
  const pos = String(r.Pos || '').toUpperCase().split(/[-\/]/)[0];
  return mkPlayer(L, {
    name: r.Player, pos: pos || undefined, grp, age: num(r.Age) || 22, ovr, pot, team: -3, yrs: 0,
    college, real: true, scout, reveal: year, quick: C.quick || undefined, realTo: num(r.To) || undefined,
    realPick: { rnd: num(r.Rnd), pick: overall, tm: r.Tm || '' }
  });
}

// filler: true for the extra prospects added to a real draft class (late-round depth, never early picks).
function genProspect(L, year, filler) {
  const grp = R.pick(['QB','RB','RB','WR','WR','TE','OL','OL','OL','DL','DL','DL','LB','LB','DB','DB','DB','K','P'].filter(g => g !== 'K' && g !== 'P' || Math.random() < 0.3));
  const pot = clamp(Math.round((filler ? 46 : 52) + R.norm() * (filler ? 6 : 10)), 40, filler ? 72 : 96);
  const ovr = clamp(pot - R.int(8, 18), 36, 78);
  const kp = grp === 'K' || grp === 'P';
  const scout = clamp(Math.round(pot + R.norm() * (filler ? 4 : 8)), 40, filler ? (kp ? 54 : 60) : (kp ? 70 : 92));
  return mkPlayer(L, { grp, age: R.int(21, 23), ovr, pot, team: -3, college: R.pick(COLLEGES), real: false, reveal: year, scout, filler: filler || undefined });
}
// Generated extras in a real class are late-round depth: cap their grades (also fixes classes built before this rule).
function tameFillers(L, pool) {
  for (const id of pool) { const p = L.players[id]; if (!p || p.realPick || !p.filler && !pool.realClass) continue; const kp = p.grp === 'K' || p.grp === 'P'; p.scout = Math.min(p.scout, kp ? 54 : 60); p.pot = Math.min(p.pot, 72); }
}

/* ---------- league creation ---------- */
/* ---------- difficulty ---------- */
const DIFF = {
  rookie: { name: 'Rookie', tradeAsk: 0.95, offer: [1.0, 1.3], aiVisits: 5, edge: 1.5, smartStyles: 0.5, counter: false },
  pro:    { name: 'Pro', tradeAsk: 1.05, offer: [0.85, 1.15], aiVisits: 10, edge: 0, smartStyles: 1, counter: false },
  allpro: { name: 'All-Pro', tradeAsk: 1.2, offer: [0.7, 1.0], aiVisits: 15, edge: -1, smartStyles: 1, counter: true }
};
function diff(L) { return DIFF[L.diff] || DIFF.pro; }
function setDifficulty(L, d) { if (DIFF[d]) { L.diff = d; addNews(L, `Difficulty set to ${DIFF[d].name}.`); } }

// Each AI team picks the scheme its roster suits best: pass if its QB and receivers
// outclass its backs and line, blitz if its front four is the strength, and so on.
// Favorites play it safe; underdogs take more risks.
function bestStyle(L, tid, avg) {
  const r = ratings(L, tid, { off: 'bal', def: 'bal' });
  const pass = (r.QB * 0.6 + r.WR * 0.4) - (avg.QB * 0.6 + avg.WR * 0.4);
  const run = (r.RB * 0.5 + r.OL * 0.5) - (avg.RB * 0.5 + avg.OL * 0.5);
  const off = pass - run > 3 ? 'pass' : (run - pass > 3 ? 'run' : 'bal');
  const dl = r.DL - avg.DL, db = r.DB - avg.DB;
  const def = dl - db > 3 ? 'blitz' : (db - dl > 3 ? 'soft' : 'bal');
  const ovr = (r.off + r.def) / 2;
  const aggr = clamp(Math.round((50 + (avg.ovr - ovr) * 4) / 10) * 10, 20, 80);
  return { off, def, aggr };
}
function aiStyles(L, announce, fresh) {
  ensureSchemes(L); resetShares(L);
  const all = L.teams.map(t => ratings(L, t.id, { off: 'bal', def: 'bal' }));
  const avg = {}; GRPS.forEach(g => avg[g] = all.reduce((s, r) => s + r[g], 0) / all.length);
  avg.ovr = all.reduce((s, r) => s + (r.off + r.def) / 2, 0) / all.length;
  const changes = [];
  for (const t of L.teams) {
    if (t.id === L.user) continue;
    const c = t.coach, r = all[t.id] || ratings(L, t.id, { off: 'bal', def: 'bal' });
    const st = t.staff || {};
    // The team that invented a scheme runs it the year it appears.
    const inv = side => (side === 'off' ? OFF_SCHEMES : DEF_SCHEMES).find(s => s.from === L.year && s.origin === t.pfr && !s.base);
    const pickSide = side => {
      const cur = side === 'off' ? c.os : c.ds, iv = inv(side);
      if (iv) return iv.id;
      if (!fresh && Math.random() > diff(L).smartStyles) return cur;
      const pref = side === 'off' ? (st.oc && st.oc.pref) : (st.dc && st.dc.pref);
      const b = bestScheme(L, t.id, side, r, pref);
      const val = s => schemeFit(r, s) * 1.2 + schemeTrend(L, s.id) + (pref && pref === s.fam ? 0.6 : 0);
      // Coaches stick with their system unless something clearly better comes along.
      // switching means a year of installing the new scheme
      return (fresh || !SCHEME[cur] || val(b) - 1.0 - val(SCHEME[cur]) > 0.5) ? b.id : cur;
    };
    const os = pickSide('off'), ds = pickSide('def');
    if (announce && (os !== c.os || ds !== c.ds)) changes.push(`${t.abbr} ${os !== c.os ? 'to the ' + SCHEME[os].name : ''}${os !== c.os && ds !== c.ds ? ' and ' : ''}${ds !== c.ds ? (os !== c.os ? 'the ' : 'to the ') + SCHEME[ds].name : ''}`);
    c.os = os; c.ds = ds; c.off = SCHEME[os].fam; c.def = SCHEME[ds].fam;
    const ovr = (r.off + r.def) / 2;
    c.aggr = clamp(Math.round((50 + (avg.ovr - ovr) * 4) / 10) * 10, 20, 80);
    resetShares(L);
  }
  if (changes.length) addNews(L, 'New schemes for ' + L.year + ': ' + changes.slice(0, 6).join('; ') + (changes.length > 6 ? `; and ${changes.length - 6} more` : '') + '.');
}
// All-Pro: the AI coach adjusts his game plan to yours.
function counterPlan(own, user, L) {
  const y = L ? L.year : 1970;
  let bd = null, bv = 1e9;
  for (const d of schemesFor(y, 'def')) { const v = schemeEdge(y, user.os, d.id) + (DEF_VS[d.fam] || DEF_VS.bal)[user.off]; if (v < bv) { bv = v; bd = d; } }
  let bo = null, bo2 = -1e9;
  for (const o of schemesFor(y, 'off')) { const v = schemeEdge(y, o.id, user.ds) + ((DEF_VS[user.def] || DEF_VS.bal)[o.fam] || 0); if (v > bo2) { bo2 = v; bo = o; } }
  const out = Object.assign({}, own);
  if (bd) { out.ds = bd.id; out.def = bd.fam; }
  if (bo && bo2 > 0.3) { out.os = bo.id; out.off = bo.fam; }
  return out;
}

function randomCoach() { return { off: R.pick(['run', 'bal', 'bal', 'pass']), def: R.pick(['soft', 'bal', 'bal', 'blitz']), aggr: R.int(3, 7) * 10, youth: Math.random() < 0.3 }; }
function ensureLeague(L) {
  ensurePicks(L);
  if (!L.diff) L.diff = 'pro';
  if (!L.numbered) { ensureNumbers(L); L.numbered = 1; }
  ensureStaff(L);
  L.job = L.job || { sec: 60, hist: [] };
  if (!L.retired) archivePlayers(L);
  ensureContracts(L);
  if (L.phase === 'offseason') ensureFA(L);
  if (L.styles !== 2) { aiStyles(L, false); L.styles = 2; }
  if (L.teams.some(t => t.coach && (!t.coach.os || !t.coach.ds))) aiStyles(L, false, true); else ensureSchemes(L);
  // drafts and classes built before fillers were capped
  for (const pool of [L.draft && L.draft.pool, L.nextClass && L.nextClass.real && L.nextClass.pool]) if (pool && pool.some(id => L.players[id] && L.players[id].realPick)) { pool.realClass = true; tameFillers(L, pool); delete pool.realClass; }
}
function mkTeam(id, a) {
  const [pfr, abbr, city, name, conf, div] = a;
  return { id, pfr, abbr, city, name, conf, div, w: 0, l: 0, t: 0, pf: 0, pa: 0, home: 0,
    coach: randomCoach(), hist: [] };
}

function newLeague(imports, userPfr, opts) {
  const L = { v: 1, year: 1970, phase: 'preseason', week: 0, teams: [], players: {}, nextId: 1,
    schedule: [], playoffs: null, draft: null, news: [], champs: [], user: 0 };
  TEAMS_1970.forEach((a, i) => L.teams.push(mkTeam(i, a)));
  const u = L.teams.find(t => t.pfr === userPfr); L.user = u ? u.id : 0;
  const gen = [];
  for (const t of L.teams) {
    const rows = imports && imports.rosters && imports.rosters[t.pfr];
    if (rows && rows.length) rows.forEach(r => playerFromRoster(L, r, t.id));
    else { genRoster(L, t.id, rules(1970).rosterMax); gen.push(t.abbr); }
  }
  addNews(L, 'The 1970 season begins. The AFL and NFL have merged into one 26-team league.');
  if (gen.length) addNews(L, 'Generated placeholder rosters for: ' + gen.join(', ') + '.');
  const Y = clamp(Math.round((opts && opts.startYear) || 1970), START_FIRST, START_LAST);
  L.realCareers = !(opts && opts.realCareers === false);
  // Picking an expansion team in its first season starts the league at its expansion draft, the
  // spring before: real rosters from the year before, no season to play, and the team to build from nothing.
  const expStart = Y > 1970 && !!REAL && (EVENTS[Y] || []).some(e => e.t === 'expand' && e.team[0] === userPfr);
  if (expStart) {
    const Yb = Y - 1;
    const n = buildFromReal(L, Yb, imports);
    fillRosters(L, Yb);
    L.news = []; L.year = Yb; L.phase = 'season-over'; L.startYear = Y; L.expStart = Y;
    addNews(L, `The league starts in the spring of ${Y}, before the expansion draft. Every other team has its real ${Yb} roster (${n} real players). Build your team in the expansion draft, the ${Y} college draft and free agency.`);
    beginExpansion(L, Y, userPfr);
  } else if (Y > 1970) {
    const viaReal = !!REAL;
    const n = viaReal ? buildFromReal(L, Y, imports) : fastForward(L, Y, imports);
    fillRosters(L, Y);
    L.news = [];
    const ut = L.teams.find(t => t.pfr === userPfr); L.user = ut ? ut.id : 0;
    addNews(L, viaReal
      ? `The ${Y} season begins with ${L.teams.length} teams and their real ${Y} rosters, undrafted players included (${n} real players; anyone over the roster limit starts as a free agent). A few open spots have generated players.`
      : `The ${Y} season begins with ${L.teams.length} teams. Rosters are built from the real draft classes: ${n} drafted players, each with the team that picked him. Spots the data can't fill (undrafted players) have generated players.`);
    L.startYear = Y;
  } else link1970(L);
  if (L.teams[L.user]) L.teams[L.user].coach = { off: 'bal', def: 'bal', aggr: 50, youth: false };
  L.job = { sec: 60, hist: [] };
  L.styles = 2;
  L.diff = DIFF[opts && opts.diff] ? opts.diff : 'pro';
  aiCutdowns(L);
  ensurePicks(L);
  aiStyles(L, false, true);
  ensureContracts(L);
  fitPayrolls(L);
  ensureStaff(L);
  ensureNumbers(L);
  return L;
}

/* ---------- real players: rosters, careers, undrafted players ----------
   rosters.json (from nflverse) lists every player on every team for every season since 1970.
   It decides who is on which team when a league starts after 1970, when real careers end,
   and lets undrafted players enter the league in their real rookie year. Ratings still come
   from Pro-Football-Reference draft data, or for undrafted players from an estimate built
   from their seasons, starts and stats. */
const START_FIRST = 1970, START_LAST = 2026;
let REAL = null, DRAFTS = null;
function setDrafts(d) { DRAFTS = d || null; }
function nameKey(n) { return String(n || '').toLowerCase().replace(/[.'’]/g, '').replace(/-/g, ' ').replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/\s+/g, ' ').trim(); }
function setRealData(d) {
  if (!d || !d.players) { REAL = null; return 0; }
  const byDraft = {}, byFirst = {}, by70 = {}, byName = {};
  for (const p of d.players) {
    p.l = p.f + p.t.length - 1;
    (byName[nameKey(p.n)] = byName[nameKey(p.n)] || []).push(p);
    if (p.d) byDraft[p.d[0] + '-' + p.d[1]] = p; else (byFirst[p.f] = byFirst[p.f] || []).push(p);
    if (p.f <= 1970) by70[nameKey(p.n)] = p;
  }
  REAL = { players: d.players, byDraft, byFirst, by70, byName, last: d.last || 2026, hasA: d.players.some(p => p.a) };
  return d.players.length;
}
function hasReal() { return !!REAL; }
// Last real season, or null if he is still playing at the end of the data.
function realEndOf(rp) { return !rp ? null : (rp.l >= REAL.last ? null : rp.l); }
// PFR draft team codes -> franchise code in the league that year
function pfrForTm(tm, y) {
  tm = String(tm || '').toUpperCase();
  const m = { ARI: 'crd', PHO: 'crd', ATL: 'atl', BUF: 'buf', CAR: 'car', CHI: 'chi', CIN: 'cin', DAL: 'dal', DEN: 'den', DET: 'det', GNB: 'gnb',
    IND: 'clt', JAX: 'jax', KAN: 'kan', LAC: 'sdg', SDG: 'sdg', LAR: 'ram', RAM: 'ram', LVR: 'rai', OAK: 'rai', RAI: 'rai', MIA: 'mia', MIN: 'min',
    NOR: 'nor', NWE: 'nwe', BOS: 'nwe', NYG: 'nyg', NYJ: 'nyj', PHI: 'phi', PIT: 'pit', SFO: 'sfo', SEA: 'sea', TAM: 'tam', TEN: 'oti', WAS: 'was' };
  if (tm === 'BAL') return y <= 1983 ? 'clt' : 'rav';
  if (tm === 'HOU') return y <= 1996 ? 'oti' : 'htx';
  if (tm === 'STL') return y <= 1987 ? 'crd' : 'ram';
  if (tm === 'CLE') return y <= 1995 ? 'cle' : 'cle';
  return m[tm] || null;
}
// The teams that exist in a given season, for the new-league screen.
function teamsAt(y) {
  const T = TEAMS_1970.map(a => ({ pfr: a[0], abbr: a[1], city: a[2], name: a[3] }));
  for (let yy = 1971; yy <= y; yy++) for (const e of EVENTS[yy] || []) {
    if (e.t === 'rename') { const t = T.find(x => x.pfr === e.pfr); if (!t) continue; if (e.city) t.city = e.city; if (e.name) t.name = e.name; if (e.abbr) t.abbr = e.abbr; if (e.newPfr) t.pfr = e.newPfr; }
    else if (e.t === 'expand') T.push({ pfr: e.team[0], abbr: e.team[1], city: e.team[2], name: e.team[3] });
  }
  return T.sort((a, b) => (a.city + a.name).localeCompare(b.city + b.name));
}
// Rating in a given season for a player following his real career (p.rc).
// Rises to his potential over about three and a half seasons, holds, then declines; players
// whose real careers were long stayed good longer.
function rcRating(p, y) {
  const rc = p.rc, n = y - rc.y0, age = rc.a0 + n, slow = p.grp === 'QB' || p.grp === 'K' || p.grp === 'P';
  const base = slow ? 33 : ({ RB: 27, WR: 29, DB: 29 })[p.grp] || 30;
  const peakAge = rc.ea ? Math.max(base, rc.ea - 3) : base;
  let o = p.pot - rc.g0 * Math.max(0, 1 - n / 3.5);
  if (age > peakAge) o -= (age - peakAge) * (p.grp === 'RB' ? 3 : 2) * (slow ? 0.7 : 1);
  return clamp(Math.round(Math.min(o, p.pot)), 36, 99);
}
// Attach a real career to a player who just entered the league in year y0.
function attachRC(p, y0, rp, fallbackTo) {
  let end = null;
  if (rp) end = realEndOf(rp);
  else if (fallbackTo && fallbackTo < DATA_LAST) end = fallbackTo;
  p.rc = { y0, a0: p.age, g0: Math.max(0, p.pot - p.ovr), end };
  p.rc.ea = end != null ? p.age + (end - y0) : (rp || fallbackTo ? p.age + ((REAL ? REAL.last : DATA_LAST) + 1 - y0) : null);
}
// Undrafted players: potential from the estimated career value (on the same scale as drafted players).
function undraftedPot(rp) {
  const s = rp.t.filter(Boolean).length, wav = Math.max(0, rp.e || 0) * (POS_AV[rp.g] || 1);
  // seasons as a starter stand in for the Pro Bowl credit drafted players get (long careers before 2001, when there are no depth charts)
  let old = 0; rp.t.forEach((x, i) => { if (x && rp.f + i < 2001) old++; });
  const st = (rp.s || 0) + Math.max(0, old - 5) * 0.6;
  const score = 45 + Math.sqrt(wav) * 4.2 + st * 0.6 + (rp.x || 0) * 0.8;
  // an average draft-slot prior: his real career, not where he wasn't picked, decides the rest
  return clamp(Math.round(compressTop(0.2 * 60 + 0.8 * score - 2.5 + R.norm() * noiseFor(s))), 40, 99);
}
function realPos(rp) { const x = String(rp.p || '').toUpperCase(); return x.length <= 3 && x !== 'OL' && x !== 'DL' ? x : undefined; }
function playerFromReal(L, rp, team, Y, drafts) {
  const grp = rp.g, b = rp.b || 0;
  drafts = drafts || DRAFTS;
  let row = null, rowYear = rp.d ? rp.d[0] : null;
  if (rp.d && drafts && drafts[rp.d[0]]) row = drafts[rp.d[0]].find(r => (num(r.Pick) || 0) === rp.d[1] && nameKey(r.Player) === nameKey(rp.n));
  // supplemental drafts (e.g. the 1984 USFL/CFL draft), imported as "1984s"
  if (!row && !rp.d && drafts) for (const k in drafts) if (/s$/.test(k)) {
    const y = parseInt(k, 10); if (!(rp.f - 3 <= y && y <= rp.f)) continue;
    const r = drafts[k].find(x => nameKey(x.Player) === nameKey(rp.n)); if (r) { row = r; rowYear = y; break; }
  }
  let p;
  if (row) {
    p = prospectFromDraft(L, row, rowYear);
    p.team = team; delete p.reveal; p.seen = true;
    p.draft = { year: rowYear, rnd: num(row.Rnd) || 1, pick: num(row.Pick) || 0 };
    p.age = num(row.Age) || (b ? rowYear - b : 22);
    attachRC(p, Math.max(rowYear, rp.f), rp);
  } else {
    const pot = undraftedPot(rp);
    p = mkPlayer(L, { name: rp.n, pos: realPos(rp), grp, age: b ? rp.f - b : 23, ovr: pot - R.int(6, 14), pot, team, yrs: 0, college: rp.c || '', real: true, udfa: rp.d ? undefined : true });
    attachRC(p, rp.f, rp);
  }
  if (rp.no) p.num = rp.no;
  // bring him to season Y
  const n = Y - p.rc.y0;
  p.age = p.rc.a0 + n; p.yrs = Math.max(0, Y - rp.f);
  p.ovr = n > 0 ? rcRating(p, Y) : p.ovr;
  p.peak = p.ovr;
  return p;
}
// The teams that exist in a given season, for the new-league screen.
function teamsAt(y) {
  const T = TEAMS_1970.map(a => ({ pfr: a[0], abbr: a[1], city: a[2], name: a[3] }));
  for (let yy = 1971; yy <= y; yy++) for (const e of EVENTS[yy] || []) {
    if (e.t === 'rename') { const t = T.find(x => x.pfr === e.pfr); if (!t) continue; if (e.city) t.city = e.city; if (e.name) t.name = e.name; if (e.abbr) t.abbr = e.abbr; if (e.newPfr) t.pfr = e.newPfr; }
    else if (e.t === 'expand') T.push({ pfr: e.team[0], abbr: e.team[1], city: e.team[2], name: e.team[3] });
  }
  return T.sort((a, b) => (a.city + a.name).localeCompare(b.city + b.name));
}
// Starting after 1970 with real rosters: every player on his real team that season.
function buildFromReal(L, Y, imports) {
  const drafts = (imports && imports.drafts) || {};
  L.players = {};
  for (let y = START_FIRST + 1; y <= Y; y++) { L.year = y; applyEvents(L); }
  const byPfr = {}; L.teams.forEach(t => byPfr[t.pfr] = t.id);
  let n = 0;
  L.realIn = {};
  for (const rp of REAL.players) {
    if (rp.f > Y || rp.l < Y) continue;
    const code = rp.t[Y - rp.f]; if (!code || byPfr[code] == null) continue;
    playerFromReal(L, rp, byPfr[code], Y, drafts); n++;
    if (!rp.d) L.realIn[rp.n + '|' + rp.f] = 1;
  }
  return n;
}
// Fill positions the data can't cover, then trim to the limit.
function fillRosters(L, Y) {
  for (const id in L.players) { const p = L.players[id]; p.hist = {}; p.inj = 0; delete p.con; delete p.injY; }
  const max = rules(Y).rosterMax;
  for (const t of L.teams) {
    const c = groupCounts(L, t.id);
    const SF = startersFor(L, t.id);
    for (const g of GRPS) { const need = Math.max(STARTERS[g], SF[g]) + (g === 'K' || g === 'P' ? 0 : 2); for (let k = c[g] || 0; k < need; k++) genPlayer(L, g, t.id, 50, [23, 30]); }
    let n = roster(L, t.id).length;
    const order = ['OL', 'DB', 'DL', 'LB', 'WR', 'RB', 'TE', 'QB'];
    let i = 0; while (n < max) { genPlayer(L, order[i % order.length], t.id, 48, [22, 29]); n++; i++; }
    cutTo(L, t.id, max, true);
  }
  L.teams.forEach(t => { t.w = t.l = t.t = t.pf = t.pa = 0; t.hist = []; t.ring = []; });
}
// Without rosters.json: build forward from 1970 with each drafted player on his drafting team.
function fastForward(L, Y, imports) {
  const drafts = (imports && imports.drafts) || {};
  let added = 0;
  for (let y = START_FIRST + 1; y <= Y; y++) {
    for (const id in L.players) {
      const p = L.players[id];
      if (p.rc && p.rc.y0 > 1970) {
        if (p.rc.end != null && y > p.rc.end) { delete L.players[id]; continue; }
        p.age++; p.yrs++; p.ovr = rcRating(p, y);
      } else if (ffAgeVet(p)) delete L.players[id];
    }
    L.year = y;
    applyEvents(L);
    for (const r of drafts[y] || []) {
      const to = num(r.To);
      if (y <= DATA_LAST && !(to >= y)) continue;
      const t = L.teams.find(x => x.pfr === pfrForTm(r.Tm, y)); if (!t) continue;
      const p = prospectFromDraft(L, r, y);
      p.team = t.id; p.draft = { year: y, rnd: num(r.Rnd) || 1, pick: num(r.Pick) || 999 };
      delete p.reveal; p.seen = true;
      attachRC(p, y, null, to >= DATA_LAST ? null : to);
      if (to >= DATA_LAST) p.rc.ea = p.age + (DATA_LAST + 2 - y);
      added++;
    }
  }
  return added;
}
function ffAgeVet(p) {
  p.age++; p.yrs++;
  let d;
  if (p.age <= 24) d = R.int(1, 6); else if (p.age <= 28) d = R.int(-1, 3); else if (p.age <= 31) d = R.int(-4, 1); else if (p.age <= 34) d = R.int(-5, 1); else d = R.int(-7, 0);
  if (d < 0 && (p.grp === 'QB' || p.grp === 'K' || p.grp === 'P')) d = Math.round(d * 0.6);
  p.ovr = d > 0 ? Math.min(p.pot, p.ovr + d) : Math.max(30, p.ovr + d); if (p.ovr > p.pot) p.pot = p.ovr;
  let rp = 0;
  if (p.age >= 33) { rp = (0.25 + (p.age - 33) * 0.15) * clamp(1 - (p.ovr - 65) * 0.04, 0.3, 1); if (p.grp === 'K' || p.grp === 'P') rp *= 0.4; if (p.grp === 'QB') rp *= 0.7; }
  else if (p.age >= 28 && p.ovr < 48) rp = 0.35;
  if (p.age >= 38 && !(p.grp === 'QB' || p.grp === 'K' || p.grp === 'P')) rp = 1;
  if (p.age >= 46) rp = 1;
  return Math.random() < rp;
}
// Each new season, that year's real undrafted players who lasted at least two seasons
// become free agents. Teams sign them on merit, like any other free agent.
function enterUndrafted(L, y) {
  if (!REAL || !REAL.byFirst[y]) return 0;
  L.realIn = L.realIn || {};
  const notable = []; let n = 0;
  for (const rp of REAL.byFirst[y]) {
    const k = rp.n + '|' + rp.f; if (L.realIn[k]) continue;
    if (rp.t.filter(Boolean).length < 2) continue;
    L.realIn[k] = 1;
    const p = playerFromReal(L, rp, -1, y, null);
    p.yrs = 0; n++;
    if (p.pot >= 74) notable.push(p);
  }
  if (notable.length) addNews(L, `Undrafted free agents to watch: ${notable.sort((a, b) => b.pot - a.pot).slice(0, 5).map(p => `${p.pos} ${p.name}`).join(', ')}.`);
  return n;
}
// 1970 veterans: their real careers end when they really ended.
function link1970(L) {
  if (!REAL) return;
  for (const id in L.players) { const p = L.players[id]; const rp = REAL.by70[nameKey(p.name)]; if (rp && p.real) p.rc = { end: realEndOf(rp) }; }
}
// Before the cap: nothing to fit. With a cap, every team starts a little under it.
function fitPayrolls(L) {
  const y = capYear(L), c = capFor(y); if (c == null) return;
  for (const t of L.teams) {
    const pay = payroll(L, t.id, y); if (pay <= c * 0.95) continue;
    const f = c * 0.94 / pay;
    roster(L, t.id).forEach(p => { if (!p.con) return; p.con.sal = Math.round(p.con.sal * f); if (p.con.base) p.con.base = p.con.base.map(v => Math.round(v * f)); (p.con.bon || []).forEach(b => b.a = Math.round(b.a * f)); });
  }
}

// A short history of each player's moves, shown on his player page.
function plog(L, p, txt) { if (!p) return; (p.log = p.log || []).push({ y: L.year, s: txt }); if (p.log.length > 40) p.log.splice(0, p.log.length - 40); }
function addNews(L, s) { L.news.unshift({ y: L.year, w: L.phase === 'regular' ? L.week + 1 : null, s }); if (L.news.length > 150) L.news.length = 150; }

/* ---------- rosters ---------- */
function roster(L, tid) { const out = []; for (const id in L.players) { const p = L.players[id]; if (p.team === tid && !p.ps && !p.unsigned) out.push(p); } return out; }
function practiceSquad(L, tid) { const out = []; for (const id in L.players) { const p = L.players[id]; if (p.team === tid && p.ps) out.push(p); } return out; }
function unsignedRights(L, tid) { const out = []; for (const id in L.players) { const p = L.players[id]; if (p.team === tid && p.unsigned) out.push(p); } return out; }
function freeAgents(L) { return roster(L, -1); }

function value(p) {
  return p.ovr + Math.max(0, p.pot - p.ovr) * (p.age < 26 ? 0.6 : 0.2) - Math.max(0, p.age - 29) * 2.5 + (p.grp === 'QB' ? 4 : 0) - (p.grp === 'K' || p.grp === 'P' ? 8 : 0);
}

// Effective rating: a player playing through an injury loses 12 points.
const HURT_PENALTY = 12;
function canPlayHurt(p) { return p.inj > 0 && p.inj < 20; }
function eff(p) { return (p.inj && p.playHurt ? p.ovr - HURT_PENALTY : p.ovr) - ((p.mor != null && p.mor < 30) ? 2 : 0); }
function available(p) { return !p.holdout && !p.striking && (!p.inj || (p.playHurt && canPlayHurt(p))); }
// Depth order for a position group: the coach's manual order first, then by rating.
function dcOrder(L, tid, g, list) {
  const ord = ((L.teams[tid].dc || {})[g]) || [];
  return list.sort((a, b) => {
    const ia = ord.indexOf(a.id), ib = ord.indexOf(b.id);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
    return eff(b) - eff(a);
  });
}
function depth(L, tid) {
  const d = {}; GRPS.forEach(g => d[g] = []);
  for (const p of roster(L, tid)) if (available(p)) d[p.grp].push(p);
  GRPS.forEach(g => dcOrder(L, tid, g, d[g]));
  return d;
}
function depthChart(L, tid, g) { return dcOrder(L, tid, g, roster(L, tid).filter(p => p.grp === g)); }
function setDepth(L, tid, g, ids) { const t = L.teams[tid]; t.dc = t.dc || {}; t.dc[g] = ids.slice(); }
function moveDepth(L, tid, pid, dir) {
  const p = L.players[pid]; if (!p) return;
  const ids = depthChart(L, tid, p.grp).map(x => x.id), i = ids.indexOf(pid), j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]]; setDepth(L, tid, p.grp, ids);
}
function resetDepth(L, tid, g) { const t = L.teams[tid]; if (t.dc) delete t.dc[g]; }
function setStarterQB(L, pid) {
  const ids = depthChart(L, L.user, 'QB').map(x => x.id).filter(id => id !== pid);
  setDepth(L, L.user, 'QB', [pid].concat(ids));
}
function setPlayHurt(L, pid, on) {
  const p = L.players[pid]; if (!p || p.team !== L.user) return 'That player is not on your team.';
  if (on && !canPlayHurt(p)) return p.inj >= 20 ? 'He is out for the season and cannot play.' : 'He is healthy.';
  p.playHurt = !!on;
  // Keep him at his normal spot so he actually starts: freeze the order by healthy rating.
  const t = L.teams[L.user];
  if (on && !(t.dc && t.dc[p.grp])) setDepth(L, L.user, p.grp, roster(L, L.user).filter(x => x.grp === p.grp).sort((a, b) => b.ovr - a.ovr).map(x => x.id));
  return null;
}

function groupCounts(L, tid) { const c = {}; GRPS.forEach(g => c[g] = 0); roster(L, tid).forEach(p => { if (!p.ir) c[p.grp]++; }); return c; }
// Players on injured reserve don't count against the roster limit.
function active(L, tid) { return roster(L, tid).filter(p => !p.ir); }
const IR_MIN = 4;  // weeks out to qualify
function irRules(y) { return y < 2012 ? { ret: false } : y < 2020 ? { ret: true, weeks: 8, max: 1 } : { ret: true, weeks: 4, max: 99 }; }
function canIR(L, p) { return (L.phase === 'regular' || L.phase === 'preseason') && p && !p.ir && p.inj >= IR_MIN; }
function placeIR(L, pid) {
  const p = L.players[pid]; if (!canIR(L, p)) return `Only players out ${IR_MIN}+ weeks can go on injured reserve.`;
  p.ir = { y: L.year, w: L.week }; delete p.playHurt;
  const R2 = irRules(L.year);
  if (p.team === L.user) addNews(L, `${L.teams[p.team].abbr} placed ${p.pos} ${p.name} on injured reserve${R2.ret ? ` (eligible to return after ${R2.weeks} weeks)` : ' for the rest of the season'}.`);
  return null;
}
function irReturnInfo(L, p) {
  if (!p || !p.ir) return null;
  const R2 = irRules(L.year); if (!R2.ret) return { ok: false, why: 'Before 2012, players on injured reserve are out for the season.' };
  const t = L.teams[p.team], used = (t.irRet && t.irRet.y === L.year) ? t.irRet.n : 0;
  if (used >= R2.max) return { ok: false, why: `You've used your ${R2.max === 1 ? 'one' : ''} return from IR this season.` };
  if (L.phase !== 'regular' || L.week - p.ir.w < R2.weeks) return { ok: false, why: `Eligible to return after ${R2.weeks} weeks on IR.` };
  if (p.inj > 0) return { ok: false, why: 'Still injured.' };
  return { ok: true };
}
function activateIR(L, pid) {
  const p = L.players[pid], info = irReturnInfo(L, p); if (!info) return 'He is not on injured reserve.';
  if (!info.ok) return info.why;
  const max = rules(L.year).rosterMax; if (active(L, p.team).length >= max) return `Your active roster is full (${max}). Release someone first.`;
  const t = L.teams[p.team]; t.irRet = t.irRet && t.irRet.y === L.year ? { y: L.year, n: t.irRet.n + 1 } : { y: L.year, n: 1 };
  delete p.ir; addNews(L, `${t.abbr} activated ${p.pos} ${p.name} from injured reserve.`); return null;
}
function aiIR(L) {
  let moved = false;
  for (const t of L.teams) {
    if (t.id === L.user) continue;
    for (const p of roster(L, t.id)) {
      if (!p.ir && p.inj >= 6) { p.ir = { y: L.year, w: L.week }; moved = true; }
      else if (p.ir) { const i = irReturnInfo(L, p); if (i && i.ok && active(L, t.id).length < rules(L.year).rosterMax) { const tt = t; tt.irRet = tt.irRet && tt.irRet.y === L.year ? { y: L.year, n: tt.irRet.n + 1 } : { y: L.year, n: 1 }; delete p.ir; } }
    }
  }
  if (moved) aiSignings(L);
}
function clearIR(L) { for (const id in L.players) delete L.players[id].ir; }

// Releasing a player under contract leaves dead money: a quarter of what is left on his deal
// (at most 60% of one year's salary) stays on this year's payroll. Minimum-salary players cost nothing.
function deadCharge(L, p, june1) {
  const y = capYear(L);
  if (p && p.con && p.con.base) { const all = proLeft(p.con, y); if (!june1) return all; const now = Math.round(proYear(p.con, y)); return { now, later: all - now }; }
  const sal = p && p.con ? salFor(p, y) : null;
  if (june1) return { now: deadCharge(L, p), later: 0 };
  if (!sal || sal < avgSalary(y) * 0.6) return 0;
  const left = (p.con.ext ? p.con.ext.exp : p.con.exp) - y + 1;
  return Math.round(sal * Math.min(0.6, 0.25 * Math.max(1, left)));
}
function deadFor(L, tid, y) { return (L.dead && L.dead[tid] && L.dead[tid][y]) || 0; }
// Restructure: turn this year's base salary (above the minimum) into a bonus spread over the years left (up to 5).
function restructureInfo(L, p) {
  const y = capYear(L); if (!p || !p.con || capFor(y) == null || y < 1994 || p.team !== L.user) return null;
  const exp = p.con.exp, left = exp - y + 1; if (left < 2) return null;
  if (!p.con.base) return null;
  const minS = Math.round(avgSalary(y) * 0.3), b = baseFor(p, y); if (b == null || b < minS * 1.5) return null;
  if (p.con.rsY === y) return null;
  const conv = b - minS, n = Math.min(5, left);
  return { conv, n, saves: Math.round(conv - conv / n) };
}
function restructure(L, pid) {
  const p = L.players[pid], R0 = restructureInfo(L, p); if (!R0) return 'He can\'t be restructured right now.';
  const y = capYear(L); p.con.base[y - p.con.signed] -= R0.conv; p.con.bon = (p.con.bon || []).concat([{ a: R0.conv, f: y, n: R0.n, cur: 1 }]); p.con.rsY = y;
  plog(L, p, `Restructured: ${money(R0.conv)} of salary turned into a bonus (saves ${money(R0.saves)} on the ${y} cap).`);
  addNews(L, `${L.teams[L.user].abbr} restructured ${p.pos} ${p.name}'s deal, clearing ${money(R0.saves)} of ${y} cap space.`);
  return null;
}
// Year by year: base, prorated bonus, cap hit, plus dead money if cut now
function contractTable(L, p) {
  if (!p || !p.con) return null;
  const y = capYear(L), c = p.con, rows = [];
  const end = c.ext ? c.ext.exp : c.exp;
  for (let yy = Math.max(y, c.signed); yy <= end; yy++) {
    const base = yy <= c.exp ? baseFor(p, yy) : c.ext.sal, pro = yy <= c.exp ? Math.round(proYear(c, yy)) : 0;
    rows.push({ y: yy, base: Math.round(base), pro, hit: Math.round(base + pro), cash: cashFor(p, yy) });
  }
  const bonus = (c.bon || []).filter(b => b.cur).reduce((s, b) => s + b.a, 0);
  return { rows, shape: c.shape ? SHAPES[c.shape].name : 'Flat', bonus, dead: c.base ? proLeft(c, y) : deadCharge(L, p), total: Math.round(c.sal * (c.exp - c.signed + 1)) };
}
function addDead(L, tid, y, amt) { if (!amt) return; L.dead = L.dead || {}; const D = L.dead[tid] || (L.dead[tid] = {}); D[y] = (D[y] || 0) + Math.round(amt); }
// June 1 cuts: from 1994, up to two a year in the offseason; this year's share of the bonus now, the rest next year
function june1Left(L) { const y = capYear(L); if (capFor(y) == null || y < 1994 || !(L.phase === 'offseason' || L.phase === 'preseason')) return 0; return 2 - ((L.june1 && L.june1[y]) || 0); }
function release(L, pid, june1) {
  const p = L.players[pid]; if (!p) return; const t = L.teams[p.team];
  let dead = 0;
  if (t && t.id === L.user) {
    const y = capYear(L);
    if (june1 && june1Left(L) > 0 && p.con && p.con.base) { const d = deadCharge(L, p, true); addDead(L, t.id, y, d.now); addDead(L, t.id, y + 1, d.later); dead = d.now; L.june1 = L.june1 || {}; L.june1[y] = (L.june1[y] || 0) + 1; }
    else { dead = deadCharge(L, p); addDead(L, t.id, y, dead); }
  }
  p.team = -1; delete p.con; if (t) plog(L, p, `Released by ${t.abbr}.`);
  if (t) addNews(L, `${t.abbr} released ${p.pos} ${p.name}.${dead ? ` Dead money: ${money(dead)} stays on the ${capYear(L)} payroll.` : ''}`);
}

function aiCutdowns(L) {
  const max = rules(L.year).rosterMax;
  for (const t of L.teams) {
    if (t.id === L.user) continue;
    cutTo(L, t.id, max, true);
  }
}

function cutTo(L, tid, max, quiet) {
  const r = active(L, tid);
  if (r.length <= max) return [];
  const counts = groupCounts(L, tid);
  const SF = startersFor(L, tid), keep = g => SF[g] + (g === 'K' || g === 'P' ? 0 : 1);
  const order = r.slice().sort((a, b) => value(a) - value(b));
  const cut = [];
  for (const p of order) {
    if (r.length - cut.length <= max) break;
    if (counts[p.grp] <= keep(p.grp)) continue;
    counts[p.grp]--; cut.push(p); p.team = -1; delete p.con;
  }
  if (!quiet && cut.length) addNews(L, `${L.teams[tid].abbr} trimmed ${cut.length} players to reach ${max}.`);
  return cut;
}

function aiSignings(L, offseason) {
  const max = rules(L.year).rosterMax, y = capYear(L), cap = capFor(y);
  const fa = freeAgents(L).filter(p => p.retiredYear == null && !isCareer(L, p)).sort((a, b) => value(b) - value(a));
  for (const t of R.shuffle(L.teams.slice())) {
    if (t.id === L.user) continue;
    let size = active(L, t.id).length;
    const counts = groupCounts(L, t.id);
    while (size < max && fa.length) {
      const SF = startersFor(L, t.id), needG = GRPS.find(g => counts[g] < SF[g] + (g === 'K' || g === 'P' ? 0 : 1));
      let i = needG ? fa.findIndex(p => p.grp === needG) : 0;
      if (i < 0) i = 0;
      const p = fa.splice(i, 1)[0];
      if (p.grp === 'K' || p.grp === 'P') { if (counts[p.grp] >= 1) continue; }
      const sal = marketValue(L, p, y) * (offseason ? 1 : 0.6);
      if (cap != null && payroll(L, t.id, y) + sal > cap) continue;
      if (offseason) noteFASign(L, p, t.id); else delete p.prevTeam;
      p.team = t.id; setContract(p, sal, y, offseason ? contractYears(p) : 1); counts[p.grp]++; size++;
    }
  }
}

function sign(L, pid) { return signFA(L, pid); }

/* ---------- draft picks & trades ---------- */
// Teams own picks for the next 3 drafts that have not been held yet.
function firstPickYear(L) { return L.phase === 'offseason' ? L.year + 2 : L.year + 1; }
function ensurePicks(L) {
  if (!L.picks) L.picks = [];
  if (!L.nextPickId) L.nextPickId = 1;
  const y0 = firstPickYear(L);
  // picks for drafts already held are gone (a league that starts after 1970 skips those drafts)
  if (L.picks.some(k => k.y < y0)) L.picks = L.picks.filter(k => k.y >= y0);
  // during the draft, the current year's picks are only the slots still to come: used picks are gone for good
  // (older versions re-created them here, so drop any that crept back in)
  const D = L.draft;
  if (D && D.slotPick) {
    const left = new Set(D.slotPick.slice(D.pick));
    if (L.picks.some(k => k.y === D.year && !left.has(k.id))) L.picks = L.picks.filter(k => k.y !== D.year || left.has(k.id));
  }
  const have = new Set(L.picks.map(k => k.y + '|' + k.rnd + '|' + k.orig));
  for (let y = y0; y < y0 + 3; y++) {
    if (D && D.slotPick && y === D.year) continue;
    const rounds = rules(y).draftRounds;
    for (const t of L.teams) for (let r = 1; r <= rounds; r++) {
      if (!have.has(y + '|' + r + '|' + t.id)) L.picks.push({ id: L.nextPickId++, y, rnd: r, orig: t.id, own: t.id });
    }
  }
}
function pickById(L, id) { return (L.picks || []).find(k => k.id === id); }
function teamPicks(L, tid) {
  ensurePicks(L);
  return L.picks.filter(k => k.own === tid && tradeablePick(k)).sort((a, b) => a.y - b.y || a.rnd - b.rnd || projectedOverall(L, a) - projectedOverall(L, b));
}

let rankCache = { key: '', cur: null, str: null };
function ranks(L) {
  const key = [L.year, L.phase, L.week, L.draft ? L.draft.pick : '', L.news.length].join('|');
  if (rankCache.key === key && rankCache.L === L) return rankCache;
  const n = L.teams.length, cur = {}, str = {};
  const played = L.teams.some(t => t.w + t.l + t.t > 0);
  if (L.phase === 'season-over' || L.phase === 'draft') draftOrder(L).forEach((tid, i) => cur[tid] = i + 1);
  else if (played) sortTeams(L, L.teams).reverse().forEach((t, i) => cur[t.id] = i + 1);
  L.teams.map(t => [t.id, teamOverall(L, t.id)]).sort((a, b) => a[1] - b[1]).forEach(([tid], i) => str[tid] = i + 1);
  rankCache = { key, L, cur: played || L.phase === 'season-over' || L.phase === 'draft' ? cur : null, str };
  return rankCache;
}
function projectedOverall(L, k) {
  const n = L.teams.length;
  if (L.draft && L.draft.slotPick && k.y === L.draft.year) {
    const i = L.draft.slotPick.indexOf(k.id); if (i >= 0) return i + 1;
  }
  const rk = ranks(L);
  let slot;
  if (k.y === L.year + 1 && rk.cur && L.phase !== 'offseason') slot = rk.cur[k.orig];
  else slot = Math.round((rk.str[k.orig] + n / 2) / 2);
  return (k.rnd - 1) * n + (slot || Math.round(n / 2));
}
// Compensatory picks could not be traded until the 2017 draft.
function tradeablePick(k) { return !k.comp || k.y >= 2017; }
function pickLabel(L, k) {
  const o = L.teams[k.orig];
  return `${k.y} Round ${k.rnd}${k.comp ? ' (comp)' : ''}${k.orig !== k.own ? ' (' + o.abbr + ')' : ''}`;
}
// Trade value: steep curve so many spare parts never add up to one star.
function weight(v) { const w = Math.pow(1.07, v - 50); return v < 50 ? w * 0.5 : w; }
function playerWeight(p) { return weight(value(p)); }
function pickWeight(L, k) {
  const ov = projectedOverall(L, k);
  const yrsOut = Math.max(0, k.y - (L.year + 1) - (L.phase === 'offseason' ? 1 : 0));
  return weight(slotGrade(ov) - 5) * Math.pow(0.9, yrsOut);
}
function pkgWeight(L, pkg) {
  return (pkg.players || []).reduce((s, id) => s + playerWeight(L.players[id]), 0) + (pkg.picks || []).reduce((s, id) => s + pickWeight(L, pickById(L, id)), 0);
}
function pkgText(L, pkg) {
  const parts = (pkg.players || []).map(id => { const p = L.players[id]; return `${p.pos} ${p.name}`; })
    .concat((pkg.picks || []).map(id => pickLabel(L, pickById(L, id)) + ' pick'));
  return parts.join(', ') || 'nothing';
}
function validPkg(L, tid, pkg) {
  return (pkg.players || []).every(id => L.players[id] && L.players[id].team === tid) && (pkg.picks || []).every(id => { const k = pickById(L, id); return k && k.own === tid && tradeablePick(k); });
}
function execTrade(L, a, b, aGive, bGive) {
  const y0 = capYear(L);
  [[a, aGive], [b, bGive]].forEach(([from, g]) => (g.players || []).forEach(id => { const p = L.players[id]; if (!p || !p.con || !p.con.bon || !p.con.bon.length) return; if (from === L.user) addDead(L, from, y0, proLeft(p.con, y0)); p.con.bon = []; }));
  (aGive.players || []).forEach(id => L.players[id].team = b); (bGive.players || []).forEach(id => L.players[id].team = a);
  (aGive.players || []).forEach(id => plog(L, L.players[id], `Traded from ${L.teams[a].abbr} to ${L.teams[b].abbr}.`)); (bGive.players || []).forEach(id => plog(L, L.players[id], `Traded from ${L.teams[b].abbr} to ${L.teams[a].abbr}.`));
  (aGive.players || []).concat(bGive.players || []).forEach(id => signRefuserIfMoved(L, L.players[id]));
  (aGive.picks || []).forEach(id => pickById(L, id).own = b); (bGive.picks || []).forEach(id => pickById(L, id).own = a);
  addNews(L, `TRADE: ${L.teams[a].abbr} send ${pkgText(L, aGive)} to ${L.teams[b].abbr} for ${pkgText(L, bGive)}.`);
  ensureNumbers(L);
  const inSeason = L.phase === 'regular' || L.phase === 'playoffs';
  // Roster limits are enforced at training camp, so offseason trades don't trigger cuts.
  if (inSeason) for (const t of [a, b]) if (t !== L.user) cutTo(L, t, rules(L.year).rosterMax, true);
}
// What a team really gains from incoming players: anyone who wouldn't make its roster
// after the trade (it would just cut him) is worth almost nothing.
// Newly signed free agents can't be flipped right away: offseason signings are locked until
// kickoff, in-season signings for 4 weeks.
function nowKey(L) {
  if (L.phase === 'regular') return L.year * 100 + L.week;
  if (L.phase === 'preseason') return L.year * 100 - 1;
  if (L.phase === 'offseason') return (L.year + 1) * 100 - 2;
  return L.year * 100 + 99;
}
// (Trade lock on new signings was removed by request: new signings can be traded right away.)
function lockNewSigning(L, p) { delete p.lock; }
function tradeLocked(L, p) { return false; }
function lockText(L, p) { const y = Math.floor(p.lock / 100), w = p.lock % 100; return w === 0 ? `the ${y} season kicks off` : `week ${w + 1} of ${y}`; }
function receiverWeight(L, tid, incoming, outgoing) {
  const max = rules(capYear(L)).rosterMax, out = new Set(outgoing.players || []);
  const inc = (incoming.players || []).map(id => L.players[id]);
  const after = roster(L, tid).filter(p => !out.has(p.id)).concat(inc).sort((a, b) => value(b) - value(a));
  const keep = new Set(after.slice(0, max).map(p => p.id));
  // Several good players are worth less than one star: each extra player counts 60% of the
  // one before (each extra pick 85%), since only one of them can fill the star's spot.
  const pw = inc.map(p => playerWeight(p) * (keep.has(p.id) ? 1 : 0.05)).sort((a, b) => b - a);
  const kw = (incoming.picks || []).map(id => pickWeight(L, pickById(L, id))).sort((a, b) => b - a);
  return pw.reduce((s, w, i) => s + w * Math.pow(0.6, i), 0) + kw.reduce((s, w, i) => s + w * Math.pow(0.85, i), 0);
}
function tradeVerdict(L, partner, give, get) {
  const g = receiverWeight(L, partner, give, get), r = pkgWeight(L, get);
  return { give: g, get: r, ask: diff(L).tradeAsk, ok: r > 0 && g >= r * diff(L).tradeAsk };
}
// give = what the user sends, get = what the user receives; each is {players:[ids], picks:[ids]}
function tradeCapMsg(L, a, b, aGive, bGive) {
  const y = capYear(L);
  const sal = ids => (ids || []).reduce((s, id) => s + (salFor(L.players[id], y) || 0), 0);
  const left = (ids, from) => from === L.user ? (ids || []).reduce((s, id) => s + (L.players[id] && L.players[id].con ? proLeft(L.players[id].con, y) : 0), 0) : 0;
  // what arrives counts base salary only (the bonus stays behind as the other team's dead money)
  const base = ids => (ids || []).reduce((s, id) => { const p = L.players[id]; return s + (p && p.con && p.con.base ? (baseFor(p, y) || 0) : salFor(p, y) || 0); }, 0);
  const da = base(bGive.players) - sal(aGive.players) + left(aGive.players, a) - left(bGive.players, b);
  return capMsg(L, a, da) || capMsg(L, b, -da);
}
const DEADLINE_WEEK = 9;
function pastDeadline(L) { return (L.phase === 'regular' && L.week >= DEADLINE_WEEK) || L.phase === 'playoffs'; }
function proposeTrade(L, partner, give, get) {
  ensurePicks(L);
  if (pastDeadline(L)) return { ok: false, msg: `The trade deadline (after week ${DEADLINE_WEEK}) has passed. Trading reopens after the season.` };
  const n = x => (x.players || []).length + (x.picks || []).length;
  if (!n(give) || !n(get)) return { ok: false, msg: 'Put at least one player or pick on each side.' };
  if (!validPkg(L, L.user, give) || !validPkg(L, partner, get)) return { ok: false, msg: 'Something in this deal is no longer on the right team.' };
  const locked = (give.players || []).map(id => L.players[id]).find(p => tradeLocked(L, p));
  if (locked) return { ok: false, msg: `${locked.name} was just signed and can't be traded until ${lockText(L, locked)}.` };
  const max = rules(L.year).rosterMax, after = active(L, L.user).length - (give.players || []).length + (get.players || []).length;
  if ((L.phase === 'regular' || L.phase === 'playoffs') && after > max) return { ok: false, msg: `That would put you at ${after} players, over the ${max} limit. Release someone first.` };
  const t = L.teams[partner], v = tradeVerdict(L, partner, give, get);
  if (!v.ok) return { ok: false, msg: `${t.city} turned it down. They want more value back.` };
  const cm = tradeCapMsg(L, L.user, partner, give, get); if (cm) return { ok: false, msg: cm };
  execTrade(L, L.user, partner, give, get);
  return { ok: true, msg: `${t.city} accepted the trade.` };
}

// "Find a trade": AI teams that want what you're offering send back their best package.
// opts.want: 'best' | 'players' | 'picks' | 'young' (players 25 and under); opts.pos: a position group you need.
function findTrades(L, give, opts) {
  opts = opts || {}; const want = opts.want || 'best', needG = opts.pos || '';
  ensurePicks(L);
  const n = (give.players || []).length + (give.picks || []).length;
  if (!n) return { err: 'Add at least one player or pick you want to move.' };
  if (pastDeadline(L)) return { err: `The trade deadline (after week ${DEADLINE_WEEK}) has passed.` };
  if (!validPkg(L, L.user, give)) return { err: 'Something in your package is no longer yours.' };
  const offers = [];
  for (const t of L.teams) {
    if (t.id === L.user) continue;
    const v = receiverWeight(L, t.id, give, { players: [], picks: [] });
    if (v < 0.4) continue;
    const target = v / diff(L).tradeAsk;
    const d = depth(L, t.id), keep = new Set(); GRPS.forEach(g => d[g].slice(0, 1).forEach(p => keep.add(p.id)));
    const okP = p => !keep.has(p.id) && (want !== 'young' || p.age <= 25);
    let items = (want === 'picks' ? [] : roster(L, t.id).filter(okP).map(p => ({ t: 'p', id: p.id, w: playerWeight(p), g: p.grp })))
      .concat(want === 'players' || want === 'young' ? [] : teamPicks(L, t.id).map(k => ({ t: 'k', id: k.id, w: pickWeight(L, k) })))
      .map(it => Object.assign(it, { r: it.w * (0.85 + Math.random() * 0.3) })).sort((a, b) => b.r - a.r);
    // a position you need: their best player there who fits the price leads the package
    if (needG) {
      const lead = items.filter(it => it.t === 'p' && it.g === needG && it.w <= target).sort((a, b) => b.w - a.w)[0];
      if (!lead) continue;
      items = [lead].concat(items.filter(it => it !== lead));
    }
    const pkg = { players: [], picks: [] }; let sum = 0, cnt = 0;
    for (const it of items) { if (cnt >= 3) break; if (sum + it.w > target) continue; (it.t === 'p' ? pkg.players : pkg.picks).push(it.id); sum += it.w; cnt++; if (sum >= target * 0.9) break; }
    if (!cnt || sum < target * 0.7) continue;
    if (tradeCapMsg(L, L.user, t.id, give, pkg)) continue;
    offers.push({ from: t.id, get: pkg, w: sum });
  }
  offers.sort((a, b) => b.w - a.w);
  return { offers: offers.slice(0, 5) };
}

// Trading block: shop a package to the whole league. Every team that wants it makes its best
// offer; the top five land in Trade offers and expire like any other offer.
function shopBlock(L, give, opts) {
  const r = findTrades(L, give, opts); if (r.err) return r;
  L.offers = (L.offers || []).filter(o => !o.block); if (!L.nextOfferId) L.nextOfferId = 1;
  const exp = L.phase === 'regular' ? L.week : -1;
  for (const o of r.offers) L.offers.push({ id: L.nextOfferId++, from: o.from, give: o.get, get: { players: (give.players || []).slice(), picks: (give.picks || []).slice() }, exp, block: true });
  return { n: r.offers.length };
}

// AI teams trade with each other: a team shores up its weakest unit with bench players and picks.
function aiTradeOnce(L) {
  ensurePicks(L);
  const ai = L.teams.filter(t => t.id !== L.user);
  const A = R.pick(ai), B = R.pick(ai); if (A === B) return false;
  const dA = depth(L, A.id), dB = depth(L, B.id);
  const SA = startersFor(L, A.id);
  const avg = (d, g) => { const n = Math.max(1, SA[g]); let s = 0; for (let i = 0; i < n; i++) s += d[g][i] ? d[g][i].ovr : 35; return s / n; };
  const groups = GRPS.filter(g => g !== 'K' && g !== 'P');
  const g = groups.sort((x, y) => avg(dA, x) - avg(dA, y))[0];
  const worst = dA[g][Math.max(1, SA[g]) - 1] ? dA[g][Math.max(1, SA[g]) - 1].ovr : 35;
  const target = R.shuffle(dB[g].filter(p => p.ovr >= worst + 5 && p.age <= 31)).sort((x, y) => playerWeight(x) - playerWeight(y))[0];
  if (!target) return false;
  const need = playerWeight(target) * 1.05;
  const starters = new Set(); GRPS.forEach(x => dA[x].slice(0, SA[x]).forEach(p => starters.add(p.id)));
  const items = roster(L, A.id).filter(p => !starters.has(p.id)).map(p => ({ t: 'p', id: p.id, w: playerWeight(p) }))
    .concat(teamPicks(L, A.id).map(k => ({ t: 'k', id: k.id, w: pickWeight(L, k) })))
    .sort((x, y) => y.w - x.w);
  const pkg = { players: [], picks: [] }; let left = need, count = 0;
  for (const it of items) {
    if (left <= 0 || count >= 4) break;
    if (it.w > left + need * 0.3) continue;
    (it.t === 'p' ? pkg.players : pkg.picks).push(it.id); left -= it.w; count++;
  }
  if (left > 0) return false;
  execTrade(L, A.id, B.id, pkg, { players: [target.id], picks: [] });
  return true;
}
// AI teams send the user offers. Each one lasts one week (or until kickoff in the offseason).
function buildPackage(L, tid, need, cap) {
  const d = depth(L, tid), starters = new Set(), SF = startersFor(L, tid);
  GRPS.forEach(x => d[x].slice(0, SF[x]).forEach(p => starters.add(p.id)));
  const items = roster(L, tid).filter(p => !starters.has(p.id)).map(p => ({ t: 'p', id: p.id, w: playerWeight(p) }))
    .concat(teamPicks(L, tid).map(k => ({ t: 'k', id: k.id, w: pickWeight(L, k) })))
    .map(it => Object.assign(it, { r: it.w * (0.8 + Math.random() * 0.4) })).sort((x, y) => y.r - x.r);
  // Counted the way the receiver counts it (extra players and picks are worth less each),
  // and never more than 10% over what they meant to pay.
  const pkg = { players: [], picks: [] }; let left = need, count = 0;
  for (const it of items) {
    if (left <= 0 || count >= (cap || 4)) break;
    const c = it.w * (it.t === 'p' ? Math.pow(0.6, pkg.players.length) : Math.pow(0.85, pkg.picks.length));
    if (c > left + need * 0.1) continue;
    (it.t === 'p' ? pkg.players : pkg.picks).push(it.id); left -= c; count++;
  }
  return left > 0 ? null : pkg;
}
function makeOffer(L) {
  ensurePicks(L); L.offers = L.offers || []; if (!L.nextOfferId) L.nextOfferId = 1;
  if (L.offers.length >= 3) return false;
  const ai = L.teams.filter(t => t.id !== L.user && !L.offers.some(o => o.from === t.id));
  if (!ai.length) return false;
  const A = R.pick(ai), dA = depth(L, A.id), dU = depth(L, L.user);
  const SA = startersFor(L, A.id);
  const avg = (d, g) => { const n = Math.max(1, SA[g]); let s = 0; for (let i = 0; i < n; i++) s += d[g][i] ? d[g][i].ovr : 35; return s / n; };
  const g = GRPS.filter(x => x !== 'K' && x !== 'P').sort((x, y) => avg(dA, x) - avg(dA, y))[0];
  const worst = dA[g][Math.max(1, SA[g]) - 1] ? dA[g][Math.max(1, SA[g]) - 1].ovr : 35;
  const target = R.pick(dU[g].filter(p => p.ovr >= worst + 4 && p.age <= 31 && !tradeLocked(L, p)));
  if (!target) return false;
  const pkg = buildPackage(L, A.id, playerWeight(target) * (diff(L).offer[0] + Math.random() * (diff(L).offer[1] - diff(L).offer[0])), 4);
  if (!pkg) return false;
  const exp = L.phase === 'regular' ? L.week : -1;
  L.offers.push({ id: L.nextOfferId++, from: A.id, give: pkg, get: { players: [target.id], picks: [] }, exp });
  addNews(L, `${L.teams[A.id].city} sent you a trade offer for ${target.pos} ${target.name}.`);
  return true;
}
function makeOffers(L, n, tries) { if (!L.teams[L.user]) return 0; let d = 0; for (let i = 0; i < tries && d < n; i++) if (makeOffer(L)) d++; }
function offerValid(L, o) { return validPkg(L, o.from, o.give) && validPkg(L, L.user, o.get); }
function acceptOffer(L, id) {
  const o = (L.offers || []).find(x => x.id === id); if (!o) return 'That offer has expired.';
  if (pastDeadline(L)) return 'The trade deadline has passed.';
  if (!offerValid(L, o)) { L.offers = L.offers.filter(x => x !== o); return 'That offer is no longer valid. Someone involved has moved.'; }
  const max = rules(L.year).rosterMax, after = active(L, L.user).length - o.get.players.length + o.give.players.length;
  if ((L.phase === 'regular' || L.phase === 'playoffs') && after > max) return `Accepting would put you at ${after} players, over the ${max} limit. Release someone first.`;
  const cm = tradeCapMsg(L, L.user, o.from, o.get, o.give); if (cm) return cm;
  const lk = (o.get.players || []).map(i => L.players[i]).find(p => tradeLocked(L, p)); if (lk) return `${lk.name} was just signed and can't be traded yet.`;
  L.offers = L.offers.filter(x => x !== o);
  execTrade(L, o.from, L.user, o.give, o.get);
  L.offers = L.offers.filter(x => offerValid(L, x));
  return null;
}
function rejectOffer(L, id) { L.offers = (L.offers || []).filter(x => x.id !== id); }

function aiTrades(L, wanted, tries) { let done = 0; for (let i = 0; i < tries && done < wanted; i++) if (aiTradeOnce(L)) done++; return done; }

// Real NFL averages per team per game (Pro-Football-Reference): pts, cmp, att, pass yds, pass TD, INT, rush att, rush yds, rush TD
const ERA_DATA = {
  1970: [19.3, 13.8, 26.9, 161.4, 1.2, 1.4, 31.4, 120.4, 0.8],
  1971: [19.4, 13.2, 25.9, 155.7, 1.1, 1.5, 32.4, 130.1, 0.9],
  1972: [20.3, 12.8, 24.8, 152.1, 1.1, 1.3, 33.7, 139.4, 1.0],
  1973: [19.5, 12.6, 24.3, 140.9, 1.0, 1.3, 35.5, 144.4, 0.9],
  1974: [18.2, 13.8, 26.4, 153.2, 1.0, 1.4, 34.4, 133.3, 1.0],
  1975: [20.6, 14.4, 27.4, 162.8, 1.2, 1.5, 36.3, 145.5, 1.1],
  1976: [19.2, 13.7, 26.2, 152.0, 1.1, 1.3, 36.9, 150.7, 1.1],
  1977: [17.2, 12.8, 25.0, 141.9, 1.0, 1.4, 37.4, 143.9, 0.9],
  1978: [18.3, 14.0, 26.4, 158.8, 1.0, 1.4, 35.9, 141.8, 1.0],
  1979: [20.1, 15.7, 29.0, 180.4, 1.2, 1.3, 33.9, 135.6, 1.1],
  1980: [20.5, 17.2, 30.6, 196.0, 1.4, 1.4, 32.1, 127.5, 1.0],
  1981: [20.7, 17.3, 31.7, 204.4, 1.3, 1.4, 32.4, 130.1, 1.0],
  1982: [20.2, 17.8, 31.5, 199.4, 1.3, 1.4, 30.8, 117.8, 0.9],
  1983: [21.8, 17.8, 31.4, 204.6, 1.4, 1.4, 31.7, 129.7, 1.0],
  1984: [21.2, 18.0, 32.0, 205.9, 1.4, 1.3, 30.8, 123.9, 0.9],
  1985: [21.5, 17.7, 32.2, 204.5, 1.3, 1.3, 30.4, 124.9, 1.0],
  1986: [20.5, 17.9, 32.3, 205.5, 1.3, 1.3, 30.2, 118.7, 0.9],
  1987: [21.6, 17.6, 32.1, 203.9, 1.5, 1.3, 31.4, 123.9, 0.9],
  1988: [20.3, 17.1, 31.5, 200.7, 1.2, 1.2, 30.3, 121.4, 0.9],
  1989: [20.6, 17.9, 32.0, 210.9, 1.3, 1.2, 29.2, 115.3, 0.9],
  1990: [20.1, 16.9, 30.2, 194.8, 1.3, 1.1, 27.8, 113.9, 0.8],
  1991: [19.0, 17.9, 31.1, 199.1, 1.1, 1.1, 27.4, 107.7, 0.8],
  1992: [18.7, 17.2, 29.9, 187.6, 1.2, 1.2, 27.4, 110.5, 0.7],
  1993: [18.7, 18.6, 32.2, 200.6, 1.2, 1.0, 28.3, 110.0, 0.7],
  1994: [20.3, 19.5, 33.6, 213.6, 1.3, 1.1, 28.0, 104.3, 0.8],
  1995: [21.5, 20.2, 34.8, 220.8, 1.4, 1.1, 27.5, 108.1, 0.8],
  1996: [20.4, 19.2, 33.3, 207.4, 1.3, 1.1, 28.3, 109.0, 0.8],
  1997: [20.7, 18.4, 32.8, 201.8, 1.3, 1.0, 28.4, 113.0, 0.8],
  1998: [21.3, 18.3, 32.3, 205.0, 1.4, 1.1, 28.3, 112.7, 0.8],
  1999: [20.8, 19.3, 33.8, 212.3, 1.3, 1.1, 27.3, 106.5, 0.7],
  2000: [20.7, 19.1, 32.9, 206.9, 1.3, 1.1, 27.6, 112.6, 0.8],
  2001: [20.2, 19.2, 32.6, 205.8, 1.3, 1.1, 27.6, 111.8, 0.7],
  2002: [21.7, 20.1, 33.8, 212.2, 1.4, 1.0, 27.5, 116.1, 0.9],
  2003: [20.8, 18.9, 32.2, 200.4, 1.3, 1.1, 28.3, 117.9, 0.8],
  2004: [21.5, 19.1, 31.9, 210.5, 1.4, 1.0, 28.2, 116.6, 0.8],
  2005: [20.6, 19.1, 32.2, 203.5, 1.3, 1.0, 28.1, 112.5, 0.8],
  2006: [20.7, 19.1, 32.0, 204.8, 1.3, 1.0, 28.2, 117.3, 0.8],
  2007: [21.7, 20.4, 33.3, 214.3, 1.4, 1.0, 27.3, 110.9, 0.8],
  2008: [22.0, 19.7, 32.3, 211.3, 1.3, 0.9, 27.6, 116.0, 0.9],
  2009: [21.5, 20.3, 33.3, 218.5, 1.4, 1.0, 27.5, 116.7, 0.8],
  2010: [22.0, 20.5, 33.7, 221.5, 1.5, 1.0, 27.2, 114.5, 0.8],
  2011: [22.2, 20.4, 34.0, 229.7, 1.5, 1.0, 27.3, 117.1, 0.8],
  2012: [22.8, 21.2, 34.7, 231.3, 1.5, 0.9, 27.2, 115.9, 0.8],
  2013: [23.4, 21.7, 35.4, 235.6, 1.6, 1.0, 27.1, 112.9, 0.8],
  2014: [22.6, 21.9, 34.9, 236.8, 1.6, 0.9, 26.7, 111.3, 0.7],
  2015: [22.8, 22.5, 35.7, 243.8, 1.6, 0.9, 26.3, 108.8, 0.7],
  2016: [22.8, 22.5, 35.7, 241.5, 1.5, 0.8, 26.0, 108.9, 0.9],
  2017: [21.7, 21.2, 34.2, 224.4, 1.4, 0.8, 26.9, 109.7, 0.7],
  2018: [23.3, 22.4, 34.5, 237.8, 1.7, 0.8, 25.9, 114.5, 0.9],
  2019: [22.8, 22.1, 34.9, 235.0, 1.6, 0.8, 26.1, 112.9, 0.9],
  2020: [24.8, 23.0, 35.2, 240.2, 1.7, 0.8, 26.9, 118.9, 1.0],
  2021: [23.0, 22.3, 34.4, 228.3, 1.5, 0.8, 26.6, 115.2, 0.9],
  2022: [21.9, 21.4, 33.3, 218.5, 1.4, 0.8, 27.3, 121.6, 0.9],
  2023: [21.8, 21.7, 33.7, 218.9, 1.4, 0.8, 26.8, 112.7, 0.9],
  2024: [22.9, 21.4, 32.7, 217.6, 1.5, 0.7, 27.0, 119.8, 0.9],
  2025: [23.0, 20.6, 32.1, 209.7, 1.5, 0.7, 26.8, 116.9, 0.9]
};
function era(y) {
  const ys = Object.keys(ERA_DATA).map(Number), yy = Math.max(ys[0], Math.min(ys[ys.length - 1], y));
  const [pts, cmp, att, pyds, ptd, int, ratt, ryds, rtd] = ERA_DATA[yy];
  return { pts, cmp, att, pyds, ptd, int, ratt, ryds, rtd, tot: pyds + ryds, pshare: pyds / (pyds + ryds), tdPass: ptd / (ptd + rtd), ypa: pyds / att, ypc: pyds / cmp, ypr: ryds / ratt, cmpPct: cmp / att };
}

/* ---------- coaching staff ---------- */
const ROLE_NAME = { hc: 'Head coach', oc: 'Offensive coordinator', dc: 'Defensive coordinator', sc: 'Director of scouting', md: 'Head of medical staff' };
const STAFF_ROLES = ['hc', 'oc', 'dc', 'sc', 'md'];
/* ---------- staff budget ----------
   The owner sets a yearly budget for the five staff jobs. Bigger markets and better teams get more.
   Salaries scale with the era (a share of the league's average player salary) and with rating. */
const ROLE_PAY = { hc: 2.2, oc: 0.9, dc: 0.9, sc: 0.9, md: 0.35 };
const MARKET_BIG = ['New York', 'Los Angeles', 'Chicago', 'Dallas', 'Philadelphia', 'San Francisco', 'Washington', 'Houston', 'Boston', 'New England'];
const MARKET_SMALL = ['Green Bay', 'Buffalo', 'Jacksonville', 'Cincinnati', 'New Orleans', 'Kansas City', 'Indianapolis', 'Tennessee', 'Cleveland', 'Pittsburgh', 'Nashville', 'Memphis'];
function marketOf(t) { const c = t.city || ''; return MARKET_BIG.some(x => c.includes(x)) ? 'big' : MARKET_SMALL.some(x => c.includes(x)) ? 'small' : 'mid'; }
const MARKET_MUL = { big: 1.15, mid: 1, small: 0.87 };
const MARKET_NAME = { big: 'Large market', mid: 'Mid-size market', small: 'Small market' };
function staffAsk(L, c, y) { return Math.round(avgSalary(y || L.year) * ROLE_PAY[c.role] * (0.45 + 1.3 * Math.pow(clamp((c.r - 35) / 55, 0, 1.1), 1.5)) / 5) * 5; }
function staffSal(L, c) { if (!c) return 0; if (c.interim) return staffAsk(L, c); if (c.sal == null) c.sal = staffAsk(L, c); return c.sal; }
// how good the team has been: last two seasons' win share, plus the current roster
function budgetInfo(L, tid) {
  const t = L.teams[tid], h = t.hist || [], last = h.slice(-2);
  const wp = last.length ? last.reduce((a, x) => a + (x.w + x.t / 2) / Math.max(1, x.w + x.l + x.t), 0) / last.length : 0.5;
  const mk = marketOf(t), win = 0.9 + wp * 0.2;
  const base = avgSalary(L.year) * 5.1 * 0.9; // a bit less than an all-average staff costs: you have to choose
  const total = Math.round(base * MARKET_MUL[mk] * win / 10) * 10;
  return { total, market: mk, marketName: MARKET_NAME[mk], wp, mult: MARKET_MUL[mk] * win };
}
function staffSpend(L, tid) { const st = L.teams[tid].staff || {}; return STAFF_ROLES.reduce((a, r) => a + (st[r] && !st[r].interim ? staffSal(L, st[r]) : 0), 0); }
// A scout starts from the league consensus (where a player was really drafted, his college) and sees part of
// the way past it: skill = share of the consensus's miss he corrects; err = his own random misses on top.
function scoutSkill(c) { return c ? { skill: clamp(0.15 + (c.r - 50) * 0.0065, 0.05, 0.45), err: clamp(6 - (c.r - 35) * 0.06, 2.5, 6.5) } : { skill: 0.03, err: 7 }; }
function scoutErr(c) { return scoutSkill(c).err; }
// Medical staff: fewer injuries and shorter ones with a good staff
function medMul(L, tid) { const t = L.teams[tid], c = t && t.staff && t.staff.md; return c ? clamp(1 - (c.r - 60) * 0.008, 0.75, 1.3) : 1.3; }
function genCoach(L, role, mean) {
  L.nextCoachId = L.nextCoachId || 1;
  return { id: L.nextCoachId++, name: genName(), age: R.int(33, 58), r: clamp(Math.round((mean || 58) + R.norm() * 8), 35, 92), role,
    pref: role === 'oc' ? R.pick(['run', 'bal', 'pass']) : (role === 'dc' ? R.pick(['soft', 'bal', 'blitz']) : null), since: L.year, sal: null };
}
function ensureStaff(L) {
  for (const t of L.teams) {
    t.staff = t.staff || {};
    for (const role of STAFF_ROLES) if (t.staff[role] === undefined) t.staff[role] = genCoach(L, role);
  }
  L.coachPool = L.coachPool || [];
  for (const role of STAFF_ROLES) while (L.coachPool.filter(c => c.role === role).length < 8) L.coachPool.push(genCoach(L, role, 55));
}
// Coordinators add to their unit, more when the team runs the scheme they prefer. The head coach helps on game day.
function staffBonus(L, tid, coach) {
  const t = L.teams[tid], st = t && t.staff; if (!st) return { off: 0, def: 0, gd: 0 };
  const c = coach || t.coach;
  // a mismatched coordinator gives only half his boost (a below-average one hurts either way)
  const cb = (x, match) => { const v = (x.r - 60) * 0.1; return v > 0 && !match ? v * 0.5 : v; };
  const off = st.oc ? cb(st.oc, st.oc.pref === c.off) : -1.5;
  const def = st.dc ? cb(st.dc, st.dc.pref === c.def) : -1.5;
  const gd = st.hc ? (st.hc.r - 60) * 0.03 : -0.6;
  return { off, def, gd };
}
function lastWP(t) { const s = t.hist[t.hist.length - 1]; return s ? (s.w + s.t / 2) / Math.max(1, s.w + s.l + s.t) : 0.5; }
function coachWindow(L) { return ['season-over', 'draft', 'offseason', 'preseason'].includes(L.phase); }
function fireCoach(L, role) {
  if (!coachWindow(L)) return 'You can only change your staff between seasons.';
  const t = L.teams[L.user], c = t.staff[role]; if (!c) return 'That job is already open.';
  t.staff[role] = null; if (!c.interim) { c.r = Math.max(35, c.r - 2); c.sal = null; L.coachPool.push(c); }
  addNews(L, `${t.abbr} fired ${ROLE_NAME[role].toLowerCase()} ${c.name}.`); return null;
}
function coachAcceptP(L, c, tid) { return clamp(0.95 - (c.r - 62) * 0.025 + (lastWP(L.teams[tid]) - 0.5) * 1.2 + (tid === L.user ? ({ rookie: 0.1, pro: 0, allpro: -0.1 }[L.diff] || 0) : 0), 0.1, 1); }
function hireCoach(L, cid) {
  if (!coachWindow(L)) return 'You can only change your staff between seasons.';
  const c = L.coachPool.find(x => x.id === cid); if (!c) return 'He is no longer available.';
  const t = L.teams[L.user]; if (t.staff[c.role] && !t.staff[c.role].interim) return `Fire your ${ROLE_NAME[c.role].toLowerCase()} first.`;
  const B = budgetInfo(L, L.user), ask = staffAsk(L, c), left = B.total - staffSpend(L, L.user);
  if (ask > left) return `${c.name} wants ${money(ask)} a year. You have ${money(Math.max(0, left))} left in the owner's staff budget.`;
  c.decl = c.decl || {};
  if (c.decl[L.year] === L.user) return `${c.name} already turned you down this year.`;
  if (Math.random() > coachAcceptP(L, c, L.user)) { c.decl[L.year] = L.user; return `${c.name} turned you down. He wants a better situation.`; }
  L.coachPool = L.coachPool.filter(x => x !== c); c.since = L.year + 1; c.sal = ask; t.staff[c.role] = c;
  addNews(L, `${t.abbr} hired ${c.name} as ${ROLE_NAME[c.role].toLowerCase()} for ${money(ask)} a year.`); return null;
}
// After each season: AI teams fire and hire, coaches age and improve or slip, new names enter.
// After each season: ratings move with results, AI teams decide to keep or fire every coach,
// hot coordinators get hired away as head coaches, and new names enter the pool.
/* ---------- draft refusals (before the 2011 rookie wage scale) ----------
   Now and then a top-3 pick refuses to sign with a bad team (Elway 1983, Bo Jackson 1986,
   Eli Manning 2004). His rights can be traded; if nobody deals for him, he sits out the year
   and goes back into the next draft. */
function maybeRefuse(L, p, tid, overall) {
  const D = L.draft; if (!D || D.year >= 2011 || overall > 3 || !p.realPick || isCareer(L, p)) return false;
  const t = L.teams[tid], last = t.hist[t.hist.length - 1]; if (!last) return false;
  const wp = (last.w + last.t / 2) / Math.max(1, last.w + last.l + last.t);
  if (wp >= 0.35 || Math.random() > 0.08) return false;
  p.unsigned = true; p.refused = { tid, y: D.year }; delete p.con;
  addNews(L, `DRAFT SHOCKER: #${overall} pick ${p.pos} ${p.name} says he will not play for ${t.city}.${tid === L.user ? ' Trade his rights or he sits out the season.' : ''}`);
  return true;
}
// After the draft, AI teams trade a refusing pick's rights for a first-rounder (as Baltimore did with Elway).
function resolveRefusals(L) {
  for (const id in L.players) {
    const p = L.players[id]; if (!p.unsigned || p.team === L.user || p.team < 0) continue;
    const dy = L.draft ? L.draft.year : L.year, next = t => (L.picks || []).filter(k => k.own === t && k.rnd === 1 && k.y > dy && tradeablePick(k));
    const from = p.team, cand = L.teams.filter(t => t.id !== from && t.id !== L.user && next(t.id).length);
    if (!cand.length) continue;
    const to = R.pick(cand), pk = next(to.id).sort((a, b) => a.y - b.y)[0];
    pk.own = from; p.team = to.id; delete p.unsigned; delete p.refused;
    const ov = p.realPick ? p.realPick.pick : 1; rookieDeal(L, p, capYear(L), Math.min(ov, 3), 1);
    addNews(L, `${L.teams[from].abbr} traded the rights to ${p.pos} ${p.name}, who refused to sign, to ${to.abbr} for a ${pk.y} first-round pick.`);
  }
}
// A refusing player still unsigned when the next draft starts goes back into the pool (Bo Jackson, 1987).
function reenterRefusers(L, pool) {
  for (const id in L.players) { const p = L.players[id]; if (!p.unsigned || !p.refused) continue;
    addNews(L, `${p.pos} ${p.name} never signed with ${L.teams[p.refused.tid].city} and re-enters the draft.`);
    p.team = -3; delete p.unsigned; delete p.refused; p.seen = true; pool.push(p.id); }
}
// When his rights are traded to a new team, he signs.
function signRefuserIfMoved(L, p) { if (p && p.unsigned && p.refused && p.team !== p.refused.tid && p.team >= 0) { delete p.unsigned; delete p.refused; rookieDeal(L, p, capYear(L), 3, 1); addNews(L, `${p.pos} ${p.name} signs with ${L.teams[p.team].city}.`); } }

/* ---------- practice squad (1989 on) ----------
   Extra players who practice but don't count on the roster or play. Young players qualify
   (up to two seasons; from 2020 some veterans too). Other teams can sign them away. */
function psSize(y) { return y < 1989 ? 0 : y < 2004 ? 5 : y < 2014 ? 8 : y < 2020 ? 10 : 16; }
function psEligible(L, p) {
  const y = L.year;
  if ((p.yrs || 0) <= 2) return true;
  return y >= 2020 && practiceSquad(L, p.team >= 0 ? p.team : L.user).filter(x => (x.yrs || 0) > 2).length < 6;
}
function toPracticeSquad(L, pid) {
  const p = L.players[pid], tid = L.user, y = L.year;
  if (!psSize(y)) return 'Practice squads start in 1989.';
  if (!p || (p.team !== tid && p.team !== -1) || p.ps) return 'He can\'t be placed on your practice squad.';
  if (!psEligible(L, p)) return `${p.name} has too many seasons for the practice squad.`;
  if (practiceSquad(L, tid).length >= psSize(y)) return `Your practice squad is full (${psSize(y)}).`;
  if (p.team === -1 && L.phase !== 'offseason') { const e = capMsg(L, tid, psPay(capYear(L))); if (e) return e; }
  if (p.team === tid) { const dead = deadCharge(L, p); if (dead) { L.dead = L.dead || {}; const D = L.dead[tid] || (L.dead[tid] = {}); D[capYear(L)] = (D[capYear(L)] || 0) + dead; } }
  p.team = tid; p.ps = true; delete p.con; delete p.ir; plog(L, p, `Placed on the ${L.teams[tid].abbr} practice squad.`);
  addNews(L, `${L.teams[tid].abbr} put ${p.pos} ${p.name} on the practice squad.`);
  return null;
}
function promoteFromPS(L, pid) {
  const p = L.players[pid]; if (!p || !p.ps) return 'He is not on a practice squad.';
  const tid = p.team;
  if (tid === L.user && L.phase === 'regular' && roster(L, tid).length >= rules(L.year).rosterMax) return 'Your roster is full. Release someone first.';
  // He moves up to the league minimum. His practice-squad pay was already on the cap, so only the difference is new.
  const y = capYear(L), sal = minSalary(y), extra = sal - (psCounts(L, y) ? psPay(y) : 0);
  if (tid === L.user) { const e = capMsg(L, tid, extra); if (e) return e + ` Promoting him adds ${money(extra)} (the minimum salary minus the practice-squad pay already on your cap).`; }
  delete p.ps; setContract(p, sal, y, 1); plog(L, p, `Promoted from the ${L.teams[tid].abbr} practice squad.`);
  addNews(L, `${L.teams[tid].abbr} promoted ${p.pos} ${p.name} from the practice squad.`);
  return null;
}
// AI teams fill their practice squads with the best young free agents after cutdowns.
function aiFillPS(L) {
  const n = psSize(L.year); if (!n) return;
  const pool = freeAgents(L).filter(p => p.retiredYear == null && (p.yrs || 0) <= 2).sort((a, b) => b.pot - a.pot);
  for (const t of L.teams) {
    if (t.id === L.user) continue;
    let have = practiceSquad(L, t.id).length;
    while (have < n && pool.length) { const p = pool.shift(); p.team = t.id; p.ps = true; delete p.con; have++; }
  }
}
// During the season, teams sign promising players off other teams' practice squads.
function poachPS(L) {
  if (!psSize(L.year)) return;
  for (const id in L.players) {
    const p = L.players[id]; if (!p.ps || p.pot < 68 || Math.random() > 0.03) continue;
    const from = p.team, to = R.pick(L.teams.filter(t => t.id !== from && t.id !== L.user));
    const worst = roster(L, to.id).filter(x => x.grp === p.grp).sort((a, b) => value(a) - value(b))[0];
    if (!worst || value(worst) >= value(p)) continue;
    worst.team = -1; delete worst.con;
    delete p.ps; p.team = to.id; setContract(p, Math.round(avgSalary(capYear(L)) * 0.35), capYear(L), 2); plog(L, p, `Signed off ${L.teams[from].abbr}'s practice squad by ${to.abbr}.`);
    addNews(L, `${to.abbr} signed ${p.pos} ${p.name} off ${from === L.user ? 'your' : L.teams[from].abbr + "'s"} practice squad.`);
  }
}
// You can sign another team's practice-squad player to your active roster too.
function signFromPS(L, pid) {
  const p = L.players[pid]; if (!p || !p.ps || p.team === L.user) return 'He is not on another team\'s practice squad.';
  if (L.phase === 'regular' && roster(L, L.user).length >= rules(L.year).rosterMax) return 'Your roster is full. Release someone first.';
  const sal = Math.round(avgSalary(capYear(L)) * 0.35), e = capMsg(L, L.user, sal); if (e) return e;
  const from = p.team; delete p.ps; p.team = L.user; setContract(p, sal, capYear(L), 2); plog(L, p, `Signed off ${L.teams[from].abbr}'s practice squad by ${L.teams[L.user].abbr}.`);
  addNews(L, `${L.teams[L.user].abbr} signed ${p.pos} ${p.name} off ${L.teams[from].abbr}'s practice squad.`);
  return null;
}
// Each new season: players who outgrew the practice squad move up (AI) or are released.
function psNewSeason(L) {
  for (const id in L.players) {
    const p = L.players[id]; if (!p.ps) continue;
    if (!psSize(L.year) || ((p.yrs || 0) > 2 && L.year < 2020)) {
      if (p.team === L.user) { delete p.ps; setContract(p, Math.round(avgSalary(capYear(L)) * 0.3), capYear(L), 1); addNews(L, `${p.pos} ${p.name} is too experienced for the practice squad and moves to your roster.`); }
      else if (p.pot >= 60) { delete p.ps; setContract(p, Math.round(avgSalary(capYear(L)) * 0.3), capYear(L), 1); }
      else { delete p.ps; p.team = -1; }
    }
  }
}

/* ---------- former players become coaches ----------
   Every player has a hidden football IQ. A few years after retiring, the sharpest ones
   (quarterbacks, centers, linebackers and safeties most often) join the coaching pool. */
function hashN(x) { x = ((x >>> 16) ^ x) * 0x45d9f3b; x = ((x >>> 16) ^ x) * 0x45d9f3b; x = (x >>> 16) ^ x; return (x >>> 0) / 4294967296; }
function footballIQ(p) {
  const u = (hashN(p.id * 7 + 3) + hashN(p.id * 13 + 5) + hashN(p.id * 31 + 11)) / 3; // 0-1, bell-shaped
  const pos = String(p.pos || '').toUpperCase();
  const bonus = p.grp === 'QB' ? 12 : /^(C|MLB|ILB|FS|SS|S)$/.test(pos) ? 7 : p.grp === 'LB' || p.grp === 'DB' ? 4 : p.grp === 'OL' || p.grp === 'TE' ? 3 : p.grp === 'K' || p.grp === 'P' ? -10 : 0;
  return clamp(Math.round(40 + u * 40 + bonus + Math.min(p.yrs || 0, 15) * 0.8), 20, 99);
}
function exPlayerCoaches(L) {
  if (!L.retired) return;
  L.exCoach = L.exCoach || {};
  // former players nobody hires within six years go back to private life
  L.coachPool = L.coachPool.filter(c => !c.ex || L.year - (c.since || L.year) <= 6);
  const off = ['QB', 'RB', 'WR', 'TE', 'OL'];
  const cands = Object.values(L.retired).filter(p => p.retiredYear != null && L.year - p.retiredYear >= 2 && L.year - p.retiredYear <= 8 && !L.exCoach[p.id] && (p.yrs || 0) >= 4)
    .map(p => ({ p, iq: footballIQ(p) })).filter(x => x.iq >= 74).sort((a, b) => b.iq - a.iq);
  let added = 0;
  for (const { p, iq } of cands) {
    if (added >= 4) break;
    if (Math.random() > 0.25) continue;
    L.exCoach[p.id] = L.year;
    const cs = careerScore(p) || 0, isOff = off.includes(p.grp);
    const role = iq >= 86 && (p.yrs || 0) >= 9 && Math.random() < 0.35 ? 'hc' : (isOff ? 'oc' : 'dc');
    const pref = role === 'oc' ? (p.grp === 'QB' || p.grp === 'WR' || p.grp === 'TE' ? 'pass' : p.grp === 'RB' ? 'run' : R.pick(['run', 'bal'])) : role === 'dc' ? (p.grp === 'DB' ? 'soft' : p.grp === 'DL' ? 'blitz' : R.pick(['bal', 'blitz'])) : null;
    L.nextCoachId = L.nextCoachId || 1;
    const c = { id: L.nextCoachId++, name: p.name, age: (p.age || 32) + (L.year - p.retiredYear), role, pref, since: L.year,
      r: clamp(Math.round(48 + (iq - 74) * 0.9 + Math.min(6, cs / 25) + R.norm() * 4), 40, 82),
      ex: { pid: p.id, pos: p.pos, yrs: p.yrs || 0, hof: !!(p.hof && p.hof > 0) } };
    L.coachPool.push(c); added++;
    if (p.hof > 0 || cs >= 60 || role === 'hc') addNews(L, `Former ${p.pos} ${p.name} has joined the coaching ranks. He's available as ${role === 'oc' ? 'an' : 'a'} ${ROLE_NAME[role].toLowerCase()}.`);
  }
}

function coachCarousel(L) {
  ensureStaff(L);
  const n = L.teams.length, P = L.playoffs, inPO = new Set(P ? P.seeds.AFC.concat(P.seeds.NFC) : []);
  const offRank = {}, defRank = {};
  L.teams.slice().sort((a, b) => b.pf - a.pf).forEach((t, i) => offRank[t.id] = i);
  L.teams.slice().sort((a, b) => a.pa - b.pa).forEach((t, i) => defRank[t.id] = i);
  const unitDelta = rk => rk < 3 ? 3 : rk < 8 ? 2 : rk < 12 ? 1 : rk >= n - 5 ? -2 : rk >= n - 10 ? -1 : 0;
  const news = [];
  for (const t of L.teams) {
    const wp = (t.w + t.t / 2) / Math.max(1, t.w + t.l + t.t);
    const champ = P && P.champ === t.id;
    for (const role of STAFF_ROLES) {
      const c = t.staff[role]; if (!c) continue;
      // rating change from this season (scouts and medical staffs mostly just age and drift)
      let d = role === 'sc' ? 0 : role === 'md' ? R.int(-1, 2) : role === 'hc' ? (wp >= 0.75 ? 3 : wp >= 0.6 ? 2 : wp >= 0.5 ? 1 : wp <= 0.25 ? -2 : wp <= 0.4 ? -1 : 0) + (inPO.has(t.id) ? 1 : 0) + (champ ? 2 : 0)
        : role === 'oc' ? unitDelta(offRank[t.id]) : unitDelta(defRank[t.id]);
      if (c.age >= 64 && Math.random() < 0.5) d -= 1;
      if (role !== 'sc') d -= Math.round((c.r - 62) * 0.08); // ratings drift back toward average without continued success
      c.r = clamp(c.r + d, 35, 95); c.delta = d; c.age++;
      c.rec = c.rec || { w: 0, l: 0, t: 0, yrs: 0 }; c.rec.w += t.w; c.rec.l += t.l; c.rec.t += t.t; c.rec.yrs++;
      if (champ) c.titles = (c.titles || 0) + 1;
      if (t.id === L.user) { if (c.age >= 70 && Math.random() < 0.5) { t.staff[role] = null; news.push(`Your ${ROLE_NAME[role].toLowerCase()} ${c.name} retired.`); } continue; }
      // AI: keep or fire
      const tenure = L.year - (c.since || L.year) + 1, tf = tenure <= 1 ? 0.4 : tenure === 2 ? 0.8 : 1;
      const prev = t.hist[t.hist.length - 2], prevBad = prev && (prev.w + prev.t / 2) / Math.max(1, prev.w + prev.l + prev.t) < 0.45;
      let pf = 0;
      if (role === 'sc' || role === 'md') pf = c.r < 50 ? 0.2 : 0.05;
      else if (role === 'hc') pf = (wp < 0.25 ? 0.8 : wp < 0.35 ? 0.6 : wp < 0.45 ? 0.25 : wp < 0.5 ? 0.1 : 0.02) + (prevBad && wp < 0.45 ? 0.25 : 0);
      else { const rk = role === 'oc' ? offRank[t.id] : defRank[t.id]; pf = rk >= n - 5 ? 0.5 : rk >= n - 10 ? 0.25 : 0.03; }
      const fire = c.age >= 70 || Math.random() < pf * tf;
      if (fire) {
        t.staff[role] = null;
        if (c.age < 70) { c.r = Math.max(35, c.r - 2); c.sal = null; L.coachPool.push(c); }
        if (role === 'hc') news.push(c.age >= 70 ? `${t.abbr} head coach ${c.name} retired.` : `${t.abbr} fired head coach ${c.name} after a ${t.w}-${t.l}${t.t ? '-' + t.t : ''} season.`);
        // a new head coach usually brings his own coordinators
        if (role === 'hc' && c.age < 70) for (const r2 of ['oc', 'dc']) { const x = t.staff[r2]; if (x && Math.random() < 0.5) { t.staff[r2] = null; L.coachPool.push(x); } }
      }
    }
  }
  L.coachPool = L.coachPool.filter(c => { c.age++; return c.age < 70; });
  for (const role of STAFF_ROLES) for (let i = 0; i < 4; i++) L.coachPool.push(genCoach(L, role, 56));
  exPlayerCoaches(L);
  // AI vacancies filled, worst teams first. Head-coach searches also look at top coordinators around the league.
  const order = L.teams.filter(t => t.id !== L.user).sort((a, b) => (a.w - b.w));
  for (const t of order) for (const role of ['hc', 'oc', 'dc']) {
    if (t.staff[role]) continue;
    let cand = L.coachPool.filter(c => c.role === role).map(c => ({ c, from: null }));
    if (role === 'hc') for (const o of L.teams) if (o.id !== t.id) for (const r2 of ['oc', 'dc']) { const x = o.staff[r2]; if (x && x.r >= 72) cand.push({ c: x, from: o, r2 }); }
    cand.sort((a, b) => b.c.r - a.c.r);
    let pick = null;
    for (const k of cand) if (Math.random() < coachAcceptP(L, k.c, t.id) * (k.from ? 0.6 : 1)) { pick = k; break; }
    pick = pick || cand.filter(k => !k.from).slice(-1)[0];
    if (!pick) continue;
    const h = pick.c;
    if (pick.from) {
      pick.from.staff[pick.r2] = null; h.role = 'hc'; h.pref = null;
      news.push(pick.from.id === L.user ? `${t.abbr} hired away your ${ROLE_NAME[pick.r2].toLowerCase()} ${h.name} as head coach. Hire a replacement on the Coach tab.` : `${t.abbr} promoted ${pick.from.abbr} coordinator ${h.name} to head coach.`);
    } else { L.coachPool = L.coachPool.filter(x => x !== h); if (role === 'hc') news.push(`${t.abbr} hired ${h.name} (rating ${h.r}) as head coach.`); }
    h.since = L.year + 1; t.staff[role] = h;
  }
  // teams that lost a coordinator to another team's head-coach search fill the job now
  for (const t of order) for (const role of ['oc', 'dc', 'sc', 'md']) if (!t.staff[role]) {
    const c = L.coachPool.filter(x => x.role === role).sort((a, b) => b.r - a.r).find(x => Math.random() < coachAcceptP(L, x, t.id)) || L.coachPool.filter(x => x.role === role)[0];
    if (c) { L.coachPool = L.coachPool.filter(x => x !== c); c.since = L.year + 1; t.staff[role] = c; }
  }
  if (news.length) addNews(L, 'Coaching carousel: ' + news.slice(0, 8).join(' ') + (news.length > 8 ? ` And ${news.length - 8} more moves.` : ''));
}
function fillInterim(L) {
  const t = L.teams[L.user]; if (!t) return;
  for (const role of STAFF_ROLES) if (!t.staff[role]) { t.staff[role] = Object.assign(genCoach(L, role, 48), { r: 48, interim: true }); addNews(L, `No ${ROLE_NAME[role].toLowerCase()} hired, so ${t.staff[role].name} takes over on an interim basis.`); }
}

/* ---------- owner & job security ---------- */
function setGoal(L) {
  if (!L.teams[L.user]) return;
  L.job = L.job || { sec: 60, hist: [] };
  const n = L.teams.length, ranked = L.teams.map(t => [t.id, teamOverall(L, t.id)]).sort((a, b) => b[1] - a[1]);
  const r = ranked.findIndex(x => x[0] === L.user) + 1, t = L.teams[L.user], last = t.hist[t.hist.length - 1];
  const g = rules(L.year).games;
  let goal;
  if (r <= 2) goal = { t: 'conf', txt: 'Reach the conference championship' };
  else if (r <= 6) goal = { t: 'div', txt: 'Win the division' };
  else if (r <= rules(L.year).playoffPerConf * 2) goal = { t: 'po', txt: 'Make the playoffs' };
  else if (r <= Math.round(n * 0.7)) goal = { t: '500', txt: 'Finish .500 or better' };
  else { const w = Math.min(Math.round(g * 0.5), Math.max(Math.round(g * 0.3), (last ? last.w : 0) + 2)); goal = { t: 'wins', n: w, txt: `Win at least ${w} games` }; }
  goal.y = L.year; goal.rank = r; L.job.goal = goal;
  addNews(L, `The owner's goal for ${L.year}: ${goal.txt}. Your roster ranks #${r} of ${n}.`);
}
function judgeSeason(L) {
  if (!L.teams[L.user]) return;
  L.job = L.job || { sec: 60, hist: [] };
  const J = L.job, g = J.goal, t = L.teams[L.user], P = L.playoffs;
  if (!g || g.y !== L.year) return;
  const inPO = P.seeds[t.conf].includes(L.user);
  const divs = divisions(L), divWin = sortTeams(L, divs[t.conf + '|' + t.div])[0].id === L.user;
  const confRound = P.rounds.find(r => r.name === 'Conference Championships');
  const reachedConf = !!(confRound && confRound.games.some(x => x.h === L.user || x.a === L.user));
  const wp = (t.w + t.t / 2) / Math.max(1, t.w + t.l + t.t);
  const met = g.t === 'conf' ? reachedConf : g.t === 'div' ? divWin : g.t === 'po' ? inPO : g.t === '500' ? wp >= 0.5 : t.w >= g.n;
  const mult = { rookie: 0.6, pro: 1, allpro: 1.4 }[L.diff] || 1;
  let d = met ? 12 : -18 * mult;
  if (inPO) d += 4;
  if (P.champ === L.user) d += 25; else if (L.champs[0] && L.champs[0].loser === L.user) d += 10;
  d += (wp - 0.5) * 16;
  const before = J.sec;
  J.sec = clamp(Math.round(J.sec + d), 0, 100);
  if (J.hist.length === 0) J.sec = Math.max(J.sec, 20);
  J.hist.push({ y: L.year, team: L.user, goal: g.txt, met, sec: J.sec });
  const mood = J.sec >= 75 ? 'thrilled' : J.sec >= 50 ? 'satisfied' : J.sec >= 25 ? 'losing patience' : 'furious';
  addNews(L, `Owner review: goal "${g.txt}" ${met ? 'met' : 'missed'}. The owner is ${mood} (job security ${before} → ${J.sec}).`);
  if (J.sec <= 0) {
    const offers = sortTeams(L, L.teams.filter(x => x.id !== L.user)).reverse().slice(0, 3).map(x => x.id);
    L.fired = { y: L.year, team: L.user, offers };
    addNews(L, `You have been fired as general manager of the ${t.city} ${t.name}.`);
  }
}
function takeJob(L, tid) {
  if (!L.fired || !L.fired.offers.includes(tid)) return 'That job is not available.';
  const old = L.teams[L.user];
  L.user = tid; L.fired = null; L.offers = []; L.plan = null;
  L.job.sec = 55; L.job.goal = null;
  addNews(L, `You are the new general manager of the ${L.teams[tid].city} ${L.teams[tid].name}.`);
  return null;
}

/* ---------- Hall of Fame ---------- */
function careerScore(p) {
  let s = 0;
  for (const y in p.hist) {
    const h = p.hist[y];
    if (OFFG.includes(p.grp)) s += offScore(h);
    else if (DEFG.includes(p.grp)) s += (h.sk || 0) * 4 + (h.dint || 0) * 5 + (h.g || 0) * 2.2;
    else if (p.grp === 'OL') s += (h.g || 0) * 1.5;
    else s += (h.fgm || 0) * 0.6 + (h.g || 0) * 0.5;
  }
  s += Math.max(0, (p.peak || p.ovr) - 65) * 6;
  for (const a of p.awards || []) s += ({ mvp: 70, opoy: 45, dpoy: 45, sbmvp: 20, roy: 8, ap1: 22, ap2: 9, pb: 5 })[a.a] || 0;
  return s;
}
function inductHOF(L) {
  L.hof = L.hof || [];
  const cand = Object.values(L.retired || {}).filter(p => !p.hof && p.retiredYear != null && L.year >= p.retiredYear + 4)
    .map(p => ({ p, s: careerScore(p) })).sort((a, b) => b.s - a.s);
  // The bar is the top 3% of long careers at each position (top 1% for kickers and punters).
  const pool = {}; Object.values(L.retired || {}).forEach(p => { if (Object.keys(p.hist).length >= 5) (pool[p.grp] = pool[p.grp] || []).push(careerScore(p)); });
  const line = g => { const a = (pool[g] || []).sort((x, y) => y - x); if (a.length < 20) return Infinity; return a[Math.floor(a.length * (g === 'K' || g === 'P' ? 0.01 : 0.03))]; };
  const cls = cand.filter(c => c.s >= line(c.p.grp)).sort((a, b) => b.s / line(b.p.grp) - a.s / line(a.p.grp)).slice(0, 5);
  for (const { p, s } of cls) {
    p.hof = L.year;
    const teams = [...new Set(Object.values(p.hist).map(h => h.tm).filter(x => x != null))];
    L.hof.push({ y: L.year, id: p.id, name: p.name, pos: p.pos, teams, score: Math.round(s) });
    aiRingCheck(L, p);
  }
  // a player who waits too long drops off the ballot
  for (const c of cand) if (!c.p.hof && L.year >= c.p.retiredYear + 24) c.p.hof = -1;
  if (cls.length) addNews(L, `Hall of Fame class of ${L.year}: ${cls.map(c => c.p.pos + ' ' + c.p.name).join(', ')}.`);
}

/* ---------- morale & holdouts ---------- */
function mor(p) { return p.mor == null ? 60 : p.mor; }
function addMor(p, d) { p.mor = clamp(mor(p) + d, 0, 100); }
function moraleWord(p) { const m = mor(p); return m >= 75 ? 'Happy' : m >= 50 ? 'Content' : m >= 30 ? 'Unhappy' : 'Angry'; }
function underpaid(L, p) { const y = capYear(L), s = salFor(p, y); return s != null && p.ovr >= 72 && s < 0.65 * marketValue(L, p, y); }
function weeklyMorale(L) {
  const wk = L.schedule[L.week - 1] || [];
  const res = {};
  wk.forEach(g => { if (!g.done) return; res[g.h] = Math.sign(g.hs - g.as); res[g.a] = Math.sign(g.as - g.hs); });
  for (const t of L.teams) {
    if (res[t.id] == null) continue;
    const d = depth(L, t.id), st = new Set(), SF = startersFor(L, t.id); GRPS.forEach(x => d[x].slice(0, SF[x]).forEach(p => st.add(p.id)));
    for (const p of roster(L, t.id)) addMor(p, res[t.id] * 1.2 + (st.has(p.id) ? 0.3 : (p.ovr >= 70 ? -0.8 : 0)));
  }
}
function seasonMorale(L) {
  const P = L.playoffs, po = new Set(P.seeds.AFC.concat(P.seeds.NFC));
  for (const t of L.teams) for (const p of roster(L, t.id)) {
    let d = (60 - mor(p)) * 0.2 + (po.has(t.id) ? 4 : 0);
    if (underpaid(L, p)) d -= 15;
    addMor(p, d);
  }
}
function holdoutCheck(L) {
  if (L.year < 1977) return;
  for (const t of L.teams) for (const p of roster(L, t.id)) {
    if (p.holdout || isCareer(L, p) || mor(p) >= 40 || !underpaid(L, p) || Math.random() > 0.6) continue;
    if (t.id === L.user) { p.holdout = true; addNews(L, `HOLDOUT: ${p.pos} ${p.name} refuses to report until he gets a new contract.`); }
    else { renegotiate(L, p.id, true); }
  }
}

// How a player fits a team's schemes (his own team, or one he could join): where he'd slot in
// the formation, whether the scheme leans on his position, and whether its style suits him.
function playerFit(L, p, tid) {
  const t = L.teams[tid], F = startersFor(L, tid), g = p.grp, why = [];
  if (g === 'K' || g === 'P') return { score: 70, grade: 'B-', why: [['', 'Kickers and punters fit any scheme']] };
  const isDef = ['DL', 'LB', 'DB'].includes(g), sch = SCHEME[isDef ? t.coach.ds : t.coach.os] || { w: {}, name: 'scheme' };
  const n = F[g] || 0, w = (sch.w || {})[g] || 1;
  if (!n) return { score: 30, grade: gradeLetter(30), why: [['-', `Your ${sch.name} doesn't use a ${g} as a starter`]] };
  const mates = roster(L, tid).filter(x => x.grp === g && x.id !== p.id).map(x => x.ovr).sort((a, b) => b - a);
  const rank = mates.filter(o => o > p.ovr).length + 1, starts = rank <= n;
  let sc = starts ? 74 : rank === n + 1 ? 64 : 58;
  why.push([starts ? '+' : '-', starts ? `Would start: #${rank} of ${n} ${g}${n > 1 ? 's' : ''} in your formation` : `Would be a backup: #${rank} at ${g} (${n} start)`]);
  if (w >= 1.15) { sc += 12; why.push(['+', `Your ${sch.name} leans on the ${g} position`]); }
  else if (w <= 0.85) { sc -= 10; why.push(['-', `Your ${sch.name} doesn't lean on the ${g} position`]); }
  const fam = sch.fam, style = isDef ? ({ blitz: ['DL', 'LB'], soft: ['DB'] })[fam] : ({ run: ['RB', 'OL', 'TE'], pass: ['QB', 'WR'] })[fam];
  if (style && style.includes(g)) { sc += 6; why.push(['+', `Suits a ${({ run: 'run-first', pass: 'pass-first', blitz: 'pressure', soft: "bend-don't-break" })[fam]} scheme`]); }
  const af = attrFit(p, sch);
  if (af.k && Math.abs(af.v) >= 1.5) { sc += af.v; const k = af.k, up = k.v >= p.ovr; why.push([af.v > 0 ? '+' : '-', `${k.name} (${k.v}) is ${up ? 'a strength' : 'a weak spot'}${af.c > 0 ? (up ? ` the ${sch.name} uses` : `, but the ${sch.name} doesn't need it`) : (up ? `, but the ${sch.name} doesn't use it` : ` the ${sch.name} exposes`)}`]); }
  sc += clamp((p.ovr - 70) * 0.3, -6, 6);
  sc = clamp(Math.round(sc), 0, 100);
  return { score: sc, grade: gradeLetter(sc), why };
}
// Why a player feels the way he does, and why he's holding out.
function moraleReasons(L, p) {
  const out = [], t = L.teams[p.team]; if (!t) return out;
  const y = capYear(L), sal = salFor(p, y), mv = marketValue(L, p, y);
  if (sal != null && p.ovr >= 72 && sal < 0.65 * mv) out.push(['-', `Underpaid: earns ${money(sal)}, about ${Math.round(sal / mv * 100)}% of his ${money(mv)} market value`]);
  else if (sal != null && sal >= mv * 0.95) out.push(['+', 'Paid what he is worth']);
  const g = t.w + t.l + t.t, last = t.hist[t.hist.length - 1];
  if (g >= 3) out.push([t.w > t.l ? '+' : t.w < t.l ? '-' : '', `Team is ${t.w}-${t.l}${t.t ? '-' + t.t : ''}`]);
  else if (last) out.push([last.w > last.l ? '+' : last.w < last.l ? '-' : '', `Last season ${last.w}-${last.l}${last.res && last.res !== 'Missed playoffs' ? ', made the playoffs' : ''}`]);
  const d = depth(L, p.team), F = startersFor(L, p.team), st = (d[p.grp] || []).slice(0, F[p.grp]).some(x => x.id === p.id);
  if (p.holdout) out.push(['-', 'Not playing: holding out']);
  else if (st) out.push(['+', 'Starting']);
  else if (p.ovr >= 70) out.push(['-', 'A good player stuck on the bench']);
  return out;
}
function holdoutInfo(L, p) {
  const y = capYear(L), sal = salFor(p, y) || 0, mv = marketValue(L, p, y);
  return { sal, mv, pct: mv ? Math.round(sal / mv * 100) : 0, price: renegotiatePrice(L, p), mor: mor(p), word: moraleWord(p), why: moraleReasons(L, p) };
}
function renegotiatePrice(L, p) { return Math.round(marketValue(L, p, capYear(L)) * 1.05); }
function renegotiate(L, pid, quiet) {
  const p = L.players[pid], y = capYear(L); if (!p || !p.con) return 'He has no contract to renegotiate.';
  const sal = renegotiatePrice(L, p), cur = salFor(p, y) || 0;
  if (!quiet) { const e = capMsg(L, p.team, sal - cur); if (e) return e; }
  const yrs = Math.max(p.con.ext ? p.con.ext.exp : p.con.exp, y) - y + 2;
  setContract(p, sal, y, yrs); p.mor = 75; plog(L, p, `New contract with ${L.teams[p.team].abbr}: ${yrs} yrs, ${money(sal)} a year.`);
  if (p.holdout) { delete p.holdout; if (!quiet) addNews(L, `${p.pos} ${p.name} ends his holdout with a new deal: ${yrs} yrs at ${money(sal)}.`); }
  else if (!quiet) addNews(L, `${L.teams[p.team].abbr} gave ${p.pos} ${p.name} a new deal: ${yrs} yrs at ${money(sal)}.`);
  return null;
}
function holdoutWeek(L) {
  for (const p of roster(L, L.user)) if (p.holdout) {
    if (Math.random() < 0.15) { delete p.holdout; addMor(p, -5); addNews(L, `${p.pos} ${p.name} ended his holdout and reported, still unhappy.`); }
    else addMor(p, -2);
  }
}

/* ---------- schedule ---------- */
function divKey(t) { return t.conf + t.div; }

function makeSchedule(L) {
  const n = rules(L.year).games, T = L.teams;
  const need = {}, met = {}, cnt = {}, home = {};
  const key = (a, b) => a < b ? a + '-' + b : b + '-' + a;
  T.forEach(a => { cnt[a.id] = 0; home[a.id] = 0; T.forEach(b => { if (a.id < b.id && divKey(a) === divKey(b)) need[key(a.id, b.id)] = 2; }); });
  const weeks = [];
  for (let w = 0; w < n + 6 && T.some(t => cnt[t.id] < n); w++) {
    let games = null;
    for (let attempt = 0; attempt < 60 && !games; attempt++) {
      const pool = R.shuffle(T.filter(t => cnt[t.id] < n).map(t => t.id));
      const used = new Set(), g = [];
      for (const a of pool) {
        if (used.has(a)) continue;
        let best = null, bs = -1e9;
        for (const b of pool) {
          if (b === a || used.has(b)) continue;
          const k = key(a, b);
          const s = (need[k] || 0) * 60 - (met[k] || 0) * 45 + (T[a].conf === T[b].conf ? 8 : 0) + Math.random() * 12;
          if (s > bs) { bs = s; best = b; }
        }
        if (best === null) continue;
        used.add(a); used.add(best); g.push([a, best]);
      }
      if (g.length >= Math.floor(pool.length / 2) - (attempt > 40 ? 1 : 0)) games = g;
    }
    const wk = [];
    for (const [a, b] of games || []) {
      const k = key(a, b);
      if (need[k]) need[k]--; met[k] = (met[k] || 0) + 1; cnt[a]++; cnt[b]++;
      const h = home[a] <= home[b] ? a : b, aw = h === a ? b : a; home[h]++;
      wk.push({ h, a: aw, hs: null, as: null, done: false });
    }
    weeks.push(wk);
  }
  L.schedule = weeks;
}


/* ---------- chemistry and team fit ----------
   Installing a new scheme takes time (about -1 point a game in its first season, -0.3 in the
   second), and keeping starters together builds chemistry. Team Fit rolls this together with
   how well the roster suits the schemes and whether the coordinators match. */
function schemeSince(L, t) {
  t.since = t.since || {};
  const c = t.coach || {};
  const sy = ['season-over', 'draft', 'offseason'].includes(L.phase) ? L.year + 1 : L.year; // the season he'll install it for
  for (const k of ['os', 'ds']) if (c[k] && (!t.since[k] || t.since[k].id !== c[k])) t.since[k] = { id: c[k], y: t.since[k] ? sy : L.year - 3 };
  return t.since;
}
function installCost(L, t, side) {
  const S = schemeSince(L, t)[side === 'off' ? 'os' : 'ds']; if (!S) return 0;
  const n = L.year - S.y; return n <= 0 ? -1.0 : n === 1 ? -0.3 : 0;
}
// Share of this season's starters who also started for this team last season (recorded at kickoff).
function continuityBonus(t, side) { const c = t.cont && t.cont[side]; return c == null ? 0 : clamp((c - 0.6) * 1.2, -0.7, 0.5); }
function chemistry(L, tid, side) { const t = L.teams[tid]; return installCost(L, t, side) + continuityBonus(t, side); }
function starterIdsBySide(L, tid) {
  const d = depth(L, tid), F = startersFor(L, tid), o = [], df = [];
  ['QB', 'RB', 'WR', 'TE', 'OL'].forEach(g => d[g].slice(0, F[g]).forEach(p => o.push(p.id)));
  ['DL', 'LB', 'DB'].forEach(g => d[g].slice(0, F[g]).forEach(p => df.push(p.id)));
  return { off: o, def: df };
}
// At kickoff: compare starters with last season's and remember this season's for next year.
function noteContinuity(L) {
  for (const t of L.teams) {
    const now = starterIdsBySide(L, t.id), prev = t.prevSt;
    t.cont = {};
    for (const side of ['off', 'def']) t.cont[side] = prev && prev[side] && prev[side].length ? now[side].filter(id => prev[side].includes(id)).length / Math.max(1, now[side].length) : null;
    t.prevSt = now;
  }
}
function gradeLetter(v) { return v >= 93 ? 'A+' : v >= 87 ? 'A' : v >= 82 ? 'A-' : v >= 77 ? 'B+' : v >= 72 ? 'B' : v >= 67 ? 'B-' : v >= 62 ? 'C+' : v >= 55 ? 'C' : v >= 50 ? 'C-' : v >= 44 ? 'D+' : v >= 38 ? 'D' : 'F'; }
function ptsScore(pts) { return clamp(Math.round(65 + pts * 14), 0, 100); }
// Team Fit for a team, optionally as if it switched to other schemes (opt.os / opt.ds).
function teamFit(L, tid, opt) {
  opt = opt || {};
  const t = L.teams[tid], c = Object.assign({}, t.coach, opt.os ? { os: opt.os, off: SCHEME[opt.os].fam } : {}, opt.ds ? { ds: opt.ds, def: SCHEME[opt.ds].fam } : {});
  const r = ratings(L, tid, { off: 'bal', def: 'bal' });
  const pers = { off: SCHEME[c.os] ? schemeFit(r, SCHEME[c.os]) * 0.6 : 0, def: SCHEME[c.ds] ? schemeFit(r, SCHEME[c.ds]) * 0.6 : 0 };
  const st = t.staff || {};
  const sb = staffBonus(L, tid, c), coachPts = { off: sb.off, def: sb.def };
  const inst = side => {
    const key = side === 'off' ? 'os' : 'ds', cur = t.coach[key];
    return opt[key] && opt[key] !== cur ? -1.0 : installCost(L, t, side);
  };
  const chem = { off: inst('off') + continuityBonus(t, 'off'), def: inst('def') + continuityBonus(t, 'def') };
  const part = (a, b) => { const pts = a + b; return { pts, score: ptsScore(pts), grade: gradeLetter(ptsScore(pts)) }; };
  const total = pers.off + pers.def + coachPts.off + coachPts.def + chem.off + chem.def;
  const S = schemeSince(L, t);
  return {
    total: part(total / 2, 0), personnel: part(pers.off, pers.def), coaches: part(coachPts.off, coachPts.def), chemistry: part(chem.off, chem.def),
    pts: total, raw: { pers, coachPts, chem },
    yearsIn: { off: opt.os && opt.os !== t.coach.os ? 1 : L.year - (S.os ? S.os.y : L.year) + 1, def: opt.ds && opt.ds !== t.coach.ds ? 1 : L.year - (S.ds ? S.ds.y : L.year) + 1 },
    cont: t.cont || {}
  };
}
// How a player fits his team's formation and scheme.
function roleTag(L, p) {
  if (p.team < 0) return null;
  const t = L.teams[p.team], F = startersFor(L, p.team), so = SCHEME[t.coach.os], sd = SCHEME[t.coach.ds];
  if (p.grp === 'K' || p.grp === 'P') return { t: 'Starter', c: '' };
  if (!F[p.grp]) return { t: 'Not used', c: 'bad' };
  const d = depth(L, p.team)[p.grp], i = d.findIndex(x => x.id === p.id);
  const w = ((['DL', 'LB', 'DB'].includes(p.grp) ? sd : so) || {}).w || {};
  if (i >= 0 && i < F[p.grp]) return (w[p.grp] || 1) >= 1.15 ? { t: 'Key', c: 'good' } : { t: 'Starter', c: '' };
  return { t: 'Depth', c: 'muted' };
}

/* ---------- game simulation ---------- */
const PW = { run: 0.8, bal: 1, pass: 1.2 };

// Average of the players who start at each position, for a given formation.
// A group with nobody on the field (no tight end in a five-wide set) is rated on its best player but carries no weight.
function unitAvgs(d, F) {
  const r = {};
  for (const g of GRPS) { const n = Math.max(1, F[g]); let s = 0; for (let i = 0; i < n; i++) s += d[g][i] ? eff(d[g][i]) : 35; r[g] = s / n; }
  return r;
}
// More players of a type on the field means that unit matters more.
function persW(F) { const B = STARTERS, o = {}; ['RB', 'WR', 'TE', 'DL', 'LB', 'DB'].forEach(g => o[g] = F[g] ? Math.pow(F[g] / B[g], 0.6) : 0); return o; }
function ratings(L, tid, coach) {
  const d = depth(L, tid), r = { d };
  const c = coach || L.teams[tid].coach, F = formation(c); r.F = F; r.tid = tid;
  Object.assign(r, unitAvgs(d, F));
  const pw = PW[c.off] || 1, rw = 2 - pw;
  const ow = (SCHEME[c.os] && SCHEME[c.os].w) || {}, dw = (SCHEME[c.ds] && SCHEME[c.ds].w) || {}, W = (w, g) => w[g] || 1;
  const P = persW(F);
  const oq = 0.30 * pw * W(ow, 'QB'), owr = 0.18 * pw * W(ow, 'WR') * P.WR, ote = 0.08 * W(ow, 'TE') * P.TE, orb = 0.16 * rw * W(ow, 'RB') * P.RB, ool = 0.28 * W(ow, 'OL');
  r.off = (r.QB * oq + r.WR * owr + r.TE * ote + r.RB * orb + r.OL * ool) / (oq + owr + ote + orb + ool);
  const ddl = 0.32 * W(dw, 'DL') * P.DL, dlb = 0.28 * W(dw, 'LB') * P.LB, ddb = 0.40 * W(dw, 'DB') * P.DB;
  r.def = (r.DL * ddl + r.LB * dlb + r.DB * ddb) / (ddl + dlb + ddb);
  const sb = staffBonus(L, tid, c); r.off += sb.off; r.def += sb.def;
  return r;
}

function teamOverall(L, tid) { const r = ratings(L, tid); return Math.round((r.off + r.def) / 2); }

function genScore(exp, mult) {
  const e = Math.max(2, exp * (1 + R.norm() * 0.28 * mult));
  const td = R.poisson(e * 0.70 / 7), fg = R.poisson(e * 0.30 / 3);
  let pts = 0; for (let i = 0; i < td; i++) pts += Math.random() < 0.96 ? 7 : 6;
  pts += fg * 3; if (Math.random() < 0.03) pts += 2;
  return { pts, td, fg };
}

/* ---------- era schemes ----------
   Every offense and defense belongs to a family (run/bal/pass, soft/bal/blitz) that the
   game plan and coordinators use, plus a named scheme that exists only in its era.
   w: how much each position group matters. a: what the scheme does (used for matchups).
   New schemes get a head start until the league adjusts; popular ones get scouted and countered. */
const OFF_SCHEMES = [
  { id: 'proset', name: 'Pro Set', fam: 'bal', pers: { RB: 2, WR: 2, TE: 1 }, from: 1970, to: 2000, base: 1, w: {}, a: { run: .5, deep: .5, quick: .3, qbRun: 0, misd: .3 }, blurb: 'Two backs, two receivers, a tight end. Does a bit of everything.' },
  { id: 'power', name: 'Power I', fam: 'run', pers: { RB: 2, WR: 1, TE: 2 }, from: 1970, to: 2026, base: 1, w: { RB: 1.25, OL: 1.15, TE: 1.05, QB: 0.8, WR: 0.8 }, a: { run: .95, deep: .2, quick: .1, qbRun: 0, misd: .3 }, ps: -0.04, blurb: 'Sweeps and isos behind a fullback. Needs a great back and line.' },
  { id: 'vertical', name: 'Vertical Bomb', fam: 'pass', pers: { RB: 2, WR: 2, TE: 1 }, from: 1970, to: 1990, base: 1, origin: 'rai', w: { WR: 1.25, QB: 1.05, TE: 0.85, RB: 0.9 }, a: { run: .4, deep: .95, quick: .1, qbRun: 0, misd: .2 }, intMul: 1.2, var: 0.1, blurb: 'The old AFL deep game: seven-step drops and long throws downfield.' },
  { id: 'shotgun', name: 'Shotgun & Motion', fam: 'bal', pers: { RB: 1, WR: 3, TE: 1 }, from: 1975, to: 1992, origin: 'dal', w: { QB: 1.1, WR: 1.05, OL: 0.95 }, a: { run: .4, deep: .4, quick: .45, qbRun: 0, misd: .7 }, sackMul: 0.9, blurb: 'Pre-snap shifts and the shotgun on passing downs keep defenses guessing.' },
  { id: 'coryell', name: 'Air Coryell', fam: 'pass', pers: { RB: 1, WR: 2, TE: 2 }, from: 1978, to: 2026, origin: 'sdg', w: { WR: 1.15, TE: 1.2, QB: 1.1, RB: 0.85, OL: 1.05 }, a: { run: .3, deep: .8, quick: .3, qbRun: 0, misd: .3 }, sackMul: 1.1, intMul: 1.1, blurb: 'Timing routes at every depth, with a tight end who runs like a receiver.' },
  { id: 'westcoast', name: 'West Coast', fam: 'pass', pers: { RB: 2, WR: 2, TE: 1 }, from: 1979, to: 2026, origin: 'sfo', w: { QB: 1.1, TE: 1.1, RB: 1.05, OL: 0.9 }, a: { run: .35, deep: .2, quick: .95, qbRun: 0, misd: .3 }, sackMul: 0.75, intMul: 0.85, var: -0.05, blurb: 'Short, quick throws replace the run. Accurate QBs and backs who catch thrive.' },
  { id: 'oneback', name: 'One-Back Counter Trey', fam: 'run', pers: { RB: 1, WR: 2, TE: 2 }, from: 1982, to: 2005, origin: 'was', w: { OL: 1.3, RB: 1.1, TE: 1.1, QB: 0.9, WR: 0.85 }, a: { run: .75, deep: .3, quick: .2, qbRun: 0, misd: .55 }, blurb: 'H-backs and pulling linemen. A great line makes any back look good.' },
  { id: 'runshoot', name: 'Run and Shoot', fam: 'pass', pers: { RB: 1, WR: 4, TE: 0 }, from: 1989, to: 1997, origin: 'oti', w: { WR: 1.35, QB: 1.15, TE: 0.4, RB: 0.9, OL: 0.9 }, a: { run: .1, deep: .65, quick: .55, qbRun: 0, misd: .4 }, ps: 0.06, sackMul: 1.25, intMul: 1.15, var: 0.1, blurb: 'Four receivers who read the coverage on the fly. Huge numbers, more sacks and picks.' },
  { id: 'kgun', name: 'K-Gun No-Huddle', fam: 'pass', pers: { RB: 1, WR: 3, TE: 1 }, from: 1989, to: 1999, origin: 'buf', w: { QB: 1.15, WR: 1.1, RB: 1.0, TE: 0.9 }, a: { run: .35, deep: .4, quick: .6, qbRun: 0, misd: .3 }, blurb: 'No huddle, all game. Tired defenses cannot substitute.' },
  { id: 'zone', name: 'Zone Run & Bootleg', fam: 'run', pers: { RB: 2, WR: 2, TE: 1 }, from: 1995, to: 2026, origin: 'den', w: { OL: 1.2, RB: 1.1, QB: 0.95, WR: 0.9 }, a: { run: .7, deep: .3, quick: .15, qbRun: 0, misd: .75 }, blurb: 'One cut and go behind a moving line, then play-action bootlegs off it.' },
  { id: 'erhardt', name: 'Erhardt-Perkins', fam: 'bal', pers: { RB: 1, WR: 2, TE: 2 }, from: 2001, to: 2026, origin: 'nwe', w: { QB: 1.15, TE: 1.1, WR: 0.95 }, a: { run: .45, deep: .3, quick: .6, qbRun: 0, misd: .35 }, sackMul: 0.9, intMul: 0.85, blurb: 'Concepts instead of plays. A smart QB changes the plan every week.' },
  { id: 'spread', name: 'Shotgun Spread', fam: 'pass', pers: { RB: 1, WR: 3, TE: 1 }, from: 2004, to: 2026, origin: 'clt', w: { QB: 1.25, WR: 1.2, TE: 0.9, RB: 0.8, OL: 0.95 }, a: { run: .2, deep: .55, quick: .6, qbRun: 0, misd: .25 }, ps: 0.04, blurb: 'Three or four wide every snap. The quarterback runs the show at the line.' },
  { id: 'readopt', name: 'Read Option / Pistol', fam: 'run', pers: { RB: 1, WR: 3, TE: 1 }, from: 2012, to: 2026, origin: 'was', w: { QB: 1.2, RB: 1.0, WR: 0.85, TE: 0.9 }, a: { run: .55, deep: .25, quick: .2, qbRun: .9, misd: .5 }, qbRush: 0.3, blurb: 'The quarterback reads an end and keeps it or hands off. Hard on edge rushers.' },
  { id: 'rpo', name: 'RPO Spread', fam: 'bal', pers: { RB: 1, WR: 3, TE: 1 }, from: 2016, to: 2026, origin: 'phi', w: { QB: 1.15, WR: 1.05, OL: 0.95 }, a: { run: .4, deep: .3, quick: .6, qbRun: .4, misd: .5 }, qbRush: 0.2, blurb: 'Run or pass decided after the snap by one defender. Punishes aggressive linebackers.' },
  { id: 'empty', name: 'Empty Five-Wide', maxShare: 0.12, fam: 'pass', pers: { RB: 0, WR: 5, TE: 0 }, from: 2019, to: 2026, origin: 'kan', w: { QB: 1.3, WR: 1.25, OL: 1.05, RB: 0.6, TE: 0.7 }, a: { run: .05, deep: .5, quick: .85, qbRun: .1, misd: .2 }, ps: 0.1, sackMul: 0.85, intMul: 1.05, var: 0.05, blurb: 'Nobody in the backfield and five receivers spread wide. The quarterback reads the whole field before the snap.' },
  { id: 'widezone', name: 'Wide Zone Play-Action', fam: 'bal', pers: { RB: 1, WR: 3, TE: 1 }, from: 2017, to: 2026, origin: 'ram', w: { OL: 1.1, RB: 1.05, WR: 1.05, TE: 1.1, QB: 0.95 }, a: { run: .55, deep: .4, quick: .3, qbRun: 0, misd: .9 }, blurb: 'Everything looks like the same outside zone until the ball is thrown over the top.' }
];
const DEF_SCHEMES = [
  { id: 'base43', name: '4-3 Base', fam: 'bal', pers: { DL: 4, LB: 3, DB: 4 }, from: 1970, to: 2026, base: 1, w: {}, a: { rush: .5, cover: .5, box: .5, disg: .1 }, blurb: 'Four linemen, three linebackers, two corners and two safeties. No weakness, no trick.' },
  { id: 'umbrella', name: 'Umbrella Zone', fam: 'soft', pers: { DL: 4, LB: 3, DB: 4 }, from: 1970, to: 1985, base: 1, w: { DB: 1.15, LB: 1.05, DL: 0.85 }, a: { rush: .25, cover: .8, box: .4, disg: .2 }, var: -0.05, blurb: 'Deep zones keep everything in front. Gives up yards, not touchdowns.' },
  { id: 'reddog', name: 'Red Dog Blitz', fam: 'blitz', pers: { DL: 4, LB: 3, DB: 4 }, from: 1970, to: 1990, base: 1, w: { LB: 1.2, DL: 1.05, DB: 0.85 }, a: { rush: .9, cover: .25, box: .6, disg: .1 }, sackMul: 1.2, var: 0.1, blurb: 'Send the linebackers. Sacks or big plays, nothing in between.' },
  { id: 'flex', name: 'Flex Defense', fam: 'bal', pers: { DL: 4, LB: 3, DB: 4 }, from: 1970, to: 1988, origin: 'dal', w: { DL: 1.15, LB: 1.05, DB: 0.85 }, a: { rush: .3, cover: .5, box: .85, disg: .25 }, blurb: 'Two linemen play off the ball to read the run. Built to stop the sweep.' },
  { id: 'nonname', name: '53 Defense', fam: 'soft', pers: { DL: 3, LB: 4, DB: 4 }, from: 1972, to: 1982, origin: 'mia', w: { LB: 1.2, DB: 1.1, DL: 0.75 }, a: { rush: .2, cover: .7, box: .5, disg: .55 }, intMul: 1.15, blurb: 'A linebacker in a lineman\'s spot. Disciplined zone and few mistakes.' },
  { id: 'curtain', name: 'Cover 2 Front Four', fam: 'bal', pers: { DL: 4, LB: 3, DB: 4 }, from: 1972, to: 1990, origin: 'pit', w: { DL: 1.25, DB: 1.05, LB: 0.8 }, a: { rush: .75, cover: .65, box: .4, disg: .1 }, sackMul: 1.15, blurb: 'Four dominant linemen get home without blitzing, and two safeties split the field.' },
  { id: 'd34', name: '3-4', fam: 'bal', pers: { DL: 3, LB: 4, DB: 4 }, from: 1974, to: 2026, origin: 'nwe', w: { LB: 1.25, DL: 0.85, DB: 0.95 }, a: { rush: .55, cover: .5, box: .55, disg: .35 }, blurb: 'Four linebackers and a nose tackle. The pressure can come from anywhere.' },
  { id: 'd46', name: '46 Defense', fam: 'blitz', pers: { DL: 4, LB: 4, DB: 3 }, from: 1984, to: 1995, origin: 'chi', w: { DL: 1.2, LB: 1.1, DB: 0.8 }, a: { rush: 1.0, cover: .2, box: .9, disg: .1 }, sackMul: 1.35, var: 0.15, blurb: 'Eight in the box and pressure every snap. Overwhelms protection, but corners are on an island.' },
  { id: 'zblitz', name: 'Zone Blitz', fam: 'blitz', pers: { DL: 3, LB: 4, DB: 4 }, from: 1992, to: 2026, origin: 'pit', w: { LB: 1.2, DB: 1.0, DL: 0.9 }, a: { rush: .8, cover: .45, box: .4, disg: .9 }, sackMul: 1.2, intMul: 1.1, blurb: 'Rush five, drop a lineman into coverage. Quarterbacks throw it to the wrong color.' },
  { id: 'tampa2', name: 'Tampa 2', fam: 'soft', pers: { DL: 4, LB: 3, DB: 4 }, from: 1996, to: 2014, origin: 'tam', w: { DL: 1.15, LB: 1.15, DB: 0.9 }, a: { rush: .5, cover: .8, box: .35, disg: .2 }, intMul: 1.2, var: -0.05, blurb: 'A fast middle linebacker runs the deep middle. Speed over size everywhere.' },
  { id: 'pressure34', name: 'Exotic Pressure 3-4', fam: 'blitz', pers: { DL: 3, LB: 4, DB: 4 }, from: 2000, to: 2026, origin: 'rav', w: { LB: 1.2, DB: 0.95, DL: 0.95 }, a: { rush: .85, cover: .35, box: .5, disg: .7 }, sackMul: 1.3, var: 0.15, blurb: 'Overload blitzes and simulated pressure from a deep linebacker group.' },
  { id: 'nickel', name: 'Nickel Base', fam: 'bal', pers: { DL: 4, LB: 2, DB: 5 }, from: 2008, to: 2026, w: { DB: 1.25, LB: 0.8 }, a: { rush: .5, cover: .7, box: .3, disg: .3 }, blurb: 'Five defensive backs as the base defense against three-receiver offenses.' },
  { id: 'wide9', name: 'Wide-9 Front', fam: 'blitz', pers: { DL: 4, LB: 3, DB: 4 }, from: 2011, to: 2018, origin: 'phi', w: { DL: 1.35, LB: 0.85, DB: 0.85 }, a: { rush: 1.0, cover: .45, box: .2, disg: .1 }, sackMul: 1.25, blurb: 'Ends lined up way outside, pinning their ears back. Runs inside can gash it.' },
  { id: 'cover3', name: 'Cover 3 Single-High', fam: 'bal', pers: { DL: 4, LB: 3, DB: 4 }, from: 2012, to: 2026, origin: 'sea', w: { DB: 1.25, DL: 0.9 }, a: { rush: .5, cover: .65, box: .65, disg: .15 }, intMul: 1.1, blurb: 'Big press corners and a rangy free safety let a strong safety live in the box.' },
  { id: 'dime', name: 'Dime Coverage', fam: 'soft', pers: { DL: 4, LB: 1, DB: 6 }, from: 2015, to: 2026, w: { DB: 1.35, LB: 0.8, DL: 0.95 }, a: { rush: .45, cover: .9, box: .15, disg: .45 }, intMul: 1.1, blurb: 'Six defensive backs on the field against three- and four-receiver offenses. Fast, but light against the run.' },
  { id: 'twohigh', name: 'Two-High Quarters', fam: 'soft', pers: { DL: 2, LB: 4, DB: 5 }, from: 2018, to: 2026, origin: 'chi', w: { DB: 1.25, LB: 1.05, DL: 0.8 }, a: { rush: .4, cover: .95, box: .25, disg: .6 }, sackMul: 0.9, blurb: 'Two deep safeties take away the big play and dare you to dink and dunk.' }
];
const SCHEME = {}; OFF_SCHEMES.forEach(s => SCHEME[s.id] = Object.assign({ side: 'off' }, s)); DEF_SCHEMES.forEach(s => SCHEME[s.id] = Object.assign({ side: 'def' }, s));
function schemeTo(s, y) { return s.to >= 2026 ? 9999 : s.to; } // the current schemes never expire
function schemesFor(y, side) { return (side === 'def' ? DEF_SCHEMES : OFF_SCHEMES).filter(s => y >= s.from && y <= schemeTo(s, y)); }
function schemeAvail(id, y) { const s = SCHEME[id]; return !!s && y >= s.from && y <= schemeTo(s, y); }
function rawEdge(o, d) {
  const A = o.a, B = d.a;
  return A.quick * B.rush * 1.6 - A.deep * B.rush * 1.0
    - A.deep * B.cover * 1.6 + A.run * B.cover * 1.1
    - A.run * B.box * 1.6 + A.deep * B.box * 1.0 + A.quick * B.box * 0.5
    + A.misd * (B.rush + B.box) * 0.8 - A.misd * B.disg * 0.4
    - B.disg * (A.quick + A.deep) * 0.6
    + A.qbRun * B.rush * 1.0 - A.qbRun * B.cover * 0.3;
}
// Pure rock-paper-scissors: double-centered over the schemes that exist this season,
// so no scheme is better on average. Personnel, novelty and the family matchups decide the rest.
const EDGE_CACHE = {};
function edgeTable(y) {
  if (EDGE_CACHE[y]) return EDGE_CACHE[y];
  const O = schemesFor(y, 'off'), D = schemesFor(y, 'def'), T = {};
  const raw = O.map(o => D.map(d => rawEdge(o, d)));
  const rm = raw.map(r => r.reduce((a, b) => a + b, 0) / r.length);
  const cm = D.map((_, j) => raw.reduce((a, r) => a + r[j], 0) / raw.length);
  const gm = rm.reduce((a, b) => a + b, 0) / rm.length;
  O.forEach((o, i) => { T[o.id] = {}; D.forEach((d, j) => T[o.id][d.id] = raw[i][j] - rm[i] - cm[j] + gm); });
  return (EDGE_CACHE[y] = T);
}
function schemeEdge(y, os, ds) { const T = edgeTable(y); return (T[os] && T[os][ds]) || 0; }
// League adjustment: a new scheme gets up to +1 point while defenses learn it; one that
// a third of the league runs gets scouted to death; one in its last years is past its prime.
const SHARE = new WeakMap();
function shares(L) {
  let c = SHARE.get(L);
  if (c && c.y === L.year && c.n === L.teams.length) return c.s;
  const s = {}; L.teams.forEach(t => { if (!t.coach) return; [t.coach.os, t.coach.ds].forEach(id => { if (id) s[id] = (s[id] || 0) + 1 / L.teams.length; }); });
  SHARE.set(L, { y: L.year, n: L.teams.length, s }); return s;
}
function resetShares(L) { SHARE.delete(L); OFFSET.delete(L); }
// Keeps league scoring on the real historical averages: whatever the schemes add across the
// whole league this season is taken back out, so they only shift who wins, not how much is scored.
const OFFSET = new WeakMap();
function schemeOffset(L) {
  const c = OFFSET.get(L); if (c && c.y === L.year) return c.v;
  const T = L.teams.filter(t => t.coach && t.coach.os && t.coach.ds);
  if (!T.length) return 0;
  let fit = 0, ed = 0;
  for (const t of T) {
    const r = ratings(L, t.id, t.coach);
    // also takes out any league-wide gap between offensive and defensive ratings
    fit += (r.off - r.def) * 0.6 + schemeTrend(L, t.coach.os) - schemeTrend(L, t.coach.ds) + chemistry(L, t.id, 'off') - chemistry(L, t.id, 'def');
    for (const u of T) if (u !== t) ed += schemeEdge(L.year, t.coach.os, u.coach.ds);
  }
  const v = fit / T.length + ed / (T.length * (T.length - 1));
  OFFSET.set(L, { y: L.year, v }); return v;
}
function schemeShare(L, id) { return shares(L)[id] || 0; }
function schemeTrend(L, id) {
  const s = SCHEME[id]; if (!s) return 0;
  const y = L.year; let v = 0;
  if (!s.base) v += Math.max(0, 1 - (y - s.from) / 6);
  const sh = schemeShare(L, id);
  if (sh > 0.3) v -= (sh - 0.3) * 4;
  if (s.to < 2026 && s.to - y < 3) v -= 0.5;
  return v;
}
function trendWord(L, id) {
  const s = SCHEME[id], y = L.year, sh = schemeShare(L, id);
  if (!s.base && y - s.from < 6) return { t: 'New: defenses are still figuring it out', c: 'good' };
  if (sh > 0.3) return { t: 'Everyone runs it: opponents are ready for it', c: 'bad' };
  if (s.to < 2026 && s.to - y < 3) return { t: 'Fading: the league has caught up', c: 'warn' };
  return null;
}
function famOf(id, side) { const s = SCHEME[id]; return s ? s.fam : (side === 'def' ? 'bal' : 'bal'); }
// How well a roster fits a scheme: the scheme's weighted unit rating minus a neutral one.
function schemeFit(r, s) {
  // rate the roster in this scheme's formation (needs depth: four receivers need four good receivers)
  const F = Object.assign({}, STARTERS, s.pers || {}), U = r.d ? unitAvgs(r.d, F) : r, B = r.d ? unitAvgs(r.d, STARTERS) : r, P = persW(F);
  if (s.side === 'off') {
    const pw = PW[s.fam], rw = 2 - pw, w = s.w;
    const parts = [['QB', 0.30 * pw, 1], ['WR', 0.18 * pw, P.WR], ['TE', 0.08, P.TE], ['RB', 0.16 * rw, P.RB], ['OL', 0.28, 1]];
    let a = 0, b = 0, n = 0, m = 0;
    parts.forEach(([g, x, k]) => { a += U[g] * x * k * (w[g] || 1); b += x * k * (w[g] || 1); n += B[g] * x; m += x; });
    return a / b - n / m;
  }
  const parts = [['DL', 0.32, P.DL], ['LB', 0.28, P.LB], ['DB', 0.40, P.DB]], w = s.w;
  let a = 0, b = 0, n = 0, m = 0;
  parts.forEach(([g, x, k]) => { a += U[g] * x * k * (w[g] || 1); b += x * k * (w[g] || 1); n += B[g] * x; m += x; });
  return a / b - n / m;
}
function schemeCap(L, s) { return s.base ? 1 : Math.min(s.maxShare || 0.4, 0.1 + 0.08 * (L.year - s.from)); }
function bestScheme(L, tid, side, r, pref) {
  const opts = schemesFor(L.year, side);
  let best = null, bv = -1e9;
  const cur = L.teams[tid] && L.teams[tid].coach && (side === 'def' ? L.teams[tid].coach.ds : L.teams[tid].coach.os);
  for (const s of opts) {
    // Ideas spread a few teams at a time: a brand-new scheme starts with the innovator and a couple of copycats.
    if (s.id !== cur && schemeShare(L, s.id) >= schemeCap(L, s)) continue;
    const v = schemeFit(r, s) * 1.2 + schemeTrend(L, s.id) + (pref && pref === s.fam ? 0.6 : 0) + R.norm() * 0.4;
    if (v > bv) { bv = v; best = s; }
  }
  return best;
}
function schemeNews(L) {
  const y = L.year;
  for (const s of OFF_SCHEMES.concat(DEF_SCHEMES)) {
    if (s.from === y && !s.base) {
      const t = s.origin && L.teams.find(x => x.pfr === s.origin);
      addNews(L, `New ${SCHEME[s.id].side === 'off' ? 'offense' : 'defense'} for ${y}: the ${s.name}${t ? `, first run by ${tname0(t)}` : ''}. ${s.blurb}`);
    }
    if (s.to === y - 1) addNews(L, `The ${s.name} has gone out of style. Teams that ran it have moved on.`);
  }
}
function tname0(t) { return t.city + ' ' + t.name; }
// Give every team a scheme, move teams off schemes that have died out, and let the
// teams that invented a scheme adopt it the year it appears.
function ensureSchemes(L) {
  const y = L.year;
  for (const t of L.teams) {
    const c = t.coach; if (!c) continue;
    const r = ratings(L, t.id, { off: 'bal', def: 'bal' });
    if (!schemeAvail(c.os, y)) {
      const old = c.os, b = bestScheme(L, t.id, 'off', r, c.off);
      c.os = (schemesFor(y, 'off').filter(s => s.fam === c.off).sort((a, b2) => schemeFit(r, b2) - schemeFit(r, a))[0] || b).id;
      if (t.id !== L.user || !old) c.off = SCHEME[c.os].fam;
      if (old && t.id === L.user) addNews(L, `Nobody runs the ${SCHEME[old].name} anymore. Your offense switches to the ${SCHEME[c.os].name}. You can change it on the Coach tab.`);
    }
    if (!schemeAvail(c.ds, y)) {
      const old = c.ds, b = bestScheme(L, t.id, 'def', r, c.def);
      c.ds = (schemesFor(y, 'def').filter(s => s.fam === c.def).sort((a, b2) => schemeFit(r, b2) - schemeFit(r, a))[0] || b).id;
      if (t.id !== L.user || !old) c.def = SCHEME[c.ds].fam;
      if (old && t.id === L.user) addNews(L, `Nobody runs the ${SCHEME[old].name} anymore. Your defense switches to the ${SCHEME[c.ds].name}. You can change it on the Coach tab.`);
    }
  }
  resetShares(L);
}
function setScheme(L, id) {
  const s = SCHEME[id]; if (!s || !schemeAvail(id, L.year)) return 'That scheme is not available in ' + L.year + '.';
  const c = L.teams[L.user].coach;
  if (s.side === 'off') { c.os = id; c.off = s.fam; } else { c.ds = id; c.def = s.fam; }
  resetShares(L);
  return null;
}

// Points added to the offense for each defense vs offense pairing.
// Blitz beats the pass but gets run on; bend-don't-break slows the pass but gives up the run.
const DEF_VS = { blitz: { pass: -2.5, bal: -0.8, run: 1.2 }, soft: { pass: -1.2, bal: 0.4, run: 1.6 }, bal: { pass: 0, bal: 0, run: 0 } };
function expected(L, oRat, dRat, oCoach, dCoach, isHome, neutral) {
  let e = era(L.year).pts + (oRat.off - dRat.def) * 0.6 + (neutral ? 0 : (isHome ? 0.7 : -0.7)) + (oRat.K - 60) * 0.04;
  let m = (DEF_VS[dCoach.def] || DEF_VS.bal)[oCoach.off] || 0;
  // A scheme only works as well as the players running it: blitzing needs a strong front four,
  // bend-don't-break needs good cover men. Weak units get less of the benefit (penalties stay full).
  if (m < 0 && dCoach.def === 'blitz') m *= clamp(1 + (dRat.DL - 62) / 20, 0.4, 1.6);
  if (m < 0 && dCoach.def === 'soft') m *= clamp(1 + (dRat.DB - 62) / 20, 0.4, 1.6);
  e += m;
  // Era schemes: the matchup between the two systems, plus how well the league has adjusted to each.
  if (oCoach.os && dCoach.ds) e += schemeEdge(L.year, oCoach.os, dCoach.ds) + schemeTrend(L, oCoach.os) - schemeTrend(L, dCoach.ds) - schemeOffset(L);
  // chemistry: a new scheme being installed, starters who have played together
  if (oRat.tid != null && dRat.tid != null) e += chemistry(L, oRat.tid, 'off') - chemistry(L, dRat.tid, 'def');
  return clamp(e, 5, 42);
}

function variance(oCoach, dCoach) {
  const so = SCHEME[oCoach.os], sd = SCHEME[dCoach.ds];
  return 1 + (oCoach.aggr - 50) / 200 + (dCoach.def === 'blitz' ? 0.15 : 0) - (dCoach.def === 'soft' ? 0.1 : 0) + ((so && so.var) || 0) + ((sd && sd.var) || 0);
}

let GAMEBUF = null, NOHIST = false, WXP = 1;
function stat(p, y, k, v) {
  if (!p) return;
  if (GAMEBUF) { const b = GAMEBUF[p.id] || (GAMEBUF[p.id] = { tm: p.team }); b[k] = (b[k] || 0) + v; }
  if (NOHIST) return;
  const h = p.hist[y] || (p.hist[y] = { g: 0 }); h[k] = (h[k] || 0) + v; if (p.team >= 0) h.tm = p.team;
}
function tstat(L, tid) {
  L.tstats = L.tstats || {}; const Y = L.tstats[L.year] || (L.tstats[L.year] = {});
  return Y[tid] || (Y[tid] = { g: 0, yds: 0, py: 0, ry: 0, td: 0, fg: 0, giv: 0, ydsA: 0, sk: 0, take: 0 });
}

function share(list, weights) {
  const pool = list.map((p, i) => [p, weights[i]]).filter(x => x[0]);
  const tot = pool.reduce((s, x) => s + x[1], 0) || 1;
  return pool.map(x => [x[0], x[1] / tot]);
}
function pickWeighted(sh) { let r = Math.random(); for (const [p, w] of sh) { r -= w; if (r <= 0) return p; } return sh.length ? sh[sh.length - 1][0] : null; }

function creditStats(L, tid, sc, rat, oppRat, coach, oppCoach) {
  const y = L.year, d = rat.d, pw = PW[coach.off] || 1, E = era(y);
  const so = SCHEME[coach.os] || {}, sd = SCHEME[(oppCoach || {}).ds] || {};
  const starters = [], F = rat.F || STARTERS;
  GRPS.forEach(g => d[g].slice(0, F[g]).forEach(p => starters.push(p)));
  starters.forEach(p => stat(p, y, 'g', 1));
  // Yardage and the pass/run mix follow the real league averages for this season.
  const avgTD = E.pts * 0.7 / 7;
  const total = clamp(Math.round(E.tot + (rat.off - oppRat.def) * 4 + (sc.td - avgTD) * 18 + R.norm() * 55), 80, 650);
  const pshare = clamp((E.pshare * (1 + (pw - 1) * 0.7) + (so.ps || 0) + R.norm() * 0.06) * WXP, 0.2, 0.88);
  const py = Math.round(total * pshare), ry = total - py;
  const tdPass = clamp(E.tdPass * pshare / E.pshare, 0.1, 0.92);
  let ptd = 0; for (let i = 0; i < sc.td; i++) if (Math.random() < tdPass) ptd++;
  const rtd = sc.td - ptd;
  const qb = d.QB[0]; let ints = 0;
  if (qb) {
    const att = Math.max(8, Math.round(py / E.ypa + R.int(-3, 4)));
    const cmp = Math.round(att * clamp(E.cmpPct + (qb.ovr - 60) * 0.004 + attrDelta(qb, 'acc') * 0.003 + R.norm() * 0.05, 0.3, 0.8));
    stat(qb, y, 'att', att); stat(qb, y, 'cmp', cmp); stat(qb, y, 'py', py); stat(qb, y, 'ptd', ptd);
    ints = R.poisson(clamp(E.int * (1 - (qb.ovr - 60) * 0.017) * (1 - attrDelta(qb, 'pkt') * 0.012) * (so.intMul || 1) * (sd.intMul || 1), 0.2, 2.6));
    stat(qb, y, 'int', ints);
  }
  // targets follow who is on the field
  const recP = [], recW = [];
  // route runners and sure hands draw more targets; deep threats gain more per catch
  const tgtMul = q => clamp(1 + (attrDelta(q, 'rte') + attrDelta(q, 'hnd')) * 0.012, 0.8, 1.25);
  const addT = (arr, n, ws) => { for (let i = 0; i < n && i < ws.length; i++) if (arr[i]) { recP.push(arr[i]); recW.push(ws[i] * tgtMul(arr[i])); } };
  addT(d.WR, Math.max(F.WR, 2), [0.3, 0.22, 0.15, 0.1, 0.07].map((x, i) => i < F.WR ? x : x * 0.3));
  addT(d.TE, Math.max(F.TE, 1), [0.17, 0.08].map((x, i) => i < F.TE ? x : x * 0.3));
  addT(d.RB, Math.max(F.RB, 1), [0.13, 0.05].map((x, i) => i < F.RB ? x : x * 0.4));
  const rec = share(recP, recW);
  for (const [p, w] of rec) {
    const yds = Math.round(py * w * (0.75 + Math.random() * 0.5)), ypc = E.ypc * clamp(1 + (attrDelta(p, 'spd') + attrDelta(p, 'phy') * 0.5) * 0.012, 0.8, 1.2);
    stat(p, y, 'recy', yds); stat(p, y, 'rec', Math.max(0, Math.round(yds / ypc + R.norm())));
  }
  for (let i = 0; i < ptd; i++) stat(pickWeighted(rec), y, 'rectd', 1);
  const qr = so.qbRush || 0.12, rush = share([d.RB[0], d.RB[1], qb], [0.56 * (0.88 - qr) / 0.76 + 0, 0.32 * (0.88 - qr) / 0.76, qr]);
  for (const [p, w] of rush) { const yds = Math.round(ry * w * (0.8 + Math.random() * 0.4)), ypr = E.ypr * clamp(1 + (attrDelta(p, 'elu') + attrDelta(p, 'spd') * 0.5) * 0.012, 0.8, 1.2); stat(p, y, 'ry', yds); stat(p, y, 'ra', Math.max(1, Math.round(yds / ypr))); }
  for (let i = 0; i < rtd; i++) stat(pickWeighted(rush), y, 'rtd', 1);
  stat(d.K[0], y, 'fgm', sc.fg);
  if (!NOHIST) { const T = tstat(L, tid); T.g++; T.yds += total; T.py += py; T.ry += ry; T.td += sc.td; T.fg += sc.fg; T.giv += ints; }
  return { total, py, ry, ints };
}

function creditDefense(L, tid, rat, oppRat, ints, coach, oppCoach) {
  const y = L.year, d = rat.d;
  const sm = ((SCHEME[(coach || {}).ds] || {}).sackMul || 1) * ((SCHEME[(oppCoach || {}).os] || {}).sackMul || 1);
  const sacks = R.poisson(clamp((2.2 + (rat.DL - oppRat.OL) * 0.06) * sm, 0.6, 6));
  const Fd = rat.F || STARTERS, rP = [], rW = [];
  const rushMul = q => clamp(1 + attrDelta(q, 'prs') * 0.04, 0.6, 1.6), ballMul = q => clamp(1 + (attrDelta(q, 'bsk') + attrDelta(q, 'cov') * 0.5) * 0.04, 0.6, 1.6);
  for (let i = 0; i < Fd.DL; i++) if (d.DL[i]) { rP.push(d.DL[i]); rW.push((i < 2 ? 0.25 : 0.15) * rushMul(d.DL[i])); }
  for (let i = 0; i < Math.min(Fd.LB, 4); i++) if (d.LB[i]) { rP.push(d.LB[i]); rW.push((Fd.DL <= 3 && i < 2 ? 0.2 : 0.1) * rushMul(d.LB[i])); }
  const rushers = share(rP, rW);
  for (let i = 0; i < sacks; i++) stat(pickWeighted(rushers), y, 'sk', 1);
  const cP = [], cW = [];
  for (let i = 0; i < Fd.DB; i++) if (d.DB[i]) { cP.push(d.DB[i]); cW.push((i < 2 ? 0.24 : i < 4 ? 0.2 : 0.12) * ballMul(d.DB[i])); }
  if (d.LB[0]) { cP.push(d.LB[0]); cW.push(0.12 * ballMul(d.LB[0])); }
  const cover = share(cP, cW);
  for (let i = 0; i < ints; i++) stat(pickWeighted(cover), y, 'dint', 1);
  if (!NOHIST) { const T = tstat(L, tid); T.sk += sacks; T.take += ints; }
  return sacks;
}

// Weeks missed per season, used by retirement.
// What the injury is, by how long it keeps him out
const INJ_TYPES = {
  1: ['Ankle sprain', 'Hamstring strain', 'Concussion', 'Knee bruise', 'Shoulder sprain', 'Hip pointer', 'Back spasms', 'Groin strain', 'Quad strain', 'Bruised ribs', 'Neck stinger', 'Thigh bruise'],
  2: ['High ankle sprain', 'Concussion', 'Hamstring strain', 'MCL sprain', 'Turf toe', 'Calf strain', 'Shoulder separation', 'Sprained wrist', 'Rib fracture', 'Groin strain'],
  4: ['MCL sprain', 'Broken hand', 'Fractured wrist', 'High ankle sprain', 'Torn meniscus', 'Broken thumb', 'Shoulder separation', 'Fractured ribs', 'Sports hernia', 'Pectoral strain'],
  9: ['Torn ACL', 'Torn Achilles', 'Broken leg', 'Torn pectoral', 'Lisfranc injury', 'Torn labrum', 'Broken collarbone', 'Fractured ankle', 'Torn ACL', 'Neck injury', 'Torn biceps', 'Dislocated hip']
};
function injName(p, wks) {
  const k = wks >= 9 ? 9 : wks >= 4 ? 4 : wks >= 2 ? 2 : 1;
  let list = INJ_TYPES[k];
  if (p.grp === 'QB') list = list.concat(k === 9 ? ['Torn ACL'] : k >= 2 ? ['Throwing shoulder', 'Broken finger'] : ['Bruised throwing hand']);
  if ((p.grp === 'OL' || p.grp === 'DL') && k >= 4) list = list.concat(['Torn triceps', 'Knee sprain']);
  p.injT = R.pick(list);
  return p.injT;
}
function injText(p) {
  if (!p || !p.inj) return '';
  return `${p.injT || 'Injury'}, out ${p.inj >= 20 ? 'for the season' : p.inj + ' week' + (p.inj > 1 ? 's' : '')}`;
}
function noteInjury(L, p, wks) { p.injY = p.injY || {}; p.injY[L.year] = (p.injY[L.year] || 0) + wks; }
function recentInjuryWeeks(p, y) { let s = 0; for (let k = y - 2; k <= y; k++) s += (p.injY && p.injY[k]) || 0; return s; }
function injuries(L, rat) {
  const F = rat.F || STARTERS;
  GRPS.forEach(g => rat.d[g].slice(0, F[g]).forEach(p => {
    if (p.inj && p.playHurt && Math.random() < 0.3) {
      const extra = R.int(1, 2); p.inj += extra; noteInjury(L, p, extra);
      if (p.team === L.user) addNews(L, `${p.pos} ${p.name} aggravated his ${(p.injT || 'injury').toLowerCase()} playing hurt. Now out ${p.inj} weeks.`);
    }
  }));
  if (L.career) { const c = L.players[L.career.pid]; if (c && !c.inj && careerDurMult(L, c) > 1 && GRPS.some(g => rat.d[g].slice(0, F[g]).includes(c)) && Math.random() < 0.38 / 22 * (careerDurMult(L, c) - 1) * 3) { c.inj = 1 + R.poisson(1.4); injName(c, c.inj); noteInjury(L, c, c.inj); } }
  if (Math.random() < 0.38 * medMul(L, rat.tid)) {
    const pool = []; ['QB','RB','WR','TE','OL','DL','LB','DB'].forEach(g => rat.d[g].slice(0, F[g]).forEach(p => pool.push(p)));
    let p = R.pick(pool); if (!p) return;
    if (isCareer(L, p) && Math.random() > careerDurMult(L, p)) return;
    p.inj = Math.random() < 0.04 ? 20 : Math.max(1, Math.round((1 + R.poisson(1.4)) * medMul(L, rat.tid))); injName(p, p.inj);
    noteInjury(L, p, Math.min(p.inj, rules(L.year).games));
    if (p.team === L.user || p.ovr >= 80 || isCareer(L, p)) addNews(L, `${L.teams[p.team].abbr} ${p.pos} ${p.name}: ${injText(p).replace(', out', '. Out')}.`);
  }
}

function planKey(L) { return L.year + (L.phase === 'playoffs' ? '-p' + L.playoffs.rounds.length : '-w' + L.week); }
function gamePlan(L) { return L.plan && L.plan.key === planKey(L) ? L.plan.c : null; }
function setGamePlan(L, key, val) {
  if (!L.plan || L.plan.key !== planKey(L)) L.plan = { key: planKey(L), c: {} };
  if (val == null) delete L.plan.c[key]; else L.plan.c[key] = val;
}
function clearGamePlan(L) { L.plan = null; }
function coachFor(L, tid) {
  const c = L.teams[tid].coach;
  if (tid !== L.user) return c;
  const p = gamePlan(L); return p ? Object.assign({}, c, p) : c;
}
function playGame(L, g, opts) {
  opts = opts || {};
  let Hc = coachFor(L, g.h), Ac = coachFor(L, g.a);
  const D = diff(L);
  if (D.counter && g.h === L.user) Ac = counterPlan(Ac, Hc, L);
  if (D.counter && g.a === L.user) Hc = counterPlan(Hc, Ac, L);
  const hr = ratings(L, g.h, Hc), ar = ratings(L, g.a, Ac);
  const edge = side => (side === L.user ? D.edge : 0) + staffBonus(L, side).gd;
  const wx = forecast(L, g, null, opts), wH = wxEffect(L, wx, g.h), wA = wxEffect(L, wx, g.a);
  const hs = genScore(expected(L, hr, ar, Hc, Ac, true, opts.neutral) + edge(g.h) + wH.pts, variance(Hc, Ac));
  const as = genScore(expected(L, ar, hr, Ac, Hc, false, opts.neutral) + edge(g.a) + wA.pts, variance(Ac, Hc));
  const H = L.teams[g.h], A = L.teams[g.a];
  let hp = hs.pts, ap = as.pts, ot = false;
  if (hp === ap) {
    if (opts.playoff || (rules(L.year).regOT && Math.random() > 0.08)) {
      ot = true; const ph = 0.5 + ((hr.off + hr.def) - (ar.off + ar.def)) * 0.01;
      if (Math.random() < clamp(ph, 0.2, 0.8)) hp += 3; else ap += 3;
    }
  }
  g.hs = hp; g.as = ap; g.done = true; g.ot = ot;
  // Player and team stats. Playoff games fill the box score but not season totals.
  GAMEBUF = {}; NOHIST = !!opts.noStats;
  WXP = wH.pass; const hS = creditStats(L, g.h, hs, hr, ar, Hc, Ac); WXP = wA.pass; const aS = creditStats(L, g.a, as, ar, hr, Ac, Hc); WXP = 1;
  const hSk = creditDefense(L, g.h, hr, ar, aS.ints, Hc, Ac), aSk = creditDefense(L, g.a, ar, hr, hS.ints, Ac, Hc);
  if (!NOHIST) { tstat(L, g.h).ydsA += aS.total; tstat(L, g.a).ydsA += hS.total; }
  g.box = makeBox(L, g, hs, as, hp, ap, hS, aS, hSk, aSk, GAMEBUF);
  GAMEBUF = null; NOHIST = false;
  if (!opts.playoff) {
    H.pf += hp; H.pa += ap; A.pf += ap; A.pa += hp;
    if (hp > ap) { H.w++; A.l++; } else if (ap > hp) { A.w++; H.l++; } else { H.t++; A.t++; }
  }
  injuries(L, hr); injuries(L, ar);
  return g;
}

function quarters(sc, total, otPts) {
  const q = [0, 0, 0, 0], w = [0.22, 0.28, 0.2, 0.3];
  const pickQ = () => { let r = Math.random(), i = 0; while (i < 3 && (r -= w[i]) > 0) i++; return i; };
  let left = total - otPts;
  const units = [];
  for (let i = 0; i < sc.td; i++) units.push(7);
  for (let i = 0; i < sc.fg; i++) units.push(3);
  let sum = units.reduce((a, b) => a + b, 0);
  while (sum > left && units.length) { const u = units.pop(); sum -= u; }
  if (left - sum > 0) units.push(left - sum);
  units.forEach(u => q[pickQ()] += u);
  if (otPts) q.push(otPts);
  return q;
}
function makeBox(L, g, hs, as, hp, ap, hS, aS, hSk, aSk, buf) {
  const ot = (hp - hs.pts) || (ap - as.pts) ? 1 : 0;
  const qh = quarters(hs, hp, hp - hs.pts), qa = quarters(as, ap, ap - as.pts);
  if (ot) { while (qh.length < 5) qh.push(0); while (qa.length < 5) qa.push(0); }
  const lines = [];
  for (const id in buf) {
    const b = buf[id], p = L.players[id]; if (!p) continue;
    const keep = b.att || b.ra || b.rec || b.sk || b.dint || b.fgm;
    if (keep) lines.push(Object.assign({ id: +id, n: p.name, pos: p.pos, grp: p.grp }, b));
  }
  return { q: [qh, qa], st: [{ yds: hS.total, py: hS.py, ry: hS.ry, to: hS.ints, sk: hSk }, { yds: aS.total, py: aS.py, ry: aS.ry, to: aS.ints, sk: aSk }], lines };
}
function boxStar(box, tid) {
  let best = null, bs = -1;
  for (const l of box.lines) {
    if (l.tm !== tid) continue;
    const sc = (l.py || 0) * 0.04 + (l.ptd || 0) * 4 - (l.int || 0) * 2 + (l.ry || 0) * 0.1 + (l.rtd || 0) * 6 + (l.recy || 0) * 0.1 + (l.rectd || 0) * 6 + (l.sk || 0) * 4 + (l.dint || 0) * 5;
    if (sc > bs) { bs = sc; best = l; }
  }
  return best;
}
function boxLine(l) {
  const parts = [];
  if (l.att) parts.push(`${l.cmp}/${l.att}, ${l.py} yds, ${l.ptd || 0} TD${l.int ? ', ' + l.int + ' INT' : ''}`);
  if (l.ra) parts.push(`${l.ra} carries, ${l.ry} yds${l.rtd ? ', ' + l.rtd + ' TD' : ''}`);
  if (l.rec) parts.push(`${l.rec} rec, ${l.recy} yds${l.rectd ? ', ' + l.rectd + ' TD' : ''}`);
  if (l.sk) parts.push(`${l.sk} sack${l.sk > 1 ? 's' : ''}`);
  if (l.dint) parts.push(`${l.dint} INT`);
  if (l.fgm) parts.push(`${l.fgm} FG`);
  return parts.join(', ');
}

function slimBox(b) {
  if (!b) return b;
  return Object.assign({}, b, { lines: b.lines.filter(l => l.att || (l.ra || 0) >= 5 || (l.rec || 0) >= 2 || l.rtd || l.rectd || l.sk || l.dint || l.fgm) });
}
// Your team's games are kept by season so you can look back at old box scores.
function archiveBoxes(L) {
  L.myGames = L.myGames || {};
  const out = [];
  (L.schedule || []).forEach((wk, i) => wk.forEach(g => { if (g.done && (g.h === L.user || g.a === L.user)) out.push(Object.assign({ wk: 'Week ' + (i + 1) }, g, { box: slimBox(g.box) })); }));
  if (L.playoffs) L.playoffs.rounds.forEach(r => r.games.forEach(g => { if (g.h === L.user || g.a === L.user) out.push(Object.assign({ wk: r.name }, g, { box: slimBox(g.box) })); }));
  if (out.length) L.myGames[L.year] = out;
}
function healWeek(L) { for (const id in L.players) { const p = L.players[id]; if (p.inj > 0) { p.inj--; if (!p.inj) delete p.injT; } if (!p.inj && p.playHurt) delete p.playHurt; } }

/* ---------- season flow ---------- */
// Every way to get under the cap right now, with what each saves this season.
function capPlan(L) {
  const y = capYear(L), cap = capFor(y); if (cap == null) return null;
  const pay = payroll(L, L.user, y), over = pay - cap, ps = psCounts(L, y) ? psPay(y) : 0;
  const mine = roster(L, L.user).filter(p => onBooks(p, y));
  const d = depth(L, L.user), SF = startersFor(L, L.user), st = new Set(); GRPS.forEach(g => (d[g] || []).slice(0, SF[g]).forEach(p => st.add(p.id)));
  const row = (p, saves, extra) => Object.assign({ id: p.id, name: p.name, pos: p.pos, ovr: p.ovr, age: p.age, sal: salFor(p, y), saves, starter: st.has(p.id) }, extra || {});
  const cut = mine.map(p => { const dead = deadCharge(L, p); return row(p, salFor(p, y) - dead, { dead }); }).filter(r => r.saves > 0)
    .sort((a, b) => b.saves - a.saves).slice(0, 8);
  const june1 = june1Left(L) > 0 ? mine.filter(p => p.con && p.con.base && deadCharge(L, p)).map(p => { const D = deadCharge(L, p, true); return row(p, salFor(p, y) - D.now, { now: D.now, later: D.later }); })
    .filter(r => r.saves > 0).sort((a, b) => b.saves - a.saves).slice(0, 4) : [];
  const rest = mine.map(p => ({ p, R0: restructureInfo(L, p) })).filter(x => x.R0).map(x => row(x.p, x.R0.saves)).sort((a, b) => b.saves - a.saves).slice(0, 4);
  const toPS = psSize(L.year) && practiceSquad(L, L.user).length < psSize(L.year) ? mine.filter(p => psEligible(L, p) && !st.has(p.id)).map(p => row(p, salFor(p, y) - deadCharge(L, p) - psPay(y))).filter(r => r.saves > 0).sort((a, b) => b.saves - a.saves).slice(0, 4) : [];
  const promote = minSalary(y) - ps;
  return { y, cap, pay, over, cut, june1, rest, toPS, promote, minSal: minSalary(y), psPay: psPay(y), psCount: practiceSquad(L, L.user).length, roster: roster(L, L.user).length, max: rules(L.year).rosterMax };
}
function canStartSeason(L) {
  const n = active(L, L.user).length, max = rules(L.year).rosterMax;
  if (n > max) return `Your roster has ${n} players. Cut down to ${max} before kickoff.`;
  const c = capFor(L.year);
  if (c != null && payroll(L, L.user, L.year) > c) return `Your payroll is ${money(payroll(L, L.user, L.year))}, over the ${L.year} cap of ${money(c)}. The "Get under the cap" card on the Office tab lists your options: cuts, restructures, trades and practice-squad moves.`;
  return null;
}

function startRegular(L) {
  const err = canStartSeason(L); if (err) return err;
  aiCutdowns(L); aiSignings(L); aiFillPS(L);
  L.teams.forEach(t => { t.w = t.l = t.t = t.pf = t.pa = 0; });
  makeSchedule(L); L.week = 0; L.phase = 'regular';
  ensureStaff(L); fillInterim(L); setGoal(L);
  L.teams.forEach(t => schemeSince(L, t)); noteContinuity(L); resetShares(L);
  L.offers = [];
  if (Math.random() < 0.5) makeOffers(L, 1, 6);
  return null;
}

/* ---------- strike seasons ---------- */
// 1982: players walk out after week 2; 57 days and 7 games lost; 9-game season, 16-team tournament.
// 1987: walkout after week 2; week 3 canceled; weeks 3-5 played by replacement players, some veterans cross.
function strikeBefore(L) {
  if (L.year === 1987 && L.week === 2 && !L.strike87) {
    L.strike87 = 1;
    for (const t of L.teams) {
      const regs = roster(L, t.id);
      const crossP = 0.05 + Math.random() * 0.15;
      for (const p of regs) if (Math.random() > crossP) p.striking = true;
      for (const g of GRPS) for (let i = 0; i < STARTERS[g] + 1; i++) {
        const r = genPlayer(L, g, t.id, 46, [22, 31]); r.repl = 1987;
      }
    }
    addNews(L, 'STRIKE: NFL players walk out. Week 3 is canceled, and the next three weeks will be played by replacement players. A few veterans on each team cross the picket line.');
  }
}
function strikeAfter(L) {
  if (L.year === 1982 && L.week === 2) addNews(L, 'STRIKE: NFL players walk out after week 2. The strike lasts 57 days and wipes out seven weeks. The season will finish with 9 games, and 16 teams will play a Super Bowl Tournament seeded by conference record.');
  if (L.year === 1982 && L.week === 3) addNews(L, 'The strike is over. Football is back.');
  if (L.year === 1987 && L.week === 5 && L.strike87 === 1) {
    L.strike87 = 2;
    for (const id in L.players) { const p = L.players[id]; if (p.striking) delete p.striking; if (p.repl === 1987 && p.team >= 0) { p.team = -2; p.retiredYear = 1988; delete p.con; } }
    addNews(L, 'The strike ends after 24 days. Regular players return, and the replacement players are released. Their games count in the standings.');
  }
}

function simWeek(L) {
  if (L.phase !== 'regular') return;
  healWeek(L);
  strikeBefore(L);
  if (L.week < DEADLINE_WEEK && Math.random() < 0.3) aiTrades(L, 1, 6);
  L.offers = (L.offers || []).filter(o => o.exp > L.week);
  for (const g of L.schedule[L.week]) if (!g.done) playGame(L, g);
  const ug = L.schedule[L.week].find(g => g.h === L.user || g.a === L.user);
  if (ug) {
    const me = ug.h === L.user, my = me ? ug.hs : ug.as, op = me ? ug.as : ug.hs, opp = L.teams[me ? ug.a : ug.h];
    addNews(L, `Week ${L.week + 1}: ${my > op ? 'W' : my < op ? 'L' : 'T'} ${my}-${op} ${me ? 'vs' : 'at'} ${opp.city}${ug.ot ? ' (OT)' : ''}.`);
  }
  L.week++;
  strikeAfter(L);
  aiIR(L);
  weeklyMorale(L); holdoutWeek(L); poachPS(L);
  if (L.week === revealWeek(L)) { scoutReview(L); if (L.teams[L.user]) rookieReveal(L); }
  if (L.week < DEADLINE_WEEK && Math.random() < 0.4) makeOffers(L, 1, 6);
  if (L.week >= L.schedule.length) startPlayoffs(L);
}

function pct(L, t) {
  const g = t.w + t.l + t.t; if (!g) return 0;
  return rules(L.year).tiesCountHalf ? (t.w + 0.5 * t.t) / g : (t.w + t.l ? t.w / (t.w + t.l) : 0.5);
}

function sortTeams(L, list) { return list.slice().sort((a, b) => (pct(L, b) - pct(L, a)) || ((b.pf - b.pa) - (a.pf - a.pa)) || (b.pf - a.pf)); }

function divisions(L) {
  const m = {};
  L.teams.forEach(t => { (m[t.conf + '|' + t.div] = m[t.conf + '|' + t.div] || []).push(t); });
  return m;
}

function seeds(L, conf) {
  const n = rules(L.year).playoffPerConf, divs = divisions(L), winners = [];
  // 1982 strike tournament: top 8 by record in each conference, divisions ignored.
  if (L.year === 1982) return sortTeams(L, L.teams.filter(t => t.conf === conf)).slice(0, n).map(t => t.id);
  for (const k in divs) if (k.startsWith(conf + '|')) winners.push(sortTeams(L, divs[k])[0]);
  const ws = sortTeams(L, winners);
  const rest = sortTeams(L, L.teams.filter(t => t.conf === conf && !winners.includes(t)));
  return ws.concat(rest.slice(0, Math.max(0, n - ws.length))).map(t => t.id);
}

/* ---------- awards ---------- */
const OFFG = ['QB', 'RB', 'WR', 'TE'], DEFG = ['DL', 'LB', 'DB'];
function offScore(h) { return (h.py || 0) * 0.035 + (h.ptd || 0) * 5.5 - (h.int || 0) * 3 + (h.ry || 0) * 0.08 + (h.rtd || 0) * 5 + (h.recy || 0) * 0.08 + (h.rectd || 0) * 5 + (h.rec || 0) * 0.2; }
function defScore(h, p) { return (h.sk || 0) * 4 + (h.dint || 0) * 5 + Math.max(0, p.ovr - 60) * 0.6 + (h.g || 0) * 0.5; }
const fmt = n => Math.round(n).toLocaleString('en-US');
function awardLine(p, h) {
  if (p.grp === 'QB') return `${fmt(h.py || 0)} pass yds, ${h.ptd || 0} TD, ${h.int || 0} INT`;
  if (p.grp === 'RB') return `${fmt(h.ry || 0)} rush yds, ${(h.rtd || 0) + (h.rectd || 0)} TD, ${fmt(h.recy || 0)} rec yds`;
  if (p.grp === 'WR' || p.grp === 'TE') return `${h.rec || 0} rec, ${fmt(h.recy || 0)} yds, ${h.rectd || 0} TD`;
  if (p.grp === 'OL') return `${h.g || 0} starts, ${p.ovr} OVR`;
  if (p.grp === 'K') return `${h.fgm || 0} FG made`;
  if (p.grp === 'P') return `${h.g || 0} games, ${p.ovr} OVR`;
  if (p.grp === 'DB') return `${h.dint || 0} INT${h.sk ? ', ' + h.sk + ' sacks' : ''}`;
  if (p.grp === 'DL') return `${h.sk || 0} sacks${h.dint ? ', ' + h.dint + ' INT' : ''}`;
  return `${h.sk || 0} sacks, ${h.dint || 0} INT`;
}
function giveAward(L, key, p, line, tid) {
  const y = L.year; L.awards = L.awards || {}; const A = L.awards[y] || (L.awards[y] = {});
  A[key] = { pid: p.id, tid, name: p.name, pos: p.pos, line };
  (p.awards = p.awards || []).push({ y, a: key });
}
const AWARD_NAMES = { mvp: 'MVP', opoy: 'Offensive Player of the Year', dpoy: 'Defensive Player of the Year', roy: 'Rookie of the Year', sbmvp: 'Super Bowl MVP', ap1: 'First-team All-Pro', ap2: 'Second-team All-Pro', pb: 'Pro Bowl' };
// All-Pro slots, with the position labels that fill each one
const AP_SLOTS = [['QB', 1, ['QB']], ['RB', 2, ['RB', 'HB', 'FB', 'TB']], ['WR', 2, ['WR', 'FL', 'SE', 'E', 'SR']], ['TE', 1, ['TE']],
  ['T', 2, ['T', 'OT', 'LT', 'RT']], ['G', 2, ['G', 'OG', 'LG', 'RG']], ['C', 1, ['C']],
  ['DE', 2, ['DE', 'LDE', 'RDE', 'LE', 'RE']], ['DT', 2, ['DT', 'NT', 'LDT', 'RDT', 'MG']], ['LB', 3, ['LB', 'MLB', 'OLB', 'ILB', 'LLB', 'RLB', 'LILB', 'RILB', 'LOLB', 'ROLB']],
  ['CB', 2, ['CB', 'LCB', 'RCB']], ['S', 2, ['S', 'FS', 'SS', 'DB']], ['K', 1, ['K', 'PK']], ['P', 1, ['P']]];
const SLOT_GRP = { QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', T: 'OL', G: 'OL', C: 'OL', DE: 'DL', DT: 'DL', LB: 'LB', CB: 'DB', S: 'DB', K: 'K', P: 'P' };
function apScore(p, h) {
  if (OFFG.includes(p.grp)) return offScore(h) + p.ovr * 0.3;
  if (DEFG.includes(p.grp)) return defScore(h, p) + p.ovr * 0.3;
  if (p.grp === 'OL') return p.ovr * 1.5 + (h.g || 0) * 2;
  if (p.grp === 'K') return (h.fgm || 0) * 3 + p.ovr * 0.5;
  return p.ovr + (h.g || 0);
}
function allProTeams(L) {
  const y = L.year, minG = Math.ceil(rules(y).games / 2), used = new Set();
  const cands = [];
  for (const id in L.players) { const p = L.players[id], h = p.hist[y]; if (h && h.tm != null && (h.g || 0) >= minG) cands.push({ p, h, s: apScore(p, h) }); }
  cands.sort((a, b) => b.s - a.s);
  const team = { first: [], second: [] };
  for (const tier of ['first', 'second']) for (const [slot, n, labels] of AP_SLOTS) {
    let got = cands.filter(c => !used.has(c.p.id) && labels.includes(String(c.p.pos).toUpperCase()) && c.p.grp === SLOT_GRP[slot]).slice(0, n);
    if (got.length < n) got = got.concat(cands.filter(c => !used.has(c.p.id) && !got.includes(c) && c.p.grp === SLOT_GRP[slot]).slice(0, n - got.length));
    for (const c of got) { used.add(c.p.id); team[tier].push({ id: c.p.id, name: c.p.name, pos: slot, tid: c.h.tm, line: awardLine(c.p, c.h) }); (c.p.awards = c.p.awards || []).push({ y, a: tier === 'first' ? 'ap1' : 'ap2' }); }
  }
  L.allPro = L.allPro || {}; L.allPro[y] = team;
  const mine = team.first.filter(x => x.tid === L.user).map(x => x.pos + ' ' + x.name);
  addNews(L, `${y} All-Pro teams announced.${mine.length ? ' First team from your club: ' + mine.join(', ') + '.' : ''}`);
}
function seasonAwards(L) {
  const y = L.year, minG = Math.ceil(rules(y).games / 2), cand = [];
  for (const id in L.players) {
    const p = L.players[id], h = p.hist[y];
    if (!h || (h.g || 0) < minG || h.tm == null) continue;
    const t = L.teams[h.tm], wp = pct(L, t);
    const off = OFFG.includes(p.grp) ? offScore(h) : 0, def = DEFG.includes(p.grp) ? defScore(h, p) : 0;
    cand.push({ p, h, off, def, wp, rookie: (p.yrs || 0) === 0 });
  }
  const best = f => cand.slice().sort((a, b) => f(b) - f(a))[0];
  const mvp = best(c => c.off ? c.off + c.wp * 60 : c.def * 1.6 + c.wp * 60);
  const opoy = best(c => c.off);
  const dpoy = best(c => c.def);
  const roy = best(c => c.rookie ? Math.max(c.off, c.def * 2.2) : -1);
  const out = [];
  for (const [k, c] of [['mvp', mvp], ['opoy', opoy], ['dpoy', dpoy], ['roy', roy]]) {
    if (!c || (k === 'roy' && !c.rookie)) continue;
    giveAward(L, k, c.p, awardLine(c.p, c.h), c.h.tm);
    out.push(`${AWARD_NAMES[k]}: ${c.p.pos} ${c.p.name}, ${L.teams[c.h.tm].abbr}`);
  }
  if (out.length) addNews(L, `${y} awards. ` + out.join(' · ') + '.');
  allProTeams(L);
  proBowl(L);
}
function superBowlMVP(L, w, pts, g) {
  const star = g && g.box ? boxStar(g.box, w) : null, sp = star && L.players[star.id];
  if (sp) { const line = boxLine(star); giveAward(L, 'sbmvp', sp, line, w); addNews(L, `Super Bowl ${roman(L.year - 1965)} MVP: ${sp.pos} ${sp.name} (${line}).`); return; }
  const d = depth(L, w), pool = [];
  const add = (p, wgt) => { if (p) pool.push([p, wgt]); };
  add(d.QB[0], 45); add(d.RB[0], 15); add(d.WR[0], 15);
  add(d.DL.slice().sort((a, b) => b.ovr - a.ovr)[0], 10); add(d.LB[0], 5); add(d.DB.slice().sort((a, b) => b.ovr - a.ovr)[0], 10);
  const tot = pool.reduce((s, x) => s + x[1], 0); let r = Math.random() * tot, p = pool[0][0];
  for (const [pl, wgt] of pool) { r -= wgt; if (r <= 0) { p = pl; break; } }
  const tds = Math.max(1, Math.floor(pts / 7));
  let line;
  if (p.grp === 'QB') { const att = R.int(18, 30); line = `${Math.round(att * (0.55 + Math.random() * 0.2))}/${att}, ${R.int(160, 290)} yds, ${R.int(1, Math.min(3, tds))} TD`; }
  else if (p.grp === 'RB') line = `${R.int(18, 30)} carries, ${R.int(85, 165)} yds, ${R.int(1, Math.min(2, tds))} TD`;
  else if (p.grp === 'WR' || p.grp === 'TE') line = `${R.int(4, 8)} rec, ${R.int(90, 170)} yds, ${R.int(1, Math.min(2, tds))} TD`;
  else line = Math.random() < 0.5 ? `${R.int(2, 3)} sacks, forced fumble` : `${R.int(2, 3)} INT`;
  giveAward(L, 'sbmvp', p, line, w);
  addNews(L, `Super Bowl ${roman(L.year - 1965)} MVP: ${p.pos} ${p.name} (${line}).`);
}

function startPlayoffs(L) {
  seasonAwards(L);
  L.phase = 'playoffs';
  L.offers = [];
  const s = { AFC: seeds(L, 'AFC'), NFC: seeds(L, 'NFC') };
  L.playoffs = { seeds: s, alive: { AFC: s.AFC.slice(), NFC: s.NFC.slice() }, rounds: [], champ: null };
  const inIt = s.AFC.concat(s.NFC).includes(L.user);
  if (L.teams[L.user]) addNews(L, inIt ? `${L.teams[L.user].city} clinched a playoff spot!` : `${L.teams[L.user].city} missed the playoffs at ${L.teams[L.user].w}-${L.teams[L.user].l}${L.teams[L.user].t ? '-' + L.teams[L.user].t : ''}.`);
}

function prevPow2(n) { let p = 1; while (p * 2 <= n) p *= 2; return p; }

function roundName(L) {
  const a = L.playoffs.alive.AFC.length;
  if (L.year === 1982 && a === 8) return 'First Round';
  if (L.year === 1982 && a === 4) return 'Second Round';
  if (a === 1) return 'Super Bowl';
  if (a === 2) return 'Conference Championships';
  if (a <= 4 && (a & (a - 1)) === 0) return 'Divisional Round';
  return 'Wild Card Round';
}

function playoffPairs(L) {
  const P = L.playoffs; if (!P) return [];
  if (roundName(L) === 'Super Bowl') { const a = P.alive.AFC[0], n = P.alive.NFC[0]; return [L.year % 2 ? [n, a] : [a, n]]; }
  const out = [];
  for (const c of ['AFC', 'NFC']) {
    const alive = P.alive[c].slice().sort((x, y) => P.seeds[c].indexOf(x) - P.seeds[c].indexOf(y));
    const n = alive.length, p2 = prevPow2(n);
    const playing = n === p2 ? alive : alive.slice(n - 2 * (n - p2));
    for (let i = 0; i < playing.length / 2; i++) out.push([playing[i], playing[playing.length - 1 - i]]);
  }
  return out;
}
function nextGame(L) {
  if (L.phase === 'regular') { const g = L.schedule[L.week] && L.schedule[L.week].find(x => x.h === L.user || x.a === L.user); return g ? { h: g.h, a: g.a } : null; }
  if (L.phase === 'playoffs') { const pr = playoffPairs(L).find(x => x.includes(L.user)); return pr ? { h: pr[0], a: pr[1], neutral: roundName(L) === 'Super Bowl' } : null; }
  return null;
}
function simPlayoffRound(L) {
  if (L.phase !== 'playoffs') return;
  const P = L.playoffs, name = roundName(L), games = [];
  healWeek(L);
  if (name === 'Super Bowl') {
    const a = P.alive.AFC[0], n = P.alive.NFC[0];
    const g = playGame(L, { h: L.year % 2 ? n : a, a: L.year % 2 ? a : n }, { playoff: true, neutral: true, noStats: true });
    const w = g.hs > g.as ? g.h : g.a; games.push(g);
    P.champ = w; L.champs.unshift({ y: L.year, champ: w, sb: L.year - 1965, score: Math.max(g.hs, g.as) + '-' + Math.min(g.hs, g.as), loser: w === g.h ? g.a : g.h });
    addNews(L, `Super Bowl ${roman(L.year - 1965)}: ${L.teams[w].city} ${L.teams[w].name} win ${Math.max(g.hs, g.as)}-${Math.min(g.hs, g.as)}.`);
    superBowlMVP(L, w, Math.max(g.hs, g.as), g);
    P.rounds.push({ name, games });
    finishSeason(L);
    return;
  }
  for (const c of ['AFC', 'NFC']) {
    const alive = P.alive[c].slice().sort((x, y) => P.seeds[c].indexOf(x) - P.seeds[c].indexOf(y));
    const n = alive.length, p2 = prevPow2(n);
    let playing;
    if (n === p2) playing = alive;
    else { const k = n - p2; playing = alive.slice(n - 2 * k); }
    const losers = [];
    for (let i = 0; i < playing.length / 2; i++) {
      const hi = playing[i], lo = playing[playing.length - 1 - i];
      const g = playGame(L, { h: hi, a: lo }, { playoff: true, noStats: true });
      games.push(g); losers.push(g.hs > g.as ? lo : hi);
    }
    P.alive[c] = alive.filter(t => !losers.includes(t));
  }
  P.rounds.push({ name, games });
  const mine = games.find(g => g.h === L.user || g.a === L.user);
  if (mine) {
    const won = (mine.h === L.user) === (mine.hs > mine.as);
    addNews(L, `${name}: ${L.teams[L.user].city} ${won ? 'advance' : 'are eliminated'}, ${Math.max(mine.hs, mine.as)}-${Math.min(mine.hs, mine.as)}.`);
  }
}

function roman(n) { const m = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; }

function finishSeason(L) {
  const P = L.playoffs;
  for (const t of L.teams) {
    let res = 'Missed playoffs';
    const conf = P.seeds[t.conf];
    if (conf.includes(t.id)) {
      res = 'Lost in playoffs';
      if (P.champ === t.id) res = 'Won Super Bowl';
      else if (L.champs[0].loser === t.id) res = 'Lost Super Bowl';
    }
    t.hist.push({ y: L.year, w: t.w, l: t.l, t: t.t, pf: t.pf, pa: t.pa, res, hc: t.staff && t.staff.hc ? t.staff.hc.name : null, gm: t.id === L.user ? 1 : undefined, nm: t.city + ' ' + t.name });
  }
  L.phase = 'season-over';
  seasonMorale(L);
  judgeSeason(L);
  inductHOF(L);
  coachCarousel(L);
}

/* ---------- draft ---------- */
function draftOrder(L) {
  const dy = L.year + 1, exp = L.teams.filter(t => t.expY === dy).map(t => t.id);
  const base = L.playoffs && L.playoffs.seeds ? seasonOrder(L) : realOrder(L, dy);
  return exp.concat(base.filter(id => !exp.includes(id)));
}
// No season played (a league that starts at an expansion draft): use the real draft's order
function realOrder(L, dy) {
  const rows = (DRAFTS && DRAFTS[dy]) || [], first = {};
  rows.forEach(r => { const c = pfrForTm(r.Tm, dy), t = c && L.teams.find(x => x.pfr === c), pk = num(r.Pick); if (t && pk && (first[t.id] == null || pk < first[t.id])) first[t.id] = pk; });
  return L.teams.map(t => t.id).sort((a, b) => (first[a] != null ? first[a] : 999) - (first[b] != null ? first[b] : 999));
}
function seasonOrder(L) {
  const P = L.playoffs, all = P.seeds.AFC.concat(P.seeds.NFC);
  // elimination round index: higher = went further
  const went = {}; all.forEach(t => went[t] = 0);
  P.rounds.forEach((r, i) => r.games.forEach(g => { went[g.h] = Math.max(went[g.h], i + 1); went[g.a] = Math.max(went[g.a], i + 1); }));
  if (P.champ != null) went[P.champ] += 1;
  const non = sortTeams(L, L.teams.filter(t => !all.includes(t.id))).reverse();
  const po = L.teams.filter(t => all.includes(t.id)).sort((a, b) => (went[a.id] - went[b.id]) || (pct(L, a) - pct(L, b)));
  return non.concat(po).map(t => t.id);
}

// Next year's draft class exists all season. Scouts grade more of it each week:
// the top prospects at training camp, everyone by the end of the regular season.
function ensureNextClass(L, imports) {
  if (!['preseason', 'regular', 'playoffs', 'season-over'].includes(L.phase)) return null;
  const dy = L.year + 1, rows = imports && imports.drafts && imports.drafts[dy];
  let C = L.nextClass;
  if (C && C.year === dy && (C.real || !(rows && rows.length))) {
    if (!C.rnd) { // older classes graded best-first: keep anyone already graded, spread the rest randomly
      const games = rules(L.year).games, now = L.phase === 'regular' ? L.week : 0;
      C.pool.forEach(id => { const p = L.players[id]; if (p && !scoutedYet(L, p)) p.sw = R.int(Math.min(games - 1, now + 1), games - 1); });
      C.rnd = 1;
    }
    return C;
  }
  if (C) C.pool.forEach(id => { if (L.players[id] && L.players[id].team === -3) delete L.players[id]; });
  const pool = [];
  if (rows && rows.length) rows.forEach(r => pool.push(prospectFromDraft(L, r, dy).id));
  const real = !!(rows && rows.length);
  const target = rules(dy).draftRounds * L.teams.length + (real ? 10 : 30);
  while (pool.length < target) pool.push(genProspect(L, dy, real).id);
  // each prospect gets graded in a random week, regardless of how good he is
  const games = rules(L.year).games;
  pool.forEach(id => { L.players[id].sw = R.int(0, games - 1); });
  L.nextClass = { year: dy, pool, real: !!(rows && rows.length), rnd: 1 };
  return L.nextClass;
}
function scoutedYet(L, p) {
  if (L.phase === 'playoffs' || L.phase === 'season-over') return true;
  if (L.phase === 'preseason') return (p.sw || 0) === 0;
  return (p.sw || 0) <= L.week;
}
function startDraft(L, imports) {
  if (L.phase === 'expansion') return 'Finish the expansion draft first.';
  if (pendingExpansion(L, L.year + 1).length && beginExpansion(L, L.year + 1)) return 'expansion';
  const dy = L.year + 1, rounds = rules(dy).draftRounds, order = draftOrder(L);
  const rows = imports && imports.drafts && imports.drafts[dy];
  let pool = [];
  const C = ensureNextClass(L, imports);
  if (C && C.year === dy) { pool = C.pool.filter(id => L.players[id] && L.players[id].team === -3); L.nextClass = null; }
  else if (rows && rows.length) rows.forEach(r => pool.push(prospectFromDraft(L, r, dy).id));
  reenterRefusers(L, pool);
  const compN = compAwards(L, dy).length;
  const target = rounds * order.length + compN + 30;
  let genCount = 0;
  const realClass = pool.some(id => L.players[id] && L.players[id].realPick);
  while (pool.length < target) { pool.push(genProspect(L, dy, realClass).id); genCount++; }
  if (realClass) { pool.realClass = true; tameFillers(L, pool); delete pool.realClass; }
  ensurePicks(L);
  const slotPick = [];
  const comps = compAwards(L, dy);
  for (let r = 1; r <= rounds; r++) {
    for (const tid of order) {
      let k = L.picks.find(x => x.y === dy && x.rnd === r && x.orig === tid && !x.comp);
      if (!k) { k = { id: L.nextPickId++, y: dy, rnd: r, orig: tid, own: tid }; L.picks.push(k); }
      slotPick.push(k.id);
    }
    for (const c of comps.filter(c => c.rnd === r)) { const k = { id: L.nextPickId++, y: dy, rnd: r, orig: c.tid, own: c.tid, comp: true }; L.picks.push(k); slotPick.push(k.id); }
  }
  if (comps.length) {
    const byT = {}; comps.forEach(c => (byT[c.tid] = byT[c.tid] || []).push('R' + c.rnd));
    addNews(L, `Compensatory picks for the ${dy} draft: ` + Object.entries(byT).map(([tid, r]) => `${L.teams[tid].abbr} (${r.join(', ')})`).join(', ') + '.');
  }
  L.draft = { year: dy, order, rounds, pick: 0, pool, log: [], started: false, visits: 0, ai: {}, slotPick };
  L.phase = 'draft';
  addNews(L, `The ${dy} draft is open: ${rounds} rounds, ${order.length} teams.` + (rows ? '' : ' No real class imported, so this class is generated.') + (rows && genCount > 30 ? ` Added ${genCount} generated prospects to fill the board.` : ''));
}

// Each team gets a few private workouts that reveal a prospect's true potential.
const SCOUT_VISITS = 10;
function aiScouting(L) {
  const D = L.draft, n = D.order.length;
  const ranked = D.pool.slice().sort((a, b) => L.players[b].scout - L.players[a].scout);
  D.order.forEach((tid, i0) => {
    if (tid === L.user) return;
    const first = D.slotPick ? D.slotPick.findIndex(id => { const k = pickById(L, id); return k && k.own === tid; }) : -1;
    const i = first >= 0 ? first : i0;
    const lo = Math.max(0, i - 10), hi = Math.min(ranked.length, i + n * 3);
    D.ai[tid] = R.shuffle(ranked.slice(lo, hi)).slice(0, diff(L).aiVisits);
  });
}
function scoutPlayer(L, pid) {
  const D = L.draft, p = L.players[pid];
  if (!D || !p || p.team !== -3) return 'That prospect is no longer available.';
  if (p.seen) return null;
  if (!(D.visits > 0)) return 'You have used all ' + SCOUT_VISITS + ' scouting visits this year.';
  p.seen = true; D.visits--; return null;
}
function beginDraft(L) { if (L.draft) { L.draft.started = true; draftUntilUser(L); } }

function onClock(L) {
  const D = L.draft; if (!D) return null;
  if (D.pick >= D.order.length * D.rounds) return null;
  if (D.slotPick) { const k = pickById(L, D.slotPick[D.pick]); if (k) return k.own; }
  return D.order[D.pick % D.order.length];
}

function makePick(L, pid) {
  const D = L.draft, tid = onClock(L); if (tid == null) return;
  const p = L.players[pid]; if (!p || p.team !== -3) return;
  p.team = tid; p.draft = { year: D.year, rnd: Math.floor(D.pick / D.order.length) + 1, pick: D.pick + 1, tid };
  { const sc = L.teams[tid].staff && L.teams[tid].staff.sc; if (sc && !sc.interim && p.scout != null) p.scG = { sid: sc.id, pot: scoutRead(L, tid, p).pot }; }
  if (p.realPick && !p.rc) attachRC(p, D.year, REAL ? REAL.byDraft[D.year + '-' + p.realPick.pick] : null, p.realTo);
  rookieDeal(L, p, D.year, D.pick + 1, p.draft.rnd);
  plog(L, p, `Drafted by ${L.teams[tid].city} ${L.teams[tid].name}: round ${p.draft.rnd}, #${D.pick + 1} overall.`);
  maybeRefuse(L, p, tid, D.pick + 1);
  D.pool = D.pool.filter(i => i !== pid);
  D.log.push({ n: D.pick + 1, tid, pid });
  if (D.slotPick) L.picks = L.picks.filter(k => k.id !== D.slotPick[D.pick]);
  D.pick++;
}

// AI teams trade up on draft day: a team picking a few spots later sends its pick plus another for the current one.
function slotNo(L, k) { const i = L.draft.slotPick.indexOf(k.id); return i >= 0 ? i + 1 : null; }
function tradeUpCandidates(L, ownerNot) {
  const D = L.draft, out = [];
  for (let i = D.pick + 1; i < Math.min(D.slotPick.length, D.pick + 15); i++) { const k = pickById(L, D.slotPick[i]); if (k && tradeablePick(k) && !ownerNot.includes(k.own)) out.push(k); }
  return out;
}
function extraPickFor(L, team, exclude, need) {
  const D = L.draft;
  const ex = (L.picks || []).filter(k => k.own === team && tradeablePick(k) && !exclude.includes(k.id) && !(D.slotPick.includes(k.id) && D.slotPick.indexOf(k.id) <= D.pick))
    .map(k => ({ k, w: pickWeight(L, k) })).sort((a, b) => a.w - b.w);
  const ok = ex.filter(x => x.w >= need).sort((a, b) => a.k.y - b.k.y || a.w - b.w);
  return ok.length ? ok[0].k : null;
}
// Compensatory picks (from the 1994 draft): teams that lost more free agents than they signed
// get extra picks at the end of rounds 3-7, based on how good the players they lost were.
function noteFASign(L, p, tid) {
  if (p.prevTeam == null || p.prevTeam === tid || value(p) < 55) { delete p.prevTeam; return; }
  const y = capYear(L); L.comp = L.comp || {}; (L.comp[y] = L.comp[y] || []).push({ from: p.prevTeam, to: tid, v: Math.round(value(p)), name: p.name });
  delete p.prevTeam;
}
function compAwards(L, dy) {
  if (dy < 1994 || !L.comp || !L.comp[dy - 1]) return [];
  const T = L.comp[dy - 1], out = [];
  for (const t of L.teams) {
    const lost = T.filter(x => x.from === t.id).map(x => x.v).sort((a, b) => b - a), gained = T.filter(x => x.to === t.id).map(x => x.v).sort((a, b) => b - a);
    const net = lost.slice(gained.length);  // each signing offsets one loss
    net.slice(0, 4).forEach(v => out.push({ tid: t.id, v, rnd: v >= 80 ? 3 : v >= 74 ? 4 : v >= 68 ? 5 : v >= 62 ? 6 : 7 }));
  }
  return out.sort((a, b) => b.v - a.v).slice(0, 32);
}
function draftTradeUp(L) {
  const D = L.draft; if (!D || !D.slotPick || D.pick >= D.order.length * 3 || Math.random() > 0.07) return;
  const cur = pickById(L, D.slotPick[D.pick]); if (!cur || cur.own === L.user || !tradeablePick(cur)) return;
  const A = cur.own, later = tradeUpCandidates(L, [A, L.user]); if (!later.length) return;
  const kB = R.pick(later), B = kB.own, need = (pickWeight(L, cur) - pickWeight(L, kB)) * (0.9 + Math.random() * 0.3);
  const add = extraPickFor(L, B, [kB.id], need); if (!add) return;
  const from = slotNo(L, kB), addTxt = pickLabel(L, add);
  cur.own = B; kB.own = A; add.own = A;
  addNews(L, `DRAFT TRADE: ${L.teams[B].abbr} move up to #${D.pick + 1}, sending #${from} and a ${addTxt} pick to ${L.teams[A].abbr}.`);
}
// While you're on the clock, an AI team may offer to trade up into your spot.
function maybeDraftOffer(L) {
  const D = L.draft; if (!D || onClock(L) !== L.user || D.pick >= D.order.length * 4) return;
  if (D.offer && D.offer.pick === D.pick) return;
  if (D.noOffer === D.pick || Math.random() > 0.3) { D.noOffer = D.pick; D.offer = null; return; }
  const cur = pickById(L, D.slotPick[D.pick]), later = tradeUpCandidates(L, [L.user]); if (!later.length || !cur || !tradeablePick(cur)) return;
  const kB = R.pick(later), B = kB.own, need = (pickWeight(L, cur) - pickWeight(L, kB)) * (1 + Math.random() * 0.15);
  const add = extraPickFor(L, B, [kB.id], need); if (!add) { D.noOffer = D.pick; return; }
  D.offer = { pick: D.pick, from: B, give: [kB.id, add.id] };
}
function acceptDraftOffer(L) {
  const D = L.draft, o = D && D.offer; if (!o || o.pick !== D.pick) return 'That offer is gone.';
  const cur = pickById(L, D.slotPick[D.pick]), ks = o.give.map(id => pickById(L, id));
  if (!cur || cur.own !== L.user || ks.some(k => !k || k.own !== o.from)) { D.offer = null; return 'That offer is no longer valid.'; }
  const txt = ks.map(k => slotNo(L, k) ? '#' + slotNo(L, k) : pickLabel(L, k) + ' pick').join(' and ');
  cur.own = o.from; ks.forEach(k => k.own = L.user); D.offer = null; D.noOffer = D.pick;
  addNews(L, `DRAFT TRADE: ${L.teams[L.user].abbr} trade down from #${D.pick + 1} to ${L.teams[o.from].abbr} for ${txt}.`);
  return null;
}
function declineDraftOffer(L) { const D = L.draft; if (D) { D.offer = null; D.noOffer = D.pick; } }
function aiPick(L) {
  draftTradeUp(L);
  const tid = onClock(L), D = L.draft; if (tid == null) return;
  const counts = groupCounts(L, tid), seen = new Set((D.ai && D.ai[tid]) || []), SFd = startersFor(L, tid);
  let best = null, bs = -1e9;
  for (const id of D.pool) {
    const p = L.players[id];
    // the team's own scouting director pulls the consensus grade toward what he sees
    const sd = L.teams[tid].staff && L.teams[tid].staff.sc, w = tid === L.user ? 1 : clamp(((sd ? sd.r : 45) - 35) / 110, 0, 0.5);
    let s = (seen.has(id) ? p.pot : p.scout + w * (scoutRead(L, tid, p).pot - p.scout)) + R.norm() * 3;
    if (counts[p.grp] < SFd[p.grp] + 1) s += 3;
    // kickers and punters are late-round picks (only a handful ever went in round 1)
    if ((p.grp === 'K' || p.grp === 'P') && D.pick < order32(D) * 3) s -= 25;
    if ((p.grp === 'K' || p.grp === 'P') && counts[p.grp] >= 1) s -= 12;
    if (p.grp === 'QB' && counts.QB >= 3) s -= 4;
    if (s > bs) { bs = s; best = p; }
  }
  if (best) makePick(L, best.id);
}

function order32(D) { return D.order.length; }
function draftUntilUser(L) { let c; while ((c = onClock(L)) !== null && c !== L.user) aiPick(L); maybeDraftOffer(L); }
function draftAll(L) { while (onClock(L) !== null) aiPick(L); }

function endDraft(L) {
  const D = L.draft;
  D.pool.forEach(id => { const p = L.players[id]; if (p) { p.team = -1; delete p.con; } });
  ensureNumbers(L);
  const mine = D.log.filter(x => x.tid === L.user).slice(0, 3).map(x => L.players[x.pid].name);
  if (L.teams[L.user]) addNews(L, `Draft complete. ${L.teams[L.user].abbr} top picks: ${mine.join(', ') || 'none'}.`);
  resolveRefusals(L);
  // keep the draft results (the last 15 drafts) for the League tab
  L.draftHist = L.draftHist || {};
  L.draftHist[D.year] = D.log.map(x => [x.n, x.tid, x.pid]);
  Object.keys(L.draftHist).map(Number).sort((a, b) => a - b).slice(0, -15).forEach(y => delete L.draftHist[y]);
  L.picks = (L.picks || []).filter(k => k.y !== D.year);
  L.draft = null; L.phase = 'offseason';
  ensurePicks(L);
  L.offers = [];
  makeOffers(L, 1, 10);
  openFreeAgency(L);
}

/* ---------- offseason ---------- */
function progress(L) {
  const youth = {}; L.teams.forEach(t => youth[t.id] = t.coach.youth);
  const retired = [], before = {};
  for (const id in L.players) { const p = L.players[id]; if (p.team >= 0) before[id] = { o: p.ovr, t: p.team }; }
  for (const id in L.players) {
    const p = L.players[id];
    if (p.team === -2 || p.team === -3) continue;
    const rookie = p.draft && p.draft.year === L.year + 1;
    if (!rookie) { p.age++; p.yrs++; }
    const h = p.hist[L.year], played = h && h.g >= 8;
    let d;
    if (p.age <= 24) d = R.int(1, 6) + (played && youth[p.team] ? 2 : 0);
    else if (p.age <= 28) d = R.int(-1, 3) + (played && youth[p.team] && p.age <= 26 ? 1 : 0);
    else if (p.age <= 31) d = R.int(-4, 1);
    else if (p.age <= 34) d = R.int(-5, 1);
    else d = R.int(-7, 0);
    // quarterbacks, kickers and punters age more slowly
    if (d < 0 && (p.grp === 'QB' || p.grp === 'K' || p.grp === 'P')) d = Math.round(d * 0.6);
    const cb = isCareer(L, p) && p.retiredYear == null ? careerGrowth(L, p, d) : 0;
    if (cb && !(L.realCareers !== false && p.rc)) d += cb;
    if (cb) p.cBoost = clamp((p.cBoost || 0) + cb, -4, 8);
    const hc = L.teams[p.team] && L.teams[p.team].staff && L.teams[p.team].staff.hc;
    if (hc && p.age <= 26 && Math.random() < (hc.r - 55) / 60) d += 1;
    if (d > 0) p.ovr = Math.min(p.pot, p.ovr + d); else p.ovr = Math.max(30, p.ovr + d);
    // Real careers: real players rise, peak and fade the way their real careers did.
    const RC = L.realCareers !== false && p.rc;
    if (RC && p.rc.y0 != null && !rookie) p.ovr = Math.max(30, Math.min(99, rcRating(p, L.year + 1) + (isCareer(L, p) ? Math.round((p.cBoost || 0) / 2) : 0)) + (played && youth[p.team] && p.age <= 26 ? 1 : 0));
    if (isCareer(L, p)) p.ovr = Math.min(99, p.ovr);
    p.peak = Math.max(p.peak || 0, p.ovr);
    if (p.ovr >= p.pot && !(RC && isCareer(L, p))) p.pot = p.ovr;
    p.inj = 0; delete p.injT;
    let rp = 0;
    if (p.age >= 33) {
      rp = 0.25 + (p.age - 33) * 0.15;
      // good players hang on longer: each point over 70 cuts the chance (85 OVR: about 40% of normal)
      rp *= clamp(1 - (p.ovr - 65) * 0.04, 0.3, 1);
      if (p.grp === 'K' || p.grp === 'P') rp *= 0.4;
      if (p.grp === 'QB') rp *= 0.7;
    } else if (p.age >= 28 && p.ovr < 48) rp = 0.35;
    // only quarterbacks, kickers and punters can play past 38, and nobody past 45
    const longCareer = p.grp === 'QB' || p.grp === 'K' || p.grp === 'P';
    if (p.age >= 38 && !longCareer) rp = 1;
    if (longCareer) rp = p.age >= 46 ? 1 : Math.min(rp, 0.95);
    // players who keep getting hurt walk away sooner
    if (p.age >= 26) { const w = recentInjuryWeeks(p, L.year); rp += clamp((w - 6) / 50, 0, 0.35) * (p.age >= 28 ? 1 : 0.5); }
    if (p.team === -1) rp += p.age >= 29 ? 0.5 : (p.age >= 24 ? 0.35 : 0.15);
    if (RC) {
      // ...and retire the year they really did (a free agent nobody signs may still walk away early)
      const lastKnown = REAL ? REAL.last : DATA_LAST + 1;
      if (p.rc.end != null) rp = L.year + 1 > p.rc.end ? 1 : (p.team === -1 ? rp * 0.5 : 0);
      else if (L.year + 1 <= lastKnown) rp = p.team === -1 ? rp * 0.5 : 0;
    }
    if (isCareer(L, p)) rp = p.retiredYear == null ? careerForcedChance(L, p) : 0;
    if (Math.random() < rp) { retired.push(p); plog(L, p, `Retired${p.team >= 0 ? ' from ' + L.teams[p.team].abbr : ''} after ${p.yrs || 0} season${p.yrs === 1 ? '' : 's'}.`); p.team = -2; p.retiredYear = L.year + 1; }
  }
  const notable = retired.filter(p => p.ovr >= 78 || p.real && p.ovr >= 72).slice(0, 6);
  if (notable.length) addNews(L, 'Retired: ' + notable.map(p => `${p.pos} ${p.name}`).join(', ') + '.');
  // camp report: every rating change on your team, plus the biggest movers around the league
  const rows = [];
  for (const id in before) { const p = L.players[id]; if (!p || p.team < 0) continue; const d = p.ovr - before[id].o; rows.push({ id: +id, name: p.name, pos: p.pos, grp: p.grp, tid: before[id].t, age: p.age, b: before[id].o, a: p.ovr, pot: p.pot }); }
  const mine = rows.filter(r => r.tid === L.user);
  const league = rows.filter(r => r.tid !== L.user && Math.abs(r.a - r.b) >= 5).sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b)).slice(0, 40);
  L.camp = { year: L.year + 1, mine, league, retired: retired.filter(p => before[p.id] && before[p.id].t === L.user).map(p => ({ id: p.id, name: p.name, pos: p.pos, age: p.age })) };
  for (const p of retired) if (Object.keys(p.hist).length) aiRingCheck(L, p);
  archivePlayers(L);
}
// Keep the active player list small so the sim stays fast: retired players with a stat
// history move to an archive (still shown in stats and awards); the rest are dropped.
function archivePlayers(L) {
  L.retired = L.retired || {};
  for (const id in L.players) {
    const p = L.players[id], played = Object.keys(p.hist).length > 0 || (p.awards && p.awards.length);
    if (p.team === -2) { if (played || isCareer(L, p)) { delete p.con; L.retired[id] = p; } delete L.players[id]; continue; }
    if (p.team === -1 && !played && !isCareer(L, p)) { p.faYears = (p.faYears || 0) + 1; if (p.faYears >= 2) delete L.players[id]; }
  }
}
function getP(L, id) { return L.players[id] || (L.retired || {})[id]; }
function allPlayers(L) { return Object.values(L.players).concat(Object.values(L.retired || {})); }

function applyEvents(L) {
  const newTeams = [];
  for (const e of EVENTS[L.year] || []) {
    if (e.t === 'rename') {
      const t = L.teams.find(x => x.pfr === e.pfr); if (!t) continue;
      const old = `${t.city} ${t.name}`;
      (t.names = t.names || []).push({ to: L.year - 1, nm: old });
      if (e.city) t.city = e.city; if (e.name) t.name = e.name; if (e.abbr) t.abbr = e.abbr; if (e.newPfr) t.pfr = e.newPfr;
      addNews(L, `${old} are now the ${t.city} ${t.name}.`);
    } else if (e.t === 'realign') {
      const t = L.teams.find(x => x.pfr === e.pfr); if (!t) continue;
      t.conf = e.conf; t.div = e.div; addNews(L, `${t.city} move to the ${e.conf} ${e.div}.`);
    } else if (e.t === 'realignAll') {
      for (const conf in e.map) for (const div in e.map[conf]) for (const code of e.map[conf][div]) {
        const t = L.teams.find(x => x.pfr === code); if (t) { t.conf = conf; t.div = div; }
      }
      addNews(L, 'The league realigns into eight four-team divisions: East, North, South and West in each conference.');
    } else if (e.t === 'expand') {
      if (L.teams.some(x => x.pfr === e.team[0])) continue; // joined before the draft
      const t = mkTeam(L.teams.length, e.team); L.teams.push(t); newTeams.push(t.id);
      addNews(L, `Expansion: the ${t.city} ${t.name} join the ${t.conf} ${t.div}.`);
    }
  }
  if (newTeams.length) { runExpansionDraft(L, newTeams, L.year); ensureStaff(L); ensurePicks(L); }
}

// How each real expansion draft worked.
// 1976: every team protected 29 players and lost 3 (Seattle and Tampa Bay took 39 each).
// 1995: every team left 6 players unprotected; Carolina took 35, Jacksonville 31.
// 1999: every team left 5 unprotected; Cleveland took 37.  2002: 5 unprotected; Houston took 19.
const EXP_RULES = {
  1976: { mode: 'protect', protect: 29, perTeam: 3, picks: { sea: 39, tam: 39 } },
  1995: { mode: 'expose', expose: 6, perTeam: 3, picks: { car: 35, jax: 31 } },
  1999: { mode: 'expose', expose: 5, perTeam: 2, picks: { cle: 37 } },
  2002: { mode: 'expose', expose: 5, perTeam: 1, picks: { htx: 19 } }
};
function expRules(y) { return EXP_RULES[y] || { mode: 'expose', expose: 5, perTeam: 2, picks: {} }; }
function upcomingExpansion(L) {
  const y = L.year + 1; if (L.phase !== 'offseason' && L.phase !== 'draft' && L.phase !== 'season-over') return null;
  const ev = pendingExpansion(L, y); if (!ev.length) return null;
  return { y, teams: ev.map(e => e.team), rules: expRules(y) };
}
function expEligible(L, tid, y) { return roster(L, tid).filter(p => !(p.draft && p.draft.year === y) && !(p.draft && p.draft.year === y - 1 && (p.yrs || 0) === 0)); }
function defaultExpList(L, tid, y) {
  const R0 = expRules(y), el = expEligible(L, tid, y).sort((a, b) => value(b) - value(a));
  if (R0.mode === 'protect') return el.slice(0, R0.protect).map(p => p.id);
  // teams usually exposed solid veterans and pricey depth, not their stars or their worst players
  return R.shuffle(el.slice(18, 40)).slice(0, R0.expose).map(p => p.id);
}
function userExpList(L) {
  if (!L.teams[L.user]) return null;
  const X = upcomingExpansion(L); if (!X) return null;
  if (!L.expList || L.expList.y !== X.y) L.expList = { y: X.y, ids: defaultExpList(L, L.user, X.y) };
  L.expList.ids = L.expList.ids.filter(id => L.players[id] && L.players[id].team === L.user);
  return L.expList;
}
function toggleExp(L, pid) {
  const X = upcomingExpansion(L), E = userExpList(L); if (!X || !E) return 'No expansion draft is coming up.';
  const i = E.ids.indexOf(pid), lim = X.rules.mode === 'protect' ? X.rules.protect : X.rules.expose;
  if (i >= 0) { if (X.rules.mode === 'expose' && E.ids.length <= lim) return `You must leave exactly ${lim} players unprotected. Pick someone else first.`; E.ids.splice(i, 1); }
  else { if (E.ids.length >= lim) return X.rules.mode === 'protect' ? `You can protect ${lim} players. Unprotect someone first.` : `You've already exposed ${lim} players. Remove one first.`; E.ids.push(pid); }
  return null;
}
// Expansion teams join before the draft ahead of their first season (as they really did): the expansion
// draft comes first, then they pick first in every round of the college draft.
function pendingExpansion(L, y) { return (EVENTS[y] || []).filter(e => e.t === 'expand' && !L.teams.some(t => t.pfr === e.team[0])); }
function addExpansionTeams(L, y) {
  const ids = [];
  for (const e of pendingExpansion(L, y)) {
    const t = mkTeam(L.teams.length, e.team); t.expY = y; L.teams.push(t); ids.push(t.id);
    addNews(L, `Expansion: the ${t.city} ${t.name} join the ${t.conf} ${t.div} for the ${y} season.`);
  }
  return ids;
}
// Returns true when the user has an expansion draft to make (phase 'expansion').
function beginExpansion(L, y, userPfr) {
  const ids = addExpansionTeams(L, y); if (!ids.length) return false;
  if (userPfr) { const t = L.teams.find(x => x.pfr === userPfr); if (t) L.user = t.id; }
  ensureStaff(L); ensurePicks(L);
  const R0 = expRules(y);
  const avail = expPool(L, ids, y);
  const want = {}; ids.forEach(id => { const t = L.teams[id]; want[id] = (R0.picks && R0.picks[t.pfr]) || 30; });
  L.exp = { y, teams: ids, avail: avail.map(p => p.id), want, lost: {}, turn: 0, log: [], prev: L.phase };
  if (!ids.includes(L.user)) { expRun(L, true); return false; }
  L.phase = 'expansion';
  addNews(L, `The ${y} expansion draft is open. You can take up to ${want[L.user]} players, no more than ${R0.perTeam} from any one team.`);
  expRun(L, false);
  return true;
}
// Who each existing team leaves available
function expPool(L, newIds, y) {
  const R0 = expRules(y), avail = [];
  for (const t of L.teams) {
    if (newIds.includes(t.id)) continue;
    const el = expEligible(L, t.id, y);
    const ids = t.id === L.user && L.expList && L.expList.y === y ? L.expList.ids : defaultExpList(L, t.id, y);
    const set = new Set(ids);
    el.forEach(p => { if (R0.mode === 'protect' ? !set.has(p.id) : set.has(p.id)) avail.push(p); });
  }
  return avail.sort((a, b) => value(b) - value(a));
}
function expCanTake(L, p) { const X = L.exp; return p && X.avail.includes(p.id) && p.team >= 0 && !X.teams.includes(p.team) && (X.lost[p.team] || 0) < expRules(X.y).perTeam; }
function expBest(L, tid) {
  const X = L.exp, counts = groupCounts(L, tid); let best = null, bs = -1e9;
  for (const id of X.avail) {
    const p = L.players[id]; if (!expCanTake(L, p)) continue;
    const sc = value(p) + (counts[p.grp] < STARTERS[p.grp] + 1 ? 6 : 0) - (counts[p.grp] >= STARTERS[p.grp] * 2 + 1 ? 8 : 0);
    if (sc > bs) { bs = sc; best = p; }
  }
  return best;
}
function expOnClock(L) { const X = L.exp; if (!X) return null; const live = X.teams.filter(id => X.want[id] > 0); if (!live.length) return null; for (let i = 0; i < X.teams.length; i++) { const tid = X.teams[(X.turn + i) % X.teams.length]; if (X.want[tid] > 0) return tid; } return null; }
function expTake(L, tid, p) {
  const X = L.exp, from = p.team;
  X.lost[from] = (X.lost[from] || 0) + 1;
  X.log.push({ tid, pid: p.id, from });
  plog(L, p, `Taken by ${L.teams[tid].abbr} from ${L.teams[from].abbr} in the ${X.y} expansion draft.`);
  if (from === L.user) addNews(L, `${L.teams[tid].abbr} took ${p.pos} ${p.name} from you in the expansion draft.`);
  p.team = tid; delete p.ir; delete p.holdout; delete p.ps; X.want[tid]--;
  X.avail.splice(X.avail.indexOf(p.id), 1);
  X.turn = (X.teams.indexOf(tid) + 1) % X.teams.length;
}
// AI expansion teams pick until it's the user's turn (or everyone is done); all = auto-pick for the user too
function expRun(L, all) {
  let guard = 0;
  while (guard++ < 500) {
    const tid = expOnClock(L); if (tid == null) return expFinish(L);
    if (tid === L.user && !all) return null;
    const p = expBest(L, tid); if (!p) { L.exp.want[tid] = 0; continue; }
    expTake(L, tid, p);
  }
}
function expPick(L, pid) {
  const X = L.exp; if (!X || L.phase !== 'expansion') return 'No expansion draft is running.';
  if (expOnClock(L) !== L.user) return 'It is not your pick.';
  const p = L.players[pid]; if (!expCanTake(L, p)) return p && X.avail.includes(p.id) ? `You've already taken ${expRules(X.y).perTeam} from the ${L.teams[p.team].name}.` : 'He is not available.';
  expTake(L, L.user, p); expRun(L, false); return null;
}
function expAutoPick(L) { if (expOnClock(L) !== L.user) return 'It is not your pick.'; const p = expBest(L, L.user); if (!p) { L.exp.want[L.user] = 0; expRun(L, false); return null; } return expPick(L, p.id); }
function expAutoAll(L) { if (!L.exp) return 'No expansion draft is running.'; expRun(L, true); return null; }
// Stop taking players: the rest of your roster comes from the college draft and free agency
function expStop(L) { if (!L.exp) return 'No expansion draft is running.'; L.exp.want[L.user] = 0; expRun(L, false); return null; }
function expFinish(L) {
  const X = L.exp; if (!X) return null;
  // AI expansion teams fill out their rosters; yours is left for you to build
  for (const tid of X.teams) {
    if (tid === L.user) continue;
    const max = rules(L.year + 1).rosterMax, have = groupCounts(L, tid);
    let size = roster(L, tid).length;
    for (const g of GRPS) while (have[g] < STARTERS[g] + 1 && size < max - 10) { genPlayer(L, g, tid, 54, [22, 30]); have[g]++; size++; }
  }
  const taken = {}; X.log.forEach(e => taken[e.tid] = (taken[e.tid] || 0) + 1);
  addNews(L, `${X.y} expansion draft: ${X.teams.map(id => `${L.teams[id].city} took ${taken[id] || 0} players`).join(', ')}.`);
  L.expDone = { y: X.y, log: X.log };
  if (L.phase === 'expansion') L.phase = X.prev || 'season-over';
  L.exp = null; L.expList = null;
  return 'done';
}
// Old one-shot version (leagues that reach an expansion year mid-save without the new flow)
function runExpansionDraft(L, newIds, y) {
  const R0 = expRules(y), avail = expPool(L, newIds, y), want = {};
  newIds.forEach(id => { const t = L.teams[id]; want[id] = (R0.picks && R0.picks[t.pfr]) || 30; });
  L.exp = { y, teams: newIds, avail: avail.map(p => p.id), want, lost: {}, turn: 0, log: [], prev: L.phase };
  const u = L.user; if (newIds.includes(u)) L.user = -99; expRun(L, true); L.user = u;
  for (const tid of newIds) { const max = rules(L.year).rosterMax, have = groupCounts(L, tid); let size = roster(L, tid).length;
    for (const g of GRPS) while (have[g] < STARTERS[g] + 1 && size < max) { genPlayer(L, g, tid, 54, [22, 30]); have[g]++; size++; }
    while (size < max) { genPlayer(L, R.pick(['OL', 'DL', 'LB', 'DB', 'WR', 'RB']), tid, 50, [22, 29]); size++; } }
}

function startNextSeason(L) {
  if (L.phase !== 'offseason') return 'Finish the draft first.';
  closeFreeAgency(L);
  clearIR(L);
  progress(L);
  L.year++;
  L.phase = 'preseason';
  applyEvents(L);
  enterUndrafted(L, L.year);
  // a new team that left positions empty gets free-agent fill-ins so it can line up
  for (const t of L.teams) { if (t.expY !== L.year) continue; const have = groupCounts(L, t.id); for (const g of GRPS) while (have[g] < STARTERS[g]) { genPlayer(L, g, t.id, 50, [23, 30]); have[g]++; } }
  archiveBoxes(L);
  L.teams.forEach(t => { t.w = t.l = t.t = t.pf = t.pa = 0; });
  L.playoffs = null; L.schedule = []; L.week = 0;
  if (L.dead) for (const k in L.dead) for (const yy in L.dead[k]) if (+yy < L.year) delete L.dead[k][yy];
  ensurePicks(L);
  aiTrades(L, R.int(2, 4), 40);
  makeOffers(L, R.int(1, 2), 20);
  aiCutdowns(L); aiSignings(L, true);
  ensureContracts(L);
  aiCapCompliance(L); aiSignings(L, true);
  schemeNews(L);
  psNewSeason(L); aiOptions(L);
  aiStyles(L, true);
  L.phase = 'preseason';
  holdoutCheck(L);
  ensureNumbers(L);
  const r = rules(L.year), p = rules(L.year - 1);
  if (r.games !== p.games && !r.strike && !p.strike) addNews(L, `The regular season is now ${r.games} games.`);
  if (r.playoffPerConf !== p.playoffPerConf && !r.strike && !p.strike) addNews(L, `The playoffs expand to ${r.playoffPerConf} teams per conference.`);
  if (r.rosterMax !== p.rosterMax) addNews(L, `Roster limit changes to ${r.rosterMax}.`);
  if (r.regOT && !p.regOT) addNews(L, 'Sudden-death overtime now applies to regular-season games.');
  if (faEra(L.year) !== faEra(L.year - 1)) addNews(L, `New labor rules: ${ERA_INFO[faEra(L.year)].name}.`);
  if (capFor(L.year) != null && capFor(L.year - 1) == null) addNews(L, `The salary cap ${L.year === 1994 ? 'arrives' : 'returns'}: ${money(capFor(L.year))} per team.`);
  addNews(L, `Training camp opens for the ${L.year} season.`);
  return null;
}

/* ---------- contracts, salary cap & free agency ---------- */
// Salary figures are in thousands of dollars.
// Real salary caps (millions). 2010 was an uncapped year. Later years grow 7% a year.
const CAP = { 1994: 34.6, 1995: 37.1, 1996: 40.753, 1997: 41.454, 1998: 52.388, 1999: 57.288, 2000: 62.172, 2001: 67.405, 2002: 71.101, 2003: 75.007,
  2004: 80.582, 2005: 85.5, 2006: 102, 2007: 109, 2008: 116, 2009: 123, 2011: 120.375, 2012: 120.6, 2013: 123, 2014: 133, 2015: 143.28,
  2016: 155.27, 2017: 167, 2018: 177.2, 2019: 188.2, 2020: 198.2, 2021: 182.5, 2022: 208.2, 2023: 224.8, 2024: 255.4, 2025: 279.2 };
function capFor(y) {
  if (y < 1994 || y === 2010) return null;
  if (CAP[y]) return CAP[y] * 1000;
  return CAP[2025] * 1000 * Math.pow(1.07, y - 2025);
}
// Approximate average player salary before the cap era (thousands).
const AVG_PRE = [[1970, 25], [1974, 38], [1977, 55], [1980, 80], [1982, 95], [1984, 165], [1986, 200], [1988, 240], [1990, 350], [1992, 490], [1993, 650]];
function avgSalary(y) {
  if (y >= 1994) return (capFor(y) || capFor(y - 1) || capFor(2009)) * 0.9 / 53;
  if (y <= AVG_PRE[0][0]) return AVG_PRE[0][1];
  for (let i = 1; i < AVG_PRE.length; i++) {
    const [y1, v1] = AVG_PRE[i - 1], [y2, v2] = AVG_PRE[i];
    if (y <= y2) return v1 + (v2 - v1) * (y - y1) / (y2 - y1);
  }
  return AVG_PRE[AVG_PRE.length - 1][1];
}
// The season whose payroll and rules apply right now (after the season ends, it's next season's).
function capYear(L) { return (L.phase === 'season-over' || L.phase === 'draft' || L.phase === 'offseason') ? L.year + 1 : L.year; }
function faEra(y) { return y <= 1976 ? 'rozelle' : (y <= 1988 ? 'comp' : (y <= 1992 ? 'planb' : 'ufa')); }
const ERA_INFO = {
  rozelle: { name: 'Rozelle Rule', text: 'A team that signs another club\'s player owes compensation set by the commissioner, so players re-sign with their own team. Expiring contracts are renewed automatically unless you let a player go.' },
  comp: { name: 'Right of first refusal', text: 'Players with expiring deals can sign offer sheets with other teams. Their team can match, or take draft-pick compensation. Unhandled expiring players re-sign at their asking price.' },
  planb: { name: 'Plan B free agency', text: 'Each team protects 37 players. Unprotected players are free to sign anywhere with no compensation. Expiring contracts still follow right of first refusal.' },
  ufa: { name: 'Unrestricted free agency', text: 'Players with 4 or more seasons whose contracts expire hit the open market unless you re-sign or franchise-tag them. Younger players are restricted and stay at a tender price.' }
};
function multFor(p) { return Math.min(13, Math.max(0.3, Math.pow(1.09, value(p) - 62))); }
function leagueNorm(L) {
  const y = capYear(L);
  if (L._norm && L._norm.y === y && L._norm.n === Object.keys(L.players).length) return L._norm.v;
  let s = 0, n = 0;
  for (const t of L.teams) for (const p of roster(L, t.id)) { s += multFor(p); n++; }
  const v = n ? s / n : 1; L._norm = { y, v, n: Object.keys(L.players).length }; return v;
}
function marketValue(L, p, y) { return Math.max(avgSalary(y || capYear(L)) * 0.3, avgSalary(y || capYear(L)) * multFor(p) / leagueNorm(L)); }
function contractYears(p) { return p.age <= 26 ? 4 : (p.age <= 29 ? 3 : (p.age <= 31 ? 2 : 1)); }
/* Contracts: an average yearly number (sal), split into base salaries by year and a signing bonus.
   The bonus is paid up front but counts against the cap spread evenly over up to five years.
   Cut or trade a player and the bonus not yet counted becomes dead money. Shapes:
   flat (no bonus), std (some bonus, even base), front / back (salary early or late), bonus (max bonus). */
const SHAPES = { flat: { name: 'Flat', share: 0, w: 0, mult: 1 }, std: { name: 'Standard', share: 0.25, w: 0, mult: 1 }, front: { name: 'Front-loaded', share: 0.2, w: -0.35, mult: 1 }, back: { name: 'Back-loaded', share: 0.25, w: 0.35, mult: 1.04 }, bonus: { name: 'Max bonus', share: 0.5, w: 0.2, mult: 0.96 } };
function autoShape(sal, yrs, y) {
  if (yrs < 2) return 'flat';
  const big = sal >= avgSalary(y) * 1.4;
  if (capFor(y) == null) return big ? 'std' : 'flat';
  return big ? R.pick(['std', 'back', 'back', 'bonus', 'front']) : sal >= avgSalary(y) * 0.8 ? R.pick(['std', 'flat', 'back']) : 'flat';
}
function proYear(con, y) { let s = 0; (con.bon || []).forEach(b => { if (y >= b.f && y < b.f + b.n) s += b.a / b.n; }); return s; }
function proLeft(con, y) { let s = 0; (con.bon || []).forEach(b => { for (let yy = Math.max(y, b.f); yy < b.f + b.n; yy++) s += b.a / b.n; }); return Math.round(s); }
function baseFor(p, y) { const c = p.con; if (!c || y > c.exp) return null; return c.base ? c.base[y - c.signed] : c.sal; }
function cashFor(p, y) { const c = p.con; if (!c) return 0; const b = baseFor(p, y); let s = b == null ? (c.ext && y <= c.ext.exp ? c.ext.sal : 0) : b; (c.bon || []).forEach(x => { if (x.f === y && x.cur) s += x.a; }); return Math.round(s); }
function setContract(p, sal, firstYear, yrs, shape) {
  const old = p.con, carry = old && old.bon ? old.bon.filter(b => b.f + b.n - 1 >= firstYear).map(b => Object.assign({}, b, { cur: 0 })) : [];
  shape = SHAPES[shape] ? shape : autoShape(sal, yrs, firstYear);
  const S = SHAPES[shape], total = Math.round(sal) * yrs * S.mult, bonus = Math.round(total * S.share), n = Math.min(5, yrs);
  const ws = []; for (let i = 0; i < yrs; i++) ws.push(yrs === 1 ? 1 : 1 + S.w * (i / (yrs - 1) - 0.5) * 2);
  const wsum = ws.reduce((a, b) => a + b, 0), base = ws.map(w => Math.round((total - bonus) * w / wsum));
  p.con = { sal: Math.round(total / yrs), exp: firstYear + yrs - 1, signed: firstYear, base, shape, bon: carry.concat(bonus ? [{ a: bonus, f: firstYear, n, cur: 1 }] : []) };
  p.mor = Math.max(mor(p), 70); delete p.holdout; }
function salFor(p, y) {
  if (!p || !p.con) return null;
  if (y <= p.con.exp) return p.con.base ? Math.round(p.con.base[y - p.con.signed] + proYear(p.con, y)) : p.con.sal;
  if (p.con.ext && y <= p.con.ext.exp) return p.con.ext.sal;
  return null;
}
function onBooks(p, y) { return salFor(p, y) != null; }
function payroll(L, tid, y) { y = y || capYear(L); return roster(L, tid).reduce((s, p) => s + (salFor(p, y) || 0), 0) + deadFor(L, tid, y) + psPayroll(L, tid, y); }
// Practice-squad pay counts against the cap (it has since the cap began). It's about a quarter of the
// league minimum (2025: $13,000 a week for 18 weeks vs. an $840,000 minimum), and only for the current season.
function minSalary(y) { return Math.round(avgSalary(y) * 0.3); }
function psPay(y) { return capFor(y) != null ? Math.round(minSalary(y) * 0.28) : 0; }
function psCounts(L, y) { return y === capYear(L) && psPay(y) > 0 && !(L.phase === 'offseason' || L.phase === 'draft' || L.phase === 'season-over'); }
function psPayroll(L, tid, y) { if (!psCounts(L, y)) return 0; let n = 0; for (const id in L.players) { const p = L.players[id]; if (p.team === tid && p.ps) n++; } return n * psPay(y); }
// Before the salary cap (and in uncapped 2010) the owner sets your spending limit:
// 15% above the league's average payroll, a little more in the biggest markets.
const BIG_MARKETS = /^(nyg|nyj|ram|rai|chi|sfo|dal|phi|was)$/;
function budgetFor(L, y) {
  y = y || capYear(L); if (capFor(y) != null) return null;
  let tot = 0, n = 0; const per = {};
  for (const id in L.players) { const p = L.players[id]; if (p.team >= 0 && p.team !== L.user) per[p.team] = (per[p.team] || 0) + (salFor(p, y) || 0); }
  for (const k in per) { tot += per[k]; n++; }
  if (!n) return null;
  const t = L.teams[L.user]; if (!t) return null; const last = t.hist[t.hist.length - 1];
  const mkt = BIG_MARKETS.test(t.pfr) ? 1.08 : 1, win = last && last.res && last.res !== 'Missed playoffs' ? 1.04 : 1;
  return Math.round(tot / n * 1.15 * mkt * win);
}
// Under a budget, your own unsigned players count at their asking price until you let them go,
// so you can't spend the money on outsiders first and then re-sign your own on top of it.
function committedPay(L, y) {
  y = y || capYear(L);
  let s = payroll(L, L.user, y);
  if (L.phase === 'offseason' || L.phase === 'draft' || L.phase === 'season-over') for (const p of expiring(L, L.user)) s += resignPrice(L, p) || 0;
  return s;
}
function limitFor(L, tid, y) { y = y || capYear(L); const c = capFor(y); return c != null ? c : (tid === L.user ? budgetFor(L, y) : null); }
function capSpace(L, tid, y) { const c = limitFor(L, tid, y); return c == null ? Infinity : c - payroll(L, tid, y); }
function capMsg(L, tid, adding, own) {
  const y = capYear(L), cap = capFor(y);
  if (cap == null && (tid !== L.user || own || adding <= 0)) return null; // re-signing your own players never breaks the budget
  // a move that doesn't add salary never breaks the cap: a team that's over can always shed money to get legal
  if (adding <= 0) return null;
  const c = cap != null ? cap : budgetFor(L, y); if (c == null) return null;
  const now = cap == null ? committedPay(L, y) : payroll(L, tid, y), after = now + adding;
  if (after <= c) return null;
  if (cap == null) return `The owner won't spend that much: it would put your ${y} payroll at ${money(after)}, over his budget of ${money(c)}.`;
  return `That would put ${tid === L.user ? 'you' : L.teams[tid].city} at ${money(after)}, over the ${y} cap of ${money(c)}.`;
}
function money(k) { return k >= 1000 ? '$' + (k / 1000).toFixed(k >= 10000 ? 1 : 2).replace(/\.?0+$/, '') + 'M' : '$' + Math.round(k) + 'K'; }
function expiring(L, tid) { const y = capYear(L); return roster(L, tid).filter(p => !onBooks(p, y)); }
function userAskMult(L) {
  if (!L.teams[L.user]) return 1;
  const t = L.teams[L.user], last = t.hist[t.hist.length - 1];
  const wp = last ? (last.w + last.t / 2) / Math.max(1, last.w + last.l + last.t) : 0.5;
  return (1 + (0.5 - wp) * 0.3) * ({ rookie: 0.9, pro: 1, allpro: 1.1 }[L.diff] || 1);
}
// Rookie deals: big money for top picks until the 2011 rookie wage scale.
// Rookie deals by era: since 2011 every rookie signs for 4 years and first-rounders carry a
// fifth-year team option; 1993-2010 first-rounders signed longer deals.
function rookieYears(year, rnd) { return year >= 2011 ? 4 : year >= 1993 ? (rnd === 1 ? 5 : rnd === 2 ? 4 : 3) : (rnd === 1 ? 4 : 3); }
function rookieDeal(L, p, year, overall, rnd) {
  const top = year >= 2011 ? 2.6 : 4.5;
  const sal = avgSalary(year) * (0.35 + top * Math.exp(-(overall - 1) / 18));
  setContract(p, sal, year, rookieYears(year, rnd));
  if (year >= 2011 && rnd === 1) p.con.opt = true;
}
// Fifth-year option: decided before the last year of a 2011+ first-round rookie deal.
function optionInfo(L, p) {
  if (!p || !p.con || !p.con.opt || p.con.ext || L.phase === 'regular' || L.phase === 'playoffs') return null;
  const y = capYear(L); if (y !== p.con.exp) return null;
  return { sal: Math.round(marketValue(L, p, y + 1) * 0.95), year: y + 1 };
}
function exerciseOption(L, pid) {
  const p = L.players[pid], o = optionInfo(L, p); if (!o) return 'No fifth-year option to pick up.';
  if (p.team === L.user) { const lim = limitFor(L, L.user, o.year); if (lim != null && payroll(L, L.user, o.year) + o.sal > lim) return `That would put you over the ${o.year} limit.`; }
  p.con.ext = { sal: o.sal, exp: o.year }; delete p.con.opt;
  addNews(L, `${L.teams[p.team].abbr} picked up ${p.pos} ${p.name}'s fifth-year option: ${money(o.sal)} for ${o.year}.`);
  return null;
}
function declineOption(L, pid) { const p = L.players[pid]; if (p && p.con) delete p.con.opt; return null; }
function aiOptions(L) {
  for (const id in L.players) { const p = L.players[id]; if (p.team < 0 || p.team === L.user || !p.con || !p.con.opt) continue; if (!optionInfo(L, p)) continue; if (value(p) >= 68) exerciseOption(L, p.id); else delete p.con.opt; }
}
function ensureContracts(L) {
  const y = capYear(L);
  for (const t of L.teams) for (const p of roster(L, t.id)) {
    if (p.con && p.con.ext && p.con.exp < y) p.con = { sal: p.con.ext.sal, exp: p.con.ext.exp, signed: p.con.exp + 1 };
    if (!p.con) setContract(p, marketValue(L, p, y) * (0.85 + Math.random() * 0.3), y, R.int(1, 4));
  }
}
function retireIfUnsigned(L, p) { p.team = -1; delete p.con; }

// How much a player likes a team: record, scheme, role, familiarity. Positive = he'll take less.
const SCHEME_FIT = {
  QB: { off: { pass: 0.06, run: -0.06 } }, WR: { off: { pass: 0.06, run: -0.06 } }, TE: { off: { pass: 0.03, run: -0.02 } },
  RB: { off: { run: 0.06, pass: -0.04 } }, OL: { off: { run: 0.03, pass: -0.01 } },
  DL: { def: { blitz: 0.05, soft: -0.03 } }, LB: { def: { blitz: 0.04, soft: -0.02 } }, DB: { def: { soft: 0.05, blitz: -0.03 } }
};
const OFF_TXT = { run: 'run-first offense', bal: 'balanced offense', pass: 'pass-first offense' };
const DEF_TXT = { soft: "bend-don't-break defense", bal: 'base defense', blitz: 'blitzing defense' };
// Per-team snapshot (payroll, size, ratings by position) so a free-agency round stays fast.
function teamCache(L, y) {
  const c = {};
  for (const t of L.teams) c[t.id] = { pay: deadFor(L, t.id, y), size: 0, g: {} };
  for (const id in L.players) {
    const p = L.players[id], e = c[p.team]; if (!e) continue;
    e.pay += salFor(p, y) || 0; e.size++; (e.g[p.grp] = e.g[p.grp] || []).push(p.ovr);
  }
  for (const k in c) for (const g in c[k].g) c[k].g[g].sort((a, b) => b - a);
  return c;
}
function fitFor(L, p, tid, cache) {
  const t = L.teams[tid], last = t.hist[t.hist.length - 1], reasons = [];
  let v = 0;
  const wp = last ? (last.w + last.t / 2) / Math.max(1, last.w + last.l + last.t) : 0.5;
  const rec = 0.3 * (wp - 0.5); v += rec;
  if (wp >= 0.6) reasons.push(['+', 'likes that you win']); else if (wp <= 0.4) reasons.push(['-', 'worried about your record']);
  const so = SCHEME[t.coach.os], sd2 = SCHEME[t.coach.ds], F = startersFor(L, tid), isDef = ['DL', 'LB', 'DB'].includes(p.grp), sch = isDef ? sd2 : so;
  if (sch && p.grp !== 'K' && p.grp !== 'P') {
    const w = (sch.w || {})[p.grp] || 1;
    if (!F[p.grp]) { v -= 0.12; reasons.push(['-', `no role in your ${sch.name}`]); }
    else if (w >= 1.15) { v += 0.07; reasons.push(['+', `key position in your ${sch.name}`]); }
    else if (w <= 0.85) { v -= 0.04; reasons.push(['-', `not a focus of your ${sch.name}`]); }
  }
  const sf = SCHEME[t.coach.os] ? null : SCHEME_FIT[p.grp];
  if (sf && sf.off) { const x = sf.off[t.coach.off] || 0; v += x; if (x > 0) reasons.push(['+', 'fits your ' + OFF_TXT[t.coach.off]]); if (x < 0) reasons.push(['-', 'doesn\'t fit your ' + OFF_TXT[t.coach.off]]); }
  if (sf && sf.def) { const x = sf.def[t.coach.def] || 0; v += x; if (x > 0) reasons.push(['+', 'fits your ' + DEF_TXT[t.coach.def]]); if (x < 0) reasons.push(['-', 'doesn\'t fit your ' + DEF_TXT[t.coach.def]]); }
  if (p.grp !== 'K' && p.grp !== 'P') {
    let others;
    if (cache) { others = (cache[tid].g[p.grp] || []).slice(); if (p.team === tid) { const i = others.indexOf(p.ovr); if (i >= 0) others.splice(i, 1); } }
    else others = roster(L, tid).filter(x => x.grp === p.grp && x.id !== p.id).map(x => x.ovr).sort((a, b) => b - a);
    const nS = Math.max(1, startersFor(L, tid)[p.grp]), bar = others[nS - 1] || 0;
    if (p.ovr > bar) { v += 0.08; reasons.push(['+', 'would start']); } else { v -= 0.06; reasons.push(['-', 'would be a backup']); }
  }
  if (p.team === tid || p.prevTeam === tid) { v += 0.05; reasons.push(['+', 'loyal to your team']); }
  if (p.team === tid) { const m = mor(p); v += (m - 60) / 300; if (m < 35) reasons.push(['-', 'unhappy with you']); else if (m >= 80) reasons.push(['+', 'happy here']); }
  if (tid === L.user) v += ({ rookie: 0.05, pro: 0, allpro: -0.05 }[L.diff] || 0);
  return { v, reasons };
}
// What he asks from a given team: market value, adjusted by how much he likes them.
function priceFor(L, p, tid, y) { return Math.round(marketValue(L, p, y) * clamp(1.08 - fitFor(L, p, tid).v, 0.75, 1.4)); }
function baseAsk(L, p) { return marketValue(L, p, capYear(L)) * (p.askMult || 1); }
function offerScore(L, p, tid, sal, yrs, cache) {
  const want = contractYears(p), yf = 1 + (p.age >= 30 ? 0.06 : 0.03) * clamp(yrs - want, -3, 3);
  return sal / baseAsk(L, p) * yf + fitFor(L, p, tid, cache).v;
}
const FA_ROUNDS = 3, ROUND_MIN = [1.0, 0.92, 0.84], ROUND_DISC = [1, 0.92, 0.85];
function interestedTeams(L, p, cache) {
  const y = capYear(L), cap = capFor(y), ask = baseAsk(L, p);
  cache = cache || teamCache(L, y);
  return L.teams.filter(t => {
    if (t.id === L.user) return false;
    if (cap != null && cache[t.id].pay + ask * 0.9 > cap) return false;
    const others = cache[t.id].g[p.grp] || [];
    const nS = Math.max(1, startersFor(L, t.id)[p.grp]);
    const bar = others[nS] != null ? others[nS - 1] : 0;
    return p.ovr >= bar - 2 || others.length < nS + 1;
  });
}
function isMarketFA(p) { return p.team === -1 && p.retiredYear == null; }
function placeBid(L, pid, sal, yrs) {
  ensureFA(L); const F = L.fa, p = L.players[pid], y = capYear(L);
  if (!F || F.era !== 'ufa' || F.round > FA_ROUNDS) return 'Bidding is closed.';
  if (!p || !isMarketFA(p)) return 'He is not on the market.';
  F.bids = F.bids || {};
  const others = Object.entries(F.bids).filter(([id]) => +id !== pid).reduce((s, [, b]) => s + b.sal, 0);
  const cap = limitFor(L, L.user, y);
  if (cap != null && payroll(L, L.user, y) + others + sal > cap) return `Your bids would total more than your ${capFor(y) != null ? 'cap space' : "owner's budget"} (${money(cap - payroll(L, L.user, y))} left).`;
  F.bids[pid] = { sal: Math.round(sal), yrs: clamp(yrs, 1, 5) }; return null;
}
function withdrawBid(L, pid) { if (L.fa && L.fa.bids) delete L.fa.bids[pid]; }
function bidOutlook(L, pid) {
  const p = L.players[pid], b = L.fa && L.fa.bids && L.fa.bids[pid]; if (!p || !b) return null;
  const v = marketView(L, pid, b.sal, b.yrs), mine = v.offers.find(o => o.tid === L.user), sc = mine.score, n = v.count - 1;
  const label = sc < v.min ? 'Below what he will accept' : v.rank === 1 ? (n ? 'Leading right now' : 'Strong offer, no one else bidding') : `Ranked ${v.rank} of ${v.count}: raise it to lead`;
  return { score: sc, teams: n, rank: v.rank, label };
}
// The market: which AI teams plan to bid on a free agent in the coming round, and roughly how much.
// Decided ahead of time so you can see it; the real bids land within about 4% of these.
const MKT_CACHE = new WeakMap();
function marketFor(L, pid, round) {
  ensureFA(L); const F = L.fa, p = L.players[pid]; if (!F || F.era !== 'ufa' || !p) return [];
  const rr = round || Math.min(FA_ROUNDS, (F.round || 0) + 1); // the round about to be played
  if (!F.mkt || F.mkt.r !== rr) F.mkt = { r: rr, b: {} };
  if (F.mkt.b[pid]) return F.mkt.b[pid];
  const y = capYear(L), cap = capFor(y), max = rules(y).rosterMax;
  let C = MKT_CACHE.get(F); if (!C || C.r !== rr) { C = { r: rr, c: teamCache(L, y) }; MKT_CACHE.set(F, C); }
  const ask = baseAsk(L, p), out = [];
  const teams = interestedTeams(L, p, C.c).sort(() => Math.random() - 0.5).slice(0, value(p) >= 75 ? 5 : 3);
  for (const t of teams) {
    if (t.id === p.team) continue;
    if (C.c[t.id].size >= max + 8) continue;
    const sal = Math.round(ask * (0.85 + Math.random() * 0.35) * ROUND_DISC[rr - 1]), yrs = clamp(contractYears(p) + R.int(-1, 1), 1, 5);
    if (cap != null && C.c[t.id].pay + sal > cap) continue;
    out.push({ tid: t.id, sal, yrs });
  }
  F.mkt.b[pid] = out;
  return out;
}
// Where a bid of yours would stand against the market: rank among all offers by how the player sees them.
function marketView(L, pid, sal, yrs) {
  const p = L.players[pid], m = marketFor(L, pid);
  const all = m.map(b => ({ tid: b.tid, sal: b.sal, yrs: b.yrs, score: offerScore(L, p, b.tid, b.sal, b.yrs) }));
  let mine = null;
  if (sal) { mine = { tid: L.user, sal, yrs, score: offerScore(L, p, L.user, sal, yrs) }; all.push(mine); }
  all.sort((a, b) => b.score - a.score);
  const r = Math.min(FA_ROUNDS, ((L.fa && L.fa.round) || 0) + 1); // judged by the round about to be played
  return { offers: all, rank: mine ? all.indexOf(mine) + 1 : null, count: all.length, min: ROUND_MIN[r - 1] };
}
function resolveRound(L) {
  const F = L.fa, y = capYear(L), cap = capFor(y), r = F.round, max = rules(y).rosterMax;
  const all = freeAgents(L).filter(p => isMarketFA(p) && !isCareer(L, p)).sort((a, b) => value(b) - value(a));
  // the top of the market, plus anyone you bid on
  const pool = all.slice(0, 220).concat(all.slice(220).filter(p => F.bids && F.bids[p.id]));
  const signed = [], C = teamCache(L, y), ulim = limitFor(L, L.user, y);
  if (F.mkt && F.mkt.r !== r) F.mkt = null;
  for (const p of pool) {
    const bids = [];
    for (const m of marketFor(L, p.id, r)) {
      if (C[m.tid].size >= max + 8) continue;
      const sal = Math.round(m.sal * (0.96 + Math.random() * 0.08));
      if (cap != null && C[m.tid].pay + sal > cap) continue;
      bids.push({ tid: m.tid, sal, yrs: m.yrs });
    }
    const ub = F.bids && F.bids[p.id];
    if (ub && (ulim == null || C[L.user].pay + ub.sal <= ulim)) bids.push({ tid: L.user, sal: ub.sal, yrs: ub.yrs });
    if (!bids.length) { p.askMult = (p.askMult || 1) * 0.92; continue; }
    bids.forEach(b => b.score = offerScore(L, p, b.tid, b.sal, b.yrs, C));
    bids.sort((a, b) => b.score - a.score);
    const best = bids[0];
    const userIn = bids.some(b => b.tid === L.user);
    if (best.score < ROUND_MIN[r - 1]) { p.askMult = (p.askMult || 1) * 0.92; if (userIn) addNews(L, `${p.pos} ${p.name} turned down every offer this round, including yours.`); continue; }
    const from = p.prevTeam;
    noteFASign(L, p, best.tid);
    plog(L, p, `Signed with ${L.teams[best.tid].abbr} as a free agent: ${best.yrs} yr${best.yrs > 1 ? 's' : ''}, ${money(best.sal)} a year.`);
    p.team = best.tid; setContract(p, best.sal, y, best.yrs); delete p.askMult;
    if (best.tid === L.user) lockNewSigning(L, p);
    const ce = C[best.tid]; ce.pay += best.sal; ce.size++; (ce.g[p.grp] = ce.g[p.grp] || []).push(p.ovr); ce.g[p.grp].sort((a, b) => b - a);
    signed.push({ pid: p.id, tid: best.tid, sal: best.sal, yrs: best.yrs, bidders: bids.map(b => b.tid) });
    if (userIn || from === L.user || value(p) >= 72) {
      const others = bids.filter(b => b.tid !== best.tid).map(b => L.teams[b.tid].abbr);
      addNews(L, `FREE AGENCY: ${p.pos} ${p.name}${from != null && L.teams[from] ? ' (formerly ' + L.teams[from].abbr + ')' : ''} signs with ${L.teams[best.tid].abbr}, ${best.yrs} yrs at ${money(best.sal)}.${others.length ? ' Also bid: ' + others.join(', ') + '.' : ''}`);
    }
  }
  if (F.bids) for (const id in F.bids) if (!L.players[id] || !isMarketFA(L.players[id])) delete F.bids[id];
  F.last = signed;
  F.mkt = null; // next round's market forms fresh
}
// Opening the market: unhandled unrestricted players leave; restricted ones take their tender.
function startMarket(L) {
  transitionSheets(L);
  const y = capYear(L);
  for (const p of expiring(L, L.user)) {
    if (isRestricted(L, p)) { setContract(p, tenderPrice(L, p), y, 1); continue; }
    p.prevTeam = L.user; retireIfUnsigned(L, p);
    addNews(L, `${p.pos} ${p.name} hits the open market.`);
  }
}
function advanceFA(L) {
  ensureFA(L); const F = L.fa;
  if (F.era !== 'ufa') return 'Bidding rounds start in 1993.';
  if (F.round > FA_ROUNDS) return 'Free agency is over for this year.';
  if (F.round === 0) startMarket(L);
  F.round++;
  resolveRound(L);
  if (F.round >= FA_ROUNDS) F.round = FA_ROUNDS + 1;
  return null;
}
// Extensions: re-sign a player in the last year of his deal before he reaches free agency.
function extInfo(L, p) {
  const y = capYear(L);
  if (!p || p.team !== L.user || !p.con || p.con.ext || p.con.exp !== y) return null;
  if (faEra(y + 1) !== 'ufa') return null;
  const ny = y + 1, fit = fitFor(L, p, L.user);
  return { from: ny, yrs: contractYears(Object.assign({}, p, { age: p.age + 1 })), sal: priceFor(L, p, L.user, ny), fit };
}
function extend(L, pid) {
  const p = L.players[pid], x = extInfo(L, p); if (!x) return 'He is not in the last year of his contract.';
  const cap = capFor(x.from);
  if (cap != null && payroll(L, L.user, x.from) + x.sal > cap) return `That would put your ${x.from} payroll over the ${money(cap)} cap.`;
  p.con.ext = { sal: x.sal, exp: x.from + x.yrs - 1 }; plog(L, p, `Extended through ${x.from + x.yrs - 1} at ${money(x.sal)} a year.`);
  addNews(L, `${L.teams[L.user].abbr} extended ${p.pos} ${p.name}: ${x.yrs} yrs at ${money(x.sal)} starting in ${x.from}.`);
  return null;
}

// Called when the offseason opens (after the draft).
function openFreeAgency(L) {
  ensureContracts(L);
  const y = capYear(L), era = faEra(y), cap = capFor(y);
  L.fa = { y, era, tagged: null, ttagged: null, sheets: [], done: {}, protect: null, round: 0, bids: {} };
  // AI teams handle their own expiring players.
  for (const t of L.teams) {
    if (t.id === L.user) continue;
    const exp = expiring(L, t.id);
    if (!exp.length) continue;
    const keepN = rules(y).rosterMax + 3;
    const ranked = roster(L, t.id).slice().sort((a, b) => value(b) - value(a));
    for (const p of exp) {
      if (isCareer(L, p)) continue;
      const rank = ranked.indexOf(p), ask = marketValue(L, p, y);
      let keep = rank < keepN && p.age < 35;
      if (era === 'ufa' && keep && (p.yrs || 0) >= 4) keep = Math.random() < 0.6 && (cap == null || payroll(L, t.id, y) + ask <= cap * 0.97);
      if (era === 'comp' && keep && value(p) >= 72 && Math.random() < 0.5) continue; // leave a few stars unsigned: offer-sheet targets
      if (keep) setContract(p, ask, y, contractYears(p));
      else { p.prevTeam = t.id; retireIfUnsigned(L, p); if (era === 'ufa' && value(p) >= 70) addNews(L, `${p.pos} ${p.name} hits free agency after leaving ${t.abbr}.`); }
    }
  }
  // Right of first refusal era: rival clubs occasionally send offer sheets to your stars.
  if (era === 'comp' || era === 'planb') {
    for (const p of expiring(L, L.user)) {
      if (value(p) < 72 || Math.random() > 0.2) continue;
      const from = R.pick(L.teams.filter(t => t.id !== L.user)).id;
      L.fa.sheets.push({ pid: p.id, from, sal: Math.round(marketValue(L, p, y) * (1.2 + Math.random() * 0.3)), yrs: contractYears(p) });
      addNews(L, `${L.teams[from].city} signed your ${p.pos} ${p.name} to an offer sheet. Match it or take compensation.`);
    }
  }
  if (era === 'planb') {
    L.fa.protect = roster(L, L.user).slice().sort((a, b) => value(b) - value(a)).slice(0, 37).map(p => p.id);
    L.fa.aiProtect = {};
    for (const t of L.teams) if (t.id !== L.user) L.fa.aiProtect[t.id] = roster(L, t.id).slice().sort((a, b) => value(b) - value(a)).slice(0, 37).map(p => p.id);
  }
  addNews(L, `${y} offseason: ${ERA_INFO[era].name}.${cap != null ? ` The salary cap is ${money(cap)}.` : (y === 2010 ? ' 2010 is an uncapped year.' : '')}`);
}
function ensureFA(L) { if (L.phase === 'offseason' && (!L.fa || L.fa.y !== capYear(L))) openFreeAgency(L); if (L.fa) { if (L.fa.round == null) L.fa.round = 0; if (!L.fa.bids) L.fa.bids = {}; } }

function askPrice(L, p) {
  const y = capYear(L), base = marketValue(L, p, y);
  return Math.round(base * (p.team === L.user ? 1 : userAskMult(L)));
}
function resignPrice(L, p) { return faEra(capYear(L)) === 'ufa' ? priceFor(L, p, L.user, capYear(L)) : askPrice(L, p); }
function tenderPrice(L, p) { return Math.round(marketValue(L, p, capYear(L)) * 0.75); }
function isRestricted(L, p) { return faEra(capYear(L)) === 'ufa' && (p.yrs || 0) < 4; }
function compPicks(L, sal) {
  const r = sal / avgSalary(capYear(L));
  const rounds = r >= 4 ? [1, 1] : (r >= 2.5 ? [1] : (r >= 1.5 ? [2] : [3]));
  return rounds;
}
function takePicks(L, from, to, rounds) {
  const got = [];
  for (const rnd of rounds) {
    const k = (L.picks || []).filter(x => x.own === from && x.rnd === rnd && !got.includes(x.id)).sort((a, b) => a.y - b.y)[0]
      || (L.picks || []).filter(x => x.own === from && x.rnd >= rnd && !got.includes(x.id)).sort((a, b) => a.y - b.y || a.rnd - b.rnd)[0];
    if (k) { k.own = to; got.push(k.id); }
  }
  return got.map(id => pickLabel(L, pickById(L, id))).join(' and ');
}
function resign(L, pid) {
  ensureFA(L);
  const p = L.players[pid], y = capYear(L);
  if (!p || p.team !== L.user || onBooks(p, y)) return 'He is not an expiring player on your team.';
  if ((L.fa.sheets || []).some(s => s.pid === pid)) return 'He has an offer sheet. Match it or take the compensation.';
  const sal = isRestricted(L, p) ? tenderPrice(L, p) : resignPrice(L, p);
  const e = capMsg(L, L.user, sal, true); if (e) return e;
  setContract(p, sal, y, contractYears(p)); plog(L, p, `Re-signed with ${L.teams[L.user].abbr}: ${contractYears(p)} yrs, ${money(sal)} a year.`);
  addNews(L, `${L.teams[L.user].abbr} re-signed ${p.pos} ${p.name}: ${contractYears(p)} yrs, ${money(sal)} a year.`);
  return null;
}
function franchiseTag(L, pid) {
  ensureFA(L);
  const p = L.players[pid], y = capYear(L);
  if (faEra(y) !== 'ufa') return 'The franchise tag starts in 1993.';
  if (L.fa.tagged) return 'You already used your franchise tag this year.';
  if (!p || p.team !== L.user || onBooks(p, y)) return 'Only an expiring player on your team can be tagged.';
  const sal = tagPrice(L, p, 'franchise');
  const e = capMsg(L, L.user, sal); if (e) return e;
  setContract(p, sal, y, 1); L.fa.tagged = pid; plog(L, p, `Franchise tag: 1 yr, ${money(sal)}.`);
  p.tags = (p.tags && p.tags.y === y - 1) ? { y, n: p.tags.n + 1, sal } : { y, n: 1, sal };
  addNews(L, `${L.teams[L.user].abbr} placed the franchise tag on ${p.pos} ${p.name}: 1 yr, ${money(sal)}${p.tags.n > 1 ? ` (tag number ${p.tags.n}, at a raise)` : ''}.`);
  return null;
}
// Tag prices: the franchise tag is the average of the top 5 salaries at his position, the transition
// tag the top 10. Tagging the same player again costs 120% of last year's tag, a third time 144%.
function tagPrice(L, p, kind) {
  const y = capYear(L), n = kind === 'transition' ? 10 : 5;
  const top = Object.values(L.players).filter(x => x.grp === p.grp && x.team >= 0 && onBooks(x, y)).map(x => salFor(x, y)).sort((a, b) => b - a).slice(0, n);
  let sal = Math.max(marketValue(L, p, y) * (kind === 'transition' ? 1.05 : 1.15), top.length ? top.reduce((a, b) => a + b, 0) / top.length : 0);
  if (kind === 'franchise' && p.tags && p.tags.y === y - 1) sal = Math.max(sal, p.tags.sal * (p.tags.n >= 2 ? 1.44 : 1.2));
  return Math.round(sal);
}
// Transition tag (1993 on): a one-year deal, but other teams can still sign him to an offer sheet;
// you can match it, and if you don't he leaves with no compensation.
function transitionTag(L, pid) {
  ensureFA(L);
  const p = L.players[pid], y = capYear(L);
  if (faEra(y) !== 'ufa') return 'The transition tag starts in 1993.';
  if (L.fa.ttagged) return 'You already used your transition tag this year.';
  if (!p || p.team !== L.user || onBooks(p, y)) return 'Only an expiring player on your team can be tagged.';
  const sal = tagPrice(L, p, 'transition');
  const e = capMsg(L, L.user, sal); if (e) return e;
  setContract(p, sal, y, 1); L.fa.ttagged = pid; p.trans = y; plog(L, p, `Transition tag: 1 yr, ${money(sal)}.`);
  addNews(L, `${L.teams[L.user].abbr} placed the transition tag on ${p.pos} ${p.name}: 1 yr, ${money(sal)}. Other teams can still make him an offer.`);
  return null;
}
// When the market opens, the best outside offer for a transition-tagged player becomes an offer sheet.
function transitionSheets(L) {
  const y = capYear(L);
  for (const p of roster(L, L.user)) {
    if (p.trans !== y) continue;
    // a team with cap room where he'd start may go over the tag price to pry him loose
    const tag = salFor(p, y) || 0, sal = Math.round(tag * (1.1 + Math.random() * 0.2));
    if (value(p) < 70 || Math.random() > 0.5) continue;
    const cands = L.teams.filter(t => t.id !== L.user && capSpace(L, t.id, y) > sal && playerFit(L, p, t.id).why.some(w => /Would start/.test(w[1])));
    if (!cands.length) continue;
    const best = { tid: R.pick(cands).id };
    L.fa.sheets.push({ pid: p.id, from: best.tid, sal, yrs: R.int(3, 5), trans: true });
    addNews(L, `${L.teams[best.tid].city} signed your transition-tagged ${p.pos} ${p.name} to an offer sheet. Match it or let him go.`);
  }
}
function letGo(L, pid) {
  const p = L.players[pid]; if (!p || p.team !== L.user) return 'He is not on your team.';
  L.fa.sheets = (L.fa.sheets || []).filter(s => s.pid !== pid);
  addNews(L, `${L.teams[L.user].abbr} let ${p.pos} ${p.name} go.`); retireIfUnsigned(L, p); return null;
}
function matchSheet(L, i) {
  const sh = L.fa.sheets[i]; if (!sh) return 'That offer sheet is gone.';
  const p = L.players[sh.pid], e = capMsg(L, L.user, sh.sal, true); if (e) return e;
  setContract(p, sh.sal, capYear(L), sh.yrs); L.fa.sheets.splice(i, 1);
  addNews(L, `${L.teams[L.user].abbr} matched ${L.teams[sh.from].city}'s offer for ${p.pos} ${p.name}.`); return null;
}
function declineSheet(L, i) {
  const sh = L.fa.sheets[i]; if (!sh) return 'That offer sheet is gone.';
  const p = L.players[sh.pid]; p.team = sh.from; setContract(p, sh.sal, capYear(L), sh.yrs); L.fa.sheets.splice(i, 1); delete p.trans;
  if (sh.trans) { addNews(L, `${p.pos} ${p.name} leaves for ${L.teams[sh.from].city}. A transition tag brings no compensation.`); return null; }
  const got = takePicks(L, sh.from, L.user, compPicks(L, sh.sal));
  addNews(L, `${p.pos} ${p.name} leaves for ${L.teams[sh.from].city}. Compensation: ${got || 'none available'}.`); return null;
}
// Comp era: offer sheet to another team's unsigned player.
function sheetTargets(L) { ensureFA(L); const y = capYear(L); return L.teams.filter(t => t.id !== L.user).flatMap(t => expiring(L, t.id)); }
function sendSheet(L, pid) {
  ensureFA(L);
  const p = L.players[pid], y = capYear(L);
  if (!p || p.team < 0 || p.team === L.user || onBooks(p, y)) return 'He is not available for an offer sheet.';
  if (L.fa.done[pid]) return 'His team already decided on your offer.';
  const sal = Math.round(askPrice(L, p) * 1.2), rounds = compPicks(L, sal);
  const owner = p.team, matchP = { rookie: 0.5, pro: 0.7, allpro: 0.85 }[L.diff] || 0.7;
  L.fa.done[pid] = true;
  if (Math.random() < matchP) { setContract(p, Math.round(sal), y, contractYears(p)); addNews(L, `${L.teams[owner].abbr} matched your offer sheet for ${p.pos} ${p.name}.`); return `${L.teams[owner].city} matched. He stays there.`; }
  const roundsTxt = takePicks(L, L.user, owner, rounds);
  p.team = L.user; setContract(p, sal, y, contractYears(p)); lockNewSigning(L, p);
  addNews(L, `${L.teams[L.user].abbr} landed ${p.pos} ${p.name} on an offer sheet (${money(sal)} a year). ${L.teams[owner].abbr} receive ${roundsTxt || 'no picks'}.`);
  return null;
}
// Plan B
function toggleProtect(L, pid) {
  ensureFA(L); const pr = L.fa.protect; if (!pr) return 'Plan B protection runs from 1989 to 1992.';
  const i = pr.indexOf(pid);
  if (i >= 0) pr.splice(i, 1); else { if (pr.length >= 37) return 'You can protect 37 players. Unprotect someone first.'; pr.push(pid); }
  return null;
}
function planBPool(L) { ensureFA(L); if (!L.fa.aiProtect) return []; const out = []; for (const tid in L.fa.aiProtect) { const pr = L.fa.aiProtect[tid]; roster(L, +tid).forEach(p => { if (!pr.includes(p.id)) out.push(p); }); } return out; }
// Signing any free agent (open market or Plan B unprotected).
function signFA(L, pid) {
  ensureFA(L);
  const p = L.players[pid], y = capYear(L), max = rules(L.year).rosterMax;
  const planB = L.phase === 'offseason' && L.fa.aiProtect && p && p.team >= 0 && p.team !== L.user && !L.fa.aiProtect[p.team].includes(p.id);
  if (!p || (p.team !== -1 && !planB)) return 'That player is no longer available.';
  if (L.phase === 'offseason' && L.fa && L.fa.era === 'ufa' && L.fa.round <= FA_ROUNDS) return 'During free agency, place a bid instead. Players choose between offers each round.';
  const inSeason = L.phase === 'regular' || L.phase === 'playoffs';
  if (inSeason && active(L, L.user).length >= max) return `Your active roster is full (${max}). Release someone or use injured reserve.`;
  const sal = askPrice(L, p) * (inSeason ? 0.6 : 1), e = capMsg(L, L.user, sal); if (e) return e;
  const from = p.team;
  p.team = L.user; setContract(p, sal, y, inSeason ? 1 : contractYears(p)); lockNewSigning(L, p);
  plog(L, p, `Signed by ${L.teams[L.user].abbr}${planB ? ' (Plan B)' : ''}: ${money(sal)} a year.`);
  addNews(L, `${L.teams[L.user].abbr} signed ${p.pos} ${p.name}${planB ? ` from ${L.teams[from].abbr} (Plan B)` : ''}: ${p.con.exp - y + 1} yr${p.con.exp > y ? 's' : ''}, ${money(sal)} a year.`);
  return null;
}
// Called from startNextSeason, before players age.
function closeFreeAgency(L) {
  ensureFA(L);
  const y = capYear(L), era = L.fa.era;
  // Offer sheets you ignored: you match by default.
  for (let i = L.fa.sheets.length - 1; i >= 0; i--) if (matchSheet(L, i)) declineSheet(L, i);
  if (era === 'ufa') while (L.fa.round <= FA_ROUNDS) advanceFA(L);
  for (const p of expiring(L, L.user)) {
    if (era === 'ufa' && !isRestricted(L, p)) { addNews(L, `${p.pos} ${p.name} left in free agency.`); retireIfUnsigned(L, p); continue; }
    const sal = isRestricted(L, p) ? tenderPrice(L, p) : askPrice(L, p);
    if (capMsg(L, L.user, sal, true)) { addNews(L, `No cap room to keep ${p.pos} ${p.name}. He left.`); retireIfUnsigned(L, p); continue; }
    setContract(p, sal, y, contractYears(p));
  }
  // AI expiring players left unsigned in the comp era re-sign now.
  for (const t of L.teams) if (t.id !== L.user) for (const p of expiring(L, t.id)) if (!isCareer(L, p)) setContract(p, marketValue(L, p, y), y, contractYears(p));
  if (era === 'planb') {
    const mine = roster(L, L.user).filter(p => !L.fa.protect.includes(p.id));
    for (const p of mine) if (value(p) >= 60 && Math.random() < 0.3) {
      const to = R.pick(L.teams.filter(t => t.id !== L.user)); p.team = to.id; setContract(p, marketValue(L, p, y), y, contractYears(p));
      addNews(L, `Plan B: ${to.city} signed your unprotected ${p.pos} ${p.name}.`);
    }
    for (const p of planBPool(L)) if (Math.random() < 0.15) {
      const to = R.pick(L.teams.filter(t => t.id !== L.user && t.id !== p.team)); p.team = to.id; setContract(p, marketValue(L, p, y), y, contractYears(p));
    }
  }
  // AI teams sign free agents they can afford.
  aiSignings(L, true);
  L.fa = null;
}
function aiCapCompliance(L) {
  const y = L.year, c = capFor(y); if (c == null) return;
  for (const t of L.teams) {
    if (t.id === L.user) continue;
    let over = payroll(L, t.id, y) - c; if (over <= 0) continue;
    const d = depth(L, t.id), st = new Set(), SF = startersFor(L, t.id); GRPS.forEach(g => d[g].slice(0, SF[g]).forEach(p => st.add(p.id)));
    const cand = roster(L, t.id).filter(p => onBooks(p, y)).sort((a, b) => (st.has(a.id) - st.has(b.id)) || (value(a) / salFor(a, y) - value(b) / salFor(b, y)));
    const cut = [];
    for (const p of cand) { if (over <= 0) break; over -= salFor(p, y); cut.push(p); retireIfUnsigned(L, p); }
    if (cut.length) addNews(L, `${t.abbr} released ${cut.length} player${cut.length > 1 ? 's' : ''} to get under the cap.`);
  }
}

/* ---------- leaders ---------- */
// When a class's true ratings show, every scout is judged on the players his team drafted:
// did his grades beat the league consensus? His rating moves with the answer.
function findStaff(L, id) { for (const t of L.teams) for (const r of STAFF_ROLES) { const c = t.staff && t.staff[r]; if (c && c.id === id) return { c, t }; } const c = (L.coachPool || []).find(x => x.id === id); return c ? { c, t: null } : null; }
function scoutReview(L) {
  const by = {};
  for (const id in L.players) { const p = L.players[id]; if (p.scG && p.draft && p.draft.year === L.year && p.scout != null) (by[p.scG.sid] = by[p.scG.sid] || []).push(p); }
  for (const sid in by) {
    const ps = by[sid], f = findStaff(L, +sid); if (!f || ps.length < 2) continue;
    const c = f.c, miss = ps.reduce((a, p) => a + Math.abs(p.scG.pot - p.pot), 0) / ps.length, cons = ps.reduce((a, p) => a + Math.abs(p.scout - p.pot), 0) / ps.length;
    const gain = cons - miss, d = clamp(Math.round((gain - 0.4) * 0.9), -4, 4); // scouts usually beat the consensus a little: only clearly better or worse moves him
    // his best call: the player he liked most more than the consensus did, and who was really that good
    const best = ps.filter(p => p.scG.pot - p.scout >= 4 && p.pot - p.scout >= 4).sort((a, b) => (b.pot - b.scout) - (a.pot - a.scout))[0];
    const worst = ps.filter(p => p.scG.pot - p.pot >= 6).sort((a, b) => (b.scG.pot - b.pot) - (a.scG.pot - a.pot))[0];
    const old = c.r; c.r = clamp(c.r + d, 35, 95); c.sal = c.sal; // salary stays until he's re-hired
    c.rev = (c.rev || []).concat([{ y: L.year, n: ps.length, miss: +miss.toFixed(1), cons: +cons.toFixed(1), d, best: best ? best.name : null, worst: worst ? worst.name : null }]).slice(-6);
    if (f.t && f.t.id === L.user) {
      addNews(L, `Scouting review of your ${L.year} class: ${c.name}'s potential grades were off by ${miss.toFixed(1)} points on average; the league consensus was off by ${cons.toFixed(1)}. ${gain >= 1 ? 'He beat the consensus' : gain <= -1 ? 'He did worse than the consensus' : 'About the same as the consensus'}${best ? `, and his best call was ${best.pos} ${best.name}` : ''}${worst ? `${best ? ';' : '. His'} worst miss was ${worst.pos} ${worst.name}` : ''}. Rating ${d > 0 ? '+' + d : d < 0 ? d : 'unchanged'}${d ? ` (${old} to ${c.r})` : ''}.`);
    }
  }
}
// Halfway through the season your rookies' true ratings show: how close was your scout?
function rookieReveal(L) {
  const rk = roster(L, L.user).filter(p => p.reveal === L.year && !p.seen);
  if (!rk.length) return;
  const sc = L.teams[L.user].staff.sc;
  const lines = rk.sort((a, b) => b.pot - a.pot).slice(0, 6).map(p => { const r = scoutRead(L, L.user, p); return `${p.pos} ${p.name} ${p.ovr}/${p.pot} (scouted ${r.ovr}/${r.pot})`; });
  const miss = rk.reduce((a, p) => a + Math.abs(scoutRead(L, L.user, p).pot - p.pot), 0) / rk.length;
  addNews(L, `Halfway through the season, your rookies' true ratings are in (overall/potential): ${lines.join(', ')}. ${sc ? `${sc.name}'s potential grades were off by ${miss.toFixed(1)} points on average.` : ''}`);
}
// A rookie's true ratings show once he's played half his first season.
function revealWeek(L) { return Math.ceil(rules(L.year).games / 2); }
function potKnown(L, p) {
  if (p.reveal == null || p.seen) return true;
  if (L.year > p.reveal) return true;
  return L.year === p.reveal && (L.phase === 'playoffs' || L.phase === 'season-over' || L.phase === 'draft' || L.phase === 'offseason' || (L.phase === 'regular' && L.week >= revealWeek(L)));
}
// What a team's scouting director thinks a prospect is now (ovr) and will become (pot).
// Each scout has his own consistent misses; a better scout misses by less.
function scoutRead(L, tid, p) {
  const t = L.teams[tid], c = t && t.staff && t.staff.sc, S = scoutSkill(c), e = S.err;
  let h = 2166136261 ^ ((c ? c.id : 7) * 7919) ^ (p.id * 104729);
  const rnd = () => { h += 0x6D2B79F5; let x = h; x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  const nrm = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, rnd()))) * Math.cos(2 * Math.PI * rnd());
  // consensus: the public grade for his ceiling, and his current level read the same way
  const cPot = p.scout != null ? p.scout : p.pot, cOvr = p.ovr + (cPot - p.pot) * 0.6;
  const o = clamp(Math.round(cOvr + Math.min(1, S.skill + 0.2) * (p.ovr - cOvr) + nrm() * e * 0.7), 25, 99);
  const pt = clamp(Math.round(cPot + S.skill * (p.pot - cPot) + nrm() * e), 30, 99);
  return { ovr: o, pot: Math.max(o, pt), err: e, skill: S.skill };
}
function hasScout(L) { return !!(L.teams[L.user] && L.teams[L.user].staff); }
function shownPot(L, p) { return potKnown(L, p) ? p.pot : hasScout(L) ? scoutRead(L, L.user, p).pot : p.scout; }
// his overall as you see it: your scout's read until his true rating shows
function shownOvr(L, p, base) {
  const b = base == null ? p.ovr : base;
  if (potKnown(L, p) || !hasScout(L)) return b;
  return clamp(b + scoutRead(L, L.user, p).ovr - p.ovr, 20, 99);
}

function leaders(L, key, n, year) {
  const y = year || L.year, out = [];
  for (const id in L.players) { const p = L.players[id]; const h = p.hist[y]; if (h && h[key]) out.push({ p, v: h[key] }); }
  return out.sort((a, b) => b.v - a.v).slice(0, n || 10);
}

function myDraftSlots(L) { const D = L.draft; if (!D || !D.slotPick) return []; const out = []; for (let i = D.pick; i < D.slotPick.length; i++) { const k = pickById(L, D.slotPick[i]); if (k && k.own === L.user) out.push(i + 1); } return out; }

/* ---------- Pro Bowl ---------- */
// Each conference names a squad from that season's stats (the same scoring as All-Pro).
const PB_SLOTS = [['QB', 3], ['RB', 3], ['WR', 4], ['TE', 2], ['T', 3], ['G', 3], ['C', 2], ['DE', 3], ['DT', 3], ['LB', 4], ['CB', 4], ['S', 3], ['K', 1], ['P', 1]];
function proBowl(L) {
  const y = L.year, minG = Math.ceil(rules(y).games / 3), out = { AFC: [], NFC: [] };
  const lab = {}; AP_SLOTS.forEach(([s, n, labels]) => lab[s] = labels);
  for (const conf of ['AFC', 'NFC']) {
    const cands = [];
    for (const id in L.players) { const p = L.players[id], h = p.hist[y]; if (h && h.tm != null && L.teams[h.tm] && L.teams[h.tm].conf === conf && (h.g || 0) >= minG) cands.push({ p, h, s: apScore(p, h) }); }
    cands.sort((a, b) => b.s - a.s);
    const used = new Set();
    for (const [slot, n] of PB_SLOTS) {
      let got = cands.filter(c => !used.has(c.p.id) && c.p.grp === SLOT_GRP[slot] && lab[slot].includes(String(c.p.pos).toUpperCase())).slice(0, n);
      if (got.length < n) got = got.concat(cands.filter(c => !used.has(c.p.id) && !got.includes(c) && c.p.grp === SLOT_GRP[slot]).slice(0, n - got.length));
      for (const c of got) { used.add(c.p.id); out[conf].push({ id: c.p.id, name: c.p.name, pos: slot, tid: c.h.tm, line: awardLine(c.p, c.h) }); (c.p.awards = c.p.awards || []).push({ y, a: 'pb' }); }
    }
  }
  L.proBowl = L.proBowl || {}; L.proBowl[y] = out;
  const ut = L.teams[L.user];
  if (ut) { const mine = out[ut.conf].filter(x => x.tid === L.user); addNews(L, `${y} Pro Bowl rosters announced: ${mine.length} from your team${mine.length ? ' (' + mine.map(x => x.name).join(', ') + ')' : ''}.`); }
  else addNews(L, `${y} Pro Bowl rosters announced.`);
}

/* ---------- stadiums and weather ---------- */
// [from year, stadium, roof (out / dome / retr), climate (cold / cool / mild / warm / hot / rain / wind)]
const STADIUMS = {
  crd: [[1970, 'Busch Memorial Stadium', 'out', 'cool'], [1988, 'Sun Devil Stadium', 'out', 'hot'], [2006, 'State Farm Stadium', 'retr', 'hot']],
  atl: [[1970, 'Atlanta-Fulton County Stadium', 'out', 'mild'], [1992, 'Georgia Dome', 'dome', 'mild'], [2017, 'Mercedes-Benz Stadium', 'retr', 'mild']],
  rav: [[1996, 'Memorial Stadium', 'out', 'cool'], [1998, 'M&T Bank Stadium', 'out', 'cool']],
  buf: [[1970, 'War Memorial Stadium', 'out', 'cold'], [1973, 'Highmark Stadium', 'out', 'cold']],
  car: [[1995, 'Memorial Stadium (Clemson)', 'out', 'mild'], [1996, 'Bank of America Stadium', 'out', 'mild']],
  chi: [[1970, 'Wrigley Field', 'out', 'cold'], [1971, 'Soldier Field', 'out', 'cold'], [2002, 'Memorial Stadium (Champaign)', 'out', 'cold'], [2003, 'Soldier Field', 'out', 'cold']],
  cin: [[1970, 'Riverfront Stadium', 'out', 'cool'], [2000, 'Paycor Stadium', 'out', 'cool']],
  cle: [[1970, 'Cleveland Municipal Stadium', 'out', 'cold'], [1999, 'Huntington Bank Field', 'out', 'cold']],
  clt: [[1970, 'Memorial Stadium', 'out', 'cool'], [1984, 'RCA Dome', 'dome', 'cool'], [2008, 'Lucas Oil Stadium', 'retr', 'cool']],
  dal: [[1970, 'Cotton Bowl', 'out', 'warm'], [1972, 'Texas Stadium', 'out', 'warm'], [2009, 'AT&T Stadium', 'retr', 'warm']],
  den: [[1970, 'Mile High Stadium', 'out', 'cold'], [2001, 'Empower Field at Mile High', 'out', 'cold']],
  det: [[1970, 'Tiger Stadium', 'out', 'cold'], [1975, 'Pontiac Silverdome', 'dome', 'cold'], [2002, 'Ford Field', 'dome', 'cold']],
  gnb: [[1970, 'Lambeau Field', 'out', 'cold']],
  htx: [[2002, 'NRG Stadium', 'retr', 'warm']],
  oti: [[1970, 'Astrodome', 'dome', 'warm'], [1997, 'Liberty Bowl Memorial Stadium', 'out', 'mild'], [1998, 'Vanderbilt Stadium', 'out', 'mild'], [1999, 'Nissan Stadium', 'out', 'mild']],
  jax: [[1995, 'EverBank Stadium', 'out', 'hot']],
  kan: [[1970, 'Municipal Stadium', 'out', 'cold'], [1972, 'Arrowhead Stadium', 'out', 'cold']],
  rai: [[1970, 'Oakland Coliseum', 'out', 'mild'], [1982, 'Los Angeles Memorial Coliseum', 'out', 'warm'], [1995, 'Oakland Coliseum', 'out', 'mild'], [2020, 'Allegiant Stadium', 'dome', 'hot']],
  sdg: [[1970, 'San Diego Stadium', 'out', 'warm'], [2017, 'Dignity Health Sports Park', 'out', 'warm'], [2020, 'SoFi Stadium', 'dome', 'warm']],
  ram: [[1970, 'Los Angeles Memorial Coliseum', 'out', 'warm'], [1980, 'Anaheim Stadium', 'out', 'warm'], [1995, 'Edward Jones Dome', 'dome', 'cool'], [2016, 'Los Angeles Memorial Coliseum', 'out', 'warm'], [2020, 'SoFi Stadium', 'dome', 'warm']],
  mia: [[1970, 'Orange Bowl', 'out', 'hot'], [1987, 'Hard Rock Stadium', 'out', 'hot']],
  min: [[1970, 'Metropolitan Stadium', 'out', 'cold'], [1982, 'Hubert H. Humphrey Metrodome', 'dome', 'cold'], [2014, 'TCF Bank Stadium', 'out', 'cold'], [2016, 'U.S. Bank Stadium', 'dome', 'cold']],
  nwe: [[1970, 'Harvard Stadium', 'out', 'cold'], [1971, 'Foxboro Stadium', 'out', 'cold'], [2002, 'Gillette Stadium', 'out', 'cold']],
  nor: [[1970, 'Tulane Stadium', 'out', 'warm'], [1975, 'Louisiana Superdome', 'dome', 'warm']],
  nyg: [[1970, 'Yankee Stadium', 'out', 'cold'], [1973, 'Yale Bowl', 'out', 'cold'], [1975, 'Shea Stadium', 'out', 'cold'], [1976, 'Giants Stadium', 'out', 'cold'], [2010, 'MetLife Stadium', 'out', 'cold']],
  nyj: [[1970, 'Shea Stadium', 'out', 'cold'], [1984, 'Giants Stadium', 'out', 'cold'], [2010, 'MetLife Stadium', 'out', 'cold']],
  phi: [[1970, 'Franklin Field', 'out', 'cool'], [1971, 'Veterans Stadium', 'out', 'cool'], [2003, 'Lincoln Financial Field', 'out', 'cool']],
  pit: [[1970, 'Three Rivers Stadium', 'out', 'cold'], [2001, 'Acrisure Stadium', 'out', 'cold']],
  sfo: [[1970, 'Kezar Stadium', 'out', 'wind'], [1971, 'Candlestick Park', 'out', 'wind'], [2014, "Levi's Stadium", 'out', 'mild']],
  sea: [[1976, 'Kingdome', 'dome', 'rain'], [2000, 'Husky Stadium', 'out', 'rain'], [2002, 'Lumen Field', 'out', 'rain']],
  tam: [[1976, 'Tampa Stadium', 'out', 'hot'], [1998, 'Raymond James Stadium', 'out', 'hot']],
  was: [[1970, 'RFK Stadium', 'out', 'cool'], [1997, 'Northwest Stadium', 'out', 'cool']]
};
function stadium(L, tid, y) {
  const t = L.teams[tid]; if (!t) return null;
  const list = STADIUMS[t.pfr]; y = y || L.year;
  if (!list) return { name: `${t.city} Stadium`, roof: 'out', clim: 'cool' };
  let s = list[0]; for (const x of list) if (x[0] <= y) s = x;
  // a franchise that moved keeps the right stadium for the city it plays in now
  return { name: s[1], roof: s[2], clim: s[3] };
}
const CLIM = { cold: [66, 3.2], cool: [72, 2.6], mild: [72, 1.8], warm: [86, 1.6], hot: [88, 1.1], rain: [66, 1.6], wind: [66, 1.0] };
const WX_NAME = { dome: 'Indoors', clear: 'Clear', rain: 'Rain', snow: 'Snow', wind: 'Windy', cold: 'Frigid' };
// Weather for a game, set once (the forecast you see before kickoff is what you get).
function forecast(L, g, week, opts) {
  if (g.wx) return g.wx;
  opts = opts || {};
  if (opts.neutral) { g.wx = Math.random() < 0.5 ? { k: 'dome' } : { k: 'clear', t: R.int(62, 80) }; return g.wx; }
  const S = stadium(L, g.h);
  if (!S || S.roof === 'dome') { g.wx = { k: 'dome' }; return g.wx; }
  const w = week == null ? (L.phase === 'playoffs' ? rules(L.year).games + 2 : L.week) : week;
  const [base, drop] = CLIM[S.clim] || CLIM.cool;
  const t = Math.round(base - drop * w + R.norm() * 7);
  if (S.roof === 'retr' && (t < 50 || t > 90 || Math.random() < 0.4)) { g.wx = { k: 'dome' }; return g.wx; }
  const wet = S.clim === 'rain' ? 0.32 : S.clim === 'hot' || S.clim === 'warm' ? 0.12 : 0.16;
  let k = 'clear';
  if (Math.random() < wet) k = t <= 33 ? 'snow' : 'rain';
  else if (Math.random() < (S.clim === 'wind' ? 0.3 : S.clim === 'cold' ? 0.15 : 0.08)) k = 'wind';
  else if (t <= 20) k = 'cold';
  g.wx = { k, t };
  return g.wx;
}
// What the weather does: fewer points and fewer passes in snow, wind and rain; warm-weather teams struggle in the cold.
function wxEffect(L, wx, tid) {
  const e = { pts: 0.15, pass: 1 };
  if (!wx || wx.k === 'dome') { e.pts = 0.45; return e; }
  if (wx.k === 'snow') { e.pts = -2.7; e.pass = 0.84; }
  else if (wx.k === 'wind') { e.pts = -1.9; e.pass = 0.87; }
  else if (wx.k === 'rain') { e.pts = -1.1; e.pass = 0.92; }
  else if (wx.k === 'cold') { e.pts = -0.7; e.pass = 0.95; }
  if (wx.t != null && wx.t <= 32 && tid != null) { const S = stadium(L, tid); if (S && (S.roof !== 'out' || S.clim === 'warm' || S.clim === 'hot')) e.pts -= 1.2; }
  return e;
}
function wxText(wx) { if (!wx) return ''; return wx.k === 'dome' ? 'Indoors' : `${WX_NAME[wx.k]}${wx.t != null ? ', ' + wx.t + '°F' : ''}`; }

/* ---------- franchise record book ---------- */
const REC_KEYS = [['py', 'Passing yards'], ['ptd', 'Passing TDs'], ['ry', 'Rushing yards'], ['rtd', 'Rushing TDs'], ['rec', 'Receptions'], ['recy', 'Receiving yards'], ['rectd', 'Receiving TDs'], ['sk', 'Sacks'], ['dint', 'Interceptions'], ['fgm', 'Field goals']];
function recordBook(L, tid) {
  const season = {}, career = {};
  REC_KEYS.forEach(([k]) => { season[k] = null; career[k] = null; });
  for (const p of allPlayers(L)) {
    const tot = {};
    for (const y in p.hist) {
      const h = p.hist[y]; if (h.tm !== tid) continue;
      for (const [k] of REC_KEYS) { const v = h[k] || 0; if (!v) continue; tot[k] = (tot[k] || 0) + v; if (!season[k] || v > season[k].v) season[k] = { v, id: p.id, name: p.name, y: +y }; }
    }
    for (const k in tot) if (!career[k] || tot[k] > career[k].v) career[k] = { v: tot[k], id: p.id, name: p.name };
  }
  const t = L.teams[tid], hs = t.hist || [];
  const best = hs.slice().sort((a, b) => (b.w - b.l) - (a.w - a.l))[0], worst = hs.slice().sort((a, b) => (a.w - a.l) - (b.w - b.l))[0];
  const pts = hs.slice().sort((a, b) => b.pf - a.pf)[0];
  return { season, career, best, worst, pts };
}

/* ---------- career extras: earnings, switching positions, forced retirement, life after ---------- */
const SWITCHES = { QB: [['WR', 'WR', 10]], RB: [['RB', 'FB', 0], ['WR', 'WR', 5], ['TE', 'TE', 7]], WR: [['TE', 'TE', 4], ['DB', 'CB', 8]], TE: [['OL', 'T', 8], ['WR', 'WR', 5], ['RB', 'FB', 4]],
  OL: [['OL', 'T', 0], ['OL', 'G', 0], ['OL', 'C', 0], ['DL', 'DT', 8]], DL: [['DL', 'DE', 0], ['DL', 'DT', 0], ['LB', 'LB', 5], ['OL', 'G', 8]], LB: [['DL', 'DE', 4], ['DB', 'S', 7]],
  DB: [['DB', 'CB', 0], ['DB', 'S', 0], ['LB', 'LB', 5], ['WR', 'WR', 8]], K: [['P', 'P', 4]], P: [['K', 'K', 4]] };
function careerSwitchOpts(L) {
  const p = careerP(L); if (!p || p.retiredYear != null) return [];
  return (SWITCHES[p.grp] || []).filter(([g, pos]) => !(g === p.grp && pos === p.pos)).map(([g, pos, cost]) => {
    const ovr = Math.max(35, p.ovr - cost);
    let rank = null; if (p.team >= 0) { const d = (depth(L, p.team)[g] || []).filter(x => x.id !== p.id); rank = 1 + d.filter(x => x.ovr > ovr).length; }
    const n = p.team >= 0 ? startersFor(L, p.team)[g] || 1 : 1;
    return { grp: g, pos, cost, ovr, rank, starter: rank != null && rank <= n };
  });
}
function careerSwitch(L, i) {
  const C = L.career, p = careerP(L), o = careerSwitchOpts(L)[+i];
  if (!o) return 'That move is not available.';
  if (!(L.phase === 'offseason' || L.phase === 'preseason')) return 'You can change positions in the offseason or at training camp.';
  if (C.switchY === L.year + ':' + L.phase && o.cost) return 'One position change per offseason.';
  const from = p.pos, fromG = p.grp;
  ensureAttrs(p);
  p.grp = o.grp; p.pos = o.pos;
  if (fromG !== o.grp) { remapAttrs(p, fromG); if (L.career.drill && !(ATTR_KEYS[p.grp] || []).includes(L.career.drill)) L.career.drill = null; }
  if (o.cost) { p.ovr = o.ovr; p.pot = Math.max(p.ovr + 1, p.pot - o.cost); p.cBoost = (p.cBoost || 0) - o.cost * 2; C.switchY = L.year + ':' + L.phase; }
  if (p.team >= 0) ensureNumbers(L);
  careerLog(L, `Moved from ${from} to ${o.pos}${o.cost ? ` (${p.ovr} overall at the new spot)` : ''}.`);
  if (o.cost) addNews(L, `${p.name} is switching from ${from} to ${o.pos}.`);
  C.offers = null;
  return null;
}
function careerEarn(L) {
  const C = L.career, p = careerP(L); if (!p || p.team < 0 || !p.con) return;
  C.earn = C.earn || {}; C.earnY = C.earnY || {}; if (C.earnY[L.year]) return; C.earnY[L.year] = 1;
  C.earn[L.year] = (C.earn[L.year] || 0) + (baseFor(p, L.year) != null ? baseFor(p, L.year) : salFor(p, L.year) || 0);
}
function careerEarnings(L) { const e = (L.career && L.career.earn) || {}; let s = 0; for (const y in e) s += e[y]; return s; }
// Called from progress() for the career player: the chance his career ends for him this offseason.
function careerForcedChance(L, p) {
  const C = L.career, inj = (p.injY && p.injY[L.year]) || 0, slow = p.grp === 'QB' || p.grp === 'K' || p.grp === 'P';
  let f = 0, why = null;
  if (inj >= 10) { f = p.age >= 30 ? 0.12 : 0.04; why = 'injury'; }
  const old = slow ? 37 : 34;
  if (p.age >= old) { const a = (0.05 + (p.age - old) * 0.06) * clamp(1 - (p.ovr - 72) * 0.05, 0.3, 1.6); if (a > f) { f = a; why = 'age'; } }
  if (p.team === -1 && p.ovr < 48) { f = Math.max(f, 0.6); why = 'ability'; }
  if (p.age >= 45) { f = 1; why = 'age'; }
  C.endWhy = why;
  return f;
}
// Coaching or the front office after you retire
function careerCoachOpts(L) {
  const p = careerP(L); if (!p || p.retiredYear == null || (L.career.coachId != null)) return [];
  const iq = footballIQ(p) + (p.ciq || 0) * 3, off = ['QB', 'RB', 'WR', 'TE', 'OL'].includes(p.grp), role = p.grp === 'K' || p.grp === 'P' ? null : off ? 'oc' : 'dc';
  if (!role) return [];
  const cnt = {}; Object.values(p.hist || {}).forEach(h => { if (h.tm != null) cnt[h.tm] = (cnt[h.tm] || 0) + 1; });
  const mine = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).map(Number);
  const pool = mine.concat(R.shuffle(L.teams.map(t => t.id)).filter(t => !mine.includes(t))).slice(0, 3);
  return pool.map(tid => ({ tid, role, r: clamp(Math.round(46 + (iq - 60) * 0.6 + Math.min(6, careerScore(p) / 200)), 40, 78) }));
}
function careerBecomeCoach(L, i) {
  const C = L.career, p = careerP(L), o = careerCoachOpts(L)[+i]; if (!o) return 'That job is gone.';
  const t = L.teams[o.tid]; ensureStaff(L);
  L.nextCoachId = L.nextCoachId || 1;
  const c = { id: L.nextCoachId++, name: p.name, age: p.age, role: o.role, pref: o.role === 'oc' ? (p.grp === 'RB' || p.grp === 'OL' ? 'run' : 'pass') : (p.grp === 'DB' ? 'soft' : 'blitz'), since: L.year, r: o.r,
    ex: { pid: p.id, pos: p.pos, yrs: p.yrs || 0, hof: !!(p.hof && p.hof > 0) } };
  const old = t.staff[o.role]; if (old) L.coachPool.push(old);
  t.staff[o.role] = c; L.exCoach = L.exCoach || {}; L.exCoach[p.id] = L.year;
  C.coachId = c.id; C.coachHist = [];
  careerLog(L, `Hired as ${ROLE_NAME[o.role].toLowerCase()} of the ${t.city} ${t.name}.`);
  addNews(L, `${t.city} hire former ${p.pos} ${p.name} as ${ROLE_NAME[o.role].toLowerCase()}.`);
  return null;
}
function careerCoachNow(L) {
  const C = L.career; if (!C || C.coachId == null) return null;
  for (const t of L.teams) for (const r of ['hc', 'oc', 'dc']) { const c = t.staff && t.staff[r]; if (c && c.id === C.coachId) return { c, tid: t.id, role: r }; }
  const c = (L.coachPool || []).find(x => x.id === C.coachId);
  return c ? { c, tid: null, role: c.role } : null;
}
function careerCoachYear(L) {
  const C = L.career, n = careerCoachNow(L); if (!n || n.tid == null) return;
  const t = L.teams[n.tid], last = t.hist[t.hist.length - 1]; if (!last || last.y !== L.year) return;
  C.coachHist = C.coachHist || []; if (C.coachHist.some(h => h.y === L.year)) return;
  C.coachHist.push({ y: L.year, tid: n.tid, role: n.role, w: last.w, l: last.l, t: last.t, res: last.res });
}
function careerFrontOfficeOpts(L) {
  const p = careerP(L); if (!p || p.retiredYear == null) return [];
  if (!(L.phase === 'offseason' || L.phase === 'preseason' || L.phase === 'season-over')) return [];
  const cnt = {}; Object.values(p.hist || {}).forEach(h => { if (h.tm != null) cnt[h.tm] = (cnt[h.tm] || 0) + 1; });
  const fav = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).map(Number)[0];
  const worst = sortTeams(L, L.teams.slice()).reverse().map(t => t.id).filter(id => id !== fav).slice(0, 2);
  return [fav].concat(worst).filter(x => x != null && L.teams[x]);
}
// Start another player in the same league: the next draft class. Your earlier players stay in its history.
function careerAgain(L, imports) {
  const old = L.career || L.exCareer; if (!old) return 'No career to continue from.';
  const op = old.pid != null ? getP(L, old.pid) : null;
  if (L.career && op && op.retiredYear == null) return 'Retire first.';
  L.pastCareers = (L.pastCareers || []).concat(old.pid != null ? [{ pid: old.pid, name: old.name || (op && op.name), y0: old.y0, coach: old.coachId != null }] : []);
  delete L.exCareer;
  L.user = NO_TEAM; L.job = null; L.offers = [];
  L.career = { pid: null, y0: L.year + 1, trust: 50, fo: 50, focus: 'technique', plan: 'balanced', log: [], games: [], alerts: [], goals: null, ms: [], seasons: {} };
  // play on to the next draft
  let guard = 0;
  while (L.phase !== 'draft' && guard++ < 400) {
    if (L.phase === 'offseason') startNextSeason(L);
    else if (L.phase === 'preseason') startRegular(L);
    else if (L.phase === 'regular') simWeek(L);
    else if (L.phase === 'playoffs') simPlayoffRound(L);
    else if (L.phase === 'season-over') startDraft(L, imports);
  }
  L.career.y0 = L.draft.year;
  return null;
}
function careerToGM(L, tid) {
  if (!careerFrontOfficeOpts(L).includes(+tid)) return 'That job is not available.';
  const p = careerP(L), t = L.teams[+tid];
  careerLog(L, `Became general manager of the ${t.city} ${t.name}.`);
  L.exCareer = L.career; delete L.career;
  L.user = +tid; L.job = { sec: 60, hist: [] }; L.offers = []; L.plan = null;
  ensureStaff(L); if (L.phase === 'offseason') { L.fa = null; ensureFA(L); }
  addNews(L, `Former ${p.pos} ${p.name} is the new general manager of the ${t.city} ${t.name}.`);
  return null;
}

/* ---------- player career mode ----------
   The user is one player, not a general manager. Every club (his own included) is run by the AI:
   L.user is NO_TEAM, so all the "skip the user's team" checks treat every team as an AI team.
   L.career holds the player's id and everything about his career that isn't on the player record. */
const NO_TEAM = -9;
function careerP(L) { return L && L.career && L.career.pid != null ? getP(L, L.career.pid) : null; }
function isCareer(L, p) { return !!(L && L.career && p && p.id === L.career.pid); }

// Where the scouts have you: the first answer is the difficulty.
const CAREER_TIERS = [
  { id: 'star', txt: 'Top-10 pick: a can\'t-miss prospect', o: 64, pot: 84, st: 84 },
  { id: 'first', txt: 'First-round talent', o: 60, pot: 79, st: 76 },
  { id: 'day2', txt: 'Day-two pick (rounds 2-3)', o: 56, pot: 74, st: 66 },
  { id: 'late', txt: 'Late-round sleeper', o: 52, pot: 71, st: 57 },
  { id: 'udfa', txt: 'Undrafted long shot', o: 47, pot: 68, st: 46 }
];
// The other questions are trade-offs: every answer that helps one thing costs another.
// o = starting overall, pot = ceiling, dev = yearly growth, dur = durability, st = draft stock,
// iq = learns the playbook (helps early), age = age on draft day, ego = contract asks, loyal = likes to stay
const CAREER_Q = [
  { q: 'What kind of body do you have?', a: [
    ['Built like a tank', { o: 3, dur: 1, pot: -3 }],
    ['Long, lean and explosive', { pot: 4, o: -2, dur: -1 }],
    ['Average frame that never breaks', { dur: 2, pot: -2 }],
    ['Still growing into it', { o: -4, pot: 5, dev: 0.5 }]] },
  { q: 'How do you spend the offseason?', a: [
    ['First in the building, last to leave', { dev: 1.5, o: -2 }],
    ['Natural talent: I coast and still win', { o: 4, dev: -1.5 }],
    ['Train hard, but I take my rest', { dev: 0.5, dur: 1, o: -1 }],
    ['Private speed coach, all year', { pot: 2, o: 1, dev: -0.5, dur: -1 }]] },
  { q: 'How much film do you watch?', a: [
    ['Hours a day. I know every play call', { o: 2, iq: 2, pot: -2 }],
    ['Enough to know my assignment', {}],
    ['I play on instinct', { pot: 3, o: -2, iq: -1 }]] },
  { q: 'How did the Combine go?', a: [
    ['I blew up the 40 and the bench press', { st: 7, o: -2 }],
    ['Skipped it. My tape speaks for itself', { st: -3, o: 1 }],
    ['Average numbers, great interviews', { st: 2, iq: 1, pot: -1 }],
    ['Pulled a hamstring halfway through', { st: -7, pot: 2, dev: 0.5 }]] },
  { q: 'Any injuries in college?', a: [
    ['Never missed a game', { dur: 2, o: -1, pot: -1 }],
    ['Tore my ACL as a junior', { o: -3, st: -6, dev: 1, dur: -1 }],
    ['A few nagging ones', { dur: -1, o: 2 }]] },
  { q: 'When did you turn pro?', a: [
    ['Declared early at 21', { age: 21, o: -3, pot: 3, st: 2 }],
    ['Stayed all four years', { age: 22 }],
    ['Fifth-year senior', { age: 23, o: 3, pot: -3, st: -2 }]] },
  { q: 'What does your agent hear from you?', a: [
    ['Get me every dollar', { ego: 0.12, loyal: -1 }],
    ['I want to win a ring', { ring: 1 }],
    ['I want to stay where I start', { loyal: 1, ego: -0.08 }],
    ['Get me on the field. The money comes later', { ego: -0.1, o: 1 }]] }
];
const CAREER_GRPS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'];
// Play styles for a created player: each shifts his position ratings (they still average to his overall)
const CAREER_STYLES = {
  QB: [['bal', 'Balanced', {}], ['gun', 'Gunslinger: big arm, takes chances', { arm: 7, acc: -2, pkt: -3, mob: -2 }], ['mgr', 'Game manager: accurate, never rattled', { acc: 5, pkt: 5, arm: -4, mob: -6 }], ['dual', 'Dual threat: beats you with his legs', { mob: 9, arm: 0, acc: -4, pkt: -5 }]],
  RB: [['bal', 'Balanced', {}], ['spd', 'Speed back: home-run hitter', { spd: 7, elu: 2, pow: -7, hnd: -2 }], ['pow', 'Power back: runs through people', { pow: 8, spd: -4, elu: -4 }], ['3d', 'Third-down back: hands and shake', { hnd: 7, elu: 3, pow: -6, spd: -4 }]],
  WR: [['bal', 'Balanced', {}], ['deep', 'Deep threat: pure speed', { spd: 8, phy: -3, rte: -3, hnd: -2 }], ['poss', 'Possession receiver: routes and hands', { hnd: 5, rte: 5, spd: -6, phy: -4 }], ['big', 'Big target: wins every jump ball', { phy: 8, spd: -4, rte: -4 }]],
  TE: [['bal', 'Balanced', {}], ['blk', 'Blocking tight end', { blk: 8, hnd: -3, rte: -4, spd: -1 }], ['move', 'Move tight end: a big receiver', { rte: 5, spd: 4, blk: -7, hnd: -2 }]],
  OL: [['bal', 'Balanced', {}], ['pass', 'Pass protector: quick feet', { pbk: 6, ftw: 4, rbk: -4, str: -6 }], ['road', 'Road grader: moves people', { rbk: 6, str: 5, pbk: -4, ftw: -7 }]],
  DL: [['bal', 'Balanced', {}], ['edge', 'Edge rusher: gets to the QB', { prs: 7, qck: 4, rdf: -5, str: -6 }], ['nose', 'Run stuffer: eats blocks', { rdf: 7, str: 5, prs: -5, qck: -7 }]],
  LB: [['bal', 'Balanced', {}], ['thump', 'Thumper: downhill tackler', { tkl: 7, prs: 1, cov: -5, spd: -3 }], ['cover', 'Coverage linebacker', { cov: 7, spd: 3, tkl: -4, prs: -6 }], ['blitz', 'Blitzer: lives in the backfield', { prs: 8, tkl: 1, cov: -6, spd: -3 }]],
  DB: [['bal', 'Balanced', {}], ['lock', 'Lockdown corner', { cov: 7, spd: 3, tkl: -7, bsk: -3 }], ['hawk', 'Ballhawk: picks off everything', { bsk: 8, cov: 0, tkl: -4, spd: -4 }], ['box', 'Box safety: a hitter', { tkl: 8, cov: -3, spd: -3, bsk: -2 }]],
  K: [['bal', 'Balanced', {}], ['leg', 'Big leg', { kpw: 7, kac: -7 }], ['acc', 'Accurate', { kac: 7, kpw: -7 }]],
  P: [['bal', 'Balanced', {}], ['leg', 'Big leg', { kpw: 7, kac: -7 }], ['acc', 'Directional punter', { kac: 7, kpw: -7 }]]
};
// questionnaire answers that shape the ratings: [question, answer] -> {group of ratings: shift}
const CAREER_Q_AT = { '0:0': { size: 1.5 }, '0:1': { ath: 3 }, '0:3': { ath: 1, size: -0.5 }, '1:3': { ath: 2.5 }, '2:0': { iq: 3 }, '2:2': { iq: -2, ath: 1 }, '3:0': { ath: 2, size: 0.8 } };
function htInches(s) { const m = String(s || '').match(/(\d)'\s*(\d+)/); return m ? +m[1] * 12 + +m[2] : null; }
// A created player's rating offsets from his size, play style and answers
function careerBuildAt(spec) {
  const g = CAREER_GRPS.includes(spec.grp) ? spec.grp : 'WR', keys = ATTR_KEYS[g], S = SIZE[g];
  const hin = htInches(spec.ht) || S[0], wt = +spec.wt || S[1];
  const heavy = clamp((wt - S[1]) / S[3] - 0.5 * (hin - S[0]) / S[2], -2.5, 2.5);
  const st = (CAREER_STYLES[g] || []).find(x => x[0] === spec.style) || (CAREER_STYLES[g] || [])[0], sty = st ? st[2] : {};
  const q = { ath: 0, iq: 0, size: 0 };
  (spec.ans || []).forEach((j, i) => { const e = CAREER_Q_AT[i + ':' + j]; if (e) for (const k in e) q[k] += e[k]; });
  const off = keys.map(k => (ATTR_SIZE[k] || 0) * (heavy + q.size) * 2.2 + (sty[k] || 0) + (ATTR_ATH[k] || 0) * q.ath + (ATTR_IQ[k] || 0) * q.iq);
  return { keys, at: centerAt(off), hin, wt };
}
function careerAttrPreview(spec, ovr) {
  const b = careerBuildAt(spec);
  return b.keys.map((k, i) => ({ k, name: ATTR_NAME[k], short: ATTR_SHORT[k], v: clamp(Math.round(ovr + b.at[i]), 20, 99) }));
}
const CAREER_POS = { QB: ['QB'], RB: ['RB', 'FB'], WR: ['WR'], TE: ['TE'], OL: ['T', 'G', 'C'], DL: ['DE', 'DT'], LB: ['LB'], DB: ['CB', 'S'], K: ['K'], P: ['P'] };
function careerPreview(tier, ans) {
  const T = CAREER_TIERS.find(t => t.id === tier) || CAREER_TIERS[2], s = { o: 0, pot: 0, dev: 0, dur: 0, st: 0, iq: 0, ego: 0, loyal: 0, ring: 0, age: 22 };
  CAREER_Q.forEach((q, i) => { const a = q.a[ans && ans[i] != null ? ans[i] : 0]; if (!a) return; for (const k in a[1]) s[k] = k === 'age' ? a[1][k] : s[k] + a[1][k]; });
  const ovr = clamp(Math.round(T.o + s.o + s.iq * 0.5), 42, 78);
  const pot = clamp(Math.round(T.pot + s.pot), ovr + 4, 94);
  const stock = clamp(Math.round(T.st + s.st + (pot - T.pot) * 0.4), 38, 92);
  return { ovr, pot, stock, dev: s.dev, dur: s.dur, iq: s.iq, age: s.age, ego: s.ego, loyal: s.loyal, ring: s.ring,
    round: stock >= 80 ? 'Round 1 (top 10)' : stock >= 72 ? 'Round 1' : stock >= 64 ? 'Rounds 2-3' : stock >= 55 ? 'Rounds 4-7' : 'Undrafted', durTxt: s.dur >= 2 ? 'Iron man' : s.dur >= 0 ? 'Normal' : 'Injury prone', devTxt: s.dev >= 1.5 ? 'Gym rat' : s.dev > 0 ? 'Hard worker' : s.dev < 0 ? 'Coasts on talent' : 'Normal' };
}
// A real prospect's numbers as the game sees them (his ceiling is hidden until a team works him out).
function careerClass(L) { const D = L.draft; return D ? D.pool.map(id => L.players[id]).filter(p => p && p.team === -3) : []; }

// Start a career: the season before the chosen draft plays out, then the draft opens with you in the pool.
function startCareer(L, imports) {
  L.user = NO_TEAM; L.job = null;
  L.career = { pid: null, y0: L.year + 1, trust: 50, fo: 50, focus: 'technique', plan: 'balanced', log: [], games: [], alerts: [], goals: null, ms: [], seasons: {} };
  aiStyles(L, false, true);
  if (L.phase === 'preseason') startRegular(L);
  while (L.phase === 'regular') simWeek(L);
  while (L.phase === 'playoffs') simPlayoffRound(L);
  startDraft(L, imports);
  L.news = L.news.slice(0, 30);
  return null;
}
function careerCreate(L, spec) {
  const D = L.draft; if (!D || !L.career || L.career.pid != null) return 'The draft is not open.';
  const grp = CAREER_GRPS.includes(spec.grp) ? spec.grp : 'WR', v = careerPreview(spec.tier, spec.ans);
  const name = String(spec.name || '').trim().slice(0, 40) || genName();
  const pos = (CAREER_POS[grp] || [grp]).includes(spec.pos) ? spec.pos : CAREER_POS[grp][0];
  const ovr = clamp(v.ovr + R.int(-1, 1), 42, 78), pot = clamp(v.pot + R.int(-1, 1), ovr + 3, 94);
  const p = mkPlayer(L, { name, grp, pos, age: v.age, ovr, pot, team: -3, college: String(spec.college || '').slice(0, 40) || R.pick(COLLEGES), real: false,
    reveal: D.year, scout: clamp(v.stock + R.int(-2, 2), 38, 92), me: 1, cdev: v.dev, cdur: v.dur, ciq: v.iq, ego: v.ego, loyal: v.loyal, ringChaser: v.ring,
    ht: spec.ht || null, wt: spec.wt || null, home: String(spec.home || '').slice(0, 40) || null, num: spec.num ? clamp(+spec.num, 0, 99) : undefined, tier: spec.tier });
  const B = careerBuildAt(Object.assign({}, spec, { grp }));
  p.at = B.at; p.atG = grp; p.atSrc = 'me'; p.hin = B.hin; p.wt = B.wt; p.cstyle = spec.style || 'bal';
  D.pool.push(p.id);
  careerBegin(L, p);
  careerLog(L, `Declared for the ${D.year} draft out of ${p.college}. Scouts grade you ${p.scout}: projected ${v.round.toLowerCase()}.`);
  return null;
}
function careerChooseReal(L, pid) {
  const D = L.draft, p = L.players[pid]; if (!D || !p || p.team !== -3 || !L.career || L.career.pid != null) return 'He is not in this draft class.';
  p.cdev = 0; p.cdur = 0; p.ego = 0; p.seen = 1;
  careerBegin(L, p);
  careerLog(L, `You are ${p.pos} ${p.name} out of ${p.college || 'college'}, entering the ${D.year} draft.`);
  return null;
}
function careerBegin(L, p) { L.career.pid = p.id; L.career.name = p.name; addNews(L, `${p.pos} ${p.name} declares for the ${L.draft.year} draft.`); }
function careerLog(L, txt) { const C = L.career; C.log.unshift({ y: L.year + (L.phase === 'offseason' || L.phase === 'draft' || L.phase === 'season-over' ? 1 : 0), w: L.phase === 'regular' ? L.week : null, txt }); C.log = C.log.slice(0, 120); }
function careerAlert(L, txt, kind) { const C = L.career; C.alerts.unshift({ id: (C.aid = (C.aid || 0) + 1), y: L.year, txt, kind: kind || 'info' }); C.alerts = C.alerts.slice(0, 8); }
function dismissAlert(L, id) { if (L.career) L.career.alerts = L.career.alerts.filter(a => a.id !== +id); }
function addFO(L, d) { const C = L.career; C.fo = clamp(Math.round((C.fo == null ? 50 : C.fo) + d), 0, 100); }
const TRUST_LABELS = [[80, 'Loves you'], [60, 'Trusts you'], [45, 'Neutral'], [25, 'Frustrated'], [0, 'On thin ice']];
const FO_LABELS = [[80, 'Franchise cornerstone'], [60, 'Valued'], [45, 'Neutral'], [25, 'Unsure about you'], [0, 'Looking to move you']];
const label = (v, T) => T.find(([m]) => v >= m)[1];
// Where you stand with the organization: the head coach (playing time) and the front office (your contract and your future here)
// The schemes your team runs and how you fit them; noticing when they change
function careerScheme(L, tid) {
  const p = careerP(L); tid = tid == null ? p && p.team : tid; if (!p || tid == null || tid < 0) return null;
  const c = L.teams[tid].coach || {}, f = playerFit(L, p, tid);
  return { os: c.os, ds: c.ds, osName: SCHEME[c.os] ? SCHEME[c.os].name : 'Balanced', dsName: SCHEME[c.ds] ? SCHEME[c.ds].name : 'Balanced', mine: DEF_GRPS_C.includes(p.grp) ? 'def' : 'off', fit: f };
}
const DEF_GRPS_C = ['DL', 'LB', 'DB'];
function careerSchemeCheck(L) {
  const C = L.career, p = careerP(L); if (!p || p.team < 0 || p.retiredYear != null) return;
  const S = careerScheme(L), prev = C.sch;
  C.sch = { tid: p.team, os: S.os, ds: S.ds, score: S.fit.score, grade: S.fit.grade };
  if (!prev || prev.tid !== p.team) return;
  const chOff = prev.os !== S.os, chDef = prev.ds !== S.ds; if (!chOff && !chDef) return;
  const t = L.teams[p.team], parts = [];
  if (chOff) parts.push(`offense: ${SCHEME[prev.os] ? SCHEME[prev.os].name : 'old scheme'} → ${S.osName}`);
  if (chDef) parts.push(`defense: ${SCHEME[prev.ds] ? SCHEME[prev.ds].name : 'old scheme'} → ${S.dsName}`);
  const mineChanged = (S.mine === 'off' && chOff) || (S.mine === 'def' && chDef), d = S.fit.score - prev.score;
  const eff = !mineChanged ? 'It doesn\'t change your side of the ball.' : d >= 5 ? `Good news for you: your fit goes from ${prev.grade} to ${S.fit.grade}.` : d <= -5 ? `Bad news for you: your fit drops from ${prev.grade} to ${S.fit.grade}.` : `Your fit stays about the same (${prev.grade} → ${S.fit.grade}).`;
  const txt = `${t.abbr} changed its ${parts.join(' and ')}. ${eff}`;
  careerLog(L, txt); careerAlert(L, txt, mineChanged && d <= -5 ? 'warn' : mineChanged && d >= 5 ? 'good' : 'info');
}
function careerStanding(L) {
  const C = L.career, p = careerP(L); if (!p || p.team < 0 || p.retiredYear != null) return null;
  const t = L.teams[p.team], hc = t.staff && t.staff.hc;
  const fo = C.fo == null ? 50 : C.fo, tr = C.trust == null ? 50 : C.trust;
  return { coach: hc ? hc.name : 'The coach', trust: tr, trustTxt: label(tr, TRUST_LABELS), fo, foTxt: label(fo, FO_LABELS), accepted: C.acceptY === L.year };
}
function careerAcceptRole(L) {
  const C = L.career, p = careerP(L); if (!p || p.team < 0) return 'You are not on a team.';
  if (C.acceptY === L.year) return 'You already told them.';
  C.acceptY = L.year; addTrust(L, 6); addFO(L, 3);
  careerLog(L, 'Told the coach you\'ll accept whatever role he gives you.');
  return 'The coach appreciates it. You can\'t ask to start again this season.';
}
function addTrust(L, d) { const C = L.career; C.trust = clamp(Math.round((C.trust == null ? 50 : C.trust) + d), 0, 100); }

// His role on his team
function careerRole(L, p) {
  if (!p || p.team < 0) return null;
  const d = depth(L, p.team)[p.grp] || [], i = d.findIndex(x => x.id === p.id), n = startersFor(L, p.team)[p.grp] || 1;
  return { slot: i + 1, n, starter: i >= 0 && i < n, label: i < 0 ? (p.inj ? 'Injured' : p.holdout ? 'Holding out' : 'Inactive') : i < n ? (n > 1 ? `Starter (${p.grp} ${i + 1})` : 'Starter') : i === n ? 'First off the bench' : `Backup (#${i + 1} on the depth chart)`, ahead: i >= n ? d[n - 1] : null };
}

/* --- draft day --- */
function careerDraftToMe(L) {
  const p = careerP(L); if (!L.draft || !p) return;
  while (onClock(L) !== null && p.team === -3) aiPick(L);
  if (p.team >= 0) {
    const d = p.draft; careerLog(L, `Drafted by the ${L.teams[p.team].city} ${L.teams[p.team].name}: round ${d.rnd}, pick #${d.pick}.`);
    careerAlert(L, `With pick #${d.pick}, the ${L.teams[p.team].city} ${L.teams[p.team].name} select you.`, 'good');
    L.career.trust = 50; L.career.fo = 50;
  }
}
function careerFinishDraft(L) {
  const p = careerP(L); if (!L.draft) return;
  if (p && p.team === -3) careerDraftToMe(L);
  draftAll(L); endDraft(L);
  if (p && p.team === -1) { careerLog(L, 'Went undrafted. Teams are calling with camp invitations.'); careerAlert(L, 'You went undrafted. Pick a camp invitation from the offers below.', 'warn'); }
}

/* --- contracts and offers --- */
function careerOffers(L) {
  const C = L.career, p = careerP(L); if (!p || p.team === -2 || p.team === -3 || p.retiredYear != null) return [];
  const key = `${L.year}-${L.phase}-${L.phase === 'regular' ? L.week : ''}-${p.team}`;
  if (C.offers && C.offers.key === key) return C.offers.list;
  if (C.offers && C.offers.keep && C.offers.keep === `${L.year}-${L.phase}`) return C.offers.list;
  const y = capYear(L), cap = capFor(y), list = [];
  const exp = p.team >= 0 && L.phase === 'offseason' && !onBooks(p, y), free = p.team === -1;
  if (exp || free) {
    const inSeason = L.phase === 'regular' || L.phase === 'playoffs';
    const cache = teamCache(L, y), ego = 1 + (p.ego || 0), mkt = 1 + (C.mkt || 0);
    const make = (tid, mult, own) => {
      const t = L.teams[tid], last = t.hist[t.hist.length - 1];
      const others = (cache[tid].g[p.grp] || []).slice(), n = startersFor(L, tid)[p.grp] || 1;
      const better = others.filter(o => o > p.ovr).length - (own ? 0 : 0);
      const role = better < n ? 'Starter' : better === n ? 'Rotation' : 'Backup', slot = better + 1, nStart = n;
      let sal = Math.round(priceFor(L, p, tid, y) * mult * ego * mkt * (inSeason ? 0.6 : 1));
      const minSal = Math.round(avgSalary(y) * 0.3); if (sal < minSal) sal = minSal;
      const fit = playerFit(L, p, tid);
      return { slot, nStart, fit: fit.grade, fitS: fit.score, tid, sal, yrs: inSeason ? 1 : free && value(p) < 55 ? R.int(1, 2) : contractYears(p), own: !!own, role, wins: last ? `${last.w}-${last.l}${last.t ? '-' + last.t : ''}` : '–', res: last ? last.res : '' };
    };
    if (exp) {
      const ranked = roster(L, p.team).slice().sort((a, b) => value(b) - value(a));
      if (ranked.indexOf(p) < rules(y).rosterMax && p.age < 37 && ((C.fo == null ? 50 : C.fo) >= 25 || value(p) >= 75)) list.push(make(p.team, 0.95 + Math.random() * 0.07 + ((C.fo == null ? 50 : C.fo) - 50) * 0.002, true));
    }
    const era = faEra(y), open = free || (exp && (era === 'ufa' || !list.length));
    if (open) {
      const pool = R.shuffle(interestedTeams(L, p, cache).filter(t => t.id !== p.team && (!inSeason || active(L, t.id).length <= rules(L.year).rosterMax)));
      pool.slice(0, 5).forEach(t => list.push(make(t.id, 0.88 + Math.random() * 0.22)));
      if (list.length < 2) {
        // camp invitations: teams thinnest at his position
        const thin = L.teams.filter(t => t.id !== p.team && !list.some(o => o.tid === t.id)).map(t => [t, (cache[t.id].g[p.grp] || []).length - (startersFor(L, t.id)[p.grp] || 1)]).sort((a, b) => a[1] - b[1]).slice(0, 3 - list.length);
        thin.forEach(([t]) => { const o = make(t.id, 0.7); o.sal = Math.round(avgSalary(y) * 0.3); o.yrs = 1; o.camp = 1; o.role = 'Camp invite'; list.push(o); });
      }
    }
    list.forEach(o => { if (cap != null && cache[o.tid].pay + o.sal > cap && !o.own) o.sal = Math.max(Math.round(avgSalary(y) * 0.3), Math.round(cap - cache[o.tid].pay)); });
  }
  C.offers = { key, list, keep: `${L.year}-${L.phase}` };
  return list;
}
function careerSign(L, i, shape) {
  const C = L.career, p = careerP(L), o = careerOffers(L)[+i]; if (!p || !o) return 'That offer is gone.';
  const y = capYear(L), old = p.team;
  if (o.tid !== old && (L.phase === 'regular' || L.phase === 'playoffs') && active(L, o.tid).length >= rules(L.year).rosterMax) {
    const cut = roster(L, o.tid).filter(x => !x.ir && x.id !== p.id).sort((a, b) => value(a) - value(b))[0]; if (cut) retireIfUnsigned(L, cut);
  }
  if (old >= 0 && old !== o.tid) p.prevTeam = old;
  p.team = o.tid; setContract(p, o.sal, y, o.yrs, o.yrs > 1 && SHAPES[shape] ? shape : 'flat'); delete p.holdout; delete p.askMult;
  const bon = (p.con.bon || []).filter(b => b.cur).reduce((s, b) => s + b.a, 0);
  if (bon) { C.earn = C.earn || {}; C.earn[y] = (C.earn[y] || 0) + bon; }
  if (old !== o.tid) { noteFASign(L, p, o.tid); C.trust = 50; C.fo = 50 + (o.camp ? -5 : 0); ensureNumbers(L); } else addFO(L, o.disc ? 10 : 4);
  const t = L.teams[o.tid], verb = old === o.tid ? 'Re-signed with' : 'Signed with';
  plog(L, p, `${verb} ${t.abbr}: ${o.yrs} yr${o.yrs > 1 ? 's' : ''}, ${money(p.con.sal)} a year${bon ? `, ${money(bon)} signing bonus` : ''}.`);
  addNews(L, `${t.abbr} ${old === o.tid ? 're-signed' : 'signed'} ${p.pos} ${p.name}: ${o.yrs} yr${o.yrs > 1 ? 's' : ''} at ${money(o.sal)}.`);
  careerLog(L, `${verb} the ${t.city} ${t.name}: ${o.yrs} year${o.yrs > 1 ? 's' : ''} at ${money(p.con.sal)} a year${bon ? ` (${SHAPES[p.con.shape].name.toLowerCase()}, ${money(bon)} signing bonus)` : ''}, ${o.role.toLowerCase()}.`);
  if (o.disc) addTrust(L, 10);
  C.offers = null; C.mkt = 0;
  if (L.phase === 'regular' || L.phase === 'playoffs') careerEarn(L);
  return null;
}
// Ask for more: it works about half the time; a team that says no may walk away.
function careerHaggle(L, i) {
  const o = careerOffers(L)[+i], p = careerP(L); if (!o || !p) return 'That offer is gone.';
  if (o.h) return 'You already pushed them once.';
  o.h = 1;
  const odds = clamp(0.5 + (value(p) - 70) * 0.015 + (o.own ? (L.career.trust - 50) * 0.004 : 0), 0.25, 0.8);
  if (Math.random() < odds) { o.sal = Math.round(o.sal * 1.1); return `${L.teams[o.tid].abbr} came up to ${money(o.sal)} a year.`; }
  if (Math.random() < 0.45) { careerOffers(L).splice(+i, 1); if (o.own) addTrust(L, -6); return `${L.teams[o.tid].abbr} pulled their offer.`; }
  return `${L.teams[o.tid].abbr} won't go higher.`;
}
function careerDiscount(L, i) {
  const o = careerOffers(L)[+i]; if (!o || !o.own) return 'Only your own team gets a hometown discount.';
  if (o.disc) return 'You already offered a discount.';
  o.disc = 1; o.sal = Math.round(o.sal * 0.88); o.yrs = Math.min(6, o.yrs + 1);
  return `Offer revised: ${o.yrs} years at ${money(o.sal)}. Taking it builds the coach's trust.`;
}
function careerAutoSign(L) {
  const p = careerP(L); if (!p || p.retiredYear != null) return;
  const list = careerOffers(L); if (!list.length) return;
  const best = list.map((o, i) => [i, o.sal * (o.own && p.loyal > 0 ? 1.15 : 1)]).sort((a, b) => b[1] - a[1])[0][0];
  const o = list[best];
  careerLog(L, 'Your agent took the best offer on the table.');
  careerSign(L, best);
  careerAlert(L, `You didn't pick a contract, so your agent took the best offer: ${L.teams[o.tid].city} ${L.teams[o.tid].name}, ${o.yrs} yr${o.yrs > 1 ? 's' : ''} at ${money(o.sal)}.`, 'info');
}

/* --- raises and holdouts --- */
function careerRaiseInfo(L) {
  const p = careerP(L); if (!p || p.team < 0 || !p.con) return null;
  const y = capYear(L), sal = salFor(p, y) || 0, mv = marketValue(L, p, y), rookie = p.draft && p.draft.year && y - p.draft.year < rookieYears(p.draft.year, p.draft.rnd);
  return { sal, mv, pct: mv ? Math.round(sal / mv * 100) : 100, under: sal < mv * 0.8 && p.ovr >= 65, rookie, asked: L.career.raiseY === L.year, holdout: !!p.holdout };
}
function careerAskRaise(L) {
  const p = careerP(L), I = careerRaiseInfo(L); if (!I) return 'You need a contract first.';
  if (I.rookie) return 'Rookie-scale deals can\'t be renegotiated yet.';
  if (I.asked) return 'You already asked this year.';
  if (!I.under) return `You make ${I.pct}% of your market value. Your team won't tear up a fair deal.`;
  L.career.raiseY = L.year;
  const odds = clamp(0.25 + (value(p) - 68) * 0.03 + ((L.career.fo == null ? 50 : L.career.fo) - 50) * 0.008, 0.08, 0.85);
  if (Math.random() < odds) { renegotiate(L, p.id, true); careerLog(L, `Got a new deal from ${L.teams[p.team].abbr}: ${money(salFor(p, capYear(L)))} a year.`); addTrust(L, 3); return `They agreed: ${money(salFor(p, capYear(L)))} a year.`; }
  addTrust(L, -5); addFO(L, -3); careerLog(L, 'Asked for a raise. The team said no.');
  return 'They said no. You can hold out, or play it out.';
}
function careerHoldout(L, on) {
  const p = careerP(L); if (!p || p.team < 0) return 'You are not under contract.';
  if (on) {
    const I = careerRaiseInfo(L); if (!I.asked || I.rookie || !I.under) return 'Ask for a raise first.';
    p.holdout = true; addTrust(L, -12); addFO(L, -15); careerLog(L, 'Started a holdout.'); addNews(L, `HOLDOUT: ${p.pos} ${p.name} refuses to report to ${L.teams[p.team].abbr} without a new contract.`);
    return 'You are holding out. You miss games until the team gives in or you report.';
  }
  delete p.holdout; addTrust(L, 4); careerLog(L, 'Ended the holdout and reported.'); return 'You reported to the team.';
}
function careerHoldoutWeek(L) {
  const p = careerP(L); if (!p || !p.holdout || p.team < 0) return;
  addTrust(L, -2); addFO(L, -2);
  const odds = clamp(0.1 + (value(p) - 70) * 0.012, 0.04, 0.3);
  if (Math.random() < odds) { renegotiate(L, p.id, true); delete p.holdout; careerLog(L, `The holdout worked: a new deal at ${money(salFor(p, capYear(L)))} a year.`); careerAlert(L, `Your holdout is over. ${L.teams[p.team].abbr} gave you a new contract: ${money(salFor(p, capYear(L)))} a year.`, 'good'); }
  else if (Math.random() < 0.06 && !pastDeadline(L)) careerShop(L, true);
}

/* --- asking to start --- */
function careerAskStart(L) {
  const p = careerP(L), r = careerRole(L, p); if (!r) return 'You are not on a team.';
  if (r.starter) return 'You already start.';
  if (L.career.acceptY === L.year) return 'You said you\'d accept any role this season.';
  if (L.career.startY === L.year + ':' + L.phase) return 'You already asked. Earn it on the field first.';
  L.career.startY = L.year + ':' + L.phase;
  const gap = r.ahead ? r.ahead.ovr - p.ovr : 0;
  const odds = clamp(0.55 - gap * 0.08 + (L.career.trust - 50) * 0.01, 0, 0.9);
  if (L.career.trust < 45) { addTrust(L, -3); return `The coach's trust in you is ${L.career.trust}. He wants to see more first.`; }
  if (Math.random() < odds) {
    const t = L.teams[p.team], ids = (depth(L, p.team)[p.grp] || []).map(x => x.id).filter(id => id !== p.id);
    t.dc = t.dc || {}; t.dc[p.grp] = [p.id].concat(ids); L.career.forced = { tid: p.team, g: p.grp, y: L.year };
    careerLog(L, `Won the starting job${r.ahead ? ' over ' + r.ahead.name : ''}.`); addTrust(L, -2);
    return 'The coach agreed: you\'re the starter.';
  }
  addTrust(L, -4); return `The coach is sticking with ${r.ahead ? r.ahead.name : 'the starter'} for now.`;
}

/* --- trade requests: after two weeks the team shops you and brings back deals --- */
function careerRequestTrade(L, kind) {
  const p = careerP(L); if (!p || p.team < 0) return 'You are not on a team.';
  if (L.phase === 'draft') return 'Wait until the draft is over.';
  L.career.treq = { kind: kind || 'any', at: nowKey(L), wk: L.phase === 'regular' ? L.week : -1, y: L.year, ph: L.phase };
  addTrust(L, -15); addFO(L, -10); careerLog(L, `Asked for a trade (${({ contender: 'to a contender', start: 'somewhere you would start', scheme: 'to a scheme that fits you', any: 'anywhere' })[kind] || 'anywhere'}).`);
  addNews(L, `${p.pos} ${p.name} has asked ${L.teams[p.team].abbr} for a trade.`);
  return 'Your request is in. Give the team a couple of weeks to shop you.';
}
function careerCancelTrade(L) { const C = L.career; if (!C.treq) return null; C.treq = null; C.deals = null; addTrust(L, 5); careerLog(L, 'Took back the trade request.'); return 'Request withdrawn.'; }
function canTradeNow(L) { return L.phase === 'offseason' || L.phase === 'preseason' || L.phase === 'season-over' || (L.phase === 'regular' && !pastDeadline(L)); }
function careerShop(L, force) {
  const C = L.career, p = careerP(L); if (!p || p.team < 0 || !canTradeNow(L)) return;
  const R0 = C.treq || { kind: 'any' };
  if (!force && C.treq) { const weeks = L.phase === 'regular' && C.treq.ph === 'regular' && C.treq.y === L.year ? L.week - C.treq.wk : 2; if (weeks < 2) return; }
  const from = p.team, y = capYear(L), sal = salFor(p, y) || 0, cap = capFor(y);
  // a team won't move its best player on a long deal unless the relationship is broken
  const best = roster(L, from).slice().sort((a, b) => value(b) - value(a))[0];
  if (!force && best === p && p.con && p.con.exp - y >= 2 && C.trust > 20) { if (!C.deals || !C.deals.length) careerAlert(L, `${L.teams[from].abbr} won't trade its best player with ${p.con.exp - y + 1} years left on his deal. Keep asking and the relationship may break.`, 'warn'); return; }
  const want = playerWeight(p) * 0.7;
  let cands = L.teams.filter(t => t.id !== from && (cap == null || payroll(L, t.id, y) + sal <= cap));
  if (R0.kind === 'contender') cands = cands.filter(t => { const l = t.hist[t.hist.length - 1]; return (l && l.res !== 'Missed playoffs') || teamOverall(L, t.id) >= 70; });
  if (R0.kind === 'scheme') { const cur = playerFit(L, p, from).score; cands = cands.filter(t => { const f = playerFit(L, p, t.id).score; return f >= Math.max(70, cur + 5); }); }
  if (R0.kind === 'start') cands = cands.filter(t => { const d = (depth(L, t.id)[p.grp] || []).filter(x => x.id !== p.id), n = startersFor(L, t.id)[p.grp] || 1; return !d[n - 1] || d[n - 1].ovr < p.ovr; });
  const deals = [];
  for (const t of R.shuffle(cands)) {
    const ks = teamPicks(L, t.id).filter(k => tradeablePick(k) && k.y >= firstPickYear(L)).sort((a, b) => pickWeight(L, a) - pickWeight(L, b));
    let pk = ks.find(k => pickWeight(L, k) >= want), picks = pk ? [pk.id] : ks.slice(-2).map(k => k.id);
    if (!picks.length) continue;
    deals.push({ tid: t.id, picks });
    if (deals.length >= 3) break;
  }
  if (!deals.length) { if (force) return; careerAlert(L, 'Your team shopped you but found no deal yet. It keeps looking.', 'info'); return; }
  C.deals = { y: L.year, ph: L.phase, wk: L.week, list: deals };
  if (force) { careerTakeDeal(L, 0, true); return; }
  careerAlert(L, `${L.teams[from].abbr} found ${deals.length} deal${deals.length > 1 ? 's' : ''} for you. Pick one on the Career tab.`, 'good');
}
function careerTakeDeal(L, i, forced) {
  const C = L.career, p = careerP(L), d = C.deals && C.deals.list[+i]; if (!d || !p || p.team < 0) return 'That deal is gone.';
  if (!canTradeNow(L)) return 'Trades are closed right now.';
  if (d.picks.some(id => { const k = pickById(L, id); return !k || k.own !== d.tid; })) { C.deals.list.splice(+i, 1); return 'That deal fell through.'; }
  const from = p.team;
  execTrade(L, from, d.tid, { players: [p.id], picks: [] }, { players: [], picks: d.picks });
  C.treq = null; C.deals = null; C.trust = 50; C.fo = 50;
  const t = L.teams[d.tid];
  careerLog(L, `Traded from ${L.teams[from].abbr} to the ${t.city} ${t.name}${forced ? '' : ' (your request)'}.`);
  careerAlert(L, `You've been traded to the ${t.city} ${t.name}.`, forced ? 'warn' : 'good');
  return null;
}
function careerDeclineDeals(L) { const C = L.career; C.deals = null; if (C.treq) C.treq.wk = L.week; return 'Your team will keep looking.'; }

/* --- training --- */
const CAREER_FOCUS = {
  technique: { name: 'Technique', txt: 'Footwork and hand work. Small gains at any position.', g: GRPS },
  strength: { name: 'Strength', txt: 'Weight room. Best for linemen, tight ends, backs and linebackers.', g: ['OL', 'DL', 'TE', 'RB', 'LB'] },
  speed: { name: 'Speed', txt: 'Track work. Best for receivers, backs and defensive backs; slows decline after 28.', g: ['WR', 'RB', 'DB', 'LB'] },
  film: { name: 'Film study', txt: 'Learn the playbook. Best for quarterbacks, linebackers and safeties.', g: ['QB', 'LB', 'DB'] },
  kicking: { name: 'Kicking', txt: 'Range and accuracy. For kickers and punters.', g: ['K', 'P'] },
  recovery: { name: 'Rest and recovery', txt: 'Fewer injuries and a slower decline. No growth.', g: [] }
};
const FOCUS_ATTR = { strength: ['pow', 'str', 'rbk', 'rdf', 'blk', 'phy', 'arm'], speed: ['spd', 'mob', 'qck', 'elu', 'ftw'], film: ['acc', 'pkt', 'rte', 'cov', 'bsk', 'pbk'], kicking: ['kpw', 'kac'] };
function setCareerDrill(L, k) { const p = careerP(L); if (p && (ATTR_KEYS[p.grp] || []).includes(k)) L.career.drill = k; else if (!k) L.career.drill = null; }
const CAREER_PLANS = { light: { name: 'Light', inj: 0.8, gain: 0.6 }, balanced: { name: 'Balanced', inj: 1, gain: 1 }, extra: { name: 'Extra work', inj: 1.3, gain: 1.4 } };
function setCareerFocus(L, f) { if (CAREER_FOCUS[f]) L.career.focus = f; }
function setCareerPlan(L, k) { if (CAREER_PLANS[k]) L.career.plan = k; }
function careerDurMult(L, p) { const plan = CAREER_PLANS[L.career.plan] || CAREER_PLANS.balanced; return clamp(1 - (p.cdur || 0) * 0.12, 0.55, 1.45) * plan.inj * (L.career.focus === 'recovery' ? 0.8 : 1); }
// Called from progress(): the season's training work turns into growth.
function careerGrowth(L, p, d) {
  const C = L.career, f = CAREER_FOCUS[C.focus] || CAREER_FOCUS.technique, plan = CAREER_PLANS[C.plan] || CAREER_PLANS.balanced;
  const games = (p.hist[L.year] && p.hist[L.year].g) || 0, work = 0.5 + Math.min(1, games / Math.max(1, rules(L.year).games)) * 0.5;
  let b = 0;
  if (C.focus === 'recovery') { if (d < 0) b += 2; }
  else if (f.g.includes(p.grp)) b += (p.age <= 29 ? 1.6 : 1.1) * plan.gain * work;
  else b += 0.6 * plan.gain * work;
  if (C.focus === 'speed' && p.age >= 28 && d < 0) b += 1;
  if (p.age <= 28) b += (p.cdev || 0) * 0.7;
  if (p.age <= 24 && p.ciq) b += p.ciq * 0.3;
  b = Math.round(b + Math.random() - 0.5);
  C.lastCamp = { y: L.year + 1, focus: C.focus, plan: C.plan, base: d, bonus: b };
  // the rating he drilled moves up relative to the others; the focus nudges its group
  const keys = ATTR_KEYS[p.grp] || [];
  if (C.drill && keys.includes(C.drill)) { const g = Math.round((p.age <= 29 ? 3 : 2) * plan.gain * work); bumpAttr(p, C.drill, g); C.lastCamp.drill = C.drill; C.lastCamp.drillUp = g; }
  const FA = FOCUS_ATTR[C.focus]; if (FA) keys.forEach(k => { if (FA.includes(k)) bumpAttr(p, k, 1); });
  if (b > 0 && !(L.realCareers !== false && p.rc) && p.ovr + d + b > p.pot && p.age <= 27) p.pot = Math.min(97, p.pot + 1);
  return b;
}

/* --- goals, awards race, milestones --- */
const GOAL_STAT = { QB: ['py', 'passing yards', 3700], RB: ['ry', 'rushing yards', 1200], WR: ['recy', 'receiving yards', 1100], TE: ['recy', 'receiving yards', 750], DL: ['sk', 'sacks', 10], LB: ['sk', 'sacks', 6], DB: ['dint', 'interceptions', 5], K: ['fgm', 'field goals', 28] };
function careerSetGoals(L) {
  const C = L.career, p = careerP(L); if (!p || p.team < 0 || p.retiredYear != null) { C.goals = null; return; }
  const g = [], r = careerRole(L, p), gm = rules(L.year).games / 16, E = era(L.year);
  const S = GOAL_STAT[p.grp];
  if (S) {
    const scale = clamp((p.ovr - 50) / 32, 0.25, 1.05), eraM = S[0] === 'py' ? E.pyds / 225 : S[0] === 'ry' ? E.ryds / 115 : 1;
    let n = S[2] * scale * gm * eraM * (r && r.starter ? 1 : 0.35); n = S[2] >= 100 ? Math.max(50, Math.round(n / 50) * 50) : Math.max(1, Math.round(n));
    g.push({ k: 'stat', s: S[0], n, txt: `${n.toLocaleString('en-US')} ${S[1]}` });
  }
  else g.push({ k: 'games', n: Math.round(rules(L.year).games * 0.85), txt: `Play ${Math.round(rules(L.year).games * 0.85)} games` });
  const rank = L.teams.map(t => [t.id, teamOverall(L, t.id)]).sort((a, b) => b[1] - a[1]).findIndex(x => x[0] === p.team) + 1;
  g.push(rank <= 6 ? { k: 'conf', txt: 'Reach the conference championship' } : rank <= L.teams.length / 2 ? { k: 'po', txt: 'Make the playoffs' } : { k: '500', txt: 'Finish .500 or better' });
  g.push(r && !r.starter ? { k: 'start', txt: 'Win a starting job' } : p.ovr >= 78 ? { k: 'ap', txt: 'Make an All-Pro team' } : { k: 'games', n: Math.round(rules(L.year).games * 0.9), txt: `Start ${Math.round(rules(L.year).games * 0.9)} games` });
  C.goals = { y: L.year, list: g };
}
function goalMet(L, p, g) {
  const h = p.hist[L.year] || {}, t = L.teams[p.team], P = L.playoffs;
  if (g.k === 'stat') return (h[g.s] || 0) >= g.n;
  if (g.k === 'games') return (h.g || 0) >= g.n;
  if (g.k === 'start') { const r = careerRole(L, p); return !!(r && r.starter); }
  if (g.k === 'ap') return (p.awards || []).some(a => a.y === L.year && (a.a === 'ap1' || a.a === 'ap2'));
  if (!t) return false;
  if (g.k === '500') return t.w + t.t / 2 >= t.l + t.t / 2;
  if (g.k === 'po') return !!(P && P.seeds[t.conf].includes(t.id));
  if (g.k === 'conf') return !!(P && P.rounds.some(r => r.name === 'Conference Championships' && r.games.some(x => x.h === t.id || x.a === t.id)));
  return false;
}
function careerGoalStatus(L) { const C = L.career, p = careerP(L); if (!C.goals || !p || C.goals.y !== L.year) return []; return C.goals.list.map(g => Object.assign({ met: goalMet(L, p, g) }, g)); }
function careerAwardRace(L) {
  const p = careerP(L); if (!p || L.phase !== 'regular' || L.week < 6) return null;
  const y = L.year, cand = [];
  for (const id in L.players) {
    const q = L.players[id], h = q.hist[y]; if (!h || h.tm == null || (h.g || 0) < Math.max(3, L.week / 2)) continue;
    const t = L.teams[h.tm], wp = pct(L, t), off = OFFG.includes(q.grp) ? offScore(h) : 0, def = DEFG.includes(q.grp) ? defScore(h, q) : 0;
    cand.push({ q, h, off, def, wp, rookie: (q.yrs || 0) === 0 });
  }
  const me = cand.find(c => c.q.id === p.id); if (!me) return null;
  const rank = f => 1 + cand.filter(c => f(c) > f(me)).length;
  const out = [{ k: 'MVP', r: rank(c => c.off ? c.off + c.wp * 60 : c.def * 1.6 + c.wp * 60) }];
  if (me.off) out.push({ k: 'Offensive Player of the Year', r: rank(c => c.off) });
  if (me.def) out.push({ k: 'Defensive Player of the Year', r: rank(c => c.def) });
  if (me.rookie) out.push({ k: 'Rookie of the Year', r: rank(c => c.rookie ? Math.max(c.off, c.def * 2.2) : -1) });
  const ap = cand.filter(c => c.q.grp === p.grp).map(c => apScore(c.q, c.h)).sort((a, b) => b - a), mine = apScore(p, me.h);
  out.push({ k: `All-Pro (${p.grp})`, r: 1 + ap.filter(v => v > mine).length });
  return out;
}
const MILESTONES = { py: [10000, 20000, 30000, 40000, 50000, 60000, 70000], ptd: [100, 200, 300, 400, 500], ry: [5000, 10000, 15000], rtd: [50, 100, 150], recy: [5000, 10000, 15000], rec: [500, 1000, 1500], rectd: [50, 100, 150], sk: [50, 100, 150, 200], dint: [25, 50], fgm: [200, 300, 400, 500], g: [100, 200, 300] };
const STAT_NAME = { py: 'passing yards', ptd: 'touchdown passes', ry: 'rushing yards', rtd: 'rushing touchdowns', recy: 'receiving yards', rec: 'receptions', rectd: 'receiving touchdowns', sk: 'sacks', dint: 'interceptions', fgm: 'field goals', g: 'games' };
function careerTotal(p, k) { let s = 0; for (const y in p.hist) s += p.hist[y][k] || 0; return s; }
function careerMilestones(L, before) {
  const C = L.career, p = careerP(L); if (!p) return;
  for (const k in MILESTONES) {
    const b = before[k] || 0, a = careerTotal(p, k);
    for (const m of MILESTONES[k]) if (b < m && a >= m) { const t = `Career milestone: ${m.toLocaleString('en-US')} ${STAT_NAME[k]}.`; C.ms.unshift({ y: L.year, txt: t }); careerLog(L, t); careerAlert(L, t, 'good'); }
  }
}

/* --- one week, the season, the year --- */
function snapTotals(p) { const o = {}; for (const k in MILESTONES) o[k] = careerTotal(p, k); return o; }
function careerWeek(L) {
  const C = L.career, p = careerP(L); if (L.phase !== 'regular') return;
  careerHoldoutWeek(L);
  if (C.treq && !C.deals) careerShop(L);
  const y = L.year, wk = L.week, before = p ? Object.assign({}, p.hist[y] || {}) : {}, tot = p ? snapTotals(p) : {}, tid = p ? p.team : -1;
  const startTeam = p && p.team;
  simWeek(L);
  if (!p || p.retiredYear != null) return;
  const g = tid >= 0 && L.schedule[wk] ? L.schedule[wk].find(x => x.h === tid || x.a === tid) : null, h = p.hist[y] || {}, line = {};
  for (const k in h) if (typeof h[k] === 'number' && k !== 'tm') { const d = h[k] - (before[k] || 0); if (d) line[k] = d; }
  if (g && g.done) {
    const home = g.h === tid, my = home ? g.hs : g.as, op = home ? g.as : g.hs;
    C.games.unshift({ y, wk: wk + 1, tid, opp: home ? g.a : g.h, home, my, op, res: my > op ? 'W' : my < op ? 'L' : 'T', line, why: line.g ? null : p.holdout ? 'Holdout' : p.inj ? (p.injT ? 'Out: ' + p.injT.toLowerCase() : 'Injured') : 'Did not play', wx: g.wx, gm: Object.assign({ wk: 'Week ' + (wk + 1) }, g, { box: slimBox(g.box) }) });
    C.games = C.games.slice(0, 120);
    const sc = OFFG.includes(p.grp) ? offScore(line) : DEFG.includes(p.grp) ? (line.sk || 0) * 4 + (line.dint || 0) * 5 : 0;
    addTrust(L, (my > op ? 0.8 : my < op ? -0.5 : 0) + (sc >= 18 ? 1.5 : sc >= 9 ? 0.6 : 0));
    if (sc >= 18) addFO(L, 0.6);
  } else if (tid >= 0) C.games.unshift({ y, wk: wk + 1, tid, bye: 1, line: {} });
  if (p.inj >= 4 && !(before.injNoted === p.inj)) { /* injury alert below */ }
  if (p.inj && !C.injAlert) { careerAlert(L, `You're hurt: ${injText(p).replace(/^./, c => c.toLowerCase())}.`, 'inj'); C.injAlert = 1; }
  if (!p.inj) C.injAlert = 0;
  if (startTeam >= 0 && p.team !== startTeam && p.team >= 0 && !C.deals) { C.trust = 50; C.fo = 50; }
  if (startTeam >= 0 && p.team !== startTeam && p.team >= 0 && !C.deals) careerAlert(L, `You've been traded to the ${L.teams[p.team].city} ${L.teams[p.team].name}.`, 'warn');
  if (startTeam >= 0 && p.team === -1) { careerAlert(L, `${L.teams[startTeam].abbr} released you. Teams with room may call.`, 'bad'); careerLog(L, `Released by ${L.teams[startTeam].abbr}.`); C.offers = null; }
  careerMilestones(L, tot);
  careerSchemeCheck(L);
  if (p.team >= 0 && (C.fo == null ? 50 : C.fo) < 20 && !C.deals && canTradeNow(L) && Math.random() < 0.05) { careerAlert(L, 'Trade rumors: the front office is shopping you.', 'warn'); careerShop(L, true); }
  // losing the job
  const r = careerRole(L, p); if (r && C.wasStarter && !r.starter && !p.inj && !p.holdout) careerAlert(L, `You've lost your starting job to ${r.ahead ? r.ahead.name : 'a teammate'}.`, 'warn');
  C.wasStarter = !!(r && r.starter);
}
function careerPlayoffRound(L) {
  const p = careerP(L), tid = p ? p.team : -1, name = roundName(L);
  simPlayoffRound(L);
  if (!p || tid < 0 || !L.playoffs) return;
  const rd = L.playoffs.rounds[L.playoffs.rounds.length - 1], g = rd && rd.games.find(x => x.h === tid || x.a === tid);
  if (g) { const home = g.h === tid, my = home ? g.hs : g.as, op = home ? g.as : g.hs; L.career.games.unshift({ y: L.year, wk: name, tid, opp: home ? g.a : g.h, home, my, op, res: my > op ? 'W' : 'L', line: careerBoxLine(g, p), po: 1, wx: g.wx, gm: Object.assign({ wk: name }, g, { box: slimBox(g.box) }) }); if (name === 'Super Bowl' && my > op) { careerLog(L, `Won Super Bowl ${roman(L.year - 1965)}.`); careerAlert(L, `Super Bowl champions! You won Super Bowl ${roman(L.year - 1965)}.`, 'good'); } }
}
// Playoff stats don't go into season totals, so read his line from the box score
function careerBoxLine(g, p) {
  const l = g.box && g.box.lines && g.box.lines.find(x => x.id === p.id || (x.n === p.name && x.pos === p.pos));
  if (!l) return {};
  const o = { g: 1 }; ['cmp', 'att', 'py', 'ptd', 'int', 'ra', 'ry', 'rtd', 'rec', 'recy', 'rectd', 'sk', 'dint', 'fgm'].forEach(k => { if (l[k]) o[k] = l[k]; });
  return o;
}
function careerSeasonEnd(L) {
  const C = L.career, p = careerP(L); if (!p || C.endY === L.year) return;
  C.endY = L.year;
  const met = careerGoalStatus(L).filter(g => g.met).length, tot = C.goals && C.goals.y === L.year ? C.goals.list.length : 0;
  const awn = (p.awards || []).filter(a => a.y === L.year).length;
  if (p.team >= 0) { const sal = salFor(p, L.year) || 0, mv = marketValue(L, p, L.year) || 1; addFO(L, met * 3 - (tot - met) + awn * 4 + (sal < mv * 0.8 ? 3 : sal > mv * 1.4 ? -4 : 0) - (p.inj >= 6 ? 2 : 0)); }
  if (tot) { addTrust(L, met * 4 - (tot - met) * 2); C.mkt = met * 0.03; careerLog(L, `${L.year} season goals: met ${met} of ${tot}.`); }
  const aw = (p.awards || []).filter(a => a.y === L.year).map(a => AWARD_NAMES[a.a]);
  if (aw.length) { careerLog(L, `${L.year} honors: ${aw.join(', ')}.`); careerAlert(L, `${L.year} honors: ${aw.join(', ')}.`, 'good'); }
  C.seasons[L.year] = { tid: p.team, ovr: p.ovr, met, tot, trust: C.trust, fo: C.fo };
}
// The next stop: what one tap of the big button does.
function careerNext(L, imports, how) {
  const C = L.career, p = careerP(L);
  if (!C) return 'No career.';
  const e = careerNext0(L, imports, how); careerSchemeCheck(L); return e;
}
function careerNext0(L, imports, how) {
  const C = L.career, p = careerP(L);
  if (L.phase === 'draft') { if (p && p.team === -3 && how !== 'finish') careerDraftToMe(L); else careerFinishDraft(L); return null; }
  if (L.phase === 'season-over') {
    careerSeasonEnd(L); startDraft(L, imports); careerFinishDraft(L);
    const q = careerP(L), n = careerOffers(L).length;
    if (q && q.team >= 0 && n && !onBooks(q, capYear(L))) careerAlert(L, `Your contract is up. Your agent has ${n} offer${n > 1 ? 's' : ''} for you: pick one on the Career tab before training camp.`, 'warn');
    return null;
  }
  if (L.phase === 'offseason') {
    if (p && p.retiredYear == null && careerOffers(L).length && (p.team === -1 || !onBooks(p, capYear(L)))) careerAutoSign(L);
    if (C.treq && !C.deals && canTradeNow(L)) careerShop(L);
    C.alerts = C.alerts.filter(a => a.y >= L.year);
    const before = p ? p.ovr : 0;
    startNextSeason(L);
    const q = careerP(L);
    if (q && q.retiredYear != null && !C.retired) {
      const why = { injury: 'Your body couldn\'t take another season. The injury ended your career.', age: 'Age caught up with you. Nobody would give you another season, and you retired.', ability: 'No team called. Your playing days are over.' }[C.endWhy] || 'Your career is over.';
      careerVerdict(L, q); careerLog(L, why); careerAlert(L, why, 'bad'); return null;
    }
    if (q && q.retiredYear == null && C.lastCamp) careerLog(L, `Training camp ${L.year}: ${q.ovr - before >= 0 ? '+' : ''}${q.ovr - before} to ${q.ovr} overall (${CAREER_FOCUS[C.lastCamp.focus].name.toLowerCase()} summer).`);
    return null;
  }
  if (L.phase === 'preseason') {
    if (C.forced) { const t = L.teams[C.forced.tid]; if (t && t.dc) delete t.dc[C.forced.g]; C.forced = null; }
    const tid = p ? p.team : -1;
    const e = startRegular(L); if (e) return e;
    if (p && tid >= 0 && p.team === -1) { careerAlert(L, `${L.teams[tid].abbr} cut you in training camp. Look for a new team below.`, 'bad'); careerLog(L, `Cut by ${L.teams[tid].abbr} at the end of camp.`); C.offers = null; }
    careerSetGoals(L); careerEarn(L); C.wasStarter = !!(careerRole(L, p) || {}).starter;
    return null;
  }
  if (L.phase === 'regular') {
    if (how === 'season') {
      // stop early when something needs an answer: a deal to pick, a trade, a release
      const a0 = C.aid || 0;
      while (L.phase === 'regular') { careerWeek(L); if (C.deals || ((C.aid || 0) !== a0 && C.alerts[0] && (C.alerts[0].kind === 'bad' || C.alerts[0].kind === 'warn' || /deal/.test(C.alerts[0].txt)))) break; }
    }
    else careerWeek(L);
    return null;
  }
  if (L.phase === 'playoffs') {
    if (how === 'season') { while (L.phase === 'playoffs') careerPlayoffRound(L); }
    else careerPlayoffRound(L);
    if (L.phase === 'season-over') careerSeasonEnd(L);
    return null;
  }
  return null;
}
// After retiring: one tap plays a whole year.
function careerSimYear(L, imports) {
  let guard = 0; const y0 = L.year;
  while (guard++ < 400) {
    if (L.phase === 'offseason' && L.year > y0) break;
    if (L.phase === 'preseason') startRegular(L);
    else if (L.phase === 'regular') simWeek(L);
    else if (L.phase === 'playoffs') { simPlayoffRound(L); if (L.phase === 'season-over' && L.career) careerCoachYear(L); }
    else if (L.phase === 'season-over') { startDraft(L, imports); draftAll(L); endDraft(L); }
    else if (L.phase === 'draft') { draftAll(L); endDraft(L); }
    else if (L.phase === 'offseason') startNextSeason(L);
  }
}

/* --- retiring, the Hall of Fame and jerseys --- */
function hofLine(L, g) {
  const pool = []; Object.values(L.retired || {}).forEach(p => { if (p.grp === g && Object.keys(p.hist).length >= 5) pool.push(careerScore(p)); });
  // too few retired careers yet: use the top active careers at the position as a stand-in
  if (pool.length < 20) Object.values(L.players).forEach(p => { if (p.grp === g && Object.keys(p.hist).length >= 5) pool.push(careerScore(p) * 1.3); });
  const a = pool.sort((x, y) => y - x); if (a.length < 10) return null;
  return a[Math.floor(a.length * (g === 'K' || g === 'P' ? 0.01 : 0.03))];
}
function careerCanRetire(L) { const p = careerP(L); return !!p && p.retiredYear == null && (L.phase === 'offseason' || L.phase === 'preseason' || L.phase === 'season-over'); }
function careerRetire(L) {
  const C = L.career, p = careerP(L); if (!careerCanRetire(L)) return 'You can retire after the season, in the offseason, or in training camp.';
  if (p.team >= 0) plog(L, p, `Retired from ${L.teams[p.team].abbr} after ${p.yrs || 0} season${p.yrs === 1 ? '' : 's'}.`);
  p.team = -2; p.retiredYear = L.phase === 'preseason' ? L.year : L.year + 1; delete p.con; delete p.holdout;
  careerVerdict(L, p);
  careerLog(L, `Retired after ${Object.keys(p.hist || {}).length} season${Object.keys(p.hist || {}).length === 1 ? '' : 's'}.`);
  addNews(L, `${p.pos} ${p.name} announces his retirement after ${Object.keys(p.hist || {}).length} season${Object.keys(p.hist || {}).length === 1 ? '' : 's'}.`);
  return null;
}
function careerVerdict(L, p) {
  const C = L.career;
  C.retired = p.retiredYear;
  // the verdict, as of four years later
  const line = hofLine(L, p.grp), s = careerScore(p);
  C.verdict = { score: Math.round(s), line: line && Math.round(line), hof: line != null && s >= line, pct: line ? Math.round(s / line * 100) : null };
  const cnt = {}; Object.values(p.hist || {}).forEach(h => { if (h.tm != null) cnt[h.tm] = (cnt[h.tm] || 0) + 1; });
  C.verdict.jerseys = Object.entries(cnt).filter(([tid, n]) => (C.verdict.hof && n >= 4) || (n >= 10 && (p.peak || 0) >= 80) || (n >= 7 && C.verdict.pct >= 85)).map(([tid]) => +tid);
  C.verdict.jerseys.forEach(tid => { const t = L.teams[tid]; if (t && !(t.ring || []).some(r => r.id === p.id)) retireNumber(L, tid, p.id, 'ai'); });
}
// Rank against everyone who has played in this league at his position
const CAREER_KEYS = { QB: ['py', 'ptd'], RB: ['ry', 'rtd', 'recy'], WR: ['recy', 'rec', 'rectd'], TE: ['recy', 'rec', 'rectd'], DL: ['sk'], LB: ['sk', 'dint'], DB: ['dint'], K: ['fgm'], OL: ['g'], P: ['g'] };
function careerRanks(L, p) {
  p = p || careerP(L); if (!p) return [];
  const all = allPlayers(L).filter(x => x.grp === p.grp && Object.keys(x.hist || {}).length);
  if (!all.includes(p)) all.push(p);
  const out = (CAREER_KEYS[p.grp] || ['g']).map(k => {
    const vals = all.map(x => ({ x, v: careerTotal(x, k) })).sort((a, b) => b.v - a.v), mine = careerTotal(p, k);
    return { k, label: STAT_NAME[k], v: mine, rank: 1 + vals.filter(v => v.v > mine).length, of: vals.length, top: vals.slice(0, 3).map(v => ({ id: v.x.id, name: v.x.name, v: v.v })) };
  });
  const sc = all.map(x => careerScore(x)).sort((a, b) => b - a), ms = careerScore(p);
  out.push({ k: 'legacy', label: 'legacy score', v: Math.round(ms), rank: 1 + sc.filter(v => v > ms).length, of: sc.length, top: [] });
  return out;
}
function careerLegacy(L) {
  const C = L.career, p = careerP(L); if (!p) return null;
  const line = hofLine(L, p.grp), s = careerScore(p);
  const rings = L.champs.filter(c => p.hist[c.y] && p.hist[c.y].tm === c.champ).map(c => c.y);
  const jerseys = L.teams.filter(t => (t.ring || []).some(r => r.id === p.id)).map(t => ({ tid: t.id, num: t.ring.find(r => r.id === p.id).num }));
  return { score: Math.round(s), line: line && Math.round(line), pct: line ? Math.round(s / line * 100) : null, rings, jerseys, hof: p.hof || 0, verdict: C.verdict || null };
}

const API = { expPick, expAutoPick, expAutoAll, expStop, expOnClock, expCanTake, expRules, scoutSkill, STAFF_ROLES, budgetInfo, staffSpend, staffSal, staffAsk, scoutErr, medMul, scoutRead, shownOvr, revealWeek, marketOf, playerType, capPlan, minSalary, psPay, ensureAllAttrs, refreshAttrs, bodyText, careerAttrPreview, setCareerDrill, ATTR_SHORT, ATTR_KEYS, ATTR_NAME, attrs, attrOf, attrDelta, topAttr, attrSource, htText, ensureAttrs, attrFit, CAREER_STYLES, injText, injName, careerAgain, execTrade, setContract, SHAPES, contractTable, restructure, restructureInfo, june1Left, cashFor, baseFor, proLeft, careerScheme, careerStanding, careerAcceptRole, PB_SLOTS, proBowl, stadium, forecast, wxText, wxEffect, recordBook, REC_KEYS, careerSwitchOpts, careerSwitch, careerEarnings, careerCoachOpts, careerBecomeCoach, careerCoachNow, careerFrontOfficeOpts, careerToGM, NO_TEAM, CAREER_TIERS, CAREER_Q, CAREER_GRPS, CAREER_POS, CAREER_FOCUS, CAREER_PLANS, careerPreview, careerClass, startCareer, careerCreate, careerChooseReal, careerP, isCareer, careerRole, careerOffers, careerSign, careerHaggle, careerDiscount, careerRaiseInfo, careerAskRaise, careerHoldout, careerAskStart, careerRequestTrade, careerCancelTrade, careerTakeDeal, careerDeclineDeals, canTradeNow, setCareerFocus, setCareerPlan, careerGoalStatus, careerAwardRace, careerNext, careerSimYear, careerCanRetire, careerRetire, careerRanks, careerLegacy, careerTotal, hofLine, dismissAlert, STAT_NAME, COLLEGES, plog, practiceSquad, unsignedRights, psSize, psEligible, toPracticeSquad, promoteFromPS, signFromPS, signRefuserIfMoved, optionInfo, exerciseOption, declineOption, transitionTag, tagPrice, tradeablePick, rookieYears, playerFit, moraleReasons, holdoutInfo, marketFor, marketView, footballIQ, teamFit, roleTag, chemistry, gradeLetter, schemeSince, offPers, defPers, formation, startersFor, persLabel, shopBlock, setDrafts, setRealData, hasReal, rcRating, teamsAt, START_FIRST, START_LAST, DATA_LAST, committedPay, tradeVerdict, receiverWeight, pkgWeight, playerWeight, value, makeOffer, budgetFor, limitFor, deadFor, deadCharge, OFF_SCHEMES, DEF_SCHEMES, SCHEME, schemesFor, schemeFit, schemeTrend, schemeShare, schemeEdge, trendWord, setScheme, findTrades, ringEligible, retireNumber, seasonsWith, upcomingExpansion, userExpList, toggleExp, expRules, active, canIR, placeIR, irReturnInfo, activateIR, irRules, acceptDraftOffer, declineDraftOffer, slotNo, AP_SLOTS, ensureNextClass, scoutedYet, tradeLocked, lockText, ROLE_NAME, ensureStaff, staffBonus, fireCoach, hireCoach, coachAcceptP, coachWindow, takeJob, careerScore, mor, moraleWord, underpaid, renegotiate, renegotiatePrice, DEADLINE_WEEK, pastDeadline, boxLine, boxStar, salFor, fitFor, priceFor, resignPrice, offerScore, baseAsk, placeBid, withdrawBid, bidOutlook, advanceFA, interestedTeams, extInfo, extend, FA_ROUNDS, getP, allPlayers, capFor, avgSalary, capYear, faEra, ERA_INFO, money, payroll, capSpace, expiring, askPrice, tenderPrice, isRestricted, compPicks, resign, franchiseTag, letGo, matchSheet, declineSheet, sheetTargets, sendSheet, toggleProtect, planBPool, signFA, onBooks, ensureFA, marketValue, era, AWARD_NAMES, DIFF, diff, setDifficulty, DEF_VS, HURT_PENALTY, eff, canPlayHurt, depthChart, setDepth, moveDepth, resetDepth, setStarterQB, setPlayHurt, gamePlan, setGamePlan, clearGamePlan, coachFor, nextGame, ensureLeague, R, clamp, rules, EVENTS, TEAMS_1970, GRPS, STARTERS, grpOf, parseCSV, parsePFR, newLeague, roster, freeAgents, depth,
  value, release, sign, proposeTrade, tradeVerdict, teamPicks, pickById, pickLabel, projectedOverall, pickWeight, playerWeight, ensurePicks, myDraftSlots, aiTrades, acceptOffer, rejectOffer, offerValid, cutTo, ratings, teamOverall, startRegular, canStartSeason, simWeek, simPlayoffRound, roundName,
  sortTeams, divisions, pct, startDraft, onClock, makePick, aiPick, draftUntilUser, draftAll, scoutPlayer, beginDraft, SCOUT_VISITS, endDraft, startNextSeason, leaders, potKnown, shownPot, roman, addNews };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.GG = API;
})(typeof window !== 'undefined' ? window : globalThis);
