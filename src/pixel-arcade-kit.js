/* Pixel Arcade Kit — the art system from Hardwood GM's arcade mode, pulled out so another game can use it.
   No dependencies. Works in the browser (attaches window.PK) and in Node (module.exports) for tests.

   What's in here:
     • helpers: clamp, hash, shade (lighten/darken a hex color)
     • text: micro (3x5 pixel digits/letters), pixText (any text with hard pixel edges, cached)
     • people: 7 skin tones, 8 hair colors, 20 looks, lookOf(id) — the same player always gets the same look
     • heads: toonHead (cartoon head for field sprites, at 1x or 2x detail), helmetHead (football helmet with facemask),
              frontHead (front-facing head for portraits)
     • finishing: edgeShade (light from the left, shadow on the right) and outlined (1-px dark outline)
     • portrait(): head-and-shoulders card art for a matchup screen
     • stands: fan() and buildStands() for the crowd
     • scoreboard(): the LED board (team panels, scores, clock, small lines like the quarter or "3RD & 7")
     • CSS: the controller pad, player card, tip box, pause menu and matchup screen styles (inject with PK.injectCSS())

   The rendering approach (see the brief for the full recipe):
     1. Draw the whole scene into a small canvas (about screen height / 2.7 pixels tall), then scale it up to the screen with
        imageSmoothingEnabled = false. That gives the chunky pixel look.
     2. Render that canvas at RS = 2 and draw the field, ball, scoreboard and text with a 2x transform, so they stay chunky,
        while the players are built at 2x resolution and drawn 1:1, so they get single-pixel detail.
     3. Prerender everything that never changes (field, lines, logos, stands) once into a "world" canvas and blit it with the
        camera offset each frame. Players, ball and scoreboard are drawn per frame, sorted by depth (y). */
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = n => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; };
  // shade('#336699', 0.2) lightens 20% toward white; -0.2 darkens 20% toward black
  const shade = (hex, f) => { if (!/^#/.test(hex)) return hex; const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const t = f < 0 ? 0 : 255, a = Math.abs(f); r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a); return `rgb(${r},${g},${b})`; };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  /* ---------- text ---------- */
  // 3x5 pixel font: digits plus the letters a scoreboard needs (Q, O, T, F, I, N, A, L, D, R, S, H, G, &)
  const MF = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111',
    Q: '111101101111001', O: '111101101101111', T: '111010010010010', F: '111100111100100', I: '111010010010111', N: '101111111101101', A: '010101111101101', L: '100100100100111',
    D: '110101101101110', R: '110101110101101', S: '111100111001111', H: '101101111101101', G: '111100101101111', '&': '010101010101011', '-': '000000111000000' };
  function micro(g, str, x, y, sc, col) {
    g.fillStyle = col; let cx = x;
    for (const ch of String(str).toUpperCase()) {
      if (ch === ':') { g.fillRect(cx, y + sc, sc, sc); g.fillRect(cx, y + 3 * sc, sc, sc); cx += 2 * sc; continue; }
      if (ch === ' ') { cx += 2 * sc; continue; }
      if (ch === '.') { g.fillRect(cx, y + 4 * sc, sc, sc); cx += 2 * sc; continue; }
      const m = MF[ch]; if (m) for (let i = 0; i < 15; i++) if (m[i] === '1') g.fillRect(cx + (i % 3) * sc, y + Math.floor(i / 3) * sc, sc, sc);
      cx += 4 * sc;
    }
    return cx - x - sc;
  }
  const microW = (str, sc) => { let w = 0; for (const ch of String(str)) w += (ch === ':' || ch === ' ' || ch === '.' ? 2 : 4) * sc; return w - sc; };
  // Any text with hard pixel edges: drawn small in a real font, then every pixel forced fully on or off. Centered on (x, y).
  const ptCache = {};
  function pixText(c, text, x, y, size, col, rot, outline) {
    const ck = text + '|' + size + '|' + col + '|' + (outline || '');
    let o = ptCache[ck];
    if (!o) {
      const t = mk(1, 1), tc = t.getContext('2d'); tc.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
      const tw = Math.ceil(tc.measureText(text).width) + 4, th = Math.ceil(size * 1.3) + 4; t.width = tw; t.height = th;
      tc.font = `900 ${size}px "Arial Black", Impact, sans-serif`; tc.textBaseline = 'top'; tc.fillStyle = '#fff'; tc.fillText(text, 2, 2);
      const d = tc.getImageData(0, 0, tw, th).data, on = new Uint8Array(tw * th);
      for (let i = 0; i < tw * th; i++) on[i] = d[i * 4 + 3] > 110 ? 1 : 0;
      o = mk(tw + 2, th + 2); const oc = o.getContext('2d');
      const put = (col2, dx, dy) => { oc.fillStyle = col2; for (let yy = 0; yy < th; yy++) for (let xx = 0; xx < tw; xx++) if (on[yy * tw + xx]) oc.fillRect(xx + 1 + dx, yy + 1 + dy, 1, 1); };
      if (outline) { put(outline, -1, 0); put(outline, 1, 0); put(outline, 0, -1); put(outline, 0, 1); }
      put(col, 0, 0); ptCache[ck] = o;
    }
    c.save(); c.translate(Math.round(x), Math.round(y)); if (rot) c.rotate(rot); c.drawImage(o, Math.round(-o.width / 2), Math.round(-o.height / 2)); c.restore();
  }

  /* ---------- people ---------- */
  const SKIN = ['#f1c9a5', '#e0ac85', '#c68863', '#a86b43', '#8a5432', '#6b3f24', '#4e2c19'];
  const HAIRC = ['#1b1209', '#1b1209', '#1b1209', '#2e1d10', '#4a2e16', '#6b4a2a', '#c9a04c', '#8a3b1d'];
  // hair: 0 short, 1 afro, 2 locks, 3 bald, 4 buzz, 5 high-top, 6 cornrows, 7 mohawk, 8 long, 9 curly, 10 man bun, 11 spiky
  // fac: 0 none, 1 beard, 2 goatee, 3 mustache · acc: 0 none, 1 headband, 2 goggles/visor, 3 arm sleeve · sock: 1 = high socks
  const LOOKS = [[0, 0, 0, 0], [1, 0, 0, 0], [2, 0, 0, 0], [3, 1, 0, 0], [4, 2, 0, 0], [5, 0, 0, 0], [6, 0, 1, 0], [7, 0, 0, 0], [8, 0, 1, 0], [9, 0, 0, 0],
    [10, 1, 0, 0], [11, 0, 0, 0], [1, 0, 1, 0], [0, 0, 2, 0], [2, 0, 1, 0], [3, 0, 0, 1], [4, 0, 3, 0], [5, 3, 0, 0], [6, 1, 0, 0], [9, 0, 3, 1]].map(([hair, fac, acc, sock]) => ({ hair, fac, acc, sock }));
  // The same id always gets the same look. Mostly dark hair; about 8% blond or red.
  function lookOf(id) {
    const hv = k => hash((id + 1) * 131 + k * 977);
    const sk = SKIN[Math.floor(hv(1) * SKIN.length)], L = LOOKS[Math.floor(hv(2) * LOOKS.length)];
    let hc = HAIRC[Math.floor(hv(3) * 6)]; if (hv(6) < 0.08) hc = HAIRC[6 + Math.floor(hv(7) * 2)];
    return { sk, hc, L, shoe: hv(4) < 0.5 ? '#f4f4f4' : '#202020', bands: hv(5) < 0.3, hv };
  }

  /* ---------- heads ---------- */
  // Cartoon head for field sprites: 8 units wide, 7 tall (ox, oy are in units; k = pixels per unit: 1 normal, 2 full detail).
  function toonHead(g, ox, oy, lk, band, faceL, k) {
    k = k || 1; const { sk, hc, L } = lk, R = (x, y, a, b, col) => { g.fillStyle = col; g.fillRect(Math.round((ox + x) * k), Math.round((oy + y) * k), Math.round(a * k), Math.round(b * k)); };
    R(0, 0, 8, 7, sk); R(-1, 3, 1, 2, shade(sk, -0.1)); R(8, 3, 1, 2, shade(sk, -0.1));
    switch (L.hair) {
      case 0: R(0, 0, 8, 2, hc); R(0, 2, 1, 1, hc); R(7, 2, 1, 1, hc); break;
      case 1: R(-1, -3, 10, 5, hc); R(0, -4, 8, 1, hc); R(-1, 2, 1, 2, hc); R(8, 2, 1, 2, hc); break;
      case 2: R(0, -1, 8, 2, hc); R(-1, 0, 1, 7, hc); R(8, 0, 1, 7, hc); R(faceL ? 7 : 0, 1, 1, 4, hc); break;
      case 3: R(2, 0, 4, 1, shade(sk, 0.2)); break;
      case 4: R(0, 0, 8, 1, hc); break;
      case 5: R(0, -4, 8, 5, hc); break;
      case 6: R(0, 0, 8, 2, hc); for (const x of [1, 3, 5]) R(x, 0, 1, 2, shade(sk, -0.2)); break;
      case 7: R(3, -3, 2, 4, hc); R(0, 0, 3, 1, shade(sk, -0.1)); R(5, 0, 3, 1, shade(sk, -0.1)); break;
      case 8: R(0, -1, 8, 2, hc); R(-1, 0, 1, 6, hc); R(8, 0, 1, 6, hc); break;
      case 9: R(0, -1, 8, 2, hc); R(-1, 0, 1, 3, hc); R(8, 0, 1, 3, hc); for (const x of [1, 4, 6]) R(x, -2, 1, 1, hc); break;
      case 10: R(0, 0, 8, 2, hc); R(3, -3, 2, 3, hc); break;
      default: R(0, 0, 8, 1, hc); for (const x of [0, 2, 4, 6]) R(x, -1, 1, 1, hc); R(1, -2, 1, 1, hc); R(5, -2, 1, 1, hc);
    }
    if (L.acc === 1) R(0, 1, 8, 1, band);
    faceDetail(g, ox, oy, lk, faceL, k, R);
  }
  // eyes, brows, nose, cheek, mouth and facial hair (shared by toonHead and helmetHead)
  function faceDetail(g, ox, oy, lk, faceL, k, R, noBrows) {
    const { sk, hc, L } = lk, sh2 = faceL ? -1 : 1, e1 = faceL ? 1 : 2, e2 = faceL ? 4 : 5;
    if (k >= 2) {
      const P = (x, y, a, b, col) => { g.fillStyle = col; g.fillRect(Math.round(ox * k + x), Math.round(oy * k + y), a, b); };
      P(-2, 7, 1, 2, shade(sk, -0.3)); P(16, 7, 1, 2, shade(sk, -0.3));
      if (!noBrows && L.hair !== 3 && L.hair !== 7) P(2, 0, 10, 1, shade(hc, 0.35));
      if (L.acc === 2) { P(0, 6, 16, 4, '#262626'); P(e1 * 2 + 1, 7, 3, 2, '#8fc8e8'); P(e2 * 2 + 1, 7, 3, 2, '#8fc8e8'); P(e1 * 2 + 1, 7, 1, 1, '#e8f6ff'); P(e2 * 2 + 1, 7, 1, 1, '#e8f6ff'); }
      else for (const ex of [e1, e2]) { const X = ex * 2; if (!noBrows) P(X, 5, 4, 1, shade(hc, -0.1)); P(X, 7, 4, 3, '#ffffff'); P(X + (sh2 > 0 ? 2 : 0), 7, 2, 3, '#2a1a10'); P(X + (sh2 > 0 ? 2 : 0), 7, 1, 1, '#ffffff'); }
      P(faceL ? 1 : 14, 8, 1, 3, shade(sk, -0.2)); P(faceL ? 0 : 15, 10, 1, 1, shade(sk, -0.3)); P(faceL ? 2 : 10, 10, 3, 1, shade(sk, 0.15));
      if (L.fac === 1) { R(0, 5, 8, 2, hc); P(faceL ? 4 : 8, 11, 4, 1, '#5a2018'); for (let i = 0; i < 6; i++) P(1 + i * 2 + (i % 2), 12 + (i % 2), 1, 1, shade(hc, -0.3)); }
      else { P(faceL ? 4 : 8, 12, 4, 1, '#6b2a20'); P(faceL ? 4 : 8, 13, 4, 1, shade(sk, -0.12)); if (L.fac === 2) P(faceL ? 4 : 8, 13, 4, 1, hc); if (L.fac === 3) P(faceL ? 3 : 7, 11, 6, 1, hc); }
      return;
    }
    if (L.acc === 2) { R(0, 3, 8, 2, '#2a2a2a'); R(e1, 3, 2, 1, '#8fc8e8'); R(e2, 3, 2, 1, '#8fc8e8'); }
    else for (const ex of [e1, e2]) { R(ex, 3, 2, 2, '#ffffff'); R(ex + (sh2 > 0 ? 1 : 0), 3, 1, 2, '#1b1209'); }
    R(faceL ? 0 : 7, 4, 1, 1, shade(sk, -0.18));
    if (L.fac === 1) { R(0, 5, 8, 2, hc); R(faceL ? 2 : 4, 5, 2, 1, '#6b2a20'); } else { R(faceL ? 2 : 4, 6, 2, 1, '#6b2a20'); if (L.fac === 2) R(faceL ? 2 : 4, 6, 2, 1, hc); if (L.fac === 3) R(faceL ? 1 : 3, 5, 4, 1, hc); }
  }
  // Football helmet over the same face: shell in the team color with a center stripe, ear hole, gray facemask bars, chin strap.
  // team: { shell, stripe, mask } (mask defaults to gray). Same units as toonHead (8 wide, 7 tall); the shell adds a unit all round.
  function helmetHead(g, ox, oy, lk, team, faceL, k) {
    k = k || 1; const R = (x, y, a, b, col) => { g.fillStyle = col; g.fillRect(Math.round((ox + x) * k), Math.round((oy + y) * k), Math.round(a * k), Math.round(b * k)); };
    const shell = team.shell, stripe = team.stripe || '#ffffff', mask = team.mask || '#9aa0a8', sk = lk.sk;
    R(0, 1, 8, 6, sk);                                    // face
    R(-1, -2, 10, 4, shell); R(0, -3, 8, 1, shell);       // dome
    R(faceL ? 5 : -1, -1, 4, 7, shell);                   // back of the helmet on the far side
    R(3, -3, 2, 5, stripe);                               // center stripe
    R(faceL ? 6 : 0, 2, 2, 2, shade(shell, -0.35));       // ear hole
    if (k >= 2) { const P = (x, y, a, b, col) => { g.fillStyle = col; g.fillRect(Math.round(ox * k + x), Math.round(oy * k + y), a, b); }; P(2, -5, 6, 1, shade(shell, 0.35)); P(faceL ? 10 : 2, -2, 4, 1, shade(shell, 0.25)); }
    faceDetail(g, ox, oy + 1, lk, faceL, k, (x, y, a, b, col) => R(x, y + 1, a, b, col), true);
    // facemask: two bars across the face and one down the front, on the side he faces
    const fx = faceL ? -1 : 6; R(fx, 3, 3, 1, mask); R(fx, 5, 3, 1, mask); R(faceL ? -1 : 8, 2, 1, 5, mask);
    R(faceL ? 2 : 4, 7, 3, 1, shade(mask, -0.3));         // chin strap
  }
  // Front-facing head for portraits (k = 3 is a good portrait scale). Uses the same looks.
  function frontHead(g, ox, oy, sc, lk, band) {
    const { sk, hc, L } = lk, R = (x, y, a, b, col) => { g.fillStyle = col; g.fillRect(ox + x * sc, oy + y * sc, a * sc, b * sc); };
    R(1, 0, 6, 6, sk); R(3, 5, 2, 1, shade(sk, -0.15)); R(0, 2, 1, 2, shade(sk, -0.08)); R(7, 2, 1, 2, shade(sk, -0.08));
    switch (L.hair) {
      case 0: R(1, 0, 6, 2, hc); break; case 1: R(0, -2, 8, 4, hc); R(1, -3, 6, 1, hc); break; case 2: R(1, -1, 6, 2, hc); R(0, 0, 1, 6, hc); R(7, 0, 1, 6, hc); break;
      case 3: R(2, 0, 4, 1, shade(sk, 0.18)); break; case 4: R(1, 0, 6, 1, hc); break; case 5: R(1, -3, 6, 4, hc); break;
      case 6: R(1, 0, 6, 2, hc); R(2, 0, 1, 2, shade(sk, -0.2)); R(4, 0, 1, 2, shade(sk, -0.2)); break; case 7: R(3, -2, 2, 3, hc); break;
      case 8: R(1, -1, 6, 2, hc); R(0, 0, 1, 5, hc); R(7, 0, 1, 5, hc); break; case 9: R(1, -1, 6, 2, hc); R(2, -2, 1, 1, hc); R(5, -2, 1, 1, hc); break;
      case 10: R(1, 0, 6, 2, hc); R(3, -2, 2, 2, hc); break; default: R(1, 0, 6, 1, hc); R(1, -1, 1, 1, hc); R(3, -1, 1, 1, hc); R(5, -1, 1, 1, hc);
    }
    if (L.fac === 1) { R(1, 4, 6, 2, hc); R(3, 4, 2, 1, shade(sk, -0.25)); } else if (L.fac === 2) R(3, 5, 2, 1, hc); else if (L.fac === 3) R(2, 4, 4, 1, hc);
    if (L.acc === 1) R(1, 1, 6, 1, band);
    if (L.acc === 2) { R(1, 2, 6, 1, '#2a2a2a'); R(2, 2, 1, 1, '#8fc8e8'); R(5, 2, 1, 1, '#8fc8e8'); }
    else for (const ex of [2, 5]) { R(ex, 2, 1, 1, '#ffffff'); g.fillStyle = '#1b1209'; g.fillRect(ox + ex * sc + Math.floor(sc / 3), oy + 2 * sc + Math.floor(sc / 3), Math.ceil(sc / 2), Math.ceil(sc * 2 / 3)); }
    R(3, 4, 2, 1, shade(sk, -0.3));
  }

  /* ---------- finishing passes ---------- */
  // Light from the upper left, shadow on the right edge of every shape. Run on a sprite before outlining.
  function edgeShade(c) {
    const g = c.getContext('2d'), W = c.width, H = c.height, id = g.getImageData(0, 0, W, H), d = id.data, src = new Uint8ClampedArray(d);
    const mul = (i, f) => { d[i] = clamp(Math.round(d[i] * f), 0, 255); d[i + 1] = clamp(Math.round(d[i + 1] * f), 0, 255); d[i + 2] = clamp(Math.round(d[i + 2] * f), 0, 255); };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (!src[i + 3]) continue;
      const r1 = !(x + 1 < W && src[i + 7]), r2 = !(x + 2 < W && src[i + 11]), l1 = !(x > 0 && src[i - 1]), t1 = !(y > 0 && src[i - W * 4 + 3]);
      if (r1) mul(i, 0.72); else if (r2) mul(i, 0.86); else if (l1 || t1) mul(i, 1.14); }
    g.putImageData(id, 0, 0); return c;
  }
  // 1-pixel dark outline around everything drawn on the canvas. Returns a new canvas.
  function outlined(c, col) {
    const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data, out = mk(W, H), oc = out.getContext('2d');
    oc.fillStyle = col || 'rgba(20,14,10,.85)';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (d[(y * W + x) * 4 + 3]) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const X = x + a, Y = y + b; return X >= 0 && Y >= 0 && X < W && Y < H && d[(Y * W + X) * 4 + 3]; })) oc.fillRect(x, y, 1, 1); }
    oc.drawImage(c, 0, 0); return out;
  }
  const flipped = c => { const f = mk(c.width, c.height), fc = f.getContext('2d'); fc.translate(c.width, 0); fc.scale(-1, 1); fc.drawImage(c, 0, 0); return f; };

  // Head-and-shoulders portrait (30x34; show it at 2-3x with CSS image-rendering: pixelated). helmet: optional {shell, stripe, mask}.
  function portrait(lk, jersey, trim, helmet) {
    const c = mk(30, 34), g = c.getContext('2d'), R = (x, y, a, b, col) => { g.fillStyle = col; g.fillRect(x, y, a, b); };
    R(3, 26, 24, 8, jersey); R(3, 26, 24, 1, trim); R(11, 26, 8, 3, lk.sk); R(12, 29, 6, 1, trim); R(13, 23, 4, 4, lk.sk);
    if (helmet) { R(4, 4, 22, 20, helmet.shell); R(13, 4, 4, 9, helmet.stripe || '#fff'); R(7, 10, 16, 14, lk.sk); frontHead(g, 3, 9, 3, Object.assign({}, lk, { L: Object.assign({}, lk.L, { hair: 3 }) }), trim);
      R(7, 16, 16, 2, helmet.mask || '#9aa0a8'); R(7, 20, 16, 2, helmet.mask || '#9aa0a8'); R(14, 16, 2, 8, helmet.mask || '#9aa0a8'); }
    else frontHead(g, 3, 9, 3, lk, trim);
    return outlined(c);
  }

  /* ---------- stands ---------- */
  // One fan, 5 wide x 8 tall: shirt in a team color sometimes, a raised arm now and then. rnd() returns 0-1 (use a seeded one).
  function fan(g, x, y, rnd, colors, back) {
    const R = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(a), Math.round(b), w, h); };
    const sk = SKIN[Math.floor(rnd() * SKIN.length)], hc = HAIRC[Math.floor(rnd() * 5)], shirt = rnd() < 0.35 ? colors[0] : rnd() < 0.3 ? colors[1] : ['#d9d4c7', '#3d4a6b', '#7a3b3b', '#4b6b3d', '#2c2c34', '#9a8a5a'][Math.floor(rnd() * 6)];
    R(x, y + 4, 5, 4, shirt); R(x + 1, y, 3, 4, sk); R(x + 1, y, 3, back ? 3 : 1, hc); if (rnd() < 0.15) R(x - 1, y + 3 - Math.floor(rnd() * 3), 1, 3, sk);
  }
  // Fill a rectangle with rows of fans. colors = [team primary, team secondary]. seed keeps the crowd the same every game.
  function buildStands(g, x0, y0, w, h, colors, seed, back) {
    let s = seed || 1; const rnd = () => hash(s++);
    for (let row = 0; row * 8 < h; row++) { const y = y0 + row * 8; g.fillStyle = '#262a3d'; g.fillRect(x0, y + 8, w, 1); for (let x = x0 + 2 + (row % 2) * 3; x < x0 + w - 4; x += 6 + Math.floor(rnd() * 2)) if (rnd() < 0.93) fan(g, x, y, rnd, colors, back); }
  }

  /* ---------- LED scoreboard ---------- */
  // s = { home: {abbr, pri, sec, score}, away: {...}, clock: '12:00', line: 'QTR' or '3RD', small: '24' or '3RD & 7', smallRed: bool }
  // z = 1 for a board pinned to the top of the screen, 2 for a big board hung in the stadium. Returns {w, h}.
  function scoreboard(px, x0, y0, z, s) {
    const wTeam = 26 * z, wScore = microW('188', 2 * z) + 4 * z, wMid = Math.max(microW(s.clock, 2 * z), 8 * z + 3 + microW(s.small || '', z)) + 8 * z;
    const W2 = wTeam * 2 + wScore * 2 + wMid + 6 * z, H2 = 20 * z, pad = 2 * z;
    px.fillStyle = '#0b0c12'; px.fillRect(x0 - 2, y0 - 2, W2 + 4, H2 + 4);
    px.fillStyle = '#3d8bff'; px.fillRect(x0 - 1, y0 - 1, W2 + 2, 1); px.fillRect(x0 - 1, y0 + H2, W2 + 2, 1); px.fillRect(x0 - 1, y0, 1, H2); px.fillRect(x0 + W2, y0, 1, H2);
    px.fillStyle = '#1c1f2e'; px.fillRect(x0, y0, W2, H2);
    const team = (T, x) => { px.fillStyle = T.pri; px.fillRect(x, y0 + 2 * z, wTeam, H2 - 4 * z); px.fillStyle = T.sec; px.fillRect(x, y0 + H2 - 3 * z, wTeam, z); pixText(px, T.abbr, x + wTeam / 2, y0 + H2 / 2 - z, Math.round(10 * z), '#ffffff', 0, '#0b0c12'); };
    team(s.home, x0 + pad);
    micro(px, s.home.score, x0 + pad + wTeam + Math.round((wScore - microW(s.home.score, 2 * z)) / 2), y0 + 5 * z, 2 * z, '#ffffff');
    const mx = x0 + pad + wTeam + wScore; px.fillStyle = '#0b0c12'; px.fillRect(mx, y0 + z, wMid, H2 - 2 * z);
    micro(px, s.clock, mx + Math.round((wMid - microW(s.clock, 2 * z)) / 2), y0 + 2 * z, 2 * z, '#ffb347');
    if (s.line) pixText(px, s.line, mx + 3 * z + 7 * z, y0 + 15 * z, Math.round(7 * z), '#c9cbd6');
    if (s.small) micro(px, s.small, mx + wMid - 3 * z - microW(s.small, z), y0 + 13 * z, z, s.smallRed ? '#ff5a4a' : '#ff8a7a');
    micro(px, s.away.score, mx + wMid + Math.round((wScore - microW(s.away.score, 2 * z)) / 2), y0 + 5 * z, 2 * z, '#ffffff');
    team(s.away, mx + wMid + wScore);
    return { w: W2, h: H2 };
  }

  /* ---------- CSS for the overlays ---------- */
  const CSS = `
.arc-pad { position: absolute; right: max(18px, env(safe-area-inset-right)); bottom: max(26px, env(safe-area-inset-bottom)); width: 230px; height: 230px; pointer-events: none; }
.arc-pad .pb { position: absolute; width: 86px; height: 86px; border-radius: 50%; pointer-events: auto; background: rgba(255,255,255,.08); border: 3px dashed rgba(255,255,255,.55); color: rgba(255,255,255,.85); font: 800 17px/1 system-ui, -apple-system, sans-serif; text-shadow: 0 2px 0 rgba(0,0,0,.45); touch-action: none; }
.arc-pad .pb.top { left: 72px; top: 0; } .arc-pad .pb.left { left: 0; top: 72px; } .arc-pad .pb.right { right: 0; top: 72px; } .arc-pad .pb.bottom { left: 72px; bottom: 0; }
.arc-pad .pb.on { background: rgba(255,255,255,.3); transform: scale(.94); }
.arc-card { position: absolute; left: 50%; transform: translateX(-50%); bottom: max(12px, env(safe-area-inset-bottom)); min-width: 200px; background: #0f3f8f; border: 3px solid #36a3ff; box-shadow: 0 0 0 3px #08214d; padding: 6px 10px; font-family: system-ui, -apple-system, sans-serif; color: #fff; pointer-events: none; }
.arc-card .nm { font-weight: 700; font-size: 14px; } .arc-card .en { height: 4px; background: rgba(0,0,0,.4); margin: 4px 0 5px; } .arc-card .en i { display: block; height: 100%; }
.arc-card .rt { display: flex; gap: 14px; justify-content: space-between; } .arc-card .rt div { text-align: center; font-weight: 700; font-size: 14px; } .arc-card .rt b { display: block; font-size: 11px; color: #cfe6ff; }
.arc-tip { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(max(12px, env(safe-area-inset-bottom)) + 92px); max-width: min(520px, 46vw); background: #0f3f8f; border: 3px solid #36a3ff; box-shadow: 0 0 0 3px #08214d; padding: 8px 14px; text-align: center; color: #fff; font: 600 14px/1.35 system-ui, sans-serif; opacity: 0; transition: opacity .3s; pointer-events: none; }
.arc-tip.on { opacity: 1; }
.arc-pause { position: absolute; right: max(14px, env(safe-area-inset-right)); top: max(10px, env(safe-area-inset-top)); width: 44px; height: 40px; background: #0f3f8f; border: 3px solid #36a3ff; color: #fff; font: 900 16px/1 system-ui, sans-serif; }
.arc-menu { position: absolute; inset: max(8px, env(safe-area-inset-top)) 8px max(8px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 8px; pointer-events: auto; font-family: system-ui, sans-serif; color: #fff; z-index: 5; }
.arc-menu .mh { background: #120f1c; border: 3px solid #36a3ff; font: 900 26px/1 "Courier New", monospace; letter-spacing: 6px; text-align: center; padding: 8px; }
.arc-menu .mb { flex: 1; min-height: 0; display: flex; gap: 10px; background: #1150a8; border: 3px solid #36a3ff; box-shadow: 0 0 0 3px #08214d; padding: 10px; }
.arc-menu .tabs { display: flex; flex-direction: column; gap: 8px; width: 170px; flex: none; }
.arc-menu button { background: #1659b8; border: 3px solid #2b7fe0; color: #fff; font: 800 15px/1.1 system-ui, sans-serif; padding: 12px 10px; }
.arc-menu .tabs button.on { border-color: #6ff3ff; background: #1a64cc; }
.arc-menu .pane { flex: 1; min-width: 0; overflow: auto; -webkit-overflow-scrolling: touch; }
.arc-menu table { width: 100%; border-collapse: separate; border-spacing: 0 3px; font-size: 13px; } .arc-menu td, .arc-menu th { padding: 6px 7px; background: #1557b4; text-align: left; white-space: nowrap; }
.arc-menu tr.h th { background: #0a2a66; } .arc-menu td.hi { color: #ffd34d; font-weight: 800; }
.arc-menu .mf { display: flex; justify-content: space-between; } .arc-menu .mf button { min-width: 130px; } .arc-menu .mf .go { background: #1a8f4a; border-color: #4ade80; }
.arc-match { position: absolute; inset: 0; z-index: 6; pointer-events: auto; background: rgba(8,10,22,.88); display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 10px 14px 12px; overflow: auto; font-family: system-ui, sans-serif; color: #fff; }
.arc-match .mh { width: min(1000px, 100%); background: #120f1c; border: 3px solid #36a3ff; box-shadow: 0 0 0 3px #08214d; font: 900 clamp(18px, 3.4vw, 30px)/1 "Courier New", monospace; letter-spacing: .3em; text-align: center; padding: 10px; }
.arc-match .sides { display: flex; gap: 14px; width: min(1000px, 100%); } .arc-match .five { flex: 1; display: flex; gap: 4px; background: #0b0d1e; border: 3px solid #36a3ff; padding: 8px 4px; }
.arc-match .pc { flex: 1; min-width: 0; text-align: center; } .arc-match .pc img { width: 100%; max-width: 84px; image-rendering: pixelated; display: block; margin: 0 auto -2px; }
.arc-match .pc .st i { font-style: normal; color: #3b3f58; } .arc-match .pc .st i.f { color: #ffc93c; }
.arc-match .pc b { display: block; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .arc-match .pc span { font-size: 11px; color: #b9c6e8; font-weight: 700; }
.arc-match .banner { position: relative; width: min(1000px, 100%); display: flex; border: 3px solid #36a3ff; } .arc-match .banner .tm { flex: 1; padding: 10px 16px 22px; display: flex; flex-direction: column; font: 900 clamp(16px, 2.8vw, 26px)/1.1 "Courier New", monospace; letter-spacing: .12em; }
.arc-match .banner .tm.r { text-align: right; } .arc-match .banner .vs { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -60%); font: 900 clamp(22px, 4vw, 38px)/1 "Courier New", monospace; }
.arc-match .kits { width: min(1000px, 100%); display: flex; flex-wrap: wrap; gap: 8px; align-items: center; } .arc-match .kits button { background: #1659b8; border: 3px solid #2b7fe0; color: #fff; font: 800 14px/1 system-ui, sans-serif; padding: 9px 12px; }
.arc-match .kits button.on { border-color: #6ff3ff; } .arc-match .kits .go { margin-left: auto; background: #1a8f4a; border-color: #4ade80; padding: 12px 22px; font-size: 16px; }`;
  function injectCSS() { if (typeof document === 'undefined' || document.getElementById('pk-css')) return; const st = document.createElement('style'); st.id = 'pk-css'; st.textContent = CSS; document.head.appendChild(st); }

  const PK = { clamp, hash, shade, MF, micro, microW, pixText, SKIN, HAIRC, LOOKS, lookOf, toonHead, helmetHead, frontHead, faceDetail, edgeShade, outlined, flipped, portrait, fan, buildStands, scoreboard, CSS, injectCSS };
  if (typeof window !== 'undefined') window.PK = PK;
  if (typeof module !== 'undefined') module.exports = PK;
})();
