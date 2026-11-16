/* Gridiron GM — interface */
(function () {
'use strict';
const G = window.GG;
const APP_VERSION = '2026-11-15i';
let SLOT = (() => { try { return localStorage.getItem('gg-slot') === 'career' ? 'career' : 'league'; } catch (e) { return 'league'; } })();
let L = null;                       // league
let IM = { rosters: {}, drafts: {} }; // imported PFR data
const ui = { tab: 'home', grp: 'ALL', lg: 'stand', leadKey: 'py', resWeek: null, open: null, confirm: null,
  tradeTeam: null, give: [], get: [], faGrp: 'ALL', draftGrp: 'ALL', msg: null, impKind: 'roster', impTeam: 'nor', impYear: 1971 };

/* ---------- storage (IndexedDB, falls back to localStorage; saves are gzip-compressed) ---------- */
const ZIP = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
async function gz(str) { return await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer(); }
async function gunz(buf) { return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); }
function b64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(str) { const b = atob(str), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; }
async function pack(v) { // value -> what gets stored
  if (v == null || !ZIP) return v;
  return { gz: 1, data: await gz(JSON.stringify(v)) };
}
async function unpack(v) { // stored -> value (old uncompressed saves still load)
  if (v && v.gz === 1) return JSON.parse(await gunz(typeof v.data === 'string' ? unb64(v.data) : v.data));
  return v;
}
const DB = {
  db: null,
  open() {
    return new Promise(res => {
      try {
        const rq = indexedDB.open('gridiron-gm', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
        rq.onsuccess = () => { DB.db = rq.result; res(); };
        rq.onerror = () => res();
      } catch (e) { res(); }
    });
  },
  async get(k) {
    try {
      let raw;
      if (!DB.db) { const v = localStorage.getItem('gg-' + k); raw = v ? JSON.parse(v) : null; }
      else raw = await new Promise(res => { const rq = DB.db.transaction('kv').objectStore('kv').get(k); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); });
      return await unpack(raw);
    } catch (e) { return null; }
  },
  async set(k, v) { // resolves true when the write is safely on disk, throws otherwise
    const p = await pack(v);
    if (!DB.db) {
      const out = p && p.gz === 1 ? { gz: 1, data: b64(p.data) } : p;
      localStorage.setItem('gg-' + k, JSON.stringify(out)); // throws QuotaExceededError when full
      return true;
    }
    return await new Promise((res, rej) => {
      const tx = DB.db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(p, k);
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error || new Error('write failed'));
      tx.onabort = () => rej(tx.error || new Error('write aborted'));
    });
  }
};
let saveT = null, saving = false, saveAgain = false, imSig = null;
const SAVE = { ok: null, err: null, at: 0, bytes: 0, mode: '' };
function imSignature() { return Object.keys(IM.rosters || {}).length + ':' + Object.keys(IM.drafts || {}).length; }
async function doSave() {
  if (saving) { saveAgain = true; return; }
  saving = true;
  try {
    await DB.set(SLOT, L);
    const sig = imSignature();
    if (sig !== imSig) { await DB.set('imports', IM); imSig = sig; }
    const wasBad = SAVE.ok === false;
    SAVE.ok = true; SAVE.err = null; SAVE.at = Date.now();
    SAVE.mode = (DB.db ? 'IndexedDB' : 'localStorage') + (ZIP ? ', compressed' : ', uncompressed');
    if (wasBad) { flash('Saving works again. Your progress is stored.'); render(); }
  } catch (e) {
    const first = SAVE.ok !== false;
    SAVE.ok = false; SAVE.err = (e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''))) ? 'This device is out of storage space for the game.' : 'The browser refused to store the game' + (e && e.name ? ' (' + e.name + ')' : '') + '.';
    if (first) render();
  } finally {
    saving = false;
    if (saveAgain) { saveAgain = false; doSave(); }
  }
}
function save() { clearTimeout(saveT); saveT = setTimeout(doSave, 250); }
function saveBanner() {
  if (SAVE.ok !== false) return '';
  return `<section class="card savewarn"><div class="eyebrow">Save failed</div><h2>Your progress is not being saved</h2>
    <p>${esc(SAVE.err)} Anything you do now will be lost when the app closes.</p>
    <p>Download a backup right now so you don't lose this league, then free up space or open the game in normal (not private) Safari.</p>
    <div class="row"><button class="btn primary" data-act="exportSave"${L ? '' : ' disabled'}>Download backup</button><button class="btn" data-act="retrySave">Try saving again</button></div></section>`;
}

/* ---------- visitor counting (GoatCounter, GitHub version only) ---------- */
const TRACKED = {};
function track(name, once) {
  try {
    if (once) { if (TRACKED[name]) return; TRACKED[name] = 1; }
    if (window.goatcounter && window.goatcounter.count && !/claude\.ai|claudeusercontent/.test(location.host)) window.goatcounter.count({ path: name, title: name, event: true });
  } catch (e) { /* offline or blocked: ignore */ }
}

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const me = () => { if (L && L.career) { const p = G.careerP(L); return L.teams[p && p.team >= 0 ? p.team : 0]; } return L.teams[L.user]; };
const rec = t => `${t.w}-${t.l}${t.t ? '-' + t.t : ''}`;
const tname = t => `${t.city} ${t.name}`;
function grade(v) { return v >= 85 ? 'g-elite' : v >= 72 ? 'g-good' : v >= 58 ? 'g-avg' : 'g-low'; }
function rating(v) { return `<span class="rt ${grade(v)}">${Math.round(v)}</span>`; }
function flash(s) { ui.msg = s; }
function statLine(p) {
  const h = p.hist[L.year]; if (!h || !h.g) return '';
  const parts = [];
  if (h.att) parts.push(`${h.cmp}/${h.att}, ${h.py} yds, ${h.ptd} TD, ${h.int || 0} INT`);
  if (h.ry) parts.push(`${h.ry} rush yds, ${h.rtd || 0} TD`);
  if (h.recy) parts.push(`${h.rec} rec, ${h.recy} yds, ${h.rectd || 0} TD`);
  if (h.sk) parts.push(`${h.sk} sacks`);
  if (h.dint) parts.push(`${h.dint} INT`);
  if (h.fgm) parts.push(`${h.fgm} FG`);
  return parts.join(' · ') || `${h.g} games`;
}
function confirmBtn(id, label, cls) {
  const armed = ui.confirm === id;
  return `<button class="btn ${cls || ''} ${armed ? 'armed' : ''}" data-act="confirm" data-id="${id}">${armed ? 'Tap again to confirm' : label}</button>`;
}

/* ---------- top bar & tabs ---------- */
const TABS = [['home', 'Office'], ['roster', 'Roster'], ['stats', 'Stats'], ['league', 'League'], ['moves', 'Moves'], ['coach', 'Coach'], ['data', 'Data']];
function phaseLabel() {
  if (!L) return 'No league yet';
  switch (L.phase) {
    case 'preseason': return `${L.year} Training Camp`;
    case 'regular': return `${L.year} · Week ${Math.min(L.week + 1, L.schedule.length)} of ${L.schedule.length}`;
    case 'playoffs': return `${L.year} Playoffs · ${G.roundName(L)}`;
    case 'season-over': return `${L.year} Season Complete`;
    case 'draft': return `${L.draft ? L.draft.year : ''} Draft`;
    default: return `${L.year + 1} Offseason`;
  }
}
function render() {
  const t = L ? me() : null, cp = L && L.career ? G.careerP(L) : null;
  if (L && L.career) {
    $('#top').innerHTML = `<div class="top-inner">
    ${cp && cp.team >= 0 ? `<button class="crest" data-act="tm" data-id="${cp.team}" aria-label="Team">${esc(L.teams[cp.team].abbr)}</button>` : `<div class="crest">${cp && cp.retiredYear != null ? 'RET' : cp && cp.team === -1 ? 'FA' : 'DFT'}</div>`}
    <div class="top-txt"><div class="top-team">${cp ? esc(cp.name) : 'Player career'}</div><div class="top-sub">${ui.tab === 'help' ? 'How to play' : esc(phaseLabel())}${cp && cp.team >= 0 && L.phase !== 'preseason' && ui.tab !== 'help' ? ' · ' + esc(L.teams[cp.team].abbr) + ' ' + rec(L.teams[cp.team]) : ''}</div></div>
    <button class="helpbtn${ui.tab === 'help' ? ' on' : ''}" data-act="help" aria-label="Help">${ui.tab === 'help' ? '✕' : '?'}</button></div>`;
    if (!CTABS.some(x => x[0] === ui.tab) && ui.tab !== 'help' && ui.tab !== 'page') ui.tab = 'home';
    const ready = cp != null;
    $('#tabs').innerHTML = CTABS.map(([k, n]) => `<button class="tab ${ui.tab === k ? 'on' : ''}" data-act="tab" data-id="${k}"${!ready && k !== 'data' && k !== 'home' ? ' disabled' : ''}>${n}</button>`).join('');
    const view = { home: vCareer, games: vGames, team: vTeamC, stats: vStats, league: vLeague, data: vData, help: vHelp, page: vPage }[ui.tab] || vCareer;
    // League and Stats screens show "your team" as the team you play for
    const u0 = L.user; let body;
    try { if (cp && cp.team >= 0 && ui.tab !== 'home') L.user = cp.team; body = view(); } finally { L.user = u0; }
    $('#main').innerHTML = saveBanner() + (ui.msg ? `<div class="toast">${esc(ui.msg)}</div>` : '') + body;
    if (ui.focus) { const el = $(ui.focus); ui.focus = null; if (el) setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 30); }
    ui.msg = null;
    return;
  }
  $('#top').innerHTML = `<div class="top-inner">
    ${t ? `<button class="crest" data-act="tm" data-id="${t.id}" aria-label="Team history">${esc(t.abbr)}</button>` : '<div class="crest">GM</div>'}
    <div class="top-txt"><div class="top-team">${t ? esc(tname(t)) : 'Gridiron GM'}</div><div class="top-sub">${ui.tab === 'help' ? 'How to play' : esc(phaseLabel())}${t && L.phase !== 'preseason' && ui.tab !== 'help' ? ' · ' + rec(t) : ''}</div></div>
    <button class="helpbtn${ui.tab === 'help' ? ' on' : ''}" data-act="help" aria-label="Help">${ui.tab === 'help' ? '✕' : '?'}</button></div>`;
  const nOff = L ? (L.offers || []).filter(o => G.offerValid(L, o)).length : 0;
  $('#tabs').innerHTML = TABS.map(([k, n]) => `<button class="tab ${ui.tab === k ? 'on' : ''}" data-act="tab" data-id="${k}"${!L && k !== 'data' && k !== 'home' ? ' disabled' : ''}>${n}${k === 'moves' && nOff ? `<span class="badge">${nOff}</span>` : ''}</button>`).join('');
  const view = { home: vHome, roster: vRoster, stats: vStats, league: vLeague, moves: vMoves, coach: vCoach, data: vData, help: vHelp, page: vPage }[ui.tab];
  $('#main').innerHTML = saveBanner() + (ui.msg ? `<div class="toast">${esc(ui.msg)}</div>` : '') + view();
  if (ui.focus) { const el = $(ui.focus); ui.focus = null; if (el) setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 30); }
  ui.msg = null;
}


/* ---------- Player and team pages ---------- */
const pLink = (p, txt) => p ? `<button class="lnk" data-act="pl" data-id="${p.id}">${txt == null ? esc(p.name) : txt}</button>` : '';
const tLink = (tid, txt) => L.teams[tid] ? `<button class="lnk" data-act="tm" data-id="${tid}">${txt == null ? esc(tname(L.teams[tid])) : txt}</button>` : '';
function openPage(k, id) {
  if (ui.tab !== 'page') { ui.pgBack = ui.tab; ui.pgStack = []; }
  else if (ui.pg) ui.pgStack.push(ui.pg);
  ui.pg = { k, id }; ui.tab = 'page'; ui.open = null; toTop();
}
function pageBack() { ui.pg = (ui.pgStack || []).pop() || null; if (!ui.pg) ui.tab = ui.pgBack || 'home'; toTop(); }
function vPage() {
  const g = ui.pg; if (!g) { ui.tab = 'home'; return vHome(); }
  const back = `<div class="row pgnav"><button class="btn sm" data-act="pgBack">← Back</button></div>`;
  if (g.k === 't' && L.teams[g.id]) return back + teamPage(L.teams[g.id]);
  const p = G.getP(L, g.id); if (!p) return back + '<section class="card"><p>That player is no longer in the league records.</p></section>';
  return back + playerPage(p);
}
function seasonCols(p) {
  const tm = r => r.s.tm != null && L.teams[r.s.tm] ? tLink(r.s.tm, esc(L.teams[r.s.tm].abbr)) : '–';
  let cols = [{ h: 'Year', f: r => r.y }, { h: 'Tm', f: tm }, { h: 'G', f: r => n0(r.s.g) }];
  if (p.grp === 'QB') cols = cols.concat([{ h: 'Cmp', f: r => num(r.s.cmp) }, { h: 'Att', f: r => num(r.s.att) }, { h: 'Yds', f: r => num(r.s.py) }, { h: 'TD', f: r => n0(r.s.ptd) }, { h: 'INT', f: r => n0(r.s.int) }, { h: 'Rush', f: r => num(r.s.ry) }]);
  else if (p.grp === 'RB') cols = cols.concat([{ h: 'Att', f: r => num(r.s.ra) }, { h: 'Rush', f: r => num(r.s.ry) }, { h: 'TD', f: r => n0(r.s.rtd) }, { h: 'Rec', f: r => num(r.s.rec) }, { h: 'RecYds', f: r => num(r.s.recy) }, { h: 'RecTD', f: r => n0(r.s.rectd) }]);
  else if (p.grp === 'WR' || p.grp === 'TE') cols = cols.concat([{ h: 'Rec', f: r => num(r.s.rec) }, { h: 'Yds', f: r => num(r.s.recy) }, { h: 'TD', f: r => n0(r.s.rectd) }]);
  else if (p.grp === 'K') cols = cols.concat([{ h: 'FG', f: r => n0(r.s.fgm) }]);
  else if (p.grp === 'OL' || p.grp === 'P') cols = cols.concat([]);
  else cols = cols.concat([{ h: 'Sacks', f: r => n0(r.s.sk) }, { h: 'INT', f: r => n0(r.s.dint) }]);
  return cols;
}
function playerPage(p) {
  const ys = Object.keys(p.hist).map(Number).sort((a, b) => a - b);
  const rows = ys.map(y => ({ y, s: p.hist[y], me: p.hist[y].tm === L.user }));
  const tot = sumHist(p), totRow = { y: 'Career', s: Object.assign({}, tot, { tm: null }) };
  // teams he played for, as runs of seasons
  const stints = []; ys.forEach(y => { const tm = p.hist[y].tm; const l = stints[stints.length - 1]; if (l && l.tm === tm && l.to === y - 1) l.to = y; else stints.push({ tm, from: y, to: y }); });
  const status = p.team >= 0 ? `${p.ps ? 'Practice squad, ' : ''}${tLink(p.team)}` : p.team === -2 || p.retiredYear ? `Retired${p.retiredYear ? ' after ' + (p.retiredYear - 1) : ''}` : p.team === -3 ? 'Draft prospect' : 'Free agent';
  const dr = p.draft ? `${p.draft.year} round ${p.draft.rnd}, #${p.draft.pick} overall${p.draft.tid != null && L.teams[p.draft.tid] ? ' by ' + esc(L.teams[p.draft.tid].abbr) : ''}` : (p.udfa ? 'Undrafted' : p.realPick ? '' : '');
  const real = p.realPick && p.realPick.pick ? `Really drafted ${p.draft ? p.draft.year : ''} #${p.realPick.pick}${p.realPick.tm ? ' by ' + esc(p.realPick.tm) : ''}` : (p.udfa ? 'Really went undrafted' : '');
  const ap1 = (p.awards || []).filter(a => a.a === 'ap1').map(a => a.y), ap2 = (p.awards || []).filter(a => a.a === 'ap2').map(a => a.y);
  const aw = (p.hof > 0 ? `<span class="award">Hall of Fame, class of ${p.hof}</span>` : '') + (p.awards || []).filter(a => a.a !== 'ap1' && a.a !== 'ap2' && a.a !== 'pb').map(a => `<span class="award">${a.y} ${esc(G.AWARD_NAMES[a.a])}</span>`).join('')
    + (ap1.length ? `<span class="award">${ap1.length}× First-team All-Pro (${ap1.join(', ')})</span>` : '') + (ap2.length ? `<span class="award">${ap2.length}× Second-team All-Pro (${ap2.join(', ')})</span>` : '') + (() => { const pb = (p.awards || []).filter(a => a.a === 'pb').map(a => a.y); return pb.length ? `<span class="award">${pb.length}× Pro Bowl (${pb.join(', ')})</span>` : ''; })()
    + L.teams.filter(t => (t.ring || []).some(r => r.id === p.id)).map(t => { const r = t.ring.find(x => x.id === p.id); return `<span class="award">${esc(t.abbr)} Ring of Honor${r.num ? ', #' + r.num + ' retired' : ''}</span>`; }).join('')
    + (p.ex ? '' : '') ;
  const coach = (() => { for (const t of L.teams) for (const r of ['hc', 'oc', 'dc']) { const c = t.staff && t.staff[r]; if (c && c.ex && c.ex.pid === p.id) return `Now ${G.ROLE_NAME[r].toLowerCase()} of the ${tLink(t.id)}`; } const c = (L.coachPool || []).find(c => c.ex && c.ex.pid === p.id); return c ? `Available as ${c.role === 'oc' ? 'an' : 'a'} ${G.ROLE_NAME[c.role].toLowerCase()}` : ''; })();
  const known = G.potKnown(L, p), mine = p.team === L.user;
  const fit = !isC() && (p.team >= 0 || p.team === -1) ? G.playerFit(L, p, L.user) : null;
  const log = (p.log || []).slice().reverse();
  const acts = isC() ? '' : p.team >= 0 && p.team !== L.user && !p.ps ? `<button class="btn sm primary" data-act="tradeFor" data-id="${p.id}">Trade for him</button>` : p.team === -1 ? `<button class="btn sm primary" data-act="tab" data-id="moves">Free agents</button>` : '';
  return `<section class="card hero"><div class="eyebrow">${esc(p.pos)}${p.num ? ' · #' + p.num : ''}${p.retiredYear ? '' : ' · age ' + p.age}${p.yrs ? ' · ' + p.yrs + ' season' + (p.yrs > 1 ? 's' : '') : ''}</div><h2>${esc(p.name)}</h2>
    <p class="small">${status}${p.college ? ' · ' + esc(p.college) : ''}${dr ? ' · ' + dr : ''}${real ? ' · <i>' + real + '</i>' : ''}${coach ? '<br>' + coach : ''}</p>
    ${p.retiredYear ? `<div class="row"><div class="pl-r"><span class="lbl">PEAK</span>${rating(p.peak || p.ovr)}</div></div>` : `<div class="row">
      <div class="pl-r"><span class="lbl">OVR</span>${rating(G.eff(p))}</div><div class="pl-r"><span class="lbl">${known ? 'POT' : 'SCOUT'}</span>${rating(G.shownPot(L, p))}</div><div class="pl-r"><span class="lbl">PEAK</span>${rating(Math.max(p.peak || 0, p.ovr))}</div>
      ${fit ? `<div class="pl-r"><span class="lbl">FIT</span><span class="fitg">${fit.grade}</span></div>` : ''}</div>`}
    ${!p.retiredYear && p.team >= 0 ? `<p class="small">${p.con ? 'Contract: ' + conText(p) : 'No contract'} · Morale ${G.moraleWord(p)}${p.inj ? ` · <b class="bad">Injured, ${p.inj >= 20 ? 'out for the season' : p.inj + ' wk'}</b>` : ''}${p.holdout ? ' · <b class="bad">Holding out</b>' : ''}</p>` : ''}
    ${fit && !p.retiredYear ? `<p class="small"><b>Fit with your ${mine ? 'team' : 'team if you got him'}:</b>${reasonsText(fit.why)}</p>` : ''}
    ${aw ? `<div class="awards">${aw}</div>` : ''}
    ${acts ? `<div class="row">${acts}</div>` : ''}</section>
    ${stints.length ? `<section class="card"><h3>Teams</h3><div class="list">${stints.map(s => `<div class="pl"><div class="pl-main"><span class="pos">${s.tm != null && L.teams[s.tm] ? esc(L.teams[s.tm].abbr) : '–'}</span><div class="pl-name">${s.tm != null && L.teams[s.tm] ? tLink(s.tm) : 'Unknown'}<div class="pl-sub">${s.from === s.to ? s.from : s.from + '–' + s.to} · ${s.to - s.from + 1} season${s.to > s.from ? 's' : ''}</div></div></div></div>`).join('')}</div></section>` : ''}
    <section class="card"><h3>Season by season</h3>${ys.length ? table(seasonCols(p), rows.concat([totRow])) : '<p class="small">No seasons played in this league yet.</p>'}</section>
    ${log.length ? `<section class="card"><h3>Transactions</h3><ul class="news">${log.map(x => `<li><span class="nw">${x.y}</span>${esc(x.s)}</li>`).join('')}</ul></section>` : ''}`;
}
function recordBookCard(tid) {
  const B = G.recordBook(L, tid), rows = G.REC_KEYS.filter(([k]) => B.season[k]);
  if (!rows.length) return '';
  const cell = r => r ? `${pLink(G.getP(L, r.id), esc(r.name))} <b>${num(r.v)}</b>${r.y ? ` <span class="small">(${r.y})</span>` : ''}` : '–';
  return `<section class="card"><h3>Record book</h3><p class="small">Single-season and career records with this franchise in this league.${B.best ? ` Best season: ${B.best.y} (${B.best.w}-${B.best.l}${B.best.t ? '-' + B.best.t : ''}). Worst: ${B.worst.y} (${B.worst.w}-${B.worst.l}${B.worst.t ? '-' + B.worst.t : ''}). Most points: ${B.pts.pf} in ${B.pts.y}.` : ''}</p>
    <div class="tscroll"><table class="tbl"><thead><tr><th class="l">Record</th><th class="l">Season</th><th class="l">Career</th></tr></thead><tbody>${rows.map(([k, lab]) => `<tr><td class="l">${esc(lab)}</td><td class="l">${cell(B.season[k])}</td><td class="l">${cell(B.career[k])}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function teamPage(t) {
  const H = t.hist || [], tid = t.id;
  const W = H.reduce((a, h) => a + h.w, 0), Lo = H.reduce((a, h) => a + h.l, 0), T = H.reduce((a, h) => a + h.t, 0);
  const po = H.filter(h => h.res && h.res !== 'Missed playoffs').length, sbw = (L.champs || []).filter(c => c.champ === tid), sbl = (L.champs || []).filter(c => c.loser === tid);
  const pctv = (W + T / 2) / Math.max(1, W + Lo + T);
  // franchise leaders: stats compiled with this team
  const lead = { py: 'Passing yards', ry: 'Rushing yards', recy: 'Receiving yards', sk: 'Sacks', dint: 'Interceptions', fgm: 'Field goals' }, tops = {};
  for (const k in lead) tops[k] = [];
  for (const p of G.allPlayers(L)) {
    const sum = {}; let any = false;
    for (const y in p.hist) { const h = p.hist[y]; if (h.tm !== tid) continue; any = true; for (const k in lead) if (h[k]) sum[k] = (sum[k] || 0) + h[k]; }
    if (!any) continue;
    for (const k in lead) if (sum[k]) tops[k].push({ p, v: sum[k] });
  }
  for (const k in tops) tops[k] = tops[k].sort((a, b) => b.v - a.v).slice(0, 5);
  const hofs = G.allPlayers(L).filter(p => p.hof > 0 && Object.values(p.hist).filter(h => h.tm === tid).length >= 3).sort((a, b) => a.hof - b.hof);
  const awards = []; const A = L.awards || {};
  Object.keys(A).map(Number).sort((a, b) => b - a).forEach(y => ['mvp', 'opoy', 'dpoy', 'roy', 'sbmvp'].forEach(k => { const a = A[y][k]; if (a && a.tid === tid) awards.push({ y, k, a }); }));
  const firsts = []; const DH = L.draftHist || {};
  Object.keys(DH).map(Number).sort((a, b) => b - a).forEach(y => DH[y].forEach(([n, tm, pid]) => { if (tm === tid && n <= L.teams.length) firsts.push({ y, n, p: G.getP(L, pid) }); }));
  const ros = G.roster(L, tid).sort((a, b) => b.ovr - a.ovr).slice(0, 12), st = t.staff || {}, c = t.coach || {};
  const res = h => h.res === 'Won Super Bowl' ? '<b class="good">Won Super Bowl</b>' : h.res === 'Lost Super Bowl' ? 'Lost Super Bowl' : h.res === 'Lost in playoffs' ? 'Playoffs' : '–';
  const names = (t.names || []).map(n => `${esc(n.nm)} (through ${n.to})`).join(' · ');
  const leadCard = Object.keys(lead).filter(k => tops[k].length).map(k => `<div class="leadblk"><div class="eyebrow">${lead[k]}</div><ol class="small">${tops[k].map(x => `<li>${pLink(x.p)} ${num(x.v)}</li>`).join('')}</ol></div>`).join('');
  return `<section class="card hero"><div class="eyebrow">${esc(t.conf)} ${esc(t.div)}${tid === L.user ? ' · your team' : ''}</div><h2>${esc(tname(t))}</h2>
    ${names ? `<p class="small">Formerly ${names}</p>` : ''}
    <div class="row stats4"><div><span class="lbl">ALL-TIME</span><b>${W}-${Lo}${T ? '-' + T : ''}</b><span class="small">${(pctv * 100).toFixed(1)}%</span></div><div><span class="lbl">PLAYOFFS</span><b>${po}</b><span class="small">seasons</span></div><div><span class="lbl">TITLES</span><b>${sbw.length}</b><span class="small">${sbl.length} SB loss${sbl.length === 1 ? '' : 'es'}</span></div><div><span class="lbl">THIS YEAR</span><b>${rec(t)}</b><span class="small">roster ${G.teamOverall(L, tid)}</span></div></div>
    ${sbw.length ? `<div class="awards">${sbw.map(c => `<span class="award">Super Bowl ${G.roman(c.sb)} champions (${c.y}, ${c.score})</span>`).join('')}</div>` : ''}
    ${tid !== L.user && !isC() ? `<div class="row"><button class="btn sm" data-act="tradeWith" data-id="${tid}">Trade with them</button></div>` : ''}</section>
    <section class="card"><h3>Now</h3><p class="small">Home: ${(() => { const S = G.stadium(L, tid); return `${esc(S.name)} (${S.roof === 'dome' ? 'dome' : S.roof === 'retr' ? 'retractable roof' : 'open air'})`; })()} · Head coach ${st.hc ? esc(st.hc.name) : 'vacant'} · OC ${st.oc ? esc(st.oc.name) : 'vacant'} · DC ${st.dc ? esc(st.dc.name) : 'vacant'}${c.os && G.SCHEME[c.os] ? ` · ${esc(G.SCHEME[c.os].name)} offense, ${esc(G.SCHEME[c.ds].name)} defense` : ''} · payroll ${G.money(G.payroll(L, tid))}</p>
      <div class="list">${ros.map(p => `<div class="pl"><div class="pl-main"><span class="pos">${esc(p.pos)}</span><div class="pl-name">${pLink(p)}<div class="pl-sub">Age ${p.age}${p.num ? ' · #' + p.num : ''}</div></div><div class="pl-r"><span class="lbl">OVR</span>${rating(p.ovr)}</div></div></div>`).join('')}</div></section>
    <section class="card"><h3>Season by season</h3>${H.length ? `<div class="tscroll"><table class="tbl stat"><thead><tr><th class="l">Year</th><th>Record</th><th>PF</th><th>PA</th><th class="l">Result</th><th class="l">Head coach</th></tr></thead><tbody>${H.slice().reverse().map(h => `<tr class="${h.gm ? 'me' : ''}"><td class="l">${h.y}</td><td>${h.w}-${h.l}${h.t ? '-' + h.t : ''}</td><td>${h.pf}</td><td>${h.pa}</td><td class="l">${res(h)}</td><td class="l small">${esc(h.hc || '–')}${h.gm ? ' · you were GM' : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small">No completed seasons yet.</p>'}</section>
    ${recordBookCard(tid)}
    ${leadCard ? `<section class="card"><h3>Franchise leaders</h3><p class="small">Totals with this team in this league.</p><div class="leadgrid">${leadCard}</div></section>` : ''}
    ${awards.length ? `<section class="card"><h3>Award winners</h3><ul class="news">${awards.map(x => `<li><span class="nw">${x.y}</span>${esc(G.AWARD_NAMES[x.k])}: ${pLink(G.getP(L, x.a.pid), esc(x.a.pos + ' ' + x.a.name))}</li>`).join('')}</ul></section>` : ''}
    ${hofs.length || (t.ring || []).length ? `<section class="card"><h3>Hall of Famers and Ring of Honor</h3>${hofs.length ? `<p class="small"><b>Hall of Famers</b> (3+ seasons here): ${hofs.map(p => pLink(p) + ' (' + p.hof + ')').join(', ')}</p>` : ''}${(t.ring || []).length ? `<p class="small"><b>Ring of Honor:</b> ${t.ring.map(r => (r.num ? '#' + r.num + ' ' : '') + pLink(G.getP(L, r.id), esc(r.name))).join(', ')}</p>` : ''}</section>` : ''}
    ${firsts.length ? `<section class="card"><h3>First-round picks</h3><ul class="news">${firsts.slice(0, 15).map(x => `<li><span class="nw">${x.y}</span>#${x.n} ${x.p ? pLink(x.p, esc(x.p.pos + ' ' + x.p.name)) : '?'}</li>`).join('')}</ul></section>` : ''}`;
}

/* ---------- Help ---------- */
try { ui.helpSeen = localStorage.getItem('gg-help-seen') === '1'; } catch (e) { /* private mode */ }
function vHelp() {
  const q = (ui.helpQ || '').trim().toLowerCase();
  const strip = h => h.replace(/<[^>]+>/g, ' ');
  const list = HELP.filter(s => !q || (s.title + ' ' + strip(s.body)).toLowerCase().includes(q));
  const open = ui.helpOpen;
  return `<section class="card hero"><div class="eyebrow">Game manual</div><h2>How to play Gridiron GM</h2>
    <label class="fld">Search the manual<input id="helpQ" type="search" placeholder="Try: holdout, cap, scouting, IR" value="${esc(ui.helpQ || '')}"></label>
    <div class="chips">${HELP.map(s => `<button class="chip ${open === s.id ? 'on' : ''}" data-act="helpGo" data-id="${s.id}">${esc(s.title)}</button>`).join('')}</div></section>
    ${list.length ? list.map(s => `<details class="card help" id="h-${s.id}"${open === s.id || q ? ' open' : ''}><summary><h3>${esc(s.title)}</h3></summary><div class="helpbody">${s.body}</div></details>`).join('') : '<section class="card"><p>Nothing in the manual matches that. Try a different word.</p></section>'}
    <section class="card"><p class="small">Gridiron GM ${APP_VERSION}. Ratings data: Pro-Football-Reference. Roster data: nflverse (CC-BY 4.0).</p>
    <div class="row"><button class="btn" data-act="help">Back to the game</button></div></section>`;
}
// A first-season pointer to the manual, on the Office tab.
function helpNudge() {
  if (!L || ui.helpSeen || (L.startYear || 1970) !== L.year || L.phase !== 'preseason') return '';
  return `<section class="card"><div class="split"><h3>New to Gridiron GM?</h3><button class="btn sm" data-act="helpNudgeX">Hide</button></div>
    <p class="small">The manual covers everything: the season calendar, trades, free agency in every era, the draft, schemes and ratings.</p>
    <div class="row"><button class="btn primary sm" data-act="helpGo" data-id="quick">Read the quick start</button></div></section>`;
}

/* ---------- Front Office ---------- */
function firedCard() {
  const F = L.fired;
  return `<section class="card hero fired"><div class="eyebrow">${F.y} · Front office</div><h2>You've been fired</h2>
    <p>The owner of the ${esc(tname(L.teams[F.team]))} has run out of patience. Three teams want to talk to you.</p>
    <div class="list">${F.offers.map(tid => { const t = L.teams[tid], s = t.hist[t.hist.length - 1]; return `<div class="pl"><div class="pl-main"><span class="pos">${esc(t.abbr)}</span><div class="pl-name">${esc(tname(t))}<div class="pl-sub">${s ? s.w + '-' + s.l + (s.t ? '-' + s.t : '') + ' last season' : ''} · roster rank ${rating(G.teamOverall(L, tid))}</div></div></div><div class="pl-btns"><button class="btn sm primary" data-act="takeJob" data-id="${tid}">Take the job</button></div></div>`; }).join('')}</div>
    <div class="row">${confirmBtn('reset', 'Start a new league instead', 'danger')}</div></section>`;
}
function ownerCard() {
  const J = L.job; if (!J) return '';
  const g = J.goal && J.goal.y === L.year ? J.goal : null, last = J.hist[J.hist.length - 1];
  const sec = J.sec, cls = sec >= 50 ? 'g-good' : sec >= 25 ? 'g-avg warn' : 'g-low bad';
  return `<section class="card"><div class="split"><h3>Owner</h3><span class="small">Job security ${sec}/100</span></div>
    <div class="bar-t cap"><span class="bar-f ${cls}" style="width:${Math.max(3, sec)}%"></span></div>
    <p class="small">${g ? `<b>${L.year} goal:</b> ${esc(g.txt)}.` : 'The owner sets a goal when the season kicks off.'}${last ? ` Last review (${last.y}): goal "${esc(last.goal)}" ${last.met ? 'met' : 'missed'}.` : ''} ${sec < 25 ? '<b class="bad">Another bad year could cost you your job.</b>' : ''}</p></section>`;
}
function holdoutCard() {
  const hs = G.roster(L, L.user).filter(p => p.holdout);
  if (!hs.length) return '';
  return `<section class="card offers"><h3>Holdouts (${hs.length})</h3><p class="small">These players won't play until they get a new deal. A player holds out when he's rated 72 or better, paid under 65% of his market value, and his morale has dropped below 40. Each week there's a small chance one reports anyway, angrier than before. You can also trade them.</p>
    <div class="list">${hs.map(p => `<div class="pl wide"><div class="pl-main"><span class="pos">${esc(p.pos)}</span><div class="pl-name">${esc(p.name)}<div class="pl-sub">${(() => { const h = G.holdoutInfo(L, p); return `<b>Why he's holding out:</b> he's rated ${p.ovr} but paid ${G.money(h.sal)}, ${h.pct}% of his ${G.money(h.mv)} market value, and his morale is ${h.word} (${h.mor}).${reasonsText(h.why.filter(r => !/^Underpaid/.test(r[1])))}<br>A new deal at ${G.money(h.price)} ends it today.`; })()}</div></div><div class="pl-r"><span class="lbl">OVR</span>${rating(p.ovr)}</div></div>
      <div class="pl-btns"><button class="btn sm primary" data-act="reneg" data-id="${p.id}">New deal at ${G.money(G.renegotiatePrice(L, p))}</button><button class="btn sm" data-act="shop" data-id="${p.id}">Shop him</button></div></div>`).join('')}</div></section>`;
}
function lastGameCard() {
  if (L.phase !== 'regular' || L.week === 0) return '';
  const w = L.week - 1, gi = L.schedule[w].findIndex(g => g.h === L.user || g.a === L.user); if (gi < 0) return '';
  const g = L.schedule[w][gi], home = g.h === L.user, my = home ? g.hs : g.as, op = home ? g.as : g.hs, o = L.teams[home ? g.a : g.h];
  const star = g.box && G.boxStar(g.box, L.user), sp = star ? `${star.pos} ${star.n}: ${G.boxLine(star)}` : '';
  return `<section class="card"><div class="split"><h3>Week ${w + 1}: ${my > op ? 'Win' : my < op ? 'Loss' : 'Tie'} ${my}-${op}</h3><button class="btn sm" data-act="box" data-id="w:${w}:${gi}">Box score</button></div>
    <p class="small">${home ? 'vs' : 'at'} ${esc(o.city)}${g.ot ? ' (OT)' : ''}${g.wx ? ' · ' + esc(G.wxText(g.wx)) : ''}${sp ? ` · Top player ${esc(sp)}` : ''}</p></section>`;
}
function vHome() {
  if (SLOT === 'career' && (!L || L.career)) return vCareer();
  if (!L) return vSetup();
  if (L.fired) return firedCard();
  let h = ui.box ? boxCard(ui.box) : '';
  const max = G.rules(L.year).rosterMax, n = G.roster(L, L.user).length;
  if (L.phase === 'preseason') {
    const over = n > max;
    h += `<section class="card hero"><div class="eyebrow">Training camp</div><h2>${L.year} roster cutdown</h2>
      <p>You carry <b class="${over ? 'bad' : 'good'}">${n}</b> players. The ${L.year} limit is <b>${max}</b>. ${over ? 'Release players on the Roster tab, or let your staff make the cuts.' : 'You are ready for the season.'}</p>
      <div class="row">${over ? `<button class="btn" data-act="autocut">Auto-cut to ${max}</button>` : ''}<button class="btn primary" data-act="startSeason"${over ? ' disabled' : ''}>Kick off the ${L.year} season</button></div></section>`;
    h += campCard();
  }
  if (L.phase === 'regular') {
    const g = L.schedule[L.week] && L.schedule[L.week].find(x => x.h === L.user || x.a === L.user);
    if (g) {
      const home = g.h === L.user, o = L.teams[home ? g.a : g.h];
      h += `<section class="card hero"><div class="eyebrow">Week ${L.week + 1} · ${home ? 'Home' : 'Away'}</div>
        <div class="matchup"><div><div class="mu-abbr">${esc(me().abbr)}</div><div class="mu-rec">${rec(me())}</div>${rating(G.teamOverall(L, L.user))}</div>
        <div class="mu-vs">${home ? 'vs' : 'at'}</div>
        <div><div class="mu-abbr">${esc(o.abbr)}</div><div class="mu-rec">${rec(o)}</div>${rating(G.teamOverall(L, o.id))}</div></div>
        <p class="small">${esc(G.stadium(L, g.h).name)} · ${esc(G.wxText(G.forecast(L, g)))}</p>
        <div class="row"><button class="btn primary" data-act="simWeek">Play week ${L.week + 1}</button><button class="btn" data-act="simSeason">Sim to playoffs</button></div>
        <p class="small">${G.pastDeadline(L) ? 'The trade deadline has passed.' : `Trade deadline: after week ${G.DEADLINE_WEEK}${L.week === G.DEADLINE_WEEK - 1 ? ' (this is the last week to trade)' : ''}.`}</p></section>` + lastGameCard() + holdoutCard() + planCard();
    } else h += `<section class="card hero"><div class="eyebrow">Week ${L.week + 1}</div><h2>Bye week</h2><div class="row"><button class="btn primary" data-act="simWeek">Sim week</button><button class="btn" data-act="simSeason">Sim to playoffs</button></div></section>`;
    h += divTable(me().conf, me().div);
  }
  if (L.phase === 'playoffs') {
    const P = L.playoffs, alive = P.alive.AFC.concat(P.alive.NFC);
    h += `<section class="card hero"><div class="eyebrow">${esc(G.roundName(L))}</div><h2>${alive.includes(L.user) ? 'Still alive' : 'Watching from home'}</h2>
      <p>Remaining: ${alive.map(id => `<b>${esc(L.teams[id].abbr)}</b>`).join(' · ')}</p>
      <div class="row"><button class="btn primary" data-act="simRound">Play ${esc(G.roundName(L))}</button></div></section>`;
    h += planCard();
    h += playoffResults();
  }
  if (L.phase === 'season-over') {
    const c = L.champs[0];
    h += `<section class="card hero"><div class="eyebrow">Super Bowl ${G.roman(c.sb)}</div><h2>${esc(tname(L.teams[c.champ]))}</h2>
      <p>Beat the ${esc(L.teams[c.loser].name)} ${c.score}. Your ${esc(me().name)} finished ${rec(me())}: ${esc(me().hist[me().hist.length - 1].res.toLowerCase())}.</p>
      <div class="row"><button class="btn primary" data-act="startDraft">Open the ${L.year + 1} draft</button></div>
      ${IM.drafts[L.year + 1] ? `<p class="small">Using the real ${L.year + 1} class you imported.</p>` : `<p class="small warn">No ${L.year + 1} draft class imported. Import it on the Data tab first, or the class will be generated.</p>`}</section>`;
    h += playoffResults();
  }
  if (L.phase === 'draft') h += vDraft();
  if (L.phase === 'offseason') {
    h += `<section class="card hero"><div class="eyebrow">Offseason</div><h2>Ready for ${L.year + 1}?</h2>
      <p>${(() => { G.ensureFA(L); const ex = G.expiring(L, L.user).length, sh = L.fa.sheets.length; return `<b>${G.ERA_INFO[L.fa.era].name}.</b> You have ${ex} expiring contract${ex === 1 ? '' : 's'}${sh ? ` and ${sh} offer sheet${sh > 1 ? 's' : ''} to answer` : ''}. Handle them on the Moves tab.`; })()}</p>
      <p class="small">Starting the new season settles free agency, ages every player, applies development, and processes retirements.</p>
      <div class="row"><button class="btn primary" data-act="nextSeason">Start the ${L.year + 1} season</button></div></section>`;
  }
  if (L.phase !== 'regular') h += holdoutCard();
  h += ownerCard();
  h += helpNudge();
  h += rightsCard();
  h += offersCard();
  h += `<section class="card"><h3>Wire</h3><ul class="news">${L.news.slice(0, 18).map(n => `<li><span class="nw">${n.y}${n.w ? ' W' + n.w : ''}</span>${esc(n.s)}</li>`).join('')}</ul></section>`;
  return h;
}

function vSetup() {
  const Y = ui.startYear || 1970, teams = G.teamsAt(Y), pick = ui.startTeam && teams.some(t => t.pfr === ui.startTeam) ? ui.startTeam : (teams.some(t => t.pfr === 'nor') ? 'nor' : teams[0].pfr);
  const have = G.TEAMS_1970.filter(t => IM.rosters[t[0]]).length;
  const dy = Object.keys(IM.drafts).map(Number).sort((a, b) => a - b);
  const missing = []; for (let y = 1971; y <= Math.min(Y, G.START_LAST); y++) if (!IM.drafts[y]) missing.push(y);
  const years = []; for (let y = G.START_FIRST; y <= G.START_LAST; y++) years.push(y);
  const real = G.hasReal();
  const blurb = Y === 1970
    ? `The AFL-NFL merger season: 26 teams, 14 games, 40-man rosters. Real rosters come from the 1970 rosters on the Data tab; a team without one gets a placeholder roster.`
    : real
      ? `Every team starts with its real ${Y} roster, undrafted players included. Ratings come from each player's real career. Expansion, moves and rule changes up to ${Y} are already in place. League history (records, awards, Hall of Fame) starts in ${Y}.`
      : `Real rosters for ${Y} haven't loaded (rosters.json), so the league is built from the draft classes: <b>every drafted player is on the team that drafted him and undrafted players are generated</b>. League history starts in ${Y}.`;
  return modeSeg() + `<section class="card hero"><div class="eyebrow">New league · ${Y}</div><h2>Take over a franchise</h2>
    <label class="fld">First season<select id="startYear">${years.map(y => `<option value="${y}"${y === Y ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
    <p>${blurb}</p>
    <p class="small"><b>${have}</b> of 26 rosters from 1970 · draft classes ${dy.length ? `${dy[0]}–${dy[dy.length - 1]} (${dy.length})` : 'none'}${missing.length && Y > 1970 ? ` · <span class="warn">missing ${missing.length > 6 ? missing.length + ' years' : missing.join(', ')}: those teams get more generated players</span>` : ''}</p>
    <div class="fld">Difficulty<div class="seg">${Object.keys(G.DIFF).map(k => `<button class="${(ui.newDiff || 'pro') === k ? 'on' : ''}" data-act="newDiff" data-id="${k}">${G.DIFF[k].name}</button>`).join('')}</div></div>
    <p class="small">${diffBlurb(ui.newDiff || 'pro')}</p>
    <label class="tog"><input type="checkbox" id="realNew"${ui.realCareers !== false ? ' checked' : ''}> Real careers</label>
    <p class="small">On: real players rise, peak, fade and retire the way their real careers did, and undrafted players join the league in their real rookie year. Off: development and retirement are random, for a different history every time. You can change this later on the Data tab.</p>
    <label class="fld">Your team<select id="pickTeam">${teams.map(t => `<option value="${t.pfr}"${t.pfr === pick ? ' selected' : ''}>${esc(t.city + ' ' + t.name)}${Y === 1970 && !IM.rosters[t.pfr] ? ' (placeholder)' : ''}</option>`).join('')}</select></label>
    <div class="row"><button class="btn primary" data-act="newLeague">Start the ${Y} season</button><button class="btn" data-act="tab" data-id="data">Import data</button></div></section>`;
}

function playoffResults() {
  const P = L.playoffs; if (!P || !P.rounds.length) return '';
  return `<section class="card"><h3>Playoff results</h3>${P.rounds.map((r, ri) => `<div class="pr"><div class="eyebrow">${esc(r.name)}</div>${r.games.map((g, gi) => gameLine(g, 'p:' + ri + ':' + gi)).join('')}</div>`).join('')}</section>`;
}
function gameLine(g, key) {
  const H = L.teams[g.h], A = L.teams[g.a], hw = g.hs > g.as, aw = g.as > g.hs, mine = g.h === L.user || g.a === L.user;
  const inner = `<span class="${aw ? 'win' : ''}">${esc(A.abbr)} ${g.as}</span><span class="at">@</span><span class="${hw ? 'win' : ''}">${esc(H.abbr)} ${g.hs}</span>${g.ot ? '<span class="ot">OT</span>' : ''}`;
  return key && g.box ? `<button class="gl ${mine ? 'mine' : ''}" data-act="box" data-id="${key}">${inner}<span class="glbox">Box score ›</span></button>` : `<div class="gl ${mine ? 'mine' : ''}">${inner}</div>`;
}
function findGame(key) {
  const [src, a, b] = String(key).split(':');
  if (src === 'w') return L.schedule[+a] && L.schedule[+a][+b];
  if (src === 'p') return L.playoffs && L.playoffs.rounds[+a] && L.playoffs.rounds[+a].games[+b];
  if (src === 'a') return L.myGames && L.myGames[a] && L.myGames[a][+b];
  if (src === 'c') { const x = L.career && L.career.games[+a]; return x && x.gm; }
  return null;
}
function boxCard(key) {
  const g = findGame(key); if (!g || !g.box) return '';
  const B = g.box, H = L.teams[g.h], A = L.teams[g.a], nq = Math.max(B.q[0].length, B.q[1].length);
  const qh = Array.from({ length: nq }, (_, i) => `<th>${i < 4 ? i + 1 : 'OT'}</th>`).join('');
  const row = (t, q, pts) => `<tr><td class="l">${esc(t.abbr)}</td>${Array.from({ length: nq }, (_, i) => `<td>${q[i] || 0}</td>`).join('')}<td><b>${pts}</b></td></tr>`;
  const st = B.st, srow = (lab, k) => `<tr><td class="l">${lab}</td><td>${st[1][k]}</td><td>${st[0][k]}</td></tr>`;
  const side = (tid, t) => {
    const ls = B.lines.filter(l => l.tm === tid);
    const pick = (f, srt, n) => ls.filter(f).sort(srt).slice(0, n);
    const pass = pick(l => l.att, (a, b) => b.att - a.att, 1), rush = pick(l => l.ra, (a, b) => b.ry - a.ry, 3), rec = pick(l => l.rec, (a, b) => b.recy - a.recy, 4);
    const def = pick(l => l.sk || l.dint, (a, b) => (b.sk + (b.dint || 0) * 2 || 0) - (a.sk + (a.dint || 0) * 2 || 0), 4), k = pick(l => l.fgm, () => 0, 1);
    const li = (l, txt) => `<li><span class="pos">${esc(l.pos)}</span> <button class="lnk" data-act="statPlayer" data-id="${l.id}">${esc(l.n)}</button> <span class="small">${txt}</span></li>`;
    const sec = (h, arr, f) => arr.length ? `<div class="eyebrow">${h}</div><ul class="olist">${arr.map(l => li(l, f(l))).join('')}</ul>` : '';
    return `<div><h3 class="sub">${esc(t.city)}</h3>${sec('Passing', pass, l => `${l.cmp}/${l.att}, ${l.py} yds, ${l.ptd || 0} TD, ${l.int || 0} INT`)}${sec('Rushing', rush, l => `${l.ra}-${l.ry}, ${l.rtd || 0} TD`)}${sec('Receiving', rec, l => `${l.rec}-${l.recy}, ${l.rectd || 0} TD`)}${sec('Defense', def, l => [l.sk ? l.sk + ' sk' : '', l.dint ? l.dint + ' INT' : ''].filter(Boolean).join(', '))}${sec('Kicking', k, l => l.fgm + ' FG')}</div>`;
  };
  return `<section class="card hero box"><div class="split"><div class="eyebrow">${esc(g.wk || '')} Box score${g.wx ? ' · ' + esc(G.wxText(g.wx)) : ''}</div><button class="btn sm" data-act="box" data-id="">Close</button></div>
    <div class="tscroll"><table class="tbl stat"><thead><tr><th class="l">Team</th>${qh}<th>Final</th></tr></thead><tbody>${row(A, B.q[1], g.as)}${row(H, B.q[0], g.hs)}</tbody></table></div>
    <div class="tscroll"><table class="tbl stat"><thead><tr><th class="l"></th><th>${esc(A.abbr)}</th><th>${esc(H.abbr)}</th></tr></thead><tbody>${srow('Total yards', 'yds')}${srow('Passing', 'py')}${srow('Rushing', 'ry')}${srow('Interceptions thrown', 'to')}${srow('Sacks', 'sk')}</tbody></table></div>
    <div class="trade">${side(g.a, A)}${side(g.h, H)}</div></section>`;
}

function diffBlurb(k) {
  return ({
    rookie: 'AI teams accept slightly lopsided trades, send generous offers, scout 5 prospects each, and half of them keep stale schemes. Your team gets a small edge on game day.',
    pro: 'Fair trades, fair offers, AI teams scout 10 prospects each and pick the scheme that fits their roster every year. No game-day edge either way.',
    allpro: 'AI teams want a clear win in every trade, lowball their offers, scout 15 prospects each, and adjust their game plan to yours every week. Your team plays at a small disadvantage.'
  })[k];
}

/* ---------- Game plan ---------- */
const OFF = { run: 'Ground game', bal: 'Balanced', pass: 'Air it out' };
const DEF = { soft: 'Bend, don\'t break', bal: 'Balanced', blitz: 'Blitz' };
function bestDefVs(off) { return Object.keys(DEF).sort((a, b) => G.DEF_VS[a][off] - G.DEF_VS[b][off])[0]; }
function bestOffVs(def) { const v = G.DEF_VS[def]; const best = Object.keys(OFF).sort((a, b) => v[b] - v[a])[0]; return v[best] > 0 ? best : null; }
function planCard() {
  const g = G.nextGame(L); if (!g) return '';
  const oid = g.h === L.user ? g.a : g.h, o = L.teams[oid], oc = o.coach, plan = G.gamePlan(L) || {}, base = me().coach;
  const chip = (key, val, label) => `<button class="${(plan[key] || '') === val ? 'on' : ''}" data-act="plan" data-key="${key}" data-id="${val}">${label}</button>`;
  const segRow = (key, map) => `<div class="seg">${chip(key, '', 'Season')}${Object.keys(map).map(k => chip(key, k, map[k])).join('')}</div>`;
  const dHint = bestDefVs(oc.off), oHint = bestOffVs(oc.def);
  const qbs = G.depthChart(L, L.user, 'QB'), startQB = G.depth(L, L.user).QB[0];
  const qbOpt = qbs.map(p => `<option value="${p.id}"${startQB && p.id === startQB.id ? ' selected' : ''}${p.inj && !(p.playHurt && G.canPlayHurt(p)) ? ' disabled' : ''}>${esc(p.name)} · ${G.eff(p)} OVR${p.inj ? (p.playHurt ? ' · playing hurt' : ' · injured') : ''}</option>`).join('');
  const using = G.coachFor(L, L.user);
  return `<section class="card"><h3>Game plan vs ${esc(o.city)}</h3>
    <p class="small"><b>Scouting report:</b> ${(() => { const oid = L.teams.indexOf(o); if (oid < 0) return ''; const a = G.teamFit(L, L.user).total, b = G.teamFit(L, oid).total; return `Team fit: yours <b>${a.grade}</b>, theirs <b>${b.grade}</b>. `; })()}${oc.os ? `<i>${esc(G.offPers(G.formation(oc)))}; ${esc(G.defPers(G.formation(oc)))}.</i> ` : ''}${oc.os ? `${esc(G.SCHEME[oc.os].name)} (${esc(OFF[oc.off])}) offense, ${esc(G.SCHEME[oc.ds].name)} (${esc(DEF[oc.def])}) defense` : `${esc(OFF[oc.off])} offense, ${esc(DEF[oc.def])} defense`}, aggressiveness ${oc.aggr}.</p>
    ${oc.os && base.os ? (() => { const a = G.schemeEdge(L.year, base.os, oc.ds), b = -G.schemeEdge(L.year, oc.os, base.ds); const w = v => `<span class="${v > 0.25 ? 'good' : v < -0.25 ? 'bad' : ''}">${v >= 0 ? '+' : ''}${v.toFixed(1)} pts</span>`; return `<p class="small"><b>Scheme matchup:</b> your ${esc(G.SCHEME[base.os].name)} vs their ${esc(G.SCHEME[oc.ds].name)}: ${w(a)}. Your ${esc(G.SCHEME[base.ds].name)} vs their ${esc(G.SCHEME[oc.os].name)}: ${w(b)}.</p>`; })() : ''}
    <p class="small">Counters: ${G.DEF_VS[dHint][oc.off] < 0 ? `a <b>${esc(DEF[dHint])}</b> defense slows their offense` : `a <b>${esc(DEF[dHint])}</b> defense is the safe call, since blitzing or sitting back gets run on`}${oHint ? `, and a <b>${esc(OFF[oHint])}</b> attack exploits their defense` : '. Their base defense has no scheme weakness, so lean on your best unit'}.</p>
    <div class="fld">Offense this week${segRow('off', OFF)}</div>
    <div class="fld">Defense this week${segRow('def', DEF)}</div>
    <label class="fld">Starting quarterback<select id="startQB">${qbOpt}</select></label>
    ${/^https?:/.test(location.protocol) && !/claude\.ai|claudeusercontent/.test(location.host) ? `<div class="row"><a class="btn" href="drive.html">Play this game yourself (preview)</a></div><p class="small">A Retro Bowl-style preview: you run the offense against this opponent with real players. It doesn't count in your league yet.</p>` : ''}
    <p class="small">Playing with: ${esc(OFF[using.off])} offense, ${esc(DEF[using.def])} defense. "Season" uses your Coach tab settings. The plan resets after this game.${G.diff(L).counter ? ' At All-Pro, their coach adjusts to your plan, so the scouting report shows their usual style, not what they will call against you.' : ''}</p></section>`;
}

/* ---------- Trade offers ---------- */
function offersCard() {
  const list = (L.offers || []).filter(o => G.offerValid(L, o));
  if (!list.length) return '';
  const items = pkg => (pkg.players || []).map(id => { const p = L.players[id]; return `<li><span class="pos">${esc(p.pos)}</span> ${esc(p.name)} <span class="small">age ${p.age}</span> ${rating(p.ovr)} ${rating(G.shownPot(L, p))}</li>`; })
    .concat((pkg.picks || []).map(id => { const k = G.pickById(L, id); return `<li><span class="pos pk">PICK</span> ${esc(G.pickLabel(L, k))} <span class="small">≈#${G.projectedOverall(L, k)}</span></li>`; })).join('');
  return `<section class="card offers"><h3>Trade offers (${list.length})</h3>${list.map(o => `
    <div class="offer"><div class="split"><b>${esc(tname(L.teams[o.from]))}</b><span class="small">${o.exp >= 0 ? `Expires when you play week ${o.exp + 1}` : 'Expires at kickoff'}</span></div>
      <div class="trade"><div><div class="eyebrow">You get</div><ul class="olist">${items(o.give)}</ul></div><div><div class="eyebrow">You give</div><ul class="olist">${items(o.get)}</ul></div></div>
      <div class="row"><button class="btn primary sm" data-act="acceptOffer" data-id="${o.id}">Accept</button><button class="btn sm" data-act="rejectOffer" data-id="${o.id}">Reject</button></div></div>`).join('')}
    <p class="small">Ratings shown are OVR then POT.</p></section>`;
}

/* ---------- Draft ---------- */
function vDraft() {
  const D = L.draft, c = G.onClock(L), n = D.order.length, started = D.started !== false, visits = D.visits || 0;
  if (c === null) return `<section class="card hero"><div class="eyebrow">${D.year} draft</div><h2>All ${D.rounds} rounds are complete</h2><div class="row"><button class="btn primary" data-act="endDraft">Finish the draft</button></div></section>` + myPicks() + draftTracker(D.log, D.year, D.rounds, n, false);
  const rnd = Math.floor(D.pick / n) + 1, pk = D.pick % n + 1, mine = started && c === L.user;
  const slots = G.myDraftSlots(L), ord = slots.length ? 'at #' + slots.slice(0, 8).join(', #') + (slots.length > 8 ? ` and ${slots.length - 8} more` : '') : 'nowhere (you traded all your picks)';
  const visitTxt = `<b>${visits}</b> of ${G.SCOUT_VISITS} scouting visits left`;
  let h;
  if (!started) {
    h = `<section class="card hero"><div class="eyebrow">${D.year} draft · Scouting week</div><h2>Send your scouts out</h2>
      <p>${visitTxt}. A visit reveals a prospect's true potential. Every other team gets ${G.SCOUT_VISITS} visits too, and they use what they learn.</p>
      <p class="small">Your picks: ${ord}. Scout grades come from projected draft slot and college, not from how careers turned out. Unused visits carry into the draft but not into next year.</p>
      <div class="row"><button class="btn primary" data-act="beginDraft">Begin the draft</button></div></section>`;
  } else {
    h = `<section class="card hero"><div class="eyebrow">${D.year} draft · Round ${rnd} of ${D.rounds} · Pick ${pk} (#${D.pick + 1} overall)</div>
      <h2>${mine ? 'You are on the clock' : esc(tname(L.teams[c])) + ' are picking'}</h2>
      <p class="small">Your picks: ${ord} · ${visitTxt}.</p>
      ${mine && D.offer && D.offer.pick === D.pick ? (() => { const o = D.offer, ks = o.give.map(id => G.pickById(L, id)).filter(Boolean); return `<div class="offer draftoffer"><b>${esc(tname(L.teams[o.from]))}</b> want to trade up into your pick. They offer ${ks.map(k => G.slotNo(L, k) ? '<b>#' + G.slotNo(L, k) + '</b> overall' : '<b>' + esc(G.pickLabel(L, k)) + '</b> pick').join(' and ')}.<div class="row"><button class="btn sm primary" data-act="dOffer" data-id="yes">Accept trade</button><button class="btn sm" data-act="dOffer" data-id="no">Keep the pick</button></div></div>`; })() : ''}
      <div class="row">${mine ? '<button class="btn" data-act="autoPick">Let scouts pick</button>' : '<button class="btn primary" data-act="toMyPick">Sim to my pick</button>'}<button class="btn" data-act="draftRest">Auto-draft the rest</button></div></section>`;
  }
  const show = ui.draftShow || 60;
  const all = D.pool.map(i => L.players[i]).filter(p => ui.draftGrp === 'ALL' || (ui.draftGrp === 'SEEN' ? p.seen : p.grp === ui.draftGrp)).sort((a, b) => b.scout - a.scout);
  const pool = all.slice(0, show);
  const chipRow = `<div class="chips">${['ALL', 'SEEN'].concat(G.GRPS).map(g => `<button class="chip ${ui.draftGrp === g ? 'on' : ''}" data-act="chip" data-key="draftGrp" data-id="${g}">${g === 'ALL' ? 'All' : g === 'SEEN' ? 'Scouted' : g}</button>`).join('')}</div>`;
  h += draftTracker(D.log, D.year, D.rounds, n, true);
  h += `<section class="card"><div class="split"><h3>Draft board</h3><span class="small">${all.length} prospects</span></div>${chipRow}<div class="list">${pool.length ? pool.map(p => `
    <div class="pl"><div class="pl-main"><span class="pos">${esc(p.pos)}</span><div class="pl-name">${esc(p.name)}<div class="pl-sub">${esc(p.college || '')} · age ${p.age}${p.realPick && p.realPick.rnd ? ` · real: R${p.realPick.rnd} #${p.realPick.pick} ${esc(p.realPick.tm)}` : ''}</div></div>
    <div class="pl-r"><span class="lbl">SCOUT</span>${rating(p.scout)}</div>${p.seen ? `<div class="pl-r"><span class="lbl">TRUE</span>${rating(p.pot)}</div>` : ''}</div>
    <div class="pl-btns">${!p.seen && visits > 0 ? `<button class="btn sm" data-act="scout" data-id="${p.id}">Scout</button>` : ''}${mine ? `<button class="btn sm primary" data-act="draftPick" data-id="${p.id}">Draft</button>` : ''}</div></div>`).join('') : `<p>${ui.draftGrp === 'SEEN' ? 'You have not scouted anyone still on the board.' : 'No prospects at this position.'}</p>`}</div>
    ${all.length > show ? `<div class="row"><button class="btn" data-act="draftMore">Show ${Math.min(60, all.length - show)} more</button></div>` : ''}</section>`;
  return h + myPicks();
}
// Every pick so far (live during the draft, or a past draft from the League tab).
function draftTracker(log, year, rounds, n, live) {
  if (!log.length) return live ? `<section class="card"><h3>Draft tracker</h3><p class="small">No picks yet. Every pick will show up here as it's made.</p></section>` : '';
  const rf = ui.trkRnd || 0, tf = ui.trkTeam == null ? -1 : ui.trkTeam;
  let rows = log.map(x => Array.isArray(x) ? { n: x[0], tid: x[1], pid: x[2] } : x);
  const rndOf = x => { const p = L.players[x.pid] || G.getP(L, x.pid); return p && p.draft && p.draft.year === year ? p.draft.rnd : Math.floor((x.n - 1) / n) + 1; };
  rows = rows.filter(x => (!rf || rndOf(x) === rf) && (tf < 0 || x.tid === tf));
  if (live) rows = rows.slice().reverse();
  const lim = live ? 5 : 16, all = ui.trkAll || rows.length <= lim, show = all ? rows : rows.slice(0, lim);
  const rnds = []; for (let r = 1; r <= rounds; r++) rnds.push(r);
  const line = x => { const p = L.players[x.pid] || G.getP(L, x.pid); if (!p) return ''; const t = L.teams[x.tid], rnd = rndOf(x), rp = p.realPick;
    return `<div class="pl wide${x.tid === L.user ? ' mine' : ''}"><div class="pl-main"><span class="pos">${esc(p.pos)}</span><div class="pl-name">${pLink(p)}<div class="pl-sub"><b>#${x.n}</b> · round ${rnd} · ${esc(t ? t.abbr : '?')}${x.tid === L.user ? ' <span class="good">· your pick</span>' : ''}${p.college ? ' · ' + esc(p.college) : ''}${rp && rp.pick ? ` · really went #${rp.pick}${rp.tm ? ' to ' + esc(rp.tm) : ''}` : ''}</div></div>
      <div class="pl-r"><span class="lbl">${p.seen ? 'TRUE' : 'SCOUT'}</span>${rating(p.seen ? p.pot : p.scout)}</div></div></div>`; };
  return `<section class="card"><div class="split"><h3>${live ? 'Draft tracker' : year + ' draft results'}</h3><span class="small">${log.length} pick${log.length === 1 ? '' : 's'}${live ? ', newest first' : ''}</span></div>
    <div class="row trk"><label class="fld">Round<select id="trkRnd"><option value="0">All rounds</option>${rnds.map(r => `<option value="${r}"${rf === r ? ' selected' : ''}>Round ${r}</option>`).join('')}</select></label>
    <label class="fld">Team<select id="trkTeam"><option value="-1">All teams</option>${L.teams.slice().sort((a, b) => tname(a).localeCompare(tname(b))).map(t => `<option value="${t.id}"${tf === t.id ? ' selected' : ''}>${esc(tname(t))}</option>`).join('')}</select></label></div>
    <div class="list">${show.map(line).join('') || '<p class="small">No picks match.</p>'}</div>
    ${!all ? `<div class="row"><button class="btn sm" data-act="trkAll">Show all ${rows.length}</button></div>` : ''}
    <p class="small">Ratings are your scouts' grade unless you scouted him (TRUE potential).</p></section>`;
}
function myPicks() {
  const mine = L.draft.log.filter(x => x.tid === L.user);
  if (!mine.length) return '';
  return `<section class="card"><h3>Your class</h3><div class="list">${mine.map(x => { const p = L.players[x.pid]; return `<div class="pl"><div class="pl-main"><span class="pos">${esc(p.pos)}</span><div class="pl-name">${esc(p.name)}<div class="pl-sub">Round ${p.draft.rnd}, #${x.n} overall</div></div><div class="pl-r"><span class="lbl">${p.seen ? 'TRUE' : 'SCOUT'}</span>${rating(p.seen ? p.pot : p.scout)}</div></div></div>`; }).join('')}</div></section>`;
}

/* ---------- Contracts ---------- */
function conText(p) {
  if (p.con && p.con.opt) return conText0(p) + ' · 5th-year option';
  return conText0(p);
}
function conText0(p) {
  if (!p.con) return 'No contract';
  if (!G.onBooks(p, G.capYear(L))) return `<b class="warn">Expiring</b>`;
  if (p.con.ext) return `${G.money(p.con.sal)} thru ${p.con.exp}, then ${G.money(p.con.ext.sal)} thru ${p.con.ext.exp}`;
  return `${G.money(p.con.sal)} thru ${p.con.exp}${G.extInfo(L, p) ? ' · <b class="warn">final year</b>' : ''}`;
}
function payrollCard() {
  const y = G.capYear(L), cap = G.capFor(y), bud = cap ? null : G.budgetFor(L, y), lim = cap || bud, pay = G.payroll(L, L.user, y), dead = G.deadFor(L, L.user, y);
  const pct = lim ? Math.min(100, pay / lim * 100) : 0;
  const note = cap ? `${G.money(cap - pay)} in cap space.` : `${y === 2010 ? '2010 is an uncapped year' : 'No salary cap until 1994'}. The owner's budget is ${G.money(bud)} (15% over the league's average payroll${/^(nyg|nyj|ram|rai|chi|sfo|dal|phi|was)$/.test(me().pfr) ? ', more for a big market' : ''}, a little more after a playoff year). ${(() => { const com = G.committedPay(L, y), un = com - pay; return (un > 0 ? `Your unsigned players would add about ${G.money(un)} if you keep them, so that money is set aside. ` : '') + (com > bud ? `You're <b>${G.money(com - bud)} over</b>: you can re-sign your own players, but no new signings or trades that add salary.` : `${G.money(bud - com)} left for new signings and trades.`); })()}`;
  return `<section class="card"><div class="split"><h3>${y} payroll</h3><span class="count">${G.money(pay)}${lim ? ' / ' + G.money(lim) : ''}</span></div>
    ${lim ? `<div class="bar-t cap"><span class="bar-f ${pay > lim ? 'g-low bad' : 'g-good'}" style="width:${pct}%"></span></div>` : ''}
    <p class="small ${cap && pay > cap ? 'bad' : ''}">${cap && pay > cap ? `Over the cap by ${G.money(pay - cap)}. You can't kick off until you get under.` : note} League average salary is about ${G.money(G.avgSalary(y))}.${dead ? ` Includes ${G.money(dead)} in dead money from released players.` : ''}</p></section>`;
}
function faCard() {
  if (L.phase !== 'offseason') return '';
  G.ensureFA(L);
  const F = L.fa, y = F.y, info = G.ERA_INFO[F.era];
  const prow = (p, extra, btns) => `<div class="pl wide"><div class="pl-main"><span class="pos">${esc(p.pos)}</span><div class="pl-name">${esc(p.name)}<div class="pl-sub">Age ${p.age + 1} in ${y} · ${(p.yrs || 0) + 1} yrs exp${extra ? ' · ' + extra : ''}</div></div>
    <div class="pl-r"><span class="lbl">OVR</span>${rating(p.ovr)}</div><div class="pl-r"><span class="lbl">${G.potKnown(L, p) ? 'POT' : 'SCOUT'}</span>${rating(G.shownPot(L, p))}</div></div><div class="pl-btns">${btns}</div></div>`;
  let h = `<section class="card offers"><div class="eyebrow">${y} offseason · ${esc(info.name)}</div><h3>Contracts &amp; free agency</h3><p class="small">${esc(info.text)}</p>
    <div class="ctbar"><span class="lbl">POSITION</span>${chips('ctGrp', ui.ctGrp || 'ALL')}${sortSeg('ctSort', true, 'pos', true)}</div>`;
  // offer sheets on your players
  F.sheets.forEach((sh, i) => {
    const p = L.players[sh.pid], picks = sh.trans ? 'nothing (transition tag)' : G.compPicks(L, sh.sal).map(r => 'a round ' + r + ' pick').join(' and ');
    h += `<div class="offer"><b>${esc(L.teams[sh.from].city)}</b> offer sheet for your ${esc(p.pos)} ${esc(p.name)}: ${sh.yrs} yrs, ${G.money(sh.sal)} a year.
      <div class="row"><button class="btn sm primary" data-act="matchSheet" data-id="${i}">Match</button><button class="btn sm" data-act="declineSheet" data-id="${i}">Let him go for ${picks}</button></div></div>`;
  });
  const ufa = F.era === 'ufa';
  if (ufa) h += marketHeader(F);
  const exp = (ufa && F.round > 0) ? [] : ctFilter(G.expiring(L, L.user).filter(p => !F.sheets.some(s => s.pid === p.id)));
  if (!(ufa && F.round > 0)) h += `<h3 class="sub">Your expiring contracts (${exp.length})</h3>`;
  if (!(ufa && F.round > 0)) h += exp.length ? `<div class="list">${exp.map(p => {
    const rfa = G.isRestricted(L, p), price = rfa ? G.tenderPrice(L, p) : G.resignPrice(L, p);
    const mk = ufa && !rfa ? G.marketFor(L, p.id) : [];
    const why = (ufa && !rfa ? reasonsText(G.fitFor(L, p, L.user).reasons) : '') + (ufa && !rfa ? `<br><span class="small">If he reaches the market: ${mk.length ? mk.map(o => `${esc(L.teams[o.tid].abbr)} ≈${G.money(o.sal)}×${o.yrs}`).join(' · ') : 'no teams expected to bid in round 1'}</span>` : '');
    const btns = `<button class="btn sm primary" data-act="resign" data-id="${p.id}">${rfa ? 'Tender' : 'Re-sign'} ${G.money(price)}</button>${F.era === 'ufa' && !F.tagged && !rfa ? `<button class="btn sm" data-act="tag" data-id="${p.id}">Franchise tag ${G.money(G.tagPrice(L, p, 'franchise'))}</button>` : ''}${F.era === 'ufa' && !F.ttagged && !rfa ? `<button class="btn sm" data-act="ttag" data-id="${p.id}">Transition tag ${G.money(G.tagPrice(L, p, 'transition'))}</button>` : ''}<button class="btn sm" data-act="letGo" data-id="${p.id}">Let go</button>`;
    return prow(p, (rfa ? 'Restricted' : (ufa ? 'Unrestricted · market value ' + G.money(G.marketValue(L, p)) : 'Asking ' + G.money(price))) + why, btns);
  }).join('')}</div><p class="small">${ufa ? 'This is your exclusive window. Once you start free agency, unrestricted players you haven\'t re-signed or tagged hit the open market, where you can still bid but other teams will too. Restricted players stay at their tender price.' : 'Anyone you don\'t handle re-signs at his asking price when the season starts.'}</p>` : '<p class="small">None. Everyone is signed for next season.</p>';
  if (ufa) h += marketList(F);
  if (F.era === 'planb') {
    const pr = F.protect, mine = ctFilter(G.roster(L, L.user).slice());
    h += `<h3 class="sub">Plan B protection (${pr.length} / 37)</h3><p class="small">Unprotected players worth keeping may sign elsewhere when the season starts.</p><div class="tlist protect">${mine.map(p => `<button class="tp ${pr.includes(p.id) ? 'on' : ''}" data-act="protect" data-id="${p.id}"><span class="pos">${esc(p.pos)}</span><span class="tp-n">${esc(p.name)}</span><span class="tp-a">${p.age}</span>${rating(p.ovr)}</button>`).join('')}</div>`;
    const pool = ctFilter(G.planBPool(L)).slice(0, 40);
    h += `<h3 class="sub">Plan B market</h3><p class="small">Other teams' unprotected players. Sign them with no compensation.</p><div class="list">${pool.map(p => prow(p, esc(L.teams[p.team].abbr), `<button class="btn sm" data-act="sign" data-id="${p.id}">Sign ${G.money(G.askPrice(L, p))}</button>`)).join('')}</div>`;
  }
  if (F.era === 'comp' || F.era === 'planb') {
    const tg = ctFilter(G.sheetTargets(L).filter(p => !F.done[p.id])).slice(0, 25);
    if (tg.length) h += `<h3 class="sub">Offer sheet targets</h3><p class="small">Unsigned players on other teams. If his team doesn't match, he's yours and you give up the draft picks shown.</p><div class="list">${tg.map(p => { const sal = Math.round(G.askPrice(L, p) * 1.2); return prow(p, esc(L.teams[p.team].abbr) + ' · costs ' + G.compPicks(L, sal).map(r => 'R' + r).join('+'), `<button class="btn sm" data-act="sheet" data-id="${p.id}">Offer ${G.money(sal)}</button>`); }).join('')}</div>`;
  }
  return h + '</section>';
}

function reasonsText(rs) {
  if (!rs || !rs.length) return '';
  return '<br>' + rs.map(([s, t]) => s ? `<span class="${s === '+' ? 'good' : 'bad'}">${s === '+' ? '▲' : '▼'} ${esc(t)}</span>` : `<span>• ${esc(t)}</span>`).join(' · ');
}
function marketHeader(F) {
  const done = F.round > G.FA_ROUNDS;
  const label = F.round === 0 ? 'Exclusive window' : (done ? 'Free agency is over' : `Bidding round ${F.round + 1} of ${G.FA_ROUNDS}`);
  const btn = done ? '' : `<button class="btn primary" data-act="advanceFA">${F.round === 0 ? 'Start free agency (resolve round 1)' : `Resolve round ${F.round + 1}`}</button>`;
  const mine = (F.last || []).filter(x => x.tid === L.user);
  const lost = (F.last || []).filter(x => x.tid !== L.user && x.bidders.includes(L.user));
  return `<div class="faround"><div class="split"><b>${label}</b><span class="small">${Object.keys(F.bids || {}).length} bid${Object.keys(F.bids || {}).length === 1 ? '' : 's'} placed</span></div>
    ${F.last ? `<p class="small">Last round: ${F.last.length} players signed. ${mine.length ? `<span class="good">You signed ${mine.map(x => esc(L.players[x.pid].name)).join(', ')}.</span>` : ''} ${lost.length ? `<span class="bad">You lost ${lost.map(x => esc(L.players[x.pid].name) + ' to ' + esc(L.teams[x.tid].abbr)).join(', ')}.</span>` : ''}</p>` : ''}
    <p class="small">Each round, every free agent picks the best offer: money and years, plus team record, scheme fit, playing time, and loyalty. Anyone who doesn't sign lowers his price for the next round. After round ${G.FA_ROUNDS}, leftovers sign cheaply with whoever has room.</p>
    <div class="row">${btn}</div></div>`;
}
function ctFilter(list) {
  const g = ui.ctGrp || 'ALL';
  return list.filter(p => g === 'ALL' || p.grp === g).sort(cmp(ui.ctSort || 'pos'));
}
// Other teams' expected offers for a free agent (estimates: real bids land within a few percent).
function marketLine(p, mine) {
  const v = G.marketView(L, p.id, mine && mine.sal, mine && mine.yrs), others = v.offers.filter(o => o.tid !== L.user);
  if (!others.length) return `<span class="small">No other teams expected to bid this round.</span>`;
  const lead = v.offers[0];
  return `<span class="small">Expected offers: ${others.map(o => `<span class="${o === lead ? 'warn' : ''}">${esc(L.teams[o.tid].abbr)} ≈${G.money(o.sal)}×${o.yrs}${o === lead ? ' (leading)' : ''}</span>`).join(' · ')}</span>`;
}
function marketList(F) {
  if (F.round > G.FA_ROUNDS) return '';
  const g = ui.ctGrp || 'ALL', q = (ui.mktQ || '').trim().toLowerCase(), so = ui.mktSort || 'ovr';
  const srt = so === 'ask' ? (a, b) => G.baseAsk(L, b) - G.baseAsk(L, a) : so === 'age' ? (a, b) => a.age - b.age || b.ovr - a.ovr : cmp(so);
  const allFA = G.freeAgents(L).filter(p => p.retiredYear == null && (g === 'ALL' || p.grp === g) && (!q || p.name.toLowerCase().includes(q))).sort(srt);
  const list = allFA.slice(0, ui.mktShow || 30);
  const rows = list.map(p => {
    const b = F.bids && F.bids[p.id], ask = G.baseAsk(L, p), o = b ? G.bidOutlook(L, p.id) : null;
    const fit = G.fitFor(L, p, L.user);
    const bidUI = b ? `<div class="bid"><span>Your bid <b>${G.money(b.sal)}</b> × <b>${b.yrs}</b> yr${b.yrs > 1 ? 's' : ''}</span>
        <span class="bidctl"><button class="btn sm ar" data-act="bid" data-id="${p.id}" data-key="sal-">−$</button><button class="btn sm ar" data-act="bid" data-id="${p.id}" data-key="sal+">+$</button><button class="btn sm ar" data-act="bid" data-id="${p.id}" data-key="yrs-">−yr</button><button class="btn sm ar" data-act="bid" data-id="${p.id}" data-key="yrs+">+yr</button><button class="btn sm" data-act="bid" data-id="${p.id}" data-key="x">Withdraw</button></span>
        <span class="small ${o && (o.label.startsWith('Below') || o.label.startsWith('Ranked')) ? 'bad' : 'good'}">${o ? esc(o.label) : ''}</span>${marketLine(p, b)}</div>`
      : `<div class="bid"><button class="btn sm primary" data-act="bid" data-id="${p.id}" data-key="new">Bid ${G.money(ask)}</button>${marketLine(p, null)}</div>`;
    return `<div class="pl wide"><div class="pl-main"><span class="pos">${esc(p.pos)}</span><div class="pl-name">${pLink(p)}<div class="pl-sub">Age ${p.age + 1} · ${p.prevTeam != null && L.teams[p.prevTeam] ? 'was ' + esc(L.teams[p.prevTeam].abbr) + ' · ' : ''}asking ${G.money(ask)} · scheme fit <b>${G.playerFit(L, p, L.user).grade}</b>${reasonsText(fit.reasons)}</div></div>
      <div class="pl-r"><span class="lbl">OVR</span>${rating(p.ovr)}</div><div class="pl-r"><span class="lbl">${G.potKnown(L, p) ? 'POT' : 'SCOUT'}</span>${rating(G.shownPot(L, p))}</div></div><div class="pl-btns">${bidUI}</div></div>`;
  }).join('');
  const grpName = { QB: 'Quarterbacks', RB: 'Running backs', WR: 'Wide receivers', TE: 'Tight ends', OL: 'Offensive line', DL: 'Defensive line', LB: 'Linebackers', DB: 'Defensive backs', K: 'Kickers', P: 'Punters' };
  return `<h3 class="sub" id="mkt">Free agent market</h3>
    <div class="mktbar"><label class="fld">Position<select id="mktGrp"><option value="ALL">All positions</option>${G.GRPS.map(x => `<option value="${x}"${g === x ? ' selected' : ''}>${grpName[x]}</option>`).join('')}</select></label>
    <label class="fld">Sort<select id="mktSort">${[['ovr', 'Overall'], ['pot', 'Potential / Scout'], ['ask', 'Asking price'], ['age', 'Youngest'], ['pos', 'Position']].map(([k, n]) => `<option value="${k}"${so === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="fld">Find a player<input id="mktQ" type="search" placeholder="Name" value="${esc(ui.mktQ || '')}"></label></div>
    <p class="small">${allFA.length} free agent${allFA.length === 1 ? '' : 's'}${g !== 'ALL' ? ' at ' + grpName[g].toLowerCase() : ''}${q ? ` matching "${esc(ui.mktQ)}"` : ''}.</p>
    <div class="list">${rows || '<p class="small">No free agents match.</p>'}</div>
    ${allFA.length > list.length ? `<div class="row"><button class="btn" data-act="mktMore">Show more (${allFA.length - list.length} left)</button></div>` : ''}`;
}
function extCard() {
  const el = G.roster(L, L.user).map(p => [p, G.extInfo(L, p)]).filter(x => x[1]).sort((a, b) => b[0].ovr - a[0].ovr);
  if (!el.length) return '';
  return `<section class="card"><h3>Extensions</h3><p class="small">These players are in the last year of their deals. Extend them now, or they reach free agency after the season. Their price depends on how they feel about your team.</p>
    <div class="list">${el.map(([p, x]) => `<div class="pl wide"><div class="pl-main"><span class="pos">${esc(p.pos)}</span><div class="pl-name">${esc(p.name)}<div class="pl-sub">Age ${p.age} · now ${G.money(p.con.sal)} · market ${G.money(G.marketValue(L, p, x.from))}${reasonsText(x.fit.reasons)}</div></div>
      <div class="pl-r"><span class="lbl">OVR</span>${rating(p.ovr)}</div><div class="pl-r"><span class="lbl">${G.potKnown(L, p) ? 'POT' : 'SCOUT'}</span>${rating(G.shownPot(L, p))}</div></div>
      <div class="pl-btns"><button class="btn sm primary" data-act="extend" data-id="${p.id}">Extend ${x.yrs} yr${x.yrs > 1 ? 's' : ''} at ${G.money(x.sal)}</button></div></div>`).join('')}</div></section>`;
}

/* ---------- trade search & find-a-trade ---------- */
function searchResults() {
  const q = (ui.tq || '').trim().toLowerCase(); if (q.length < 2) return '';
  const hits = [];
  for (const id in L.players) { const p = L.players[id]; if (p.team >= 0 && p.team !== L.user && p.name.toLowerCase().includes(q)) hits.push(p); }
  hits.sort((a, b) => b.ovr - a.ovr);
  if (!hits.length) return '<p class="small">No players found.</p>';
  return `<div class="tlist search">${hits.slice(0, 12).map(p => `<button class="tp" data-act="pickFound" data-id="${p.id}"><span class="pos">${esc(p.pos)}</span><span class="tp-n">${esc(p.name)}</span><span class="tp-a">${esc(L.teams[p.team].abbr)} · ${p.age}</span>${rating(p.ovr)}</button>`).join('')}</div><p class="small">Tap a player to add him to the deal with his team.</p>`;
}
function leaguePSCard() {
  if (!G.psSize(L.year) || !(L.phase === 'regular' || L.phase === 'preseason')) return '';
  const all = L.teams.filter(t => t.id !== L.user).flatMap(t => G.practiceSquad(L, t.id)).sort((a, b) => G.shownPot(L, b) - G.shownPot(L, a)).slice(0, 15);
  if (!all.length) return '';
  return `<section class="card"><h3>Other teams' practice squads</h3><p class="small">You can sign any of them straight to your roster (a two-year minimum deal). The best prospects first.</p>
    <div class="list">${all.map(p => `<div class="pl"><div class="pl-main"><span class="pos">${esc(p.pos)}</span><div class="pl-name">${esc(p.name)}<div class="pl-sub">${esc(L.teams[p.team].abbr)} · age ${p.age}</div></div>
      <div class="pl-r"><span class="lbl">OVR</span>${rating(p.ovr)}</div><div class="pl-r"><span class="lbl">${G.potKnown(L, p) ? 'POT' : 'SCOUT'}</span>${rating(G.shownPot(L, p))}</div></div>
      <button class="btn sm" data-act="psPoach" data-id="${p.id}">Sign</button></div>`).join('')}</div></section>`;
}
function blockCard() {
  const wants = [['best', 'Best offer'], ['players', 'Players'], ['picks', 'Picks'], ['young', 'Young (25 and under)']];
  const w = ui.blockWant || 'best', g = ui.blockPos || '';
  return `<section class="card"><h3>Trading block</h3>
    <p class="small">Shop what's in <b>You send</b> to the whole league. Every team that wants it makes its best offer, and the top five show up under <b>Trade offers</b> at the top of this tab. ${L.phase === 'regular' ? 'Offers last a week.' : 'Offers last until kickoff.'}</p>
    <div class="fld">What you want back<div class="seg">${wants.map(([k, t]) => `<button class="${w === k ? 'on' : ''}" data-act="blockWant" data-id="${k}">${t}</button>`).join('')}</div></div>
    <label class="fld">Position you need<select id="blockPos"${w === 'picks' ? ' disabled' : ''}><option value="">Any position</option>${G.GRPS.map(x => `<option value="${x}"${g === x ? ' selected' : ''}>${({ QB: 'Quarterback', RB: 'Running back', WR: 'Wide receiver', TE: 'Tight end', OL: 'Offensive line', DL: 'Defensive line', LB: 'Linebacker', DB: 'Defensive back', K: 'Kicker', P: 'Punter' })[x] || x}</option>`).join('')}</select></label>
    <div class="row"><button class="btn primary" data-act="shopBlock"${ui.give.length ? '' : ' disabled'}>Find offers for what you send</button></div>
    ${ui.give.length ? '' : '<p class="small">Pick players or picks under You send first.</p>'}${ui.blockMsg ? `<p class="small">${esc(ui.blockMsg)}</p>` : ''}</section>`;
}
function foundCard() {
  const F = ui.found; if (!F) return '';
  if (F.err) return `<div class="found"><p class="small bad">${esc(F.err)}</p></div>`;
  if (!F.offers.length) return '<div class="found"><p class="small">No team wants that package right now. Try adding more, or different players or picks.</p></div>';
  const txt = pkg => (pkg.players || []).map(id => { const p = L.players[id]; return p ? `${esc(p.pos)} ${esc(p.name)} ${rating(p.ovr)}` : ''; })
    .concat((pkg.picks || []).map(id => { const k = G.pickById(L, id); return k ? `${esc(G.pickLabel(L, k))} pick <span class="small">≈#${G.projectedOverall(L, k)}</span>` : ''; })).filter(Boolean).join('<br>');
  return `<div class="found"><div class="eyebrow">Offers for your package</div>${F.offers.map((o, i) => `<div class="offer"><div class="split"><b>${esc(tname(L.teams[o.from]))}</b><button class="btn sm primary" data-act="takeFound" data-id="${i}">Accept</button></div><div class="small">They send:</div><div>${txt(o.get)}</div></div>`).join('')}</div>`;
}

/* ---------- camp report, expansion draft, ring of honor ---------- */
function campCard() {
  const C = L.camp; if (!C || C.year !== L.year || !C.mine.length) return '';
  const rows = C.mine.slice().sort((a, b) => (b.a - b.b) - (a.a - a.b));
  const up = rows.filter(r => r.a > r.b), down = rows.filter(r => r.a < r.b).reverse();
  const line = r => { const d = r.a - r.b, p = L.players[r.id]; return `<div class="pl"><div class="pl-main"><span class="pos">${esc(r.pos)}</span><div class="pl-name">${esc(r.name)}<div class="pl-sub">Age ${r.age}${p && p.team !== L.user ? ' · no longer on your team' : ''}</div></div><div class="pl-r"><span class="lbl">WAS</span>${rating(r.b)}</div><div class="pl-r"><span class="lbl">NOW</span>${rating(r.a)}</div><span class="delta ${d > 0 ? 'good' : 'bad'}">${d > 0 ? '▲' + d : '▼' + (-d)}</span></div></div>`; };
  const show = ui.campAll ? 99 : 6;
  return `<section class="card"><div class="split"><h3>${C.year} camp report</h3><span class="small">${up.length} improved · ${down.length} declined</span></div>
    <p class="small">How your players' ratings changed over the offseason: young players grow, veterans slip.${C.retired.length ? ` Retired: ${C.retired.map(r => esc(r.pos + ' ' + r.name)).join(', ')}.` : ''}</p>
    <div class="trade"><div><div class="eyebrow">Biggest gains</div><div class="list">${up.slice(0, show).map(line).join('') || '<p class="small">None.</p>'}</div></div>
    <div><div class="eyebrow">Biggest drops</div><div class="list">${down.slice(0, show).map(line).join('') || '<p class="small">None.</p>'}</div></div></div>
    ${C.league.length ? `<h3 class="sub">Around the league</h3><div class="list">${C.league.slice(0, ui.campAll ? 40 : 5).map(r => { const d = r.a - r.b; return `<div class="pl"><div class="pl-main"><span class="pos">${esc(r.pos)}</span><div class="pl-name">${esc(r.name)}<div class="pl-sub">${esc(L.teams[r.tid].abbr)} · age ${r.age}</div></div><div class="pl-r"><span class="lbl">WAS</span>${rating(r.b)}</div><div class="pl-r"><span class="lbl">NOW</span>${rating(r.a)}</div><span class="delta ${d > 0 ? 'good' : 'bad'}">${d > 0 ? '▲' + d : '▼' + (-d)}</span></div></div>`; }).join('')}</div>` : ''}
    <div class="row"><button class="btn sm" data-act="campAll">${ui.campAll ? 'Show less' : 'Show full report'}</button></div></section>`;
}
function expansionCard() {
  const X = G.upcomingExpansion(L); if (!X) return '';
  const E = G.userExpList(L), protect = X.rules.mode === 'protect', lim = protect ? X.rules.protect : X.rules.expose;
  const names = X.teams.map(t => t[2] + ' ' + t[3]).join(' and ');
  const mine = G.roster(L, L.user).slice().sort((a, b) => b.ovr - a.ovr);
  const rookies = new Set(mine.filter(p => p.draft && p.draft.year === X.y).map(p => p.id));
  return `<section class="card offers"><div class="eyebrow">${X.y} expansion draft</div><h3>${esc(names)} join the league</h3>
    <p class="small">${protect ? `Every team protects ${lim} players. The new teams pick from everyone else, and no team loses more than ${X.rules.perTeam}.` : `Every team leaves ${lim} players unprotected for the new teams to choose from. No team loses more than ${X.rules.perTeam}.`} This year's draft picks are exempt. The draft happens when you start the ${X.y} season.</p>
    <p><b>${protect ? 'Protected' : 'Left unprotected'}: ${E.ids.length} / ${lim}</b></p>
    <div class="tlist protect">${mine.filter(p => !rookies.has(p.id)).map(p => { const on = E.ids.includes(p.id); return `<button class="tp ${on ? 'on' : ''}" data-act="expT" data-id="${p.id}"><span class="pos">${esc(p.pos)}</span><span class="tp-n">${esc(p.name)}</span><span class="tp-a">${p.age}</span>${rating(p.ovr)}</button>`; }).join('')}</div>
    <p class="small">${protect ? 'Highlighted players are protected.' : 'Highlighted players are exposed and can be taken.'}</p></section>`;
}
function ringView() {
  const tid = ui.ringTeam == null ? L.user : ui.ringTeam, t = L.teams[tid], ring = (t.ring || []).slice().sort((a, b) => (a.num || 99) - (b.num || 99));
  const sel = `<label class="fld">Team<select id="ringTeam">${L.teams.map(x => `<option value="${x.id}"${x.id === tid ? ' selected' : ''}>${esc(tname(x))}${(x.ring || []).length ? ' (' + x.ring.length + ')' : ''}</option>`).join('')}</select></label>`;
  let h = `<section class="card"><h3>Ring of Honor</h3><p class="small">Retired numbers. AI teams retire the numbers of their Hall of Famers and longtime stars. You decide for your own team, and a retired number can't be worn again.</p>${sel}
    ${ring.length ? `<div class="rings">${ring.map(r => `<div class="ring"><span class="ringnum">${r.num || '–'}</span><div><button class="lnk" data-act="statPlayer" data-id="${r.id}">${esc(r.name)}</button><div class="small">${esc(r.pos)} · ${r.seasons} season${r.seasons === 1 ? '' : 's'} · retired ${r.y}</div></div></div>`).join('')}</div>` : '<p class="small">No numbers retired yet.</p>'}`;
  if (tid === L.user) {
    const el = G.ringEligible(L, L.user).slice(0, ui.ringAll ? 60 : 12);
    h += `<h3 class="sub">Retire a number</h3><p class="small">Retired players with 3 or more seasons on your team, best careers first.</p><div class="list">${el.map(p => { const n = (p.nums && p.nums[L.user]) || p.num; return `<div class="pl"><div class="pl-main"><span class="pos">${esc(p.pos)}</span><div class="pl-name">${esc(p.name)}${p.hof > 0 ? ' <span class="award">HOF</span>' : ''}<div class="pl-sub">${G.seasonsWith(p, L.user)} seasons with you</div></div></div><div class="pl-btns"><button class="btn sm" data-act="ringAdd" data-id="${p.id}">Retire ${n ? '#' + n : 'number'}</button></div></div>`; }).join('') || '<p class="small">No one qualifies yet.</p>'}</div>
      ${G.ringEligible(L, L.user).length > el.length ? `<div class="row"><button class="btn sm" data-act="ringAll">Show more</button></div>` : ''}`;
  }
  return h + '</section>';
}

/* ---------- Sorting ---------- */
// POT means what you can see: true potential once known, otherwise the scout grade.
function yearSal(p) { return (p.con && G.salFor(p, G.capYear(L))) || 0; }
function cmp(key) {
  if (key === 'sal') return (a, b) => yearSal(b) - yearSal(a) || b.ovr - a.ovr;
  if (key === 'pos') return (a, b) => G.GRPS.indexOf(a.grp) - G.GRPS.indexOf(b.grp) || b.ovr - a.ovr;
  return key === 'pot'
    ? (a, b) => G.shownPot(L, b) - G.shownPot(L, a) || b.ovr - a.ovr
    : (a, b) => b.ovr - a.ovr || G.shownPot(L, b) - G.shownPot(L, a);
}
function sortSeg(stateKey, withPos, def, withSal) {
  const cur = ui[stateKey] || def || 'ovr';
  const opts = (withPos ? [['pos', 'Position']] : []).concat([['ovr', 'Overall'], ['pot', 'Potential / Scout']], withSal ? [['sal', 'Salary']] : []);
  return `<div class="sortrow"><span class="lbl">SORT</span><div class="seg mini">${opts.map(([k, n]) => `<button class="${cur === k ? 'on' : ''}" data-act="sort" data-key="${stateKey}" data-id="${k}">${n}</button>`).join('')}</div></div>`;
}

/* ---------- Roster ---------- */
function chips(key, cur) {
  return `<div class="chips">${['ALL'].concat(G.GRPS).map(g => `<button class="chip ${cur === g ? 'on' : ''}" data-act="chip" data-key="${key}" data-id="${g}">${g === 'ALL' ? 'All' : g}</button>`).join('')}</div>`;
}
function psCard() {
  const n = G.psSize(L.year); if (!n) return '';
  const ps = G.practiceSquad(L, L.user).sort((a, b) => b.pot - a.pot), inS = L.phase === 'regular' || L.phase === 'playoffs';
  return `<section class="card"><div class="split"><h3>Practice squad</h3><span class="count">${ps.length} / ${n}</span></div>
    <p class="small">Players here practice and develop but don't count on your roster or play. ${L.year >= 2020 ? 'Players with up to two seasons qualify, plus up to six veterans.' : 'Players with up to two seasons qualify.'} Other teams can sign them away during the season. Add players from the roster (tap a player) or from free agents.</p>
    <div class="list">${ps.length ? ps.map(p => `<div class="pl wide"><div class="pl-main"><span class="pos">${esc(p.pos)}</span><div class="pl-name">${esc(p.name)}<div class="pl-sub">Age ${p.age} · ${p.yrs ? p.yrs + ' yr' + (p.yrs > 1 ? 's' : '') : 'Rookie'}</div></div>
      <div class="pl-r"><span class="lbl">OVR</span>${rating(p.ovr)}</div><div class="pl-r"><span class="lbl">${G.potKnown(L, p) ? 'POT' : 'SCOUT'}</span>${rating(G.shownPot(L, p))}</div></div>
      <div class="pl-btns"><button class="btn sm primary" data-act="psUp" data-id="${p.id}"${inS && G.roster(L, L.user).length >= G.rules(L.year).rosterMax ? ' disabled' : ''}>Promote to roster</button><button class="btn sm" data-act="psCut" data-id="${p.id}">Release</button></div></div>`).join('') : '<p class="small">Empty.</p>'}</div></section>`;
}
function rightsCard() {
  const rs = G.unsignedRights(L, L.user); if (!rs.length) return '';
  return `<section class="card offers"><h3>Draft pick refusing to sign</h3>${rs.map(p => `<p><b>${esc(p.pos)} ${esc(p.name)}</b> says he won't play for ${esc(me().city)}, like John Elway in 1983 and Bo Jackson in 1986. You hold his rights: trade them (he's in your trade list on the Moves tab) and he'll sign with his new team. Keep them and he sits out the season, then goes back into next year's draft.</p>`).join('')}
    <div class="row"><button class="btn primary sm" data-act="tab" data-id="moves">Go to trades</button></div></section>`;
}
function vRoster() {
  const max = G.rules(L.year).rosterMax, all = G.roster(L, L.user), d = G.depth(L, L.user);
  const SFu = G.startersFor(L, L.user), starterIds = new Set(); G.GRPS.forEach(g => d[g].slice(0, SFu[g]).forEach(p => starterIds.add(p.id)));
  const rc = cmp(ui.rSort), list = all.filter(p => ui.grp === 'ALL' || p.grp === ui.grp).sort((a, b) => (ui.rSort === 'sal' ? 0 : G.GRPS.indexOf(a.grp) - G.GRPS.indexOf(b.grp)) || rc(a, b));
  const act = G.active(L, L.user).length, onIR = all.length - act;
  return rightsCard() + `<section class="card"><div class="split"><h3>${esc(me().name)} roster</h3><span class="count ${act > max ? 'bad' : ''}">${act} / ${max}${onIR ? ` <span class="small">+ ${onIR} on IR</span>` : ''}</span></div>
    <p class="small">Green positions are starters, set on the Coach tab's depth chart. Tap a player for options.</p>${chips('grp', ui.grp)}${sortSeg('rSort', false, 'ovr', true)}
    <div class="list">${list.map(p => `<div class="pl ${ui.open === p.id ? 'open' : ''}">
      <button class="pl-main" data-act="open" data-id="${p.id}"><span class="pos ${starterIds.has(p.id) ? 'st' : ''}">${esc(p.pos)}</span>
      <div class="pl-name">${esc(p.name)}${p.inj ? `<span class="inj">INJ ${p.inj >= 20 ? 'season' : p.inj + 'w'}</span>` : ''}<div class="pl-sub">${p.num ? '#' + p.num + ' · ' : ''}${(() => { const C = L.camp; if (!C || C.year !== L.year || (L.phase !== 'preseason' && L.phase !== 'regular')) return ''; const r = C.mine.find(x => x.id === p.id); if (!r || r.a === r.b) return ''; const d = r.a - r.b; return `<span class="${d > 0 ? 'good' : 'bad'}">${d > 0 ? '▲' + d : '▼' + (-d)} camp</span> · `; })()}${p.ir ? '<b class="bad">INJURED RESERVE</b> · ' : ''}${p.holdout ? '<b class="bad">HOLDOUT</b> · ' : ''}${p.striking ? '<b class="bad">ON STRIKE</b> · ' : ''}${p.repl ? '<b class="warn">Replacement player</b> · ' : ''}${(() => { const rt = G.roleTag(L, p), f = G.playerFit(L, p, L.user); return rt ? `<span class="${rt.c}">${rt.t}</span>, fit <b>${f.grade}</b> · ` : ''; })()}Age ${p.age} · ${p.yrs ? p.yrs + ' yr' + (p.yrs > 1 ? 's' : '') : 'Rookie'} · <span class="${G.mor(p) < 50 ? 'bad' : (G.mor(p) >= 75 ? 'good' : '')}">${G.moraleWord(p)}</span> · ${conText(p)}${statLine(p) ? ' · ' + statLine(p) : ''}</div></div>
      <div class="pl-r"><span class="lbl">OVR</span>${rating(p.ovr)}</div><div class="pl-r"><span class="lbl">${G.potKnown(L, p) ? 'POT' : 'SCOUT'}</span>${rating(G.shownPot(L, p))}</div></button>
      ${ui.open === p.id ? `<div class="pl-act"><button class="btn sm" data-act="pl" data-id="${p.id}">Player page</button><div class="small whybox"><b>Scheme fit ${G.playerFit(L, p, L.user).grade}:</b> ${reasonsText(G.playerFit(L, p, L.user).why)}<br><b>Morale ${G.moraleWord(p)} (${G.mor(p)}):</b> ${reasonsText(G.moraleReasons(L, p)) || 'nothing notable'}${p.holdout ? `<br><b class="bad">Holding out</b> until he gets a new deal (${G.money(G.renegotiatePrice(L, p))}).` : ''}</div>${p.college ? `<span class="small">${esc(p.college)}${p.draft ? ` · drafted ${p.draft.year} R${p.draft.rnd}` : ''}</span>` : ''}${G.canIR(L, p) ? `<button class="btn sm" data-act="ir" data-id="${p.id}">Place on injured reserve</button>` : ''}${p.ir ? (() => { const i = G.irReturnInfo(L, p); return i.ok ? `<button class="btn sm primary" data-act="irOff" data-id="${p.id}">Activate from IR</button>` : `<span class="small">${esc(i.why)}</span>`; })() : ''}${(p.holdout || (G.mor(p) < 50 && G.underpaid(L, p))) && p.con ? `<button class="btn sm primary" data-act="reneg" data-id="${p.id}">New deal ${G.money(G.renegotiatePrice(L, p))}</button>` : ''}${G.extInfo(L, p) ? `<button class="btn sm primary" data-act="extend" data-id="${p.id}">Extend ${G.money(G.extInfo(L, p).sal)}</button>` : ''}${G.canPlayHurt(p) ? `<button class="btn sm" data-act="hurt" data-id="${p.id}">${p.playHurt ? 'Rest him' : 'Play through injury'}</button>` : ''}${G.psSize(L.year) && G.psEligible(L, p) && L.phase !== 'playoffs' ? `<button class="btn sm" data-act="psDown" data-id="${p.id}">Move to practice squad</button>` : ''}${G.optionInfo(L, p) ? `<button class="btn sm primary" data-act="opt5" data-id="${p.id}">Pick up 5th-year option ${G.money(G.optionInfo(L, p).sal)}</button><button class="btn sm" data-act="opt5no" data-id="${p.id}">Decline option</button>` : ''}${confirmBtn('rel' + p.id, G.deadCharge(L, p) ? `Release (${G.money(G.deadCharge(L, p))} dead money)` : 'Release')}<button class="btn sm" data-act="shop" data-id="${p.id}">Offer in trade</button></div>` : ''}
    </div>`).join('')}</div></section>` + psCard();
}

/* ---------- Stats ---------- */
const n0 = v => v || 0;
const num = v => Math.round(n0(v)).toLocaleString('en-US');
const avg = (a, b, d) => b ? (a / b).toFixed(d == null ? 1 : d) : '–';
function table(cols, rows, opts) {
  opts = opts || {};
  if (!rows.length) return `<p class="small">${opts.empty || 'No stats yet.'}</p>`;
  const head = cols.map((c, i) => `<th class="${i ? '' : 'l'}">${opts.sortKey ? `<button class="th" data-act="tsSort" data-id="${c.k || ''}">${c.h}${opts.sortKey === c.k ? ' ▾' : ''}</button>` : c.h}</th>`).join('');
  const body = rows.map(r => `<tr class="${r.me ? 'me' : ''}">${cols.map((c, i) => `<td class="${i ? '' : 'l'}">${c.f(r)}</td>`).join('')}</tr>`).join('');
  return `<div class="tscroll"><table class="tbl stat"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function statYears() {
  const ys = new Set(Object.keys(L.tstats || {}).map(Number));
  for (const p of G.allPlayers(L)) { if (p.team === L.user || Object.values(p.hist).some(h => h.tm === L.user)) Object.keys(p.hist).forEach(y => ys.add(+y)); }
  return [...ys].sort((a, b) => b - a);
}
function teamRecord(t, y) {
  if (y === L.year && L.phase !== 'preseason') return { w: t.w, l: t.l, t: t.t, pf: t.pf, pa: t.pa };
  return t.hist.find(s => s.y === y) || null;
}
function sumHist(p) { const s = { seasons: 0 }; for (const y in p.hist) { s.seasons++; for (const k in p.hist[y]) if (k !== 'tm') s[k] = n0(s[k]) + p.hist[y][k]; } return s; }
function playerTables(rows, career) {
  const nm = r => `<button class="lnk" data-act="statPlayer" data-id="${r.p.id}">${esc(r.p.name)}</button>${career ? '' : ''}`;
  const first = { h: 'Player', f: nm };
  const yrs = career ? [{ h: 'Yrs', f: r => r.s.seasons }] : [];
  const out = [];
  const pass = rows.filter(r => n0(r.s.att) > 0).sort((a, b) => n0(b.s.py) - n0(a.s.py));
  out.push(['Passing', table([first, ...yrs, { h: 'G', f: r => n0(r.s.g) }, { h: 'Cmp', f: r => num(r.s.cmp) }, { h: 'Att', f: r => num(r.s.att) }, { h: 'Pct', f: r => avg(n0(r.s.cmp) * 100, r.s.att) }, { h: 'Yds', f: r => num(r.s.py) }, { h: 'TD', f: r => n0(r.s.ptd) }, { h: 'INT', f: r => n0(r.s.int) }, { h: 'Y/A', f: r => avg(r.s.py, r.s.att) }], pass)]);
  const rush = rows.filter(r => n0(r.s.ra) > 0).sort((a, b) => n0(b.s.ry) - n0(a.s.ry));
  out.push(['Rushing', table([first, ...yrs, { h: 'G', f: r => n0(r.s.g) }, { h: 'Att', f: r => num(r.s.ra) }, { h: 'Yds', f: r => num(r.s.ry) }, { h: 'Avg', f: r => avg(r.s.ry, r.s.ra) }, { h: 'TD', f: r => n0(r.s.rtd) }], rush)]);
  const recv = rows.filter(r => n0(r.s.rec) > 0 || n0(r.s.recy) > 0).sort((a, b) => n0(b.s.recy) - n0(a.s.recy));
  out.push(['Receiving', table([first, ...yrs, { h: 'G', f: r => n0(r.s.g) }, { h: 'Rec', f: r => num(r.s.rec) }, { h: 'Yds', f: r => num(r.s.recy) }, { h: 'Avg', f: r => avg(r.s.recy, r.s.rec) }, { h: 'TD', f: r => n0(r.s.rectd) }], recv)]);
  const def = rows.filter(r => ['DL', 'LB', 'DB'].includes(r.p.grp) && n0(r.s.g) > 0).sort((a, b) => (n0(b.s.sk) * 2 + n0(b.s.dint) * 3) - (n0(a.s.sk) * 2 + n0(a.s.dint) * 3) || n0(b.s.g) - n0(a.s.g));
  out.push(['Defense', table([first, ...yrs, { h: 'Pos', f: r => esc(r.p.pos) }, { h: 'G', f: r => n0(r.s.g) }, { h: 'Sacks', f: r => n0(r.s.sk) }, { h: 'INT', f: r => n0(r.s.dint) }], def)]);
  const kick = rows.filter(r => n0(r.s.fgm) > 0).sort((a, b) => n0(b.s.fgm) - n0(a.s.fgm));
  out.push(['Kicking', table([first, ...yrs, { h: 'G', f: r => n0(r.s.g) }, { h: 'FG made', f: r => n0(r.s.fgm) }], kick)]);
  return out.map(([t, tb]) => `<section class="card"><h3>${t}</h3>${tb}</section>`).join('');
}
function playerCard(p) {
  const ys = Object.keys(p.hist).map(Number).sort((a, b) => a - b);
  const rows = ys.map(y => ({ y, s: p.hist[y], me: p.hist[y].tm === L.user }));
  const tm = r => r.s.tm != null ? esc(L.teams[r.s.tm].abbr) : '–';
  let cols = [{ h: 'Year', f: r => r.y }, { h: 'Tm', f: tm }, { h: 'G', f: r => n0(r.s.g) }];
  if (p.grp === 'QB') cols = cols.concat([{ h: 'Cmp', f: r => num(r.s.cmp) }, { h: 'Att', f: r => num(r.s.att) }, { h: 'Yds', f: r => num(r.s.py) }, { h: 'TD', f: r => n0(r.s.ptd) }, { h: 'INT', f: r => n0(r.s.int) }, { h: 'Rush', f: r => num(r.s.ry) }]);
  else if (p.grp === 'RB') cols = cols.concat([{ h: 'Att', f: r => num(r.s.ra) }, { h: 'Rush', f: r => num(r.s.ry) }, { h: 'TD', f: r => n0(r.s.rtd) }, { h: 'Rec', f: r => num(r.s.rec) }, { h: 'RecYds', f: r => num(r.s.recy) }, { h: 'RecTD', f: r => n0(r.s.rectd) }]);
  else if (p.grp === 'WR' || p.grp === 'TE') cols = cols.concat([{ h: 'Rec', f: r => num(r.s.rec) }, { h: 'Yds', f: r => num(r.s.recy) }, { h: 'TD', f: r => n0(r.s.rectd) }]);
  else if (p.grp === 'K') cols = cols.concat([{ h: 'FG', f: r => n0(r.s.fgm) }]);
  else cols = cols.concat([{ h: 'Sacks', f: r => n0(r.s.sk) }, { h: 'INT', f: r => n0(r.s.dint) }]);
  const tot = sumHist(p);
  const totRow = { y: 'Career', s: Object.assign({}, tot, { tm: null, g: tot.g }) };
  const ap1 = (p.awards || []).filter(a => a.a === 'ap1').map(a => a.y), ap2 = (p.awards || []).filter(a => a.a === 'ap2').map(a => a.y);
  const aw = (p.hof > 0 ? `<span class="award">Hall of Fame ${p.hof}</span>` : '') + (p.awards || []).filter(a => a.a !== 'ap1' && a.a !== 'ap2' && a.a !== 'pb').map(a => `<span class="award">${a.y} ${esc(G.AWARD_NAMES[a.a])}</span>`).join('')
    + (ap1.length ? `<span class="award">${ap1.length}× First-team All-Pro (${ap1.join(', ')})</span>` : '') + (ap2.length ? `<span class="award">${ap2.length}× Second-team All-Pro</span>` : '') + (() => { const n = (p.awards || []).filter(a => a.a === 'pb').length; return n ? `<span class="award">${n}× Pro Bowl</span>` : ''; })();
  return `<section class="card hero"><div class="split"><div><div class="eyebrow">${esc(p.pos)} · age ${p.age} · ${p.team >= 0 ? esc(tname(L.teams[p.team])) : (p.team === -2 ? 'Retired' : 'Free agent')}</div><h2>${esc(p.name)}</h2></div><button class="btn sm" data-act="statPlayer" data-id="">Close</button></div>
    ${aw ? `<div class="awards">${aw}</div>` : ''}
    ${ys.length ? table(cols, rows.concat([totRow])) : '<p class="small">No NFL stats in this league yet. Stats before 1970 are not imported.</p>'}</section>`;
}
function vStats() {
  const seg = [['team', 'Teams'], ['season', 'My players'], ['career', 'Careers'], ['awards', 'Awards'], ['allpro', 'All-Pro & Pro Bowl'], ['hof', 'Hall of Fame'], ['hist', 'Records']], mode = ui.st || 'team';
  let h = `<div class="chips navchips">${seg.map(([k, n]) => `<button class="chip ${mode === k ? 'on' : ''}" data-act="st" data-id="${k}">${n}</button>`).join('')}</div>`;
  if (ui.statPid && G.getP(L, ui.statPid)) h += playerCard(G.getP(L, ui.statPid));
  const years = statYears();
  const y = years.includes(ui.stYear) ? ui.stYear : (years[0] || L.year);
  const yearChips = years.length > 1 ? `<div class="chips">${years.map(v => `<button class="chip ${v === y ? 'on' : ''}" data-act="stYear" data-id="${v}">${v}</button>`).join('')}</div>` : '';
  if (mode === 'team') {
    const Y = (L.tstats || {})[y] || {};
    const rows = L.teams.map(t => { const T = Y[t.id], r = teamRecord(t, y); return T && r ? { t, T, r, me: t.id === L.user } : null; }).filter(Boolean);
    const pg = (v, g) => g ? (v / g).toFixed(1) : '–';
    const cols = [
      { h: 'Team', k: '', f: x => esc(x.t.abbr), v: x => x.t.abbr },
      { h: 'W-L-T', k: 'w', f: x => `${x.r.w}-${x.r.l}-${x.r.t}`, v: x => x.r.w + x.r.t / 2 },
      { h: 'PF', k: 'pf', f: x => x.r.pf, v: x => x.r.pf },
      { h: 'PA', k: 'pa', f: x => x.r.pa, v: x => -x.r.pa },
      { h: 'Yds/G', k: 'yds', f: x => pg(x.T.yds, x.T.g), v: x => x.T.yds / x.T.g },
      { h: 'Pass/G', k: 'py', f: x => pg(x.T.py, x.T.g), v: x => x.T.py / x.T.g },
      { h: 'Rush/G', k: 'ry', f: x => pg(x.T.ry, x.T.g), v: x => x.T.ry / x.T.g },
      { h: 'Allow/G', k: 'ydsA', f: x => pg(x.T.ydsA, x.T.g), v: x => -x.T.ydsA / x.T.g },
      { h: 'Sacks', k: 'sk', f: x => x.T.sk, v: x => x.T.sk },
      { h: 'Take', k: 'take', f: x => x.T.take, v: x => x.T.take },
      { h: 'Give', k: 'giv', f: x => x.T.giv, v: x => -x.T.giv }
    ];
    const sk = ui.tsSort || 'w', col = cols.find(c => c.k === sk) || cols[1];
    rows.sort((a, b) => col.v(b) - col.v(a));
    h += yearChips + `<section class="card"><h3>${y} team stats</h3><p class="small">Tap a column to sort. Allowed yards, points against, and giveaways sort best-first.</p>${table(cols, rows, { sortKey: sk, empty: 'No games played yet this season.' })}</section>`;
  }
  if (mode === 'season') {
    const rows = []; for (const p of G.allPlayers(L)) { const s = p.hist[y]; if (s && s.tm === L.user) rows.push({ p, s, me: false }); }
    h += yearChips + `<p class="small">${y} regular season, players who played for the ${esc(me().name)}. Tap a name for his career.</p>` + playerTables(rows, false);
  }
  if (mode === 'career') {
    const rows = G.roster(L, L.user).map(p => ({ p, s: sumHist(p), me: false })).filter(r => r.s.seasons > 0);
    h += `<p class="small">Career totals for your current roster, counting only seasons played in this league. Tap a name for year-by-year stats.</p>` + playerTables(rows, true);
  }
  if (mode === 'hist') h += historyView();
  if (mode === 'allpro') h += allProView();
  if (mode === 'hof') h += hofView();
  if (mode === 'awards') {
    const A = L.awards || {}, ys = Object.keys(A).map(Number).sort((a, b) => b - a);
    h += `<section class="card"><h3>Awards</h3><p class="small">Regular-season awards are given when the regular season ends. Super Bowl MVP is named after the Super Bowl.</p>${ys.length ? ys.map(yy => `<div class="aw-year"><div class="eyebrow">${yy}</div>${['mvp', 'opoy', 'dpoy', 'roy', 'sbmvp'].filter(k => A[yy][k]).map(k => { const a = A[yy][k]; return `<div class="aw ${a.tid === L.user ? 'mine' : ''}"><span class="aw-k">${esc(G.AWARD_NAMES[k])}</span><span class="aw-p"><button class="lnk" data-act="statPlayer" data-id="${a.pid}">${esc(a.pos)} ${esc(a.name)}</button>, ${esc(L.teams[a.tid].abbr)}</span><span class="small">${esc(a.line)}</span></div>`; }).join('')}</div>`).join('') : '<p>No awards yet. The first ones are given when the regular season ends.</p>'}</section>`;
  }
  return h;
}

function historyView() {
  let h = ringView();
  const t = me(), mine = G.allPlayers(L);
  // franchise records
  const recs = [['py', 'Passing yards'], ['ptd', 'Passing TD'], ['ry', 'Rushing yards'], ['rtd', 'Rushing TD'], ['recy', 'Receiving yards'], ['rectd', 'Receiving TD'], ['sk', 'Sacks'], ['dint', 'Interceptions']];
  const season = {}, career = {};
  for (const p of mine) for (const y in p.hist) { const s = p.hist[y]; if (s.tm !== L.user) continue;
    for (const [k] of recs) { const v = s[k] || 0; if (!v) continue;
      if (!season[k] || v > season[k].v) season[k] = { v, p, y };
      const c = (career[k] = career[k] || {}); c[p.id] = (c[p.id] || 0) + v; } }
  const careerBest = k => { const c = career[k] || {}; let best = null; for (const id in c) if (!best || c[id] > best.v) best = { v: c[id], p: G.getP(L, +id) }; return best; };
  const recRows = recs.map(([k, n]) => { const s = season[k], c = careerBest(k);
    return `<tr><td class="l">${n}</td><td class="l">${s ? `<button class="lnk" data-act="statPlayer" data-id="${s.p.id}">${esc(s.p.name)}</button> ${num(s.v)} (${s.y})` : '–'}</td><td class="l">${c && c.p ? `<button class="lnk" data-act="statPlayer" data-id="${c.p.id}">${esc(c.p.name)}</button> ${num(c.v)}` : '–'}</td></tr>`; }).join('');
  const hs = t.hist.slice();
  const best = hs.slice().sort((a, b) => (b.w + b.t / 2) / (b.w + b.l + b.t) - (a.w + a.t / 2) / (a.w + a.l + a.t))[0];
  const titles = hs.filter(s => s.res === 'Won Super Bowl').map(s => s.y);
  h += `<section class="card"><h3>${esc(t.name)} records</h3><p class="small">Only seasons played for your franchise in this league count.${titles.length ? ` Super Bowl titles: <b>${titles.join(', ')}</b>.` : ''}${best ? ` Best season: ${best.y} (${best.w}-${best.l}${best.t ? '-' + best.t : ''}).` : ''}</p>
    <div class="tscroll"><table class="tbl stat"><thead><tr><th class="l">Record</th><th class="l">Single season</th><th class="l">Career</th></tr></thead><tbody>${recRows}</tbody></table></div></section>`;
  // past seasons + box scores
  const ys = Object.keys(L.myGames || {}).map(Number).sort((a, b) => b - a);
  if (ys.length) {
    const y = ys.includes(ui.histYear) ? ui.histYear : ys[0];
    h += `<section class="card"><h3>Your past games</h3><div class="chips">${ys.map(v => `<button class="chip ${v === y ? 'on' : ''}" data-act="histYear" data-id="${v}">${v}</button>`).join('')}</div>${L.myGames[y].map((g, i) => `<div class="eyebrow">${esc(g.wk)}</div>${gameLine(g, 'a:' + y + ':' + i)}`).join('')}</section>`;
  }
  return h;
}

function allProView() {
  const A = L.allPro || {}, ys = Object.keys(A).map(Number).sort((a, b) => b - a);
  if (!ys.length) return '<section class="card"><h3>All-Pro teams</h3><p class="small">The first All-Pro teams are named when this regular season ends.</p></section>';
  const y = ys.includes(ui.apYear) ? ui.apYear : ys[0];
  const tbl = list => `<div class="tscroll"><table class="tbl stat"><thead><tr><th class="l">Pos</th><th class="l">Player</th><th class="l">Team</th><th class="l">Season</th></tr></thead><tbody>${list.map(x => `<tr class="${x.tid === L.user ? 'me' : ''}"><td class="l">${esc(x.pos)}</td><td class="l"><button class="lnk" data-act="statPlayer" data-id="${x.id}">${esc(x.name)}</button></td><td class="l">${esc(L.teams[x.tid].abbr)}</td><td class="l small">${esc(x.line)}</td></tr>`).join('')}</tbody></table></div>`;
  return `<section class="card"><h3>${y} All-Pro teams</h3><p class="small">Picked at the end of each regular season from that season's stats. Offensive linemen and kickers are judged mostly on rating and games started. Every year is kept.</p>
    <div class="chips">${ys.map(v => `<button class="chip ${v === y ? 'on' : ''}" data-act="apYear" data-id="${v}">${v}</button>`).join('')}</div>
    <h3 class="sub">First team</h3>${tbl(A[y].first)}<h3 class="sub">Second team</h3>${tbl(A[y].second)}</section>`
    + (L.proBowl && L.proBowl[y] ? `<section class="card"><h3>${y} Pro Bowl</h3><p class="small">Each conference's squad, picked from the season's stats.</p>${['AFC', 'NFC'].map(c => `<h3 class="sub">${c}</h3>${tbl(L.proBowl[y][c])}`).join('')}</section>` : '');
}
function hofView() {
  const hof = (L.hof || []).slice().sort((a, b) => b.y - a.y || b.score - a.score);
  const g = ui.hofGrp || 'ALL';
  const rows = hof.map(x => {
    const p = G.getP(L, x.id); if (!p) return null;
    const ys = Object.keys(p.hist).map(Number).sort((a, b) => a - b), s = sumHist(p), aw = p.awards || [];
    const cnt = k => aw.filter(a => a.a === k).length;
    const honors = [cnt('mvp') ? cnt('mvp') + '× MVP' : '', cnt('ap1') ? cnt('ap1') + '× 1st-team All-Pro' : '', cnt('opoy') + cnt('dpoy') ? (cnt('opoy') + cnt('dpoy')) + '× Player of the Year' : '', cnt('sbmvp') ? cnt('sbmvp') + '× SB MVP' : ''].filter(Boolean).join(', ');
    const career = p.grp === 'QB' ? `${num(s.py)} pass yds, ${n0(s.ptd)} TD` : p.grp === 'RB' ? `${num(s.ry)} rush yds, ${n0(s.rtd) + n0(s.rectd)} TD` : (p.grp === 'WR' || p.grp === 'TE') ? `${num(s.rec)} rec, ${num(s.recy)} yds` : p.grp === 'DB' ? `${n0(s.dint)} INT` : p.grp === 'DL' ? `${n0(s.sk)} sacks` : p.grp === 'LB' ? `${n0(s.sk)} sacks, ${n0(s.dint)} INT` : p.grp === 'K' ? `${n0(s.fgm)} FG` : `${n0(s.g)} games`;
    return { x, p, grp: p.grp, yrs: ys.length ? `${ys[0]}–${ys[ys.length - 1]}` : '', career, honors };
  }).filter(r => r && (g === 'ALL' || r.grp === g));
  return `<section class="card"><div class="split"><h3>Hall of Fame</h3><span class="count">${hof.length}</span></div>
    <p class="small">Every inductee in your league's history. Players become eligible 5 years after their last season. The bar is roughly the top 3% of long careers at each position, counting only seasons played in this league, plus honors like MVPs and All-Pro selections.</p>
    ${chips('hofGrp', g)}
    ${rows.length ? `<div class="tscroll"><table class="tbl stat"><thead><tr><th class="l">Class</th><th class="l">Player</th><th class="l">Years</th><th class="l">Teams</th><th class="l">Career</th><th class="l">Honors</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.x.teams.includes(L.user) ? 'me' : ''}"><td class="l">${r.x.y}</td><td class="l">${esc(r.x.pos)} <button class="lnk" data-act="statPlayer" data-id="${r.x.id}">${esc(r.x.name)}</button></td><td class="l">${r.yrs}</td><td class="l">${r.x.teams.map(tid => esc(L.teams[tid].abbr)).join(', ')}</td><td class="l">${r.career}</td><td class="l small">${r.honors || '–'}</td></tr>`).join('')}</tbody></table></div>` : `<p class="small">${hof.length ? 'No inductees at this position.' : 'No one has been inducted yet. The first classes usually arrive around 1980.'}</p>`}</section>`;
}

function draftClassView() {
  if (L.phase === 'draft') return '<section class="card"><p>The draft is underway. Make your picks on the Office tab.</p></section>';
  if (L.phase === 'offseason') return `<section class="card"><p>The ${L.year + 2} draft class appears when the ${L.year + 1} season kicks off.</p></section>`;
  const C = G.ensureNextClass(L, IM); if (!C) return '';
  const all = C.pool.map(id => L.players[id]).filter(p => p && p.team === -3);
  const seen = all.filter(p => G.scoutedYet(L, p));
  const g = ui.prGrp || 'ALL';
  const list = seen.filter(p => g === 'ALL' || p.grp === g).sort((a, b) => b.scout - a.scout);
  const show = list.slice(0, ui.prShow || 50);
  const games = G.rules(L.year).games;
  const stage = L.phase === 'preseason' ? 'Training camp: scouts have graded a random handful of prospects so far.'
    : L.phase === 'regular' ? `Week ${L.week} of ${games}: scouts grade a random batch of prospects every week, not best-first, so a top player can turn up late.` : 'Every prospect has been graded.';
  const rankOf = new Map(seen.slice().sort((a, b) => b.scout - a.scout).map((p, i) => [p.id, i + 1]));
  return `<section class="card"><div class="split"><h3>${C.year} draft class</h3><span class="count">${seen.length} / ${all.length}</span></div>
    <p class="small">${stage} ${C.real ? 'This is the real class you imported.' : `No ${C.year} class has been imported, so these prospects are generated.`} Scout grades are estimates. True potential stays hidden until you use a scouting visit at the draft or a player finishes his rookie season.</p>
    ${chips('prGrp', g)}
    <div class="list">${show.map(p => `<div class="pl"><div class="pl-main"><span class="dc-n">${rankOf.get(p.id)}</span><span class="pos">${esc(p.pos)}</span><div class="pl-name">${esc(p.name)}<div class="pl-sub">${esc(p.college || '')} · age ${p.age}${p.realPick && p.realPick.rnd ? ` · real: R${p.realPick.rnd} #${p.realPick.pick}` : ''}</div></div>
      <div class="pl-r"><span class="lbl">SCOUT</span>${rating(p.scout)}</div></div></div>`).join('') || '<p class="small">No graded prospects at this position yet.</p>'}</div>
    ${list.length > show.length ? `<div class="row"><button class="btn" data-act="prMore">Show more (${list.length - show.length} left)</button></div>` : ''}</section>`;
}

/* ---------- League ---------- */
function divTable(conf, div) {
  const teams = G.sortTeams(L, L.teams.filter(t => t.conf === conf && t.div === div));
  return `<section class="card"><h3>${conf} ${div}</h3><table class="tbl"><thead><tr><th>Team</th><th>W</th><th>L</th><th>T</th><th>PF</th><th>PA</th></tr></thead><tbody>
    ${teams.map(t => `<tr class="${t.id === L.user ? 'me' : ''}"><td>${tLink(t.id, esc(t.city))}</td><td>${t.w}</td><td>${t.l}</td><td>${t.t}</td><td>${t.pf}</td><td>${t.pa}</td></tr>`).join('')}</tbody></table></section>`;
}
function vLeague() {
  if (ui.box) return boxCard(ui.box) + vLeagueInner();
  return vLeagueInner();
}
function vLeagueInner() {
  const seg = [['stand', 'Standings'], ['lead', 'Leaders'], ['res', 'Results'], ['class', 'Draft class'], ['dres', 'Draft results'], ['teams', 'Teams'], ['hist', 'History']];
  let h = `<div class="seg">${seg.map(([k, n]) => `<button class="${ui.lg === k ? 'on' : ''}" data-act="lg" data-id="${k}">${n}</button>`).join('')}</div>`;
  if (ui.lg === 'teams') {
    const byConf = {}; L.teams.forEach(t => (byConf[t.conf] = byConf[t.conf] || []).push(t));
    h += Object.keys(byConf).sort().map(cf => `<section class="card"><h3>${esc(cf)}</h3><div class="list">${byConf[cf].sort((a, b) => tname(a).localeCompare(tname(b))).map(t => { const H = t.hist || [], W = H.reduce((a, x) => a + x.w, 0), Lo = H.reduce((a, x) => a + x.l, 0), sb = (L.champs || []).filter(c => c.champ === t.id).length;
      return `<div class="pl"><div class="pl-main"><span class="pos">${esc(t.abbr)}</span><div class="pl-name">${tLink(t.id)}<div class="pl-sub">${esc(t.div)} · ${rec(t)} this season · ${W}-${Lo} all-time${sb ? ` · ${sb} title${sb > 1 ? 's' : ''}` : ''}</div></div></div></div>`; }).join('')}</div></section>`).join('');
  }
  if (ui.lg === 'dres') {
    const H = L.draftHist || {}, ys = Object.keys(H).map(Number).sort((a, b) => b - a);
    if (L.draft && L.draft.log.length) ys.unshift(L.draft.year);
    if (!ys.length) h += '<section class="card"><p>No drafts yet. Results appear here once your first draft is held.</p></section>';
    else {
      const y = ys.includes(ui.dresYear) ? ui.dresYear : ys[0], live = L.draft && y === L.draft.year, log = live ? L.draft.log : H[y];
      const n = L.teams.length, rounds = Math.ceil(log.length / n) || G.rules(y).draftRounds;
      h += `<section class="card"><label class="fld">Draft<select id="dresYear">${ys.map(v => `<option value="${v}"${v === y ? ' selected' : ''}>${v}${live && v === y ? ' (in progress)' : ''}</option>`).join('')}</select></label></section>`;
      h += draftTracker(log, y, rounds, n, false);
    }
  }
  if (ui.lg === 'stand') {
    const divs = G.divisions(L);
    Object.keys(divs).sort().forEach(k => { const [c, d] = k.split('|'); h += divTable(c, d); });
  }
  if (ui.lg === 'lead') {
    const keys = [['py', 'Passing yards'], ['ptd', 'Passing TD'], ['ry', 'Rushing yards'], ['recy', 'Receiving yards'], ['rectd', 'Receiving TD'], ['sk', 'Sacks'], ['dint', 'Interceptions'], ['fgm', 'Field goals']];
    h += `<div class="chips">${keys.map(([k, n]) => `<button class="chip ${ui.leadKey === k ? 'on' : ''}" data-act="lead" data-id="${k}">${n}</button>`).join('')}</div>`;
    const top = G.leaders(L, ui.leadKey, 15);
    h += `<section class="card"><table class="tbl"><thead><tr><th>#</th><th class="l">Player</th><th>Team</th><th>${esc(keys.find(k => k[0] === ui.leadKey)[1])}</th></tr></thead><tbody>
      ${top.length ? top.map((x, i) => `<tr class="${x.p.team === L.user ? 'me' : ''}"><td>${i + 1}</td><td class="l">${esc(x.p.name)}</td><td>${x.p.team >= 0 ? esc(L.teams[x.p.team].abbr) : 'FA'}</td><td>${x.v}</td></tr>`).join('') : '<tr><td colspan="4">No games played yet this season.</td></tr>'}</tbody></table></section>`;
  }
  if (ui.lg === 'res') {
    const played = L.schedule.filter(w => w.some(g => g.done)).length;
    if (!played) h += '<section class="card"><p>No games played yet this season.</p></section>';
    else {
      const w = ui.resWeek == null ? played - 1 : Math.min(ui.resWeek, played - 1);
      h += `<div class="chips">${L.schedule.slice(0, played).map((_, i) => `<button class="chip ${i === w ? 'on' : ''}" data-act="week" data-id="${i}">W${i + 1}</button>`).join('')}</div>
        <section class="card">${L.schedule[w].map((g, gi) => gameLine(g, 'w:' + w + ':' + gi)).join('')}</section>`;
    }
  }
  if (ui.lg === 'class') h += draftClassView();
  if (ui.lg === 'hist') {
    h += `<section class="card"><h3>Super Bowl champions</h3>${L.champs.length ? `<table class="tbl"><tbody>${L.champs.map(c => `<tr class="${c.champ === L.user ? 'me' : ''}"><td>${c.y}</td><td class="l">${G.roman(c.sb)}</td><td class="l">${esc(tname(L.teams[c.champ]))}</td><td>${c.score}</td></tr>`).join('')}</tbody></table>` : '<p>No champions crowned yet.</p>'}</section>`;
    h += `<section class="card"><h3>${esc(me().name)} by season</h3>${me().hist.length ? `<table class="tbl"><tbody>${me().hist.slice().reverse().map(s => `<tr><td>${s.y}</td><td>${s.w}-${s.l}${s.t ? '-' + s.t : ''}</td><td>${s.pf}-${s.pa}</td><td class="l">${esc(s.res)}</td></tr>`).join('')}</tbody></table>` : '<p>Your first season is under way.</p>'}</section>`;
  }
  return h;
}

/* ---------- Moves: free agents & trades ---------- */
function vMoves() {
  const max = G.rules(L.year).rosterMax, n = G.roster(L, L.user).length;
  const fa = G.freeAgents(L).filter(p => ui.faGrp === 'ALL' || p.grp === ui.faGrp).sort(ui.mSort ? cmp(ui.mSort) : (a, b) => G.value(b) - G.value(a)).slice(0, 40);
  const faEra = G.faEra(G.capYear(L)), inSeason = L.phase === 'regular' || L.phase === 'playoffs';
  const faNote = faEra === 'ufa' && L.phase === 'offseason' ? 'The open market: unrestricted free agents plus released and undrafted players. They sign for the price shown, which is higher if your team was bad last year.' : (inSeason ? 'Players released, cut, or left undrafted. In-season signings are 1-year deals at a discount.' : 'Players released, cut, or left undrafted.');
  const bidding = L.phase === 'offseason' && L.fa && L.fa.era === 'ufa' && L.fa.round <= G.FA_ROUNDS;
  let h = offersCard() + expansionCard() + payrollCard() + faCard() + extCard() + (bidding ? '' : `<section class="card"><div class="split"><h3>Free agents</h3><span class="count">${n} / ${max}</span></div>
    <p class="small">${faNote}</p>${chips('faGrp', ui.faGrp)}${sortSeg('mSort')}
    <div class="list">${fa.length ? fa.map(p => `<div class="pl"><div class="pl-main"><span class="pos">${esc(p.pos)}</span><div class="pl-name">${esc(p.name)}<div class="pl-sub">Age ${p.age}</div></div>
      <div class="pl-r"><span class="lbl">OVR</span>${rating(p.ovr)}</div><div class="pl-r"><span class="lbl">${G.potKnown(L, p) ? 'POT' : 'SCOUT'}</span>${rating(G.shownPot(L, p))}</div></div>
      <div class="pl-btns"><button class="btn sm" data-act="sign" data-id="${p.id}"${inSeason && n >= max ? ' disabled' : ''}>Sign ${G.money(G.askPrice(L, p) * (inSeason ? 0.6 : 1))}</button>${G.psSize(L.year) && (p.yrs || 0) <= 2 && G.practiceSquad(L, L.user).length < G.psSize(L.year) ? `<button class="btn sm" data-act="psSign" data-id="${p.id}">Practice squad</button>` : ''}</div></div>`).join('') : '<p>No free agents at this position.</p>'}</div></section>`) + leaguePSCard();
  const others = L.teams.filter(t => t.id !== L.user);
  // "All teams" (-1): browse the whole league; the partner is whichever team you pick from
  const allT = ui.tradeTeam === -1;
  const tt = allT ? (ui.getTeam != null ? ui.getTeam : -1) : (ui.tradeTeam == null ? others[0].id : ui.tradeTeam);
  const pkg = sel => ({ players: sel.filter(x => x[0] === 'p').map(x => +x.slice(2)), picks: sel.filter(x => x[0] === 'k').map(x => +x.slice(2)) });
  // drop anything that changed teams since it was selected
  ui.give = ui.give.filter(x => x[0] === 'p' ? (L.players[+x.slice(2)] || {}).team === L.user : (G.pickById(L, +x.slice(2)) || {}).own === L.user);
  ui.get = tt < 0 ? [] : ui.get.filter(x => x[0] === 'p' ? (L.players[+x.slice(2)] || {}).team === tt : (G.pickById(L, +x.slice(2)) || {}).own === tt);
  // each side has its own position filter
  const gGive = ui.tGrpGive || 'ALL', gGet = ui.tGrpGet || 'ALL';
  const tc = cmp(ui.tSort || 'pos'), showPot = ui.tSort === 'pot';
  const mine = G.roster(L, L.user).concat(G.unsignedRights(L, L.user)).filter(p => gGive === 'ALL' || p.grp === gGive).sort(tc);
  const LIM = 150;
  let theirsAll = allT ? others.flatMap(t => G.roster(L, t.id)) : G.roster(L, tt);
  theirsAll = theirsAll.filter(p => gGet === 'ALL' || p.grp === gGet).sort(tc);
  const theirs = theirsAll.slice(0, allT ? LIM : 999);
  const posSel = (side, cur) => `<label class="fld tpos">Position<select id="tGrp-${side}">${['ALL'].concat(G.GRPS).map(g => `<option value="${g}"${cur === g ? ' selected' : ''}>${g === 'ALL' ? 'All positions' : g}</option>`).join('')}</select></label>`;
  const btnP = (p, side) => { const key = 'p:' + p.id, on = ui[side].includes(key), lk = side === 'give' && G.tradeLocked(L, p); return `<button class="tp ${on ? 'on' : ''}" data-act="tp" data-side="${side}" data-id="${key}"${lk ? ' disabled title="Just signed"' : ''}><span class="pos">${esc(p.pos)}</span><span class="tp-n">${esc(p.name)}${lk ? ' (new)' : ''}</span><span class="tp-a">${side === 'get' ? 'fit ' + G.playerFit(L, p, L.user).grade + ' · ' : ''}${allT && side === 'get' ? esc(L.teams[p.team].abbr) + ' · ' : ''}${ui.tSort === 'sal' ? G.money(yearSal(p)) : p.age}</span>${rating(showPot ? G.shownPot(L, p) : p.ovr)}</button>`; };
  const btnK = (k, side) => { const key = 'k:' + k.id, on = ui[side].includes(key); return `<button class="tp ${on ? 'on' : ''}" data-act="tp" data-side="${side}" data-id="${key}"><span class="pos pk">PICK</span><span class="tp-n">${allT && side === 'get' ? esc(L.teams[k.own].abbr) + ' ' : ''}${k.y} R${k.rnd}${k.orig !== k.own ? ' (' + esc(L.teams[k.orig].abbr) + ')' : ''}</span><span class="tp-a">≈#${G.projectedOverall(L, k)}</span></button>`; };
  const col = (side, players, tid, label) => {
    const picks = side === 'get' && allT ? others.flatMap(t => G.teamPicks(L, t.id)).sort((a, b) => a.y - b.y || a.rnd - b.rnd).slice(0, LIM) : G.teamPicks(L, tid);
    return `<div><div class="eyebrow">${label} (${ui[side].length})</div>
      <div class="seg mini"><button class="${(ui.tview || 'p') === 'p' ? 'on' : ''}" data-act="tview" data-id="p">Players</button><button class="${ui.tview === 'k' ? 'on' : ''}" data-act="tview" data-id="k">Picks (${picks.length})</button></div>
      ${ui.tview === 'k' ? '' : posSel(side, side === 'give' ? gGive : gGet)}
      <div class="tlist">${(ui.tview === 'k' ? picks.map(k => btnK(k, side)) : players.map(p => btnP(p, side))).join('') || '<p class="small">No players at this position.</p>'}</div>
      ${side === 'get' && allT ? `<p class="small">${tt >= 0 ? `Trading with <b>${esc(tname(L.teams[tt]))}</b>. Picking from another team switches partners.` : 'Every team in the league. Pick a player or pick and that team becomes your partner.'}${ui.tview !== 'k' && theirsAll.length > LIM ? ` Showing the top ${LIM} of ${theirsAll.length}; filter by position to see more.` : ''}</p>` : ''}</div>`;
  };
  const give = pkg(ui.give), get = pkg(ui.get), ready = ui.give.length && ui.get.length;
  let gauge = '';
  if (ready) {
    const v = G.tradeVerdict(L, tt, give, get), ratio = v.give / (v.get * v.ask);
    gauge = `<p class="small ${v.ok ? 'good' : 'bad'}">${v.ok ? (ratio > 1.6 ? 'They would accept. You may be overpaying.' : 'They would likely accept.') : (ratio > 0.8 ? 'Close. Add a little more.' : 'Not close. They want much more back.')}</p>`;
  }
  const chosen = (sel) => sel.length ? `<ul class="chosen">${sel.map(x => x[0] === 'p' ? `<li>${esc(L.players[+x.slice(2)].pos)} ${pLink(L.players[+x.slice(2)])}</li>` : `<li>${esc(G.pickLabel(L, G.pickById(L, +x.slice(2))))} pick</li>`).join('')}</ul>` : '<p class="small">Nothing yet.</p>';
  h += `<section class="card"><h3>Trade</h3>${G.pastDeadline(L) ? '<p class="small bad"><b>The trade deadline has passed.</b> Trading reopens after the season.</p>' : (L.phase === 'regular' ? `<p class="small">Trade deadline: after week ${G.DEADLINE_WEEK}.</p>` : '')}
    <p class="small">Trade players and draft picks for the next three drafts. Picks show their projected overall slot.</p>
    <label class="fld">Find a player on another team<input id="tq" type="search" placeholder="Type a name" value="${esc(ui.tq || '')}" autocomplete="off"></label>
    <div id="tqres">${searchResults()}</div>
    <label class="fld">Trade partner<select id="tradeTeam"><option value="-1"${allT ? ' selected' : ''}>All teams</option>${others.map(t => `<option value="${t.id}"${!allT && t.id === tt ? ' selected' : ''}>${esc(tname(t))} (${rec(t)})</option>`).join('')}</select></label>
    ${ui.tview === 'k' ? '' : sortSeg('tSort', true, 'pos', true)}<div class="trade">${col('give', mine, L.user, 'You send')}${col('get', theirs, tt, 'You receive')}</div>
    <div class="trade summary"><div><div class="eyebrow">Sending</div>${chosen(ui.give)}</div><div><div class="eyebrow">Receiving</div>${chosen(ui.get)}</div></div>
    ${gauge}
    <div class="row"><button class="btn primary" data-act="propose"${ready ? '' : ' disabled'}>Propose trade</button><button class="btn" data-act="clearTrade">Clear</button></div>
    </section>${blockCard()}`;
  return h;
}

/* ---------- Coach ---------- */
const FAM_TXT = { run: 'Run-first', bal: 'Balanced', pass: 'Pass-first', soft: "Bend, don't break", blitz: 'Pressure' };
function schemeCard(side, c, r) {
  const cur = side === 'off' ? c.os : c.ds, list = G.schemesFor(L.year, side), raw = G.ratings(L, L.user, { off: 'bal', def: 'bal' });
  const yrs = x => x.to >= 2026 ? (x.base ? 'Since 1970' : 'Since ' + x.from) : (x.base ? 'Until ' + x.to : x.from + '–' + x.to);
  const rows = list.map(x => {
    const fit = G.schemeFit(raw, G.SCHEME[x.id]), tw = G.trendWord(L, x.id), n = Math.round(G.schemeShare(L, x.id) * L.teams.length), on = x.id === cur;
    const tf = G.teamFit(L, L.user, side === 'off' ? { os: x.id } : { ds: x.id }), yi = tf.yearsIn[side];
    return `<div class="pl wide scheme ${on ? 'on' : ''}"><div class="pl-main"><span class="pos">${({ run: 'RUN', bal: 'BAL', pass: 'PASS', soft: 'BEND', blitz: 'BLTZ' })[x.fam]}</span><div class="pl-name">${esc(x.name)}${on ? ' <span class="good">· running it</span>' : ''}
      <div class="pl-sub">${esc(FAM_TXT[x.fam])} · ${yrs(x)} · ${n} team${n === 1 ? '' : 's'}${tw ? ` · <span class="${tw.c}">${esc(tw.t)}</span>` : ''}</div>
      <div class="pl-sub">${esc(side === 'off' ? G.offPers(G.formation({ os: x.id })) : G.defPers(G.formation({ ds: x.id })))}</div>
      <div class="pl-sub">${esc(x.blurb)}</div>
      <div class="pl-sub">${on ? `Year ${yi} in the system${yi === 1 ? ' (still installing it)' : yi === 2 ? ' (almost installed)' : ''}` : `If you switch: team fit <b>${tf.total.grade}</b>, including a first season of installing it`}</div></div></div>
      <div class="pl-r"><span class="lbl">FIT</span><span class="fit ${fit > 0.4 ? 'good' : fit < -0.4 ? 'bad' : ''}">${fit >= 0 ? '+' : ''}${fit.toFixed(1)}</span></div>
      ${on ? '' : `<div class="pl-btns"><button class="btn sm" data-act="scheme" data-id="${x.id}">Run it</button></div>`}</div>`;
  }).join('');
  const nm = side === 'off' ? 'Offensive scheme' : 'Defensive scheme';
  const help = side === 'off'
    ? 'The schemes of ' + L.year + '. Fit is how much better your current players rate in that system than in a plain one. New schemes catch defenses off guard for a few years; once a third of the league runs one, everyone has a plan for it. Old schemes disappear as the game moves on.'
    : 'Each defense beats some offenses and struggles against others; check the scheme matchup on the Office tab before each game. Fit is how much better your current defenders rate in that system.';
  return `<section class="card"><h3>${nm}</h3><p class="small">${help}</p><div class="list">${rows}</div>${side === 'def' ? '<p class="small">Set a different run/pass lean for one game on the Office tab.</p>' : ''}</section>`;
}
function fitCard() {
  const f = G.teamFit(L, L.user), c = me().coach, st = me().staff || {};
  const pp = v => `<span class="${v > 0.15 ? 'good' : v < -0.15 ? 'bad' : ''}">${v >= 0 ? '+' : ''}${v.toFixed(1)}</span>`;
  const yi = f.yearsIn, cont = f.cont || {}, pct = v => v == null ? 'set at kickoff' : Math.round(v * 100) + '% of starters back';
  const row = (name, part, why) => `<div class="fitrow"><span class="fitg ${part.score >= 77 ? 'good' : part.score < 55 ? 'bad' : ''}">${part.grade}</span><div><b>${name}</b> ${pp(part.pts)} pts<div class="small">${why}</div></div></div>`;
  const persWhy = `${esc(G.SCHEME[c.os].name)} ${pp(f.raw.pers.off)}, ${esc(G.SCHEME[c.ds].name)} ${pp(f.raw.pers.def)}: how well your players suit the formations and the positions each scheme leans on.`;
  const coachWhy = `OC ${st.oc ? (st.oc.pref === c.off ? 'matches' : "doesn't match") + ' your offense' : 'vacant'}, DC ${st.dc ? (st.dc.pref === c.def ? 'matches' : "doesn't match") + ' your defense' : 'vacant'}.`;
  const chemWhy = `Offense: year ${yi.off} in the system, ${pct(cont.off)}. Defense: year ${yi.def}, ${pct(cont.def)}.`;
  return `<section class="card"><div class="split"><h3>Team fit</h3><span class="fitbig ${f.total.score >= 77 ? 'good' : f.total.score < 55 ? 'bad' : ''}">${f.total.grade} <span class="small">(${f.total.score})</span></span></div>
    <p class="small">Worth ${pp(f.pts / 2)} points a game on each side of the ball. A new scheme costs about a point a game in its first season and a little in its second; keeping starters together helps.</p>
    ${row('Personnel', f.personnel, persWhy)}${row('Coaches', f.coaches, coachWhy)}${row('Chemistry', f.chemistry, chemWhy)}</section>`;
}
function vCoach() {
  const c = me().coach, r = G.ratings(L, L.user);
  G.ensureStaff(L);
  const st = me().staff, win = G.coachWindow(L), sb = G.staffBonus(L, L.user);
  const prefTxt = x => x.role === 'oc' ? ({ run: 'Prefers run-first schemes', bal: 'Prefers balanced schemes', pass: 'Prefers pass-first schemes' })[x.pref] : x.role === 'dc' ? ({ soft: "Prefers bend-don't-break schemes", bal: 'Prefers balanced schemes', blitz: 'Prefers pressure schemes' })[x.pref] : 'Game day and player development';
  const match = x => (x.role === 'oc' && x.pref === c.off) || (x.role === 'dc' && x.pref === c.def);
  const staffRows = ['hc', 'oc', 'dc'].map(role => { const x = st[role];
    return x ? `<div class="pl wide"><div class="pl-main"><span class="pos">${role.toUpperCase()}</span><div class="pl-name">${esc(x.name)}${x.interim ? ' <span class="small">(interim)</span>' : ''}<div class="pl-sub">${G.ROLE_NAME[role]}${x.ex ? ` · former ${esc(x.ex.pos)}` : ''} · age ${x.age}${x.rec && x.rec.yrs ? ` · ${x.rec.w}-${x.rec.l}${x.rec.t ? '-' + x.rec.t : ''} in ${x.rec.yrs} season${x.rec.yrs > 1 ? 's' : ''}` : ''}${x.titles ? ` · ${x.titles} title${x.titles > 1 ? 's' : ''}` : ''}${x.delta ? ` · <span class="${x.delta > 0 ? 'good' : 'bad'}">${x.delta > 0 ? '+' : ''}${x.delta} rating last season</span>` : ''} · ${prefTxt(x)}${role !== 'hc' ? (match(x) ? ' · <span class="good">matches your scheme</span>' : ' · <span class="warn">scheme mismatch, half effect</span>') : ''}</div></div><div class="pl-r"><span class="lbl">RTG</span>${rating(x.r)}</div></div>
      ${win ? `<div class="pl-btns">${confirmBtn('fire' + role, 'Fire')}</div>` : ''}</div>`
      : `<div class="pl wide"><div class="pl-main"><span class="pos">${role.toUpperCase()}</span><div class="pl-name"><b class="bad">Vacant</b><div class="pl-sub">${G.ROLE_NAME[role]}. Hire one below before kickoff, or an interim coach takes over.</div></div></div></div>`; }).join('');
  const open = ['hc', 'oc', 'dc'].filter(role => !st[role]);
  const pool = open.length && win ? L.coachPool.filter(x => open.includes(x.role)).sort((a, b) => b.r - a.r).slice(0, 15) : [];
  const poolRows = pool.map(x => { const pr = G.coachAcceptP(L, x, L.user), lk = pr >= 0.75 ? 'Interested' : pr >= 0.4 ? 'Might listen' : 'Unlikely'; const dec = x.decl && x.decl[L.year] === L.user;
    return `<div class="pl wide"><div class="pl-main"><span class="pos">${x.role.toUpperCase()}</span><div class="pl-name">${esc(x.name)}<div class="pl-sub">${x.ex ? `<b>Former ${esc(x.ex.pos)}</b>, ${x.ex.yrs} seasons${x.ex.hof ? ', Hall of Famer' : ''} · ` : ''}Age ${x.age} · ${prefTxt(x)} · <span class="${pr >= 0.75 ? 'good' : pr < 0.4 ? 'bad' : ''}">${dec ? 'Turned you down' : lk}</span></div></div><div class="pl-r"><span class="lbl">RTG</span>${rating(x.r)}</div></div>
      <div class="pl-btns">${dec ? '' : `<button class="btn sm primary" data-act="hire" data-id="${x.id}">Offer the job</button>`}</div></div>`; }).join('');
  const staffCard = `<section class="card"><div class="split"><h3>Coaching staff</h3><span class="small">Offense ${sb.off >= 0 ? '+' : ''}${sb.off.toFixed(1)} · Defense ${sb.def >= 0 ? '+' : ''}${sb.def.toFixed(1)} · Game day ${sb.gd >= 0 ? '+' : ''}${sb.gd.toFixed(1)} pts</span></div>
    <p class="small">Coordinators boost their unit, with full effect only when your scheme matches what they prefer. The head coach adds points on game day and helps young players develop. ${win ? 'You can change your staff until kickoff.' : 'You can change your staff after the season.'}</p>
    <div class="list">${staffRows}</div>${poolRows ? `<h3 class="sub">Available coaches</h3><p class="small">Top coaches prefer winning teams.</p><div class="list">${poolRows}</div>` : ''}</section>`;
  const segc = (key, opts) => `<div class="seg">${opts.map(([v, n]) => `<button class="${c[key] === v ? 'on' : ''}" data-act="coach" data-key="${key}" data-id="${v}">${n}</button>`).join('')}</div>`;
  const bar = (n, v) => `<div class="bar"><span class="bar-l">${n}</span><span class="bar-t"><span class="bar-f ${grade(v)}" style="width:${Math.max(4, Math.min(100, (v - 30) / 0.65))}%"></span></span><span class="bar-v">${Math.round(v)}</span></div>`;
  const SF = G.startersFor(L, L.user), dg = ui.dcGrp || 'QB', chart = G.depthChart(L, L.user, dg), dep = G.depth(L, L.user)[dg].slice(0, SF[dg]).map(p => p.id);
  const custom = !!(me().dc && me().dc[dg]);
  const dcRows = chart.map((p, i) => {
    const out = p.striking || p.holdout || (p.inj && !(p.playHurt && G.canPlayHurt(p))), st = dep.includes(p.id);
    return `<div class="dc ${out ? 'out' : ''}"><span class="dc-n">${i + 1}</span><span class="pos ${st ? 'st' : ''}">${esc(p.pos)}</span>
      <div class="pl-name">${pLink(p)}${p.striking ? '<span class="inj">ON STRIKE</span>' : ''}${p.holdout ? '<span class="inj">HOLDOUT</span>' : ''}${p.repl ? '<span class="inj">REPLACEMENT</span>' : ''}${p.inj ? `<span class="inj">${p.inj >= 20 ? 'OUT season' : (p.playHurt ? 'HURT ' : 'OUT ') + p.inj + 'w'}</span>` : ''}<div class="pl-sub">Age ${p.age}${p.playHurt && p.inj ? ` · plays at ${G.eff(p)}` : ''}</div></div>
      <div class="pl-r"><span class="lbl">OVR</span>${rating(G.eff(p))}</div><div class="pl-r"><span class="lbl">${G.potKnown(L, p) ? 'POT' : 'SCOUT'}</span>${rating(G.shownPot(L, p))}</div>
      ${G.canPlayHurt(p) ? `<button class="btn sm" data-act="hurt" data-id="${p.id}">${p.playHurt ? 'Rest' : 'Play hurt'}</button>` : ''}
      <button class="btn sm ar" data-act="dcMove" data-id="${p.id}" data-key="-1"${i === 0 ? ' disabled' : ''} aria-label="Move up">▲</button><button class="btn sm ar" data-act="dcMove" data-id="${p.id}" data-key="1"${i === chart.length - 1 ? ' disabled' : ''} aria-label="Move down">▼</button></div>`;
  }).join('');
  return fitCard() + staffCard + `<section class="card"><div class="split"><h3>Depth chart</h3><span class="small">${custom ? 'Custom order' : 'Sorted by rating'}</span></div>
      <p class="small"><b>On the field:</b> ${esc(G.offPers(SF))} on offense, ${esc(G.defPers(SF))} on defense. Your schemes decide this; change them below and the depth chart follows.</p>
      <div class="chips">${G.GRPS.map(g => `<button class="chip ${dg === g ? 'on' : ''}" data-act="chip" data-key="dcGrp" data-id="${g}">${g} ${SF[g]}</button>`).join('')}</div>
      <p class="small">${SF[dg] ? `The top ${SF[dg]} healthy player${SF[dg] === 1 ? '' : 's'} start${SF[dg] === 1 ? 's' : ''} (green).` : `Your formation doesn't use a ${dg} as a starter; they play as backups and in packages.`} Injured players are skipped unless you let them play hurt, which costs ${G.HURT_PENALTY} rating points and risks a longer injury.</p>
      <div class="list">${dcRows || '<p>No players at this position.</p>'}</div>
      <div class="row"><button class="btn sm" data-act="dcSort" data-key="ovr" data-id="${dg}">Order by overall</button><button class="btn sm" data-act="dcSort" data-key="pot" data-id="${dg}">Order by potential</button>${custom ? `<button class="btn sm" data-act="dcReset" data-id="${dg}">Auto (best healthy OVR)</button>` : ''}</div>
      <p class="small">Ordering changes who starts. Ordering by potential plays your young players ahead of better veterans.</p></section>
    ${schemeCard('off', c, r)}
    ${schemeCard('def', c, r)}
    <section class="card"><h3>Aggressiveness: ${c.aggr}</h3><input type="range" id="aggr" min="0" max="100" step="5" value="${c.aggr}">
      <p class="small">Higher means more fourth-down tries and deep shots: bigger wins and bigger losses.</p></section>
    <section class="card"><label class="tog"><input type="checkbox" id="youth"${c.youth ? ' checked' : ''}> Develop young starters</label>
      <p class="small">Starters 26 and under who play most of the season get an extra development bump in the offseason.</p></section>
    <section class="card"><h3>Unit ratings</h3>${bar('Offense', r.off)}${bar('Defense', r.def)}${G.GRPS.map(g => bar(g, r[g])).join('')}</section>`;
}

/* ---------- Data ---------- */
function vData() {
  const top = modeSeg();
  const teamsOpt = G.TEAMS_1970.map(t => `<option value="${t[0]}"${ui.impTeam === t[0] ? ' selected' : ''}>${esc(t[2] + ' ' + t[3])} (${t[0]})</option>`).join('');
  let h = top + `<section class="card"><h3>Import from Pro-Football-Reference</h3>
    <p class="small">On the PFR page, open Share &amp; Export → Get table as CSV, copy the text, and paste it here. Rosters only matter when you start a new league. Draft classes can be added any time before that year's draft.</p>
    <div class="seg"><button class="${ui.impKind === 'roster' ? 'on' : ''}" data-act="impKind" data-id="roster">1970 team roster</button><button class="${ui.impKind === 'draft' ? 'on' : ''}" data-act="impKind" data-id="draft">Draft class</button></div>
    ${ui.impKind === 'roster' ? `<label class="fld">Team<select id="impTeam">${teamsOpt}</select></label>` : `<label class="fld">Draft year (add an s for a supplemental draft, like 1984s)<input id="impYear" type="text" inputmode="text" value="${ui.impYear}"></label>`}
    <label class="fld">CSV text<textarea id="impText" rows="5" placeholder="Paste the CSV here"></textarea></label>
    <div class="row"><button class="btn primary" data-act="import">Import</button></div>
    <label class="fld">Or choose files (name them like nor.csv or draft1971.csv)<input id="impFiles" type="file" accept=".csv,.txt,text/csv,text/plain" multiple></label></section>`;
  h += `<section class="card"><h3>1970 rosters imported</h3><div class="grid26">${G.TEAMS_1970.map(t => `<span class="cell ${IM.rosters[t[0]] ? 'ok' : ''}" title="${esc(t[2])}">${esc(t[1])}<small>${IM.rosters[t[0]] ? IM.rosters[t[0]].length : '–'}</small></span>`).join('')}</div>
    <p class="small">Draft classes: ${Object.keys(IM.drafts).sort().map(y => `<b>${y}</b> (${IM.drafts[y].length})`).join(', ') || 'none yet'}</p></section>`;
  if (L) h += `<section class="card"><label class="tog"><input type="checkbox" id="realL"${L.realCareers !== false ? ' checked' : ''}> Real careers</label><p class="small">On: real players rise, peak, fade and retire the way their real careers did. Off: random development and retirement. Takes effect at the next offseason.</p></section>`;
  h += `<section class="card"><h3>Real rosters</h3><p class="small">${G.hasReal() ? `Loaded: every NFL roster from 1970 to 2026. Used for leagues that start after 1970, for when real careers end, and for undrafted players.` : `Not loaded yet. Put <b>rosters.json</b> next to index.html on your site.`} Roster data: <b>nflverse</b> (github.com/nflverse, CC-BY 4.0). Ratings data: Pro-Football-Reference draft classes.</p></section>`;
  if (L) h += `<section class="card"><h3>Difficulty</h3><div class="seg">${Object.keys(G.DIFF).map(k => `<button class="${(L.diff || 'pro') === k ? 'on' : ''}" data-act="setDiff" data-id="${k}">${G.DIFF[k].name}</button>`).join('')}</div><p class="small">${diffBlurb(L.diff || 'pro')} You can change this any time.</p></section>`;
  const nR = Object.keys(IM.rosters).length, nD = Object.keys(IM.drafts).length;
  h += `<section class="card"><h3>Share your data with a friend</h3>
    <p class="small">Your imported rosters and draft classes live only on this device. Make a data pack and send it to a friend (AirDrop, Messages, email). They open the game, tap <b>Load data pack</b>, and pick the file. It contains only the imported tables, not your league.</p>
    <p class="small">This device has <b>${nR}</b> of 26 rosters and <b>${nD}</b> draft class${nD === 1 ? '' : 'es'}${nD ? ` (${Object.keys(IM.drafts).sort()[0]}–${Object.keys(IM.drafts).sort().slice(-1)[0]})` : ''}.</p>
    <div class="row"><button class="btn primary" data-act="exportData"${nR || nD ? '' : ' disabled'}>Make data pack</button><label class="btn filebtn">Load data pack<input id="loadData" type="file" accept=".json,application/json"></label></div></section>`;
  h += `<p class="small ver">Gridiron GM version ${APP_VERSION}${SAVE.ok ? ` · Last saved ${new Date(SAVE.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} (${SAVE.mode})` : SAVE.ok === false ? ' · <b>Saving is failing</b>' : ''}</p>`;
  h += `<section class="card"><h3>Save file</h3><p class="small">Your ${SLOT === 'career' ? 'career' : 'league'} saves on this device automatically, separately from your ${SLOT === 'career' ? 'GM league' : 'player career'}. Switching between General manager and Player career keeps both. Back it up before clearing Safari data or switching devices.</p>
    <div class="row"><button class="btn" data-act="exportSave"${L ? '' : ' disabled'}>Download backup</button><label class="btn filebtn">Restore backup<input id="loadSave" type="file" accept=".json,application/json"></label></div>
    ${L ? `<div class="row">${confirmBtn('reset', SLOT === 'career' ? 'Delete this career' : 'Delete this league', 'danger')}</div>` : ''}</section>`;
  return h;
}

/* ---------- player career mode ---------- */
const isC = () => !!(L && L.career);
function toTop() { const m = document.getElementById('main'); if (m) m.scrollTop = 0; try { window.scrollTo(0, 0); } catch (e) { /* ignore */ } }
// iOS can leave the page shifted after the keyboard closes; snap it back
document.addEventListener('focusout', () => setTimeout(() => { try { window.scrollTo(0, 0); } catch (e) { /* ignore */ } }, 50));
const CP = () => G.careerP(L);
const CTABS = [['home', 'Career'], ['games', 'Games'], ['team', 'Team'], ['stats', 'Stats'], ['league', 'League'], ['data', 'Data']];
function modeSeg() {
  return `<div class="seg modeseg"><button class="${SLOT === 'league' ? 'on' : ''}" data-act="slot" data-id="league">General manager</button><button class="${SLOT === 'career' ? 'on' : ''}" data-act="slot" data-id="career">Player career</button></div>`;
}
function cStatus(p) {
  if (!p) return 'Draft prospect';
  if (p.retiredYear != null) return `Retired (${p.retiredYear})`;
  if (p.team === -3) return `${L.draft ? L.draft.year : ''} draft prospect`;
  if (p.team === -1) return 'Free agent';
  return tname(L.teams[p.team]);
}
const HT = []; for (let i = 66; i <= 81; i++) HT.push(`${Math.floor(i / 12)}'${i % 12}"`);
const DEF_WT = { QB: 220, RB: 215, WR: 200, TE: 250, OL: 310, DL: 285, LB: 240, DB: 195, K: 190, P: 205 };
const DEF_HT = { QB: 9, RB: 4, WR: 7, TE: 10, OL: 11, DL: 10, LB: 8, DB: 5, K: 6, P: 8 };

function vCareerSetup() {
  const Y = ui.cYear || 2005, years = []; for (let y = G.START_FIRST + 1; y <= G.START_LAST + 1; y++) years.push(y);
  return modeSeg() + `<section class="card hero"><div class="eyebrow">Player career</div><h2>Start your career</h2>
    <p>You are one player. Every team, yours included, is run by the computer. Pick your draft year: the season before it plays out (a few seconds), then the draft opens with you in it. You can create a player or become a real prospect from that year's class.</p>
    <label class="fld">Draft year<select id="cYear">${years.map(y => `<option value="${y}"${y === Y ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
    <label class="tog"><input type="checkbox" id="realNew"${ui.realCareers !== false ? ' checked' : ''}> Real careers for everyone else</label>
    <p class="small">Your GM league is kept separately. Switch back any time with the buttons at the top.</p>
    <div class="row"><button class="btn primary" data-act="cBuild">${ui.cBusy ? 'Building the league…' : `Enter the ${Y} draft`}</button></div></section>`;
}
function cPreviewCard(v) {
  return `<section class="card" id="cprev"><h3>Scouting report</h3>
    <div class="stats4"><div><b>${v.ovr}</b><span>Overall now</span></div><div><b>${v.pot}</b><span>Ceiling</span></div><div><b>${v.stock}</b><span>Draft grade</span></div><div><b>${v.age}</b><span>Age</span></div></div>
    <p class="small">Projected: <b>${esc(v.round)}</b> · Work ethic: <b>${esc(v.devTxt)}</b> · Durability: <b>${esc(v.durTxt)}</b>${v.ego > 0 ? ' · Wants top dollar' : v.ego < 0 ? ' · Team-friendly asks' : ''}${v.ring ? ' · Chasing a ring' : ''}${v.loyal > 0 ? ' · Loyal' : ''}</p>
    <p class="small">These are before the dice: the real numbers can land a point either way. Teams draft on the grade they see, and a team that works you out sees your real ceiling.</p></section>`;
}
function vCareerCreate() {
  const c = ui.cNew = ui.cNew || { grp: 'WR', tier: 'day2', ans: CAREER_DEFAULT_ANS(), name: '', college: '', home: '', ht: null, wt: null, num: '' };
  const v = G.careerPreview(c.tier, c.ans), D = L.draft;
  const posOpts = G.CAREER_POS[c.grp];
  let h = `<section class="card hero"><div class="eyebrow">${D.year} draft</div><h2>Who are you?</h2>
    <div class="seg"><button class="${ui.cWay !== 'real' ? 'on' : ''}" data-act="cWay" data-id="new">Create a player</button><button class="${ui.cWay === 'real' ? 'on' : ''}" data-act="cWay" data-id="real">Be a real prospect</button></div></section>`;
  if (ui.cWay === 'real') return h + vCareerRealPick();
  h += `<section class="card"><h3>The basics</h3>
    <label class="fld">Name<input id="cName" type="text" maxlength="40" value="${esc(c.name)}" placeholder="Your name"></label>
    <div class="grid2"><label class="fld">Position group<select id="cGrp">${G.CAREER_GRPS.map(g => `<option${g === c.grp ? ' selected' : ''}>${g}</option>`).join('')}</select></label>
    <label class="fld">Position<select id="cPos">${posOpts.map(x => `<option${x === c.pos ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
    <label class="fld">Height<select id="cHt">${HT.map((x, i) => `<option value="${x}"${(c.ht || HT[DEF_HT[c.grp]]) === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
    <label class="fld">Weight (lb)<input id="cWt" type="number" inputmode="numeric" min="150" max="380" value="${c.wt || DEF_WT[c.grp]}"></label>
    <label class="fld">College<input id="cCol" type="text" list="cColList" maxlength="40" value="${esc(c.college)}" placeholder="Your college (or leave blank)"></label>
    <label class="fld">Hometown<input id="cHome" type="text" maxlength="40" value="${esc(c.home)}" placeholder="Missouri City, TX"></label>
    <label class="fld">Jersey number<input id="cNum" type="number" inputmode="numeric" min="0" max="99" value="${esc(c.num)}" placeholder="Any"></label></div>
    <datalist id="cColList">${G.COLLEGES.map(x => `<option value="${esc(x)}">`).join('')}</datalist></section>`;
  h += `<section class="card"><h3>1. Where do the scouts have you?</h3><p class="small">This is the difficulty: it sets your talent and how teams see you.</p>
    <div class="qopts">${G.CAREER_TIERS.map(t => `<button class="qopt ${c.tier === t.id ? 'on' : ''}" data-act="cTier" data-id="${t.id}">${esc(t.txt)}</button>`).join('')}</div></section>`;
  G.CAREER_Q.forEach((q, i) => {
    h += `<section class="card"><h3>${i + 2}. ${esc(q.q)}</h3><div class="qopts">${q.a.map((a, j) => `<button class="qopt ${c.ans[i] === j ? 'on' : ''}" data-act="cAns" data-id="${i}:${j}">${esc(a[0])}</button>`).join('')}</div></section>`;
  });
  h += cPreviewCard(v);
  h += `<div class="row"><button class="btn primary" data-act="cCreate">Declare for the ${D.year} draft</button></div>`;
  return h;
}
function CAREER_DEFAULT_ANS() { return G.CAREER_Q.map(() => 0); }
function vCareerRealPick() {
  const g = ui.cRealGrp || 'ALL', list = G.careerClass(L).filter(p => p.realPick && (g === 'ALL' || p.grp === g)).sort((a, b) => a.realPick.pick - b.realPick.pick).slice(0, ui.cRealShow || 80);
  return `<section class="card"><h3>The real ${L.draft.year} class</h3><p class="small">Real players keep their real talent: with Real careers on, your ratings follow the career he really had, but you decide where he signs, how he trains and when he retires. Teams won't necessarily draft him where he really went.</p>
    <div class="chips">${['ALL'].concat(G.CAREER_GRPS).map(x => `<button class="chip ${g === x ? 'on' : ''}" data-act="cRealGrp" data-id="${x}">${x}</button>`).join('')}</div>
    <div class="tscroll"><table class="tbl"><thead><tr><th class="l">Real pick</th><th class="l">Player</th><th>Pos</th><th class="l">College</th><th></th></tr></thead><tbody>
    ${list.map(p => `<tr><td class="l">#${p.realPick.pick}${p.realPick.tm ? ' ' + esc(p.realPick.tm) : ''}</td><td class="l">${esc(p.name)}</td><td>${esc(p.pos)}</td><td class="l small">${esc(p.college || '')}</td><td><button class="btn sm primary" data-act="cReal" data-id="${p.id}">Be him</button></td></tr>`).join('')}</tbody></table></div>
    ${list.length >= (ui.cRealShow || 80) ? `<div class="row"><button class="btn" data-act="cRealMore">Show more</button></div>` : ''}</section>`;
}

function cAlerts() {
  const A = L.career.alerts || []; if (!A.length) return '';
  return A.map(a => `<div class="calert ${a.kind}"><span>${esc(a.txt)}</span><button class="x" data-act="cDismiss" data-id="${a.id}" aria-label="Dismiss">✕</button></div>`).join('');
}
function trustBar(v) { return `<div class="tbar"><i style="width:${v}%"></i></div>`; }
// "$9.4M a year · 3 years left (thru 2010)", counting this season while it's being played
function cConLine(p, y) {
  if (!p.con) return 'No contract';
  if (G.salFor(p, y) == null) return 'Pick a new deal';
  const exp = p.con.ext ? p.con.ext.exp : p.con.exp, inSeason = L.phase === 'preseason' || L.phase === 'regular' || L.phase === 'playoffs';
  const left = exp - (inSeason ? L.year : L.year + 1) + 1;
  return left <= 1 ? `${inSeason ? 'Contract year' : 'Last year'} (thru ${exp})` : `${left} years left (thru ${exp})`;
}
function cHeader(p) {
  const r = G.careerRole(L, p), C = L.career, y = G.capYear(L), sal = p.con ? G.salFor(p, y) : null;
  const pot = Math.max(p.pot, p.ovr);
  return `<section class="card hero"><div class="eyebrow">${esc(p.pos)}${p.num != null && p.team >= 0 ? ' · #' + p.num : ''} · Age ${p.age}${p.yrs ? ' · Year ' + (p.yrs + 1) : ' · Rookie'}</div>
    <h2>${pLink(p)}</h2><p>${p.team >= 0 ? tLink(p.team) : esc(cStatus(p))}${r ? ' · ' + esc(r.label) : ''}</p>
    <div class="stats4"><div>${rating(p.ovr)}<span>Overall</span></div><div>${rating(pot)}<span>Ceiling</span></div><div><b>${sal != null ? G.money(sal) + '/yr' : p.con ? 'Expired' : '–'}</b><span>${cConLine(p, y)}</span></div><div><b>${C.fo == null ? 50 : C.fo}</b><span>Front office</span></div></div>
    <p class="small">Career earnings: <b>${G.money(G.careerEarnings(L))}</b></p>
    ${p.inj ? `<p class="small bad">Injured: out ${p.inj >= 20 ? 'for the season' : p.inj + ' week' + (p.inj > 1 ? 's' : '')}.</p>` : ''}${p.holdout ? '<p class="small warn">You are holding out.</p>' : ''}</section>`;
}
function cGameLine(l) {
  const s = [];
  if (l.att) s.push(`${l.cmp || 0}/${l.att}, ${l.py || 0} yds, ${l.ptd || 0} TD${l.int ? ', ' + l.int + ' INT' : ''}`);
  if (l.ra || l.ry) s.push(`${l.ra || 0} car, ${l.ry || 0} yds${l.rtd ? ', ' + l.rtd + ' TD' : ''}`);
  if (l.rec || l.recy) s.push(`${l.rec || 0} rec, ${l.recy || 0} yds${l.rectd ? ', ' + l.rectd + ' TD' : ''}`);
  if (l.sk) s.push(`${l.sk} sack${l.sk > 1 ? 's' : ''}`);
  if (l.dint) s.push(`${l.dint} INT`);
  if (l.fgm) s.push(`${l.fgm} FG`);
  return s.join(' · ') || (l.g ? 'Played' : '');
}
function cGameRow(g) {
  const i = L.career.games.indexOf(g), bx = g.gm && g.gm.box ? ` <button class="btn sm" data-act="box" data-id="c:${i}">Box</button>` : '';
  if (g.bye) return `<tr><td class="l">${g.y} W${g.wk}</td><td class="l" colspan="3">Bye</td></tr>`;
  return `<tr><td class="l">${g.y} ${typeof g.wk === 'number' ? 'W' + g.wk : esc(g.wk)}</td><td class="l">${g.home ? 'vs' : 'at'} ${esc(L.teams[g.opp].abbr)}</td><td class="${g.res === 'W' ? 'good' : g.res === 'L' ? 'bad' : ''}">${g.res} ${g.my}-${g.op}</td><td class="l small">${g.po ? 'Playoffs' + (cGameLine(g.line || {}) ? ' · ' + esc(cGameLine(g.line)) : '') : esc(g.why || cGameLine(g.line))}${g.wx ? ` <span class="muted">· ${esc(G.wxText(g.wx))}</span>` : ''}</td><td>${bx}</td></tr>`;
}
function cPhaseCard(p) {
  const C = L.career, ph = L.phase;
  if (p.retiredYear != null) return cRetiredCard(p);
  if (ph === 'draft') {
    if (p.team === -3) return `<section class="card hero"><div class="eyebrow">${L.draft.year} draft</div><h2>Draft day</h2>
      <p>Scouts grade you <b>${p.scout}</b>${p.realPick ? ` (in real life: pick #${p.realPick.pick})` : ''}. Teams draft on what they see; a team that worked you out sees your real ceiling.</p>
      <div class="row"><button class="btn primary" data-act="cNext">Start the draft</button></div></section>`;
    return `<section class="card hero"><div class="eyebrow">${L.draft.year} draft</div><h2>${p.team >= 0 ? `Welcome to ${esc(L.teams[p.team].city)}` : 'The draft goes on'}</h2>
      <div class="row"><button class="btn primary" data-act="cNext" data-id="finish">Finish the draft</button></div></section>`;
  }
  if (ph === 'offseason') {
    const offers = G.careerOffers(L);
    return `<section class="card hero"><div class="eyebrow">${L.year + 1} offseason</div><h2>${offers.length ? 'Decide where you play' : 'Summer'}</h2>
      <p>${offers.length ? 'Your agent has offers below. If you go to camp without choosing, he takes the biggest deal.' : p.team >= 0 ? 'Pick your summer training below, then head to camp. Your growth or decline for your age happens there.' : 'No offers yet. Head to camp and hope for a call, or retire.'}</p>
      ${offers.length ? '' : `<div class="row"><button class="btn primary" data-act="cNext">Go to ${L.year + 1} training camp</button></div>`}</section>` + (offers.length ? cOffersCard(offers) + `<section class="card"><p class="small">Not ready to choose? Your agent will sign the biggest offer (${esc(L.teams[offers.slice().sort((a, b) => b.sal - a.sal)[0].tid].abbr)}).</p><div class="row">${confirmBtn('cCamp', `Skip it and go to ${L.year + 1} camp`)}</div></section>` : '');
  }
  if (ph === 'preseason') {
    const lc = C.lastCamp && C.lastCamp.y === L.year ? C.lastCamp : null;
    return `<section class="card hero"><div class="eyebrow">${L.year} training camp</div><h2>${p.team >= 0 ? 'Camp is open' : 'Unsigned in camp season'}</h2>
      ${lc ? `<p>Your summer (${esc(G.CAREER_FOCUS[lc.focus].name.toLowerCase())}, ${esc(G.CAREER_PLANS[lc.plan].name.toLowerCase())}): age ${lc.base >= 0 ? '+' : ''}${lc.base}, training ${lc.bonus >= 0 ? '+' : ''}${lc.bonus}. You're now <b>${p.ovr}</b> overall.</p>` : ''}
      <p class="small">Teams make their final cuts when the season starts.</p>
      <div class="row"><button class="btn primary" data-act="cNext">Kick off the ${L.year} season</button></div></section>` + (p.team === -1 ? cOffersCard(G.careerOffers(L)) : '');
  }
  if (ph === 'regular') {
    const tid = p.team, g = tid >= 0 && L.schedule[L.week] ? L.schedule[L.week].find(x => x.h === tid || x.a === tid) : null;
    const o = g ? L.teams[g.h === tid ? g.a : g.h] : null;
    return `<section class="card hero"><div class="eyebrow">${L.year} · Week ${L.week + 1}</div><h2>${tid < 0 ? 'Free agent' : o ? `${g.h === tid ? 'vs' : 'at'} ${esc(o.city)} ${esc(o.name)}` : 'Bye week'}</h2>
      ${tid >= 0 ? `<p>${esc(L.teams[tid].abbr)} ${rec(L.teams[tid])}${o ? ` · ${esc(o.abbr)} ${rec(o)}` : ''}</p>` : ''}${o ? `<p class="small">${esc(G.stadium(L, g.h).name)} · ${esc(G.wxText(G.forecast(L, g)))}</p>` : ''}
      <div class="row"><button class="btn primary" data-act="cNext">${o ? 'Play the game' : 'Sim the week'}</button><button class="btn" data-act="cNext" data-id="season">Sim to the playoffs</button></div></section>`
      + (p.team === -1 ? cOffersCard(G.careerOffers(L)) : '');
  }
  if (ph === 'playoffs') {
    const P = L.playoffs, alive = P.alive.AFC.concat(P.alive.NFC), mine = p.team >= 0 && alive.includes(p.team);
    return `<section class="card hero"><div class="eyebrow">${esc(G.roundName(L))}</div><h2>${mine ? 'Still alive' : 'Watching from home'}</h2>
      <div class="row"><button class="btn primary" data-act="cNext">Play the ${esc(G.roundName(L))}</button><button class="btn" data-act="cNext" data-id="season">Sim the rest</button></div></section>`;
  }
  if (ph === 'season-over') {
    const c = L.champs[0], h = p.hist[L.year];
    return `<section class="card hero"><div class="eyebrow">Super Bowl ${G.roman(c.sb)}</div><h2>${esc(tname(L.teams[c.champ]))} win it all</h2>
      <p>Your ${L.year}: ${h ? esc(statLine(p)) : 'no games played'}.</p>${p.con && p.team >= 0 && p.con.exp <= L.year && !(p.con.ext) ? '<p><b>Your contract is up.</b> After the draft your agent brings you offers to choose from.</p>' : ''}
      <div class="row"><button class="btn primary" data-act="cNext">On to the draft and the offseason</button></div></section>`;
  }
  return '';
}
function cOffersCard(list) {
  if (!list || !list.length) return '';
  return `<section class="card"><h3>Contract offers</h3><div class="tscroll"><table class="tbl"><thead><tr><th class="l">Team</th><th>Per year</th><th>Yrs</th><th class="l">Role</th><th>Fit</th><th class="l">Last year</th><th></th></tr></thead><tbody>
    ${list.map((o, i) => `<tr><td class="l">${tLink(o.tid, esc(L.teams[o.tid].abbr))}${o.own ? ' <span class="small">(yours)</span>' : ''}</td><td><b>${G.money(o.sal)}</b></td><td>${o.yrs}</td><td class="l">${esc(o.role)}</td><td>${esc(o.fit || '')}</td><td class="l small">${esc(o.wins)}${o.res ? ' · ' + esc(o.res) : ''}</td>
      <td class="l"><button class="btn sm primary" data-act="cSign" data-id="${i}">Sign</button>${o.h ? '' : ` <button class="btn sm" data-act="cHaggle" data-id="${i}">Ask for more</button>`}${o.own && !o.disc ? ` <button class="btn sm" data-act="cDisc" data-id="${i}">Hometown discount</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
    <p class="small">Asking for more works about half the time; a team that says no may pull its offer. A hometown discount (12% less, one more year) builds your coach's trust.</p></section>`;
}
function cSchemeCard(p) {
  const S = G.careerScheme(L); if (!S) return '';
  const f = S.fit, side = S.mine === 'off' ? 'offense' : 'defense';
  return `<section class="card"><h3>Your team's schemes</h3>
    <p>Offense: <b>${esc(S.osName)}</b>${S.mine === 'off' ? ' (your side)' : ''} · Defense: <b>${esc(S.dsName)}</b>${S.mine === 'def' ? ' (your side)' : ''}</p>
    <p>Your fit in this ${side}: <b>${esc(f.grade)}</b> (${f.score})</p>
    <ul class="small whylist">${f.why.map(([s, t]) => `<li class="${s === '+' ? 'good' : s === '-' ? 'bad' : ''}">${s === '+' ? '+' : s === '-' ? '−' : '·'} ${esc(t)}</li>`).join('')}</ul>
    <p class="small">Teams change schemes with new coaches or when the game changes. You'll get an alert, with what it means for you.</p></section>`;
}
function cOrgCard(p) {
  const S = G.careerStanding(L); if (!S) return '';
  const C = L.career, r = G.careerRole(L, p), bar = (lab, v, txt, why) => `<div class="orgrow"><span class="orglab">${lab}</span><div class="tbar"><i style="width:${v}%"></i></div><b>${v}</b></div><p class="small"><b>${esc(txt)}.</b> ${why}</p>`;
  const out = [];
  out.push(bar('Coach trust', S.trust, `${S.coach}: ${S.trustTxt}`, 'Decides your playing time and whether he gives you a starting job. Grows when you win, play well, meet your goals and accept your role; drops when you make demands, hold out or ask out.'));
  out.push(bar('Front office', S.fo, S.foTxt, 'How the general manager sees you: production for your pay, honors and goals add to it; holdouts, trade requests and turned-down raises cost you. It decides whether they re-sign you, give you a raise, or shop you (below 20, expect trade rumors).'));
  const btns = [];
  if (r && !r.starter && L.phase !== 'draft') btns.push(`<button class="btn" data-act="cStart"${S.accepted ? ' disabled' : ''}>Ask to start</button>`);
  if (!S.accepted) btns.push(`<button class="btn" data-act="cAccept">Accept any role</button>`);
  if (btns.length) out.push(`<div class="row">${btns.join('')}${r && r.ahead && !r.starter ? `<span class="small">Ahead of you: ${esc(r.ahead.name)} (${r.ahead.ovr})</span>` : ''}</div>`);
  if (C.treq) out.push(`<div class="row"><span>Trade request in (${esc(({ contender: 'to a contender', start: 'where you\'d start', scheme: 'to a scheme that fits you', any: 'anywhere' })[C.treq.kind])}).</span><button class="btn sm" data-act="cTradeNo">Take it back</button></div>`);
  else if (G.canTradeNow(L)) out.push(`<details class="trq"><summary>Ask for a trade</summary><div class="row"><button class="btn sm" data-act="cTrade" data-id="contender">To a contender</button><button class="btn sm" data-act="cTrade" data-id="start">Where I'd start</button><button class="btn sm" data-act="cTrade" data-id="scheme">A scheme that fits me</button><button class="btn sm" data-act="cTrade" data-id="any">Anywhere</button></div><p class="small">Coach trust drops 15 and the front office 10. After two weeks your team brings back deals.</p></details>`);
  return `<section class="card"><h3>Coach and front office</h3>${out.join('')}</section>`;
}
function cMovesCard(p) {
  if (p.retiredYear != null) return '';
  const C = L.career, out = [];
  if (C.deals && C.deals.list.length) out.push(`<p><b>Trade offers for you:</b></p><div class="tscroll"><table class="tbl"><tbody>${C.deals.list.map((d, i) => { const t = L.teams[d.tid], l = t.hist[t.hist.length - 1]; return `<tr><td class="l">${tLink(d.tid)}</td><td class="l small">${l ? `${l.w}-${l.l} · ${esc(l.res)}` : ''}${(() => { const S = G.careerScheme(L, d.tid); return S ? ` · ${esc(S.mine === 'off' ? S.osName : S.dsName)}, fit ${esc(S.fit.grade)}` : ''; })()}</td><td><button class="btn sm primary" data-act="cDeal" data-id="${i}">Go there</button></td></tr>`; }).join('')}</tbody></table></div><div class="row"><button class="btn sm" data-act="cDealNo">Turn them all down</button></div>`);
  if (p.team >= 0) {
    const r = G.careerRole(L, p);
    if (false) out.push(`<div class="row"><button class="btn" data-act="cStart">Ask to start</button><span class="small">${r.ahead ? `Ahead of you: ${esc(r.ahead.name)} (${r.ahead.ovr})` : ''}</span></div>`);
    const I = G.careerRaiseInfo(L);
    if (I) {
      if (p.holdout) out.push(`<div class="row"><button class="btn" data-act="cHold" data-id="off">End the holdout and report</button></div>`);
      else if (I.asked && I.under && !I.rookie && (L.phase === 'preseason' || L.phase === 'regular')) out.push(`<div class="row"><button class="btn danger" data-act="cHold" data-id="on">Hold out</button><span class="small">You'll miss games until they give in or you report. Costs trust.</span></div>`);
      else out.push(`<div class="row"><button class="btn" data-act="cRaise"${I.asked || I.rookie || !I.under ? ' disabled' : ''}>Ask for a raise</button><span class="small">You make ${I.pct}% of your market value.${I.rookie ? ' Rookie-scale deal.' : I.asked ? ' Already asked this year.' : !I.under ? ' That\'s fair pay.' : ''}</span></div>`);
    }
  }
  if (L.phase === 'offseason' || L.phase === 'preseason') {
    const sw = G.careerSwitchOpts(L);
    if (sw.length) out.push(`<p class="small"><b>Change positions:</b> a new spot costs some overall (none within your position group), but can put you on the field.</p><div class="tscroll"><table class="tbl"><tbody>${sw.map((o, i) => `<tr><td class="l">${esc(o.pos)}</td><td>${o.cost ? '−' + o.cost : 'Free'}</td><td>${o.ovr} OVR</td><td class="l small">${o.rank != null ? (o.starter ? 'Would start' : `#${o.rank} on the depth chart`) : ''}</td><td><button class="btn sm" data-act="cSwitch" data-id="${i}">Switch</button></td></tr>`).join('')}</tbody></table></div>`);
  }
  if (G.careerCanRetire(L)) out.push(`<div class="row">${confirmBtn('cRetire', 'Retire', 'danger')}</div>`);
  return out.length ? `<section class="card"><h3>Your moves</h3>${out.join('')}</section>` : '';
}
function cTrainCard(p) {
  if (p.retiredYear != null) return '';
  const C = L.career;
  return `<section class="card"><h3>Training</h3>
    <p class="small">Your focus turns into growth at training camp. Every game you play counts toward it. Matching your position works best.</p>
    <div class="chips">${Object.keys(G.CAREER_FOCUS).map(k => `<button class="chip ${C.focus === k ? 'on' : ''}" data-act="cFocus" data-id="${k}">${esc(G.CAREER_FOCUS[k].name)}${G.CAREER_FOCUS[k].g.includes(p.grp) ? ' ★' : ''}</button>`).join('')}</div>
    <p class="small">${esc(G.CAREER_FOCUS[C.focus].txt)}</p>
    <div class="seg">${Object.keys(G.CAREER_PLANS).map(k => `<button class="${C.plan === k ? 'on' : ''}" data-act="cPlan" data-id="${k}">${esc(G.CAREER_PLANS[k].name)}</button>`).join('')}</div>
    <p class="small">Extra work grows you faster and raises your injury risk; light work is the reverse.</p></section>`;
}
function cScheduleCard(p) {
  if (p.retiredYear != null || p.team < 0 || !L.schedule || !L.schedule.length || !(L.phase === 'regular' || L.phase === 'playoffs' || L.phase === 'season-over')) return '';
  const tid = p.team, C = L.career;
  const rows = L.schedule.map((wk, i) => {
    const g = wk.find(x => x.h === tid || x.a === tid), cur = L.phase === 'regular' && i === L.week;
    if (!g) return `<tr class="${cur ? 'nextwk' : ''}"><td class="l">${i + 1}</td><td class="l muted" colspan="3">Bye</td></tr>`;
    const home = g.h === tid, o = L.teams[home ? g.a : g.h];
    let res = '', you = '';
    if (g.done) {
      const my = home ? g.hs : g.as, op = home ? g.as : g.hs, mine = C.games.find(x => x.y === L.year && x.wk === i + 1 && !x.po);
      res = `<span class="${my > op ? 'good' : my < op ? 'bad' : ''}">${my > op ? 'W' : my < op ? 'L' : 'T'} ${my}-${op}</span>`;
      you = mine ? esc(mine.why || cGameLine(mine.line)) : '';
    } else res = cur ? '<b>Next</b>' : '';
    return `<tr class="${cur ? 'nextwk' : ''}"><td class="l">${i + 1}</td><td class="l">${home ? 'vs' : 'at'} ${tLink(o.id, esc(o.abbr))} <span class="small muted">${rec(o)}</span></td><td>${res}</td><td class="l small">${you}</td></tr>`;
  }).join('');
  return `<section class="card"><h3>${L.year} schedule</h3><div class="tscroll"><table class="tbl"><thead><tr><th class="l">Wk</th><th class="l">Opponent</th><th>Result</th><th class="l">You</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
function cSeasonCard(p) {
  if (p.retiredYear != null || !(L.phase === 'regular' || L.phase === 'playoffs' || L.phase === 'season-over')) return '';
  const C = L.career, last = C.games.find(g => g.y === L.year && !g.bye), goals = G.careerGoalStatus(L), race = G.careerAwardRace(L);
  let h = `<section class="card"><h3>${L.year} season</h3><p>${esc(statLine(p) || 'No stats yet.')}</p>`;
  if (last && last.gm && last.gm.box) h += `<div class="row"><button class="btn sm" data-act="box" data-id="c:${L.career.games.indexOf(last)}">Last game's box score</button></div>`;
  if (last) h += `<p class="small">Last game: ${typeof last.wk === 'number' ? 'Week ' + last.wk : esc(last.wk)}, ${last.res} ${last.my}-${last.op} ${last.home ? 'vs' : 'at'} ${esc(L.teams[last.opp].abbr)}. ${esc(last.po ? '' : last.why || cGameLine(last.line))}</p>`;
  if (goals.length) h += `<p class="small"><b>Season goals:</b> ${goals.map(g => `<span class="${g.met ? 'good' : ''}">${g.met ? '✓' : '○'} ${esc(g.txt)}</span>`).join(' · ')}</p>`;
  if (race) h += `<p class="small"><b>If the season ended today:</b> ${race.map(r => `${esc(r.k)} #${r.r}`).join(' · ')}</p>`;
  return h + '</section>';
}
function cLegacyCard(p) {
  const Lg = G.careerLegacy(L), ranks = G.careerRanks(L), aw = (p.awards || []).slice().sort((a, b) => a.y - b.y);
  const cnt = {}; aw.forEach(a => cnt[a.a] = (cnt[a.a] || 0) + 1);
  let h = `<section class="card"><h3>Legacy</h3>`;
  h += `<p>${Object.keys(cnt).length ? Object.entries(cnt).map(([k, n]) => `<b>${n}×</b> ${esc(G.AWARD_NAMES[k])}`).join(' · ') : 'No awards yet.'}${Lg.rings.length ? ` · <b>${Lg.rings.length}×</b> Super Bowl champion (${Lg.rings.sort().join(', ')})` : ''}</p>`;
  h += `<div class="tscroll"><table class="tbl"><thead><tr><th class="l">Career</th><th>Total</th><th>All-time rank (${esc(p.grp)})</th><th class="l">Leader</th></tr></thead><tbody>${ranks.map(r => `<tr><td class="l">${esc(r.label)}</td><td>${num(r.v)}</td><td>#${r.rank} of ${r.of}</td><td class="l small">${r.top[0] ? `${esc(r.top[0].name)} (${num(r.top[0].v)})` : ''}</td></tr>`).join('')}</tbody></table></div>
    <p class="small">Ranked against everyone who has played in this league since it started in ${L.career.y0 - 1}.</p>`;
  if (Lg.pct != null) h += `<p><b>Hall of Fame meter:</b> ${Lg.pct}% of the bar at your position.</p><div class="tbar"><i style="width:${Math.min(100, Lg.pct)}%"></i></div>`;
  if (p.hof > 0) h += `<p class="good"><b>Inducted into the Hall of Fame, class of ${p.hof}.</b></p>`;
  if (Lg.jerseys.length) h += `<p>Jersey retired: ${Lg.jerseys.map(j => `${esc(L.teams[j.tid].abbr)}${j.num ? ' #' + j.num : ''}`).join(', ')}.</p>`;
  return h + '</section>';
}
function cRetiredCard(p) {
  const V = L.career.verdict || {}, Lg = G.careerLegacy(L);
  return `<section class="card hero"><div class="eyebrow">Retired after ${(() => { const n = Object.keys(p.hist || {}).length; return n + ' season' + (n === 1 ? '' : 's'); })()}</div><h2>${p.hof > 0 ? `Hall of Famer, class of ${p.hof}` : V.hof ? 'The verdict: a Hall of Famer' : 'The verdict: Hall of Very Good'}</h2>
    <p>${V.pct != null ? `Voters, as of four years from now, put you at <b>${V.pct}%</b> of the Hall of Fame bar at your position.` : ''} ${Lg.jerseys.length ? `Your number is retired by ${Lg.jerseys.map(j => esc(L.teams[j.tid].city)).join(' and ')}.` : 'No team has retired your number.'}</p>
    <p class="small">The league plays on. Sim ahead to watch the real vote (eligible ${p.retiredYear + 4}).</p>
    <div class="row"><button class="btn primary" data-act="cYear" data-id="1">Sim a year</button><button class="btn" data-act="cYear" data-id="5">Sim 5 years</button></div></section>` + cAfterCard(p);
}
function cAfterCard(p) {
  const C = L.career, co = G.careerCoachOpts(L), now = G.careerCoachNow(L), fo = G.careerFrontOfficeOpts(L);
  let h = '';
  if (now) {
    const H = C.coachHist || [];
    h += `<p><b>Coaching:</b> ${now.tid != null ? `${esc(G.ROLE_NAME[now.role])} of the ${tLink(now.tid)}` : 'between jobs'} (rating ${now.c.r}).</p>`;
    if (H.length) h += `<div class="tscroll"><table class="tbl"><tbody>${H.slice().reverse().map(x => `<tr><td class="l">${x.y}</td><td class="l">${esc(L.teams[x.tid].abbr)} ${esc(G.ROLE_NAME[x.role])}</td><td>${x.w}-${x.l}${x.t ? '-' + x.t : ''}</td><td class="l small">${esc(x.res)}</td></tr>`).join('')}</tbody></table></div>`;
  } else if (co.length) h += `<p><b>Coach:</b> teams want you on staff. Coordinators who win get head-coaching jobs.</p><div class="row">${co.map((o, i) => `<button class="btn sm" data-act="cCoach" data-id="${i}">${esc(G.ROLE_NAME[o.role])}, ${esc(L.teams[o.tid].abbr)}</button>`).join('')}</div>`;
  if (fo.length) h += `<p><b>Front office:</b> run a team as general manager in this same league. Your career stays in its history; this save becomes a GM league (your other GM league isn't touched).</p><div class="row">${fo.map(tid => confirmBtn('cGM' + tid, 'GM of the ' + L.teams[tid].name)).join('')}</div>`;
  return h ? `<section class="card"><h3>Life after football</h3>${h}</section>` : '';
}
function vCareer() {
  if (ui.box) { const b = boxCard(ui.box); if (b) return b; }
  if (!L) return vCareerSetup();
  if (L.career.pid == null) return modeSeg() + vCareerCreate();
  const p = CP();
  let h = cAlerts() + cHeader(p) + cPhaseCard(p) + cSeasonCard(p) + cScheduleCard(p) + (p.retiredYear == null ? cOrgCard(p) + cSchemeCard(p) + cDepthCard(p, false) : '') + cMovesCard(p) + cTrainCard(p) + cLegacyCard(p);
  h += `<section class="card"><h3>Your story</h3><ul class="news">${L.career.log.slice(0, 30).map(n => `<li><span class="nw">${n.y}</span>${esc(n.txt)}</li>`).join('')}</ul></section>`;
  h += `<section class="card"><h3>Wire</h3><ul class="news">${L.news.slice(0, 12).map(n => `<li><span class="nw">${n.y}${n.w ? ' W' + n.w : ''}</span>${esc(n.s)}</li>`).join('')}</ul></section>`;
  return h;
}
function vGames() {
  if (ui.box) { const b = boxCard(ui.box); if (b) return b; }
  const G0 = L.career.games || [];
  if (!G0.length) return `<section class="card"><h3>Games</h3><p>No games yet.</p></section>`;
  const ys = [...new Set(G0.map(g => g.y))], y = ui.gYear && ys.includes(ui.gYear) ? ui.gYear : ys[0];
  const rows = G0.filter(g => g.y === y).slice().reverse();
  return `<section class="card"><h3>Your games</h3><div class="chips">${ys.map(x => `<button class="chip ${x === y ? 'on' : ''}" data-act="gYear" data-id="${x}">${x}</button>`).join('')}</div>
    <div class="tscroll"><table class="tbl"><thead><tr><th class="l">Week</th><th class="l">Opp</th><th>Result</th><th class="l">You</th><th></th></tr></thead><tbody>${rows.map(cGameRow).join('')}</tbody></table></div></section>`;
}
function vTeamC() {
  const p = CP();
  if (!p || p.team < 0) return `<section class="card"><h3>Team</h3><p>You're not on a team right now.</p></section>`;
  return cDepthCard(p, true) + teamPage(L.teams[p.team]);
}
// The depth chart as the coach has it: your group first, then every other position
function cDepthCard(p, all) {
  if (!p || p.team < 0) return '';
  const D = G.depth(L, p.team), N = G.startersFor(L, p.team), order = [p.grp].concat(G.GRPS.filter(g => g !== p.grp));
  const r = G.careerRole(L, p);
  const grp = g => {
    const list = (D[g] || []).slice(0, Math.max(N[g] + 3, 4)), n = N[g] || 0;
    return `<div class="dcgrp${g === p.grp ? ' mine' : ''}"><div class="eyebrow">${g} · ${n} starter${n === 1 ? '' : 's'}</div>${list.map((x, i) => `<div class="dcrow${x.id === p.id ? ' me' : ''}${i < n ? ' st' : ''}"><span class="dcn">${i + 1}</span><span class="dcnm">${x.id === p.id ? '<b>You</b>' : pLink(x)}${x.inj ? ' <span class="bad small">inj</span>' : ''}</span><span class="dcpos">${esc(x.pos)}</span><span class="dco">${x.ovr}</span></div>`).join('')}${(D[g] || []).length > list.length ? `<div class="small muted">+${D[g].length - list.length} more</div>` : ''}</div>`;
  };
  return `<section class="card"><h3>Depth chart</h3><p class="small">${r ? `You: <b>${esc(r.label)}</b>. ` : ''}Starters are highlighted. The coach sets this from ratings and health${L.career.forced && L.career.forced.y === L.year ? '; you won your job by asking' : ''}.</p>
    <div class="dcgrid">${(all ? order : [p.grp]).map(grp).join('')}</div>${all ? '' : `<div class="row"><button class="btn sm" data-act="tab" data-id="team">Whole depth chart</button></div>`}</section>`;
}
function careerAct(a, el) {
  const id = el.dataset.id;
  switch (a) {
    case 'cBuild': {
      if (ui.cBusy) return true;
      ui.cBusy = true; render();
      setTimeout(() => {
        const Y = ui.cYear || 2005;
        L = G.newLeague(IM, 'nor', { startYear: Y - 1, realCareers: ui.realCareers !== false });
        G.startCareer(L, IM); ui.cBusy = false; ui.tab = 'home'; track('career/' + Y); save(); render();
      }, 30);
      return true;
    }
    case 'cWay': ui.cWay = id; break;
    case 'cTier': ui.cNew.tier = id; break;
    case 'cAns': { const [i, j] = id.split(':').map(Number); ui.cNew.ans[i] = j; break; }
    case 'cCreate': { const c = ui.cNew; if (!c.name.trim()) { flash('Give your player a name.'); break; } const e = G.careerCreate(L, Object.assign({}, c, { pos: c.pos || G.CAREER_POS[c.grp][0], ht: c.ht || HT[DEF_HT[c.grp]], wt: c.wt || DEF_WT[c.grp] })); if (e) flash(e); else { track('career-create/' + c.grp + '/' + c.tier); toTop(); } break; }
    case 'cReal': { const e = G.careerChooseReal(L, +id); if (e) flash(e); else { track('career-real'); toTop(); } break; }
    case 'cRealGrp': ui.cRealGrp = id; ui.cRealShow = 80; break;
    case 'cRealMore': ui.cRealShow = (ui.cRealShow || 80) + 80; break;
    case 'cNext': { const e = G.careerNext(L, IM, id); if (e) flash(e); toTop(); break; }
    case 'cYear': { for (let i = 0; i < +id; i++) G.careerSimYear(L, IM); break; }
    case 'cSign': { const e = G.careerSign(L, +id); flash(e || 'Signed.'); break; }
    case 'cHaggle': flash(G.careerHaggle(L, +id)); break;
    case 'cDisc': flash(G.careerDiscount(L, +id)); break;
    case 'cRaise': flash(G.careerAskRaise(L)); break;
    case 'cHold': flash(G.careerHoldout(L, id === 'on')); break;
    case 'cStart': flash(G.careerAskStart(L)); break;
    case 'cAccept': flash(G.careerAcceptRole(L)); break;
    case 'cTrade': flash(G.careerRequestTrade(L, id)); break;
    case 'cTradeNo': flash(G.careerCancelTrade(L)); break;
    case 'cDeal': { const e = G.careerTakeDeal(L, +id); flash(e || 'Traded.'); break; }
    case 'cDealNo': flash(G.careerDeclineDeals(L)); break;
    case 'cFocus': G.setCareerFocus(L, id); break;
    case 'cPlan': G.setCareerPlan(L, id); break;
    case 'cDismiss': G.dismissAlert(L, id); break;
    case 'gYear': ui.gYear = +id; break;
    case 'cSwitch': { const e = G.careerSwitch(L, +id); flash(e || 'Position changed.'); break; }
    case 'cCoach': { const e = G.careerBecomeCoach(L, +id); flash(e || 'You\'re a coach now.'); break; }
    default: return false;
  }
  save(); render(); return true;
}
function careerChange(t) {
  const c = ui.cNew; if (!c) return false;
  if (t.id === 'cGrp') { c.grp = t.value; c.pos = G.CAREER_POS[c.grp][0]; c.ht = null; c.wt = null; render(); return true; }
  if (t.id === 'cPos') { c.pos = t.value; return true; }
  if (t.id === 'cHt') { c.ht = t.value; return true; }
  if (t.id === 'cWt') { c.wt = +t.value || null; return true; }
  return false;
}
function careerInput(t) {
  const c = ui.cNew; if (!c) return false;
  const map = { cName: 'name', cCol: 'college', cHome: 'home', cNum: 'num' };
  if (map[t.id]) { c[map[t.id]] = t.value; return true; }
  return false;
}

/* ---------- actions ---------- */
function importText(text, kind, key) {
  const res = G.parsePFR(text);
  if (kind && res.kind !== kind) throw new Error(`That looks like a ${res.kind} table, not a ${kind} table.`);
  if (res.kind === 'roster') { IM.rosters[key] = res.rows; return `Imported ${res.rows.length} players for ${key}.`; }
  IM.drafts[key] = res.rows; return `Imported ${res.rows.length} prospects for the ${key} draft.`;
}

async function onFiles(files) {
  const out = [];
  for (const f of files) {
    const text = await f.text(), base = f.name.toLowerCase().replace(/\.[a-z]+$/, '');
    try {
      const res = G.parsePFR(text);
      if (res.kind === 'roster') {
        const code = G.TEAMS_1970.find(t => base.includes(t[0]));
        if (!code) { out.push(`${f.name}: name it with the team code, like nor.csv.`); continue; }
        IM.rosters[code[0]] = res.rows; out.push(`${code[0]} ✓`);
      } else {
        const y = (base.match(/(19|20)\d\d/) || [])[0];
        if (!y) { out.push(`${f.name}: include the year in the name, like draft1971.csv.`); continue; }
        IM.drafts[+y] = res.rows; out.push(`draft ${y} ✓`);
      }
    } catch (e) { out.push(`${f.name}: ${e.message}`); }
  }
  flash(out.join(' · ')); save(); render();
}

function act(a, el) {
  const id = el.dataset.id;
  if (careerAct(a, el)) return;
  switch (a) {
    case 'tab': ui.tab = id; ui.open = null; ui.box = null; toTop(); track('tab/' + id, true); break;
    case 'confirm':
      if (ui.confirm !== id) { ui.confirm = id; render(); return; }
      ui.confirm = null;
      if (id === 'reset') { L = null; DB.set(SLOT, null).catch(() => {}); ui.tab = 'home'; ui.cNew = null; flash(SLOT === 'career' ? 'Career deleted.' : 'League deleted. Your imported data is still here.'); }
      else if (id.startsWith('cGM')) { const e = G.careerToGM(L, +id.slice(3)); if (e) flash(e); else { ui.tab = 'home'; flash(`Welcome to the front office. You run the ${tname(me())}.`); toTop(); } }
      else if (id === 'cCamp') { const e = G.careerNext(L, IM); if (e) flash(e); toTop(); }
      else if (id === 'cRetire') { const e = G.careerRetire(L); flash(e || 'You have retired.'); toTop(); }
      else if (id.startsWith('fire')) { const e = G.fireCoach(L, id.slice(4)); flash(e || 'Coach fired. Hire a replacement before kickoff.'); }
      else if (id.startsWith('rel')) { const dc = G.deadCharge(L, L.players[+id.slice(3)]); G.release(L, +id.slice(3)); ui.open = null; flash('Player released to the waiver pool.' + (dc ? ` ${G.money(dc)} in dead money stays on your ${G.capYear(L)} payroll.` : '')); }
      break;
    case 'newDiff': ui.newDiff = id; break;
    case 'slot': {
      if (id === SLOT) break;
      clearTimeout(saveT); const cur = L, from = SLOT;
      (L ? DB.set(from, cur) : Promise.resolve()).catch(() => {}).then(() => DB.get(id)).then(l => {
        SLOT = id; try { localStorage.setItem('gg-slot', id); } catch (e) { /* private mode */ }
        L = l && l.teams ? l : null; if (L) G.ensureLeague(L);
        ui.tab = 'home'; ui.page = null; render();
      });
      return;
    }
    case 'setDiff': G.setDifficulty(L, id); flash(`Difficulty is now ${G.DIFF[id].name}.`); break;
    case 'newLeague': L = G.newLeague(IM, $('#pickTeam').value, { diff: ui.newDiff || 'pro', startYear: ui.startYear || 1970, realCareers: ui.realCareers !== false }); ui.tab = 'home'; track('new-league/' + (ui.startYear || 1970)); track('team/' + me().pfr); track('difficulty/' + (ui.newDiff || 'pro')); if (ui.realCareers === false) track('real-careers/off'); flash(`Welcome to ${tname(me())}.`); break;
    case 'autocut': G.cutTo(L, L.user, G.rules(L.year).rosterMax); break;
    case 'startSeason': { const e = G.startRegular(L); if (e) flash(e); break; }
    case 'simWeek': G.simWeek(L); break;
    case 'simSeason': while (L.phase === 'regular') G.simWeek(L); break;
    case 'simRound': G.simPlayoffRound(L); break;
    case 'startDraft': if (L.fired) break; G.startDraft(L, IM); ui.draftGrp = 'ALL'; ui.draftShow = 60; break;
    case 'beginDraft': G.beginDraft(L); break;
    case 'scout': { const e = G.scoutPlayer(L, +id); if (e) flash(e); break; }
    case 'draftMore': ui.draftShow = (ui.draftShow || 60) + 60; break;
    case 'toMyPick': G.draftUntilUser(L); break;
    case 'autoPick': G.aiPick(L); G.draftUntilUser(L); break;
    case 'draftPick': G.makePick(L, +id); G.draftUntilUser(L); break;
    case 'draftRest': G.draftAll(L); break;
    case 'endDraft': G.endDraft(L); break;
    case 'nextSeason': { const e = G.startNextSeason(L); if (e) flash(e); else track('season-played'); break; }
    case 'chip': ui[el.dataset.key] = id; if (el.dataset.key === 'st') { ui.statPid = null; } if (el.dataset.key === 'draftGrp') ui.draftShow = 60; if (el.dataset.key === 'prGrp') ui.prShow = 50; break;
    case 'open': ui.open = ui.open === +id ? null : +id; ui.confirm = null; break;
    case 'lg': ui.lg = id; break;
    case 'trkAll': ui.trkAll = true; break;
    case 'lead': ui.leadKey = id; break;
    case 'week': ui.resWeek = +id; break;
    case 'sign': { const e = G.sign(L, +id); flash(e || 'Signed.'); break; }
    case 'resign': { const e = G.resign(L, +id); flash(e || 'Re-signed.'); break; }
    case 'tag': { const e = G.franchiseTag(L, +id); flash(e || 'Franchise tag applied.'); break; }
    case 'ttag': { const e = G.transitionTag(L, +id); flash(e || 'Transition tag applied. Other teams can still make him an offer; you get to match.'); break; }
    case 'opt5': { const e = G.exerciseOption(L, +id); flash(e || 'Fifth-year option picked up.'); break; }
    case 'opt5no': { G.declineOption(L, +id); flash('Option declined. He plays out his deal and can become a free agent.'); break; }
    case 'psDown': { const e = G.toPracticeSquad(L, +id); ui.open = null; flash(e || 'Moved to the practice squad.'); break; }
    case 'psSign': { const e = G.toPracticeSquad(L, +id); flash(e || 'Signed to your practice squad.'); break; }
    case 'psUp': { const e = G.promoteFromPS(L, +id); flash(e || 'Promoted to the active roster.'); break; }
    case 'psCut': { const p = L.players[+id]; if (p) { delete p.ps; p.team = -1; flash(`${p.name} released.`); } break; }
    case 'psPoach': { const e = G.signFromPS(L, +id); flash(e || 'Signed off their practice squad.'); break; }
    case 'letGo': { const e = G.letGo(L, +id); flash(e || 'Released to free agency.'); break; }
    case 'matchSheet': { const e = G.matchSheet(L, +id); flash(e || 'Offer matched. He stays.'); break; }
    case 'declineSheet': { const e = G.declineSheet(L, +id); flash(e || 'He leaves. Compensation picks added.'); break; }
    case 'sheet': { const e = G.sendSheet(L, +id); flash(e || 'His team did not match. He is yours.'); break; }
    case 'protect': { const e = G.toggleProtect(L, +id); if (e) flash(e); break; }
    case 'advanceFA': { const e = G.advanceFA(L); if (e) flash(e); break; }
    case 'mktMore': ui.mktShow = (ui.mktShow || 30) + 30; break;
    case 'extend': { const e = G.extend(L, +id); flash(e || 'Extension signed.'); break; }
    case 'bid': {
      const k = el.dataset.key, p = L.players[+id], b = (L.fa.bids || {})[+id], ask = G.baseAsk(L, p);
      if (k === 'x') { G.withdrawBid(L, +id); break; }
      let sal = b ? b.sal : ask, yrs = b ? b.yrs : Math.max(1, Math.min(5, p.age <= 26 ? 4 : p.age <= 29 ? 3 : p.age <= 31 ? 2 : 1));
      if (k === 'sal+') sal += ask * 0.05; if (k === 'sal-') sal = Math.max(ask * 0.5, sal - ask * 0.05);
      if (k === 'yrs+') yrs = Math.min(5, yrs + 1); if (k === 'yrs-') yrs = Math.max(1, yrs - 1);
      const e = G.placeBid(L, +id, sal, yrs); if (e) flash(e); break;
    }
    case 'shop': ui.give = ['p:' + id]; ui.get = []; ui.tview = 'p'; ui.tab = 'moves'; break;
    case 'tview': ui.tview = id; break;
    case 'acceptOffer': { const e = G.acceptOffer(L, +id); flash(e || 'Trade accepted.'); break; }
    case 'rejectOffer': G.rejectOffer(L, +id); flash('Offer rejected.'); break;
    case 'tp': { ui.found = null; const side = el.dataset.side;
      if (side === 'get' && ui.tradeTeam === -1) {
        const owner = id[0] === 'p' ? (L.players[+id.slice(2)] || {}).team : (G.pickById(L, +id.slice(2)) || {}).own;
        if (owner != null && owner !== ui.getTeam) { if (ui.get.length) flash(`Now trading with ${tname(L.teams[owner])}.`); ui.get = []; ui.getTeam = owner; }
      }
      const arr = ui[side]; const i = arr.indexOf(id); if (i >= 0) arr.splice(i, 1); else if (arr.length < 6) arr.push(id); else flash('A deal can include up to 6 items per side.'); break; }
    case 'clearTrade': ui.give = []; ui.get = []; ui.found = null; break;
    case 'propose': { const pk = sel => ({ players: sel.filter(x => x[0] === 'p').map(x => +x.slice(2)), picks: sel.filter(x => x[0] === 'k').map(x => +x.slice(2)) }); const tt = ui.tradeTeam === -1 ? ui.getTeam : (ui.tradeTeam == null ? L.teams.find(t => t.id !== L.user).id : ui.tradeTeam); if (tt == null || tt < 0) { flash('Pick something to receive first.'); break; } const r = G.proposeTrade(L, tt, pk(ui.give), pk(ui.get)); flash(r.msg); if (r.ok) { ui.give = []; ui.get = []; } break; }
    case 'coach': me().coach[el.dataset.key] = id; break;
    case 'scheme': { const e = G.setScheme(L, id); flash(e || `You now run the ${G.SCHEME[id].name}.`); break; }
    case 'plan': G.setGamePlan(L, el.dataset.key, id || null); break;
    case 'dcMove': G.moveDepth(L, L.user, +id, +el.dataset.key); break;
    case 'dcReset': G.resetDepth(L, L.user, id); break;
    case 'dcSort': G.setDepth(L, L.user, id, G.depthChart(L, L.user, id).sort(cmp(el.dataset.key)).map(p => p.id)); flash(`${id} depth chart ordered by ${el.dataset.key === 'pot' ? 'potential' : 'overall'}.`); break;
    case 'sort': ui[el.dataset.key] = id; break;
    case 'prMore': ui.prShow = (ui.prShow || 50) + 50; break;
    case 'apYear': ui.apYear = +id; break;
    case 'pickFound': { const p = L.players[+id]; if (p) { ui.tradeTeam = p.team; ui.get = ['p:' + p.id]; ui.tview = 'p'; ui.tGrpGet = 'ALL'; ui.found = null; ui.tq = ''; } break; }
    case 'findTrade': { const pk = sel => ({ players: sel.filter(x => x[0] === 'p').map(x => +x.slice(2)), picks: sel.filter(x => x[0] === 'k').map(x => +x.slice(2)) }); const r = G.findTrades(L, pk(ui.give)); ui.found = r.err ? { err: r.err } : { offers: r.offers, give: ui.give.slice() }; ui.focus = '.found'; break; }
    case 'takeFound': { const F = ui.found, o = F && F.offers && F.offers[+id]; if (!o) break; const pk = sel => ({ players: sel.filter(x => x[0] === 'p').map(x => +x.slice(2)), picks: sel.filter(x => x[0] === 'k').map(x => +x.slice(2)) }); const r = G.proposeTrade(L, o.from, pk(F.give), o.get); flash(r.msg); if (r.ok) { ui.give = []; ui.get = []; ui.found = null; } break; }
    case 'help': if (ui.tab === 'help') { ui.tab = ui.helpBack || 'home'; } else { ui.helpBack = ui.tab; ui.helpOpen = SLOT === 'career' ? 'career' : HELP_FOR_TAB[ui.tab] || 'quick'; ui.helpQ = ''; ui.tab = 'help'; ui.focus = '#h-' + ui.helpOpen; } toTop(); track('help/' + (ui.helpOpen || ''), true); break;
    case 'helpGo': if (ui.tab !== 'help') { ui.helpBack = ui.tab; ui.tab = 'help'; } ui.helpOpen = id; ui.helpQ = ''; ui.focus = '#h-' + id; track('help/' + id, true); break;
    case 'helpNudgeX': ui.helpSeen = true; try { localStorage.setItem('gg-help-seen', '1'); } catch (e) { /* ignore */ } break;
    case 'blockWant': ui.blockWant = id; if (id === 'picks') ui.blockPos = ''; break;
    case 'shopBlock': {
      const pk = sel => ({ players: sel.filter(x => x[0] === 'p').map(x => +x.slice(2)), picks: sel.filter(x => x[0] === 'k').map(x => +x.slice(2)) });
      const r = G.shopBlock(L, pk(ui.give), { want: ui.blockWant || 'best', pos: ui.blockWant === 'picks' ? '' : (ui.blockPos || '') });
      if (r.err) { ui.blockMsg = r.err; break; }
      ui.blockMsg = r.n ? '' : 'No team made an offer. Try a different ask, another position, or add more to the package.';
      if (r.n) { flash(`${r.n} team${r.n === 1 ? '' : 's'} made offers. They're under Trade offers at the top.`); ui.focus = '.offers'; toTop(); }
      break;
    }
    case 'campAll': ui.campAll = !ui.campAll; break;
    case 'expT': { const e = G.toggleExp(L, +id); if (e) flash(e); break; }
    case 'ringAdd': { const e = G.retireNumber(L, L.user, +id, 'user'); flash(e || 'Number retired.'); break; }
    case 'ringAll': ui.ringAll = true; break;
    case 'ir': { const e = G.placeIR(L, +id); flash(e || 'Placed on injured reserve. His roster spot is open.'); break; }
    case 'irOff': { const e = G.activateIR(L, +id); flash(e || 'Activated from injured reserve.'); break; }
    case 'dOffer': { if (id === 'yes') { const e = G.acceptDraftOffer(L); flash(e || 'Trade accepted. You moved down.'); G.draftUntilUser(L); } else { G.declineDraftOffer(L); flash('You kept the pick.'); } break; }
    case 'st': ui.st = id; ui.statPid = null; break;
    case 'box': ui.box = id || null; if (id) toTop(); break;
    case 'histYear': ui.histYear = +id; break;
    case 'takeJob': { const e = G.takeJob(L, +id); flash(e || `Welcome to ${tname(me())}.`); ui.tab = 'home'; break; }
    case 'hire': { const e = G.hireCoach(L, +id); flash(e || 'Hired.'); break; }
    case 'reneg': { const e = G.renegotiate(L, +id); flash(e || 'New deal signed.'); break; }
    case 'stYear': ui.stYear = +id; break;
    case 'tsSort': ui.tsSort = id || 'w'; break;
    case 'statPlayer': if (id) openPage('p', +id); break;
    case 'pl': openPage('p', +id); break;
    case 'tm': openPage('t', +id); break;
    case 'pgBack': pageBack(); break;
    case 'tradeFor': { const p = G.getP(L, +id); if (p && p.team >= 0) { ui.tradeTeam = p.team; ui.getTeam = null; ui.get = ['p:' + p.id]; ui.tab = 'moves'; ui.focus = '#tradeTeam'; } break; }
    case 'tradeWith': ui.tradeTeam = +id; ui.getTeam = null; ui.get = []; ui.tab = 'moves'; ui.focus = '#tradeTeam'; break;
    case 'hurt': { const p = L.players[+id]; const e = G.setPlayHurt(L, +id, !p.playHurt); if (e) flash(e); else flash(p.playHurt ? `${p.name} will play through the injury.` : `${p.name} will rest until healthy.`); break; }
    case 'impKind': ui.impKind = id; break;
    case 'import': {
      const text = $('#impText').value;
      try { const yk = String(ui.impYear).trim().toLowerCase(); if (ui.impKind !== 'roster' && !/^(19[7-9]\d|20[0-3]\d)s?$/.test(yk)) throw new Error('Enter a draft year like 1985, or 1984s for the 1984 supplemental draft.'); flash(importText(text, ui.impKind, ui.impKind === 'roster' ? ui.impTeam : (/s$/.test(yk) ? yk : +yk))); G.setDrafts(IM.drafts); } catch (e) { flash(e.message); }
      break;
    }
    case 'exportData': {
      const blob = new Blob([JSON.stringify({ gridironData: 1, rosters: IM.rosters, drafts: IM.drafts })], { type: 'application/json' });
      const a2 = document.createElement('a'); a2.href = URL.createObjectURL(blob); a2.download = 'gridiron-gm-data-pack.json';
      document.body.appendChild(a2); a2.click(); a2.remove();
      flash('Data pack created. Use Share → Save to Files, AirDrop, or Messages to send it.');
      break;
    }
    case 'retrySave': { doSave(); break; }
    case 'exportSave': {
      const blob = new Blob([JSON.stringify({ league: L, imports: IM })], { type: 'application/json' });
      const a2 = document.createElement('a'); a2.href = URL.createObjectURL(blob); a2.download = `gridiron-gm-${L.career ? 'career-' : ''}${L.year}.json`;
      document.body.appendChild(a2); a2.click(); a2.remove();
      flash('Backup created. If nothing downloaded, open the installed app rather than this preview.');
      break;
    }
    default: return;
  }
  if (a !== 'confirm') ui.confirm = null;
  save(); render();
}

document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && !el.disabled) act(el.dataset.act, el); });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'cYear') { ui.cYear = +t.value; render(); return; }
  if (careerChange(t)) return;
  if (t.id === 'ringTeam') { ui.ringTeam = +t.value; render(); return; }
  if (t.id === 'tGrp-give' || t.id === 'tGrp-get') { ui[t.id === 'tGrp-give' ? 'tGrpGive' : 'tGrpGet'] = t.value; render(); }
  else if (t.id === 'startQB') { G.setStarterQB(L, +t.value); save(); render(); }
  else if (t.id === 'tradeTeam') { ui.tradeTeam = +t.value; ui.get = []; ui.getTeam = null; render(); }
  else if (t.id === 'aggr') { me().coach.aggr = +t.value; save(); render(); }
  else if (t.id === 'startYear') { ui.startYear = +t.value; ui.startTeam = $('#pickTeam') && $('#pickTeam').value; render(); }
  else if (t.id === 'pickTeam') { ui.startTeam = t.value; }
  else if (t.id === 'youth') { me().coach.youth = t.checked; save(); }
  else if (t.id === 'impTeam') ui.impTeam = t.value;
  else if (t.id === 'impYear') ui.impYear = t.value.trim();
  else if (t.id === 'realNew') ui.realCareers = t.checked;
  else if (t.id === 'blockPos') { ui.blockPos = t.value; }
  else if (t.id === 'mktGrp') { ui.ctGrp = t.value; ui.mktShow = 30; ui.focus = '#mkt'; render(); }
  else if (t.id === 'mktSort') { ui.mktSort = t.value; ui.focus = '#mkt'; render(); }
  else if (t.id === 'trkRnd') { ui.trkRnd = +t.value; ui.trkAll = false; render(); }
  else if (t.id === 'trkTeam') { ui.trkTeam = +t.value; ui.trkAll = false; render(); }
  else if (t.id === 'dresYear') { ui.dresYear = +t.value; ui.trkAll = false; render(); }
  else if (t.id === 'realL') { if (L) { L.realCareers = t.checked; save(); render(); } }
  else if (t.id === 'impFiles' && t.files.length) onFiles([...t.files]);
  else if (t.id === 'loadData' && t.files[0]) {
    t.files[0].text().then(s => {
      try {
        const o = JSON.parse(s);
        const src = o.gridironData ? o : (o.imports || null); // a full backup works too
        if (!src || (!src.rosters && !src.drafts)) throw 0;
        let r = 0, d = 0;
        for (const k in src.rosters || {}) { IM.rosters[k] = src.rosters[k]; r++; }
        for (const k in src.drafts || {}) { IM.drafts[k] = src.drafts[k]; d++; }
        flash(`Loaded ${r} roster${r === 1 ? '' : 's'} and ${d} draft class${d === 1 ? '' : 'es'}.${L ? ' Draft classes apply to future drafts. Rosters only apply when you start a new league.' : ' Start a new league to use them.'}`);
        save();
      } catch (err) { flash('That file is not a Gridiron GM data pack.'); }
      render();
    });
  }
  else if (t.id === 'loadSave' && t.files[0]) {
    t.files[0].text().then(s => {
      try { const o = JSON.parse(s); if (!o.league || !o.league.teams) throw 0; L = o.league; G.ensureLeague(L); IM = o.imports || IM; ui.tab = 'home'; SLOT = L.career ? 'career' : 'league'; try { localStorage.setItem('gg-slot', SLOT); } catch (e2) { /* private mode */ } flash(`Restored your ${L.year} ${L.career ? 'career' : 'league'}.`); save(); }
      catch (err) { flash('That file is not a Gridiron GM backup.'); }
      render();
    });
  }
});
document.addEventListener('click', e => { const a = e.target.closest('a[data-help]'); if (!a) return; e.preventDefault(); ui.helpOpen = a.dataset.help; ui.helpQ = ''; ui.focus = '#h-' + ui.helpOpen; render(); }, true);
document.addEventListener('input', e => { if (careerInput(e.target)) return; if (e.target.id === 'mktQ') { ui.mktQ = e.target.value; ui.mktShow = 30; render(); const el = $('#mktQ'); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (x) { /* ignore */ } } return; } if (e.target.id === 'helpQ') { ui.helpQ = e.target.value; ui.helpOpen = null; render(); const el = $('#helpQ'); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (x) { /* search inputs */ } } return; } if (e.target.id === 'tq') { ui.tq = e.target.value; const box = document.getElementById('tqres'); if (box) box.innerHTML = searchResults(); return; } if (e.target.id === 'aggr') { const h = e.target.closest('.card').querySelector('h3'); if (h) h.textContent = 'Aggressiveness: ' + e.target.value; } });

// Rosters and draft classes published with the game (data.json next to index.html).
// Anything this device doesn't have yet is added; your own imports are never overwritten.
async function loadRealRosters() {
  // nflverse rosters: who played where every season. Kept on the device so it works offline.
  let have = false;
  try { const d = await DB.get('real'); if (d && d.players) { G.setRealData(d); have = true; } } catch (e) { /* none saved */ }
  if (!/^https?:/.test(location.protocol)) return;
  try {
    const res = await fetch('rosters.json', { cache: 'no-store' });
    if (!res.ok) return;
    const d = await res.json(); if (!d || !d.gridironRosters) return;
    const n = G.setRealData(d);
    if (!have || (REALN && REALN !== n)) { DB.set('real', d).catch(() => {}); }
    REALN = n;
    if (!have) { flash(`Loaded real rosters for every season (${n.toLocaleString()} players).`); render(); }
  } catch (e) { /* offline: keep what's on the device */ }
}
let REALN = 0;
async function loadBuiltInData() {
  if (!/^https?:/.test(location.protocol)) return;
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    if (!res.ok) return;
    const o = await res.json(); if (!o || !o.gridironData) return;
    let r = 0, d = 0;
    for (const k in o.rosters || {}) if (!IM.rosters[k]) { IM.rosters[k] = o.rosters[k]; r++; }
    for (const k in o.drafts || {}) if (!IM.drafts[k]) { IM.drafts[k] = o.drafts[k]; d++; }
    G.setDrafts(IM.drafts);
    if (r || d) { flash(`Loaded the game's built-in data: ${r} roster${r === 1 ? '' : 's'} and ${d} draft class${d === 1 ? '' : 'es'}.`); save(); render(); }
  } catch (e) { /* offline or no data file: use what's on this device */ }
}
(async function boot() {
  await DB.open();
  const [l, im] = await Promise.all([DB.get(SLOT), DB.get('imports')]);
  if (im) { IM = im; imSig = imSignature(); } if (l && l.teams) { L = l; G.ensureLeague(L); }
  if (L) save(); // re-store older uncompressed saves in compressed form
  G.setDrafts(IM.drafts);
  render();
  loadBuiltInData();
  loadRealRosters();
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !/claude\.ai|claudeusercontent/.test(location.host)) {
    try { navigator.serviceWorker.register('sw.js'); } catch (e) { /* offline install unavailable */ }
  }
})();
})();
