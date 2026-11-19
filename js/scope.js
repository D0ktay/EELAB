(function (root) {
  'use strict';
  const DIVS = [];
  for (let e = -6; e <= 0; e++) for (const m of [1, 2, 5]) if (m * Math.pow(10, e) <= 1) DIVS.push(+(m * Math.pow(10, e)).toPrecision(1));
  const OSCC = ['#f5e536', '#38b6ff', '#ff4b4b', '#3fe05a'], LAC = '#3ee06a', PRC = '#ff9f43';
  const GUT = 150, AXIS = 18, PRE = 0.2;

  function num(v, p) {
    let s = (+v).toPrecision(p || 3);
    if (s.indexOf('e') < 0 && s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }
  function fmtTime(sec) {
    if (sec == null || !isFinite(sec)) return '—';
    const a = Math.abs(sec), sg = sec < 0 ? '-' : '';
    if (a === 0) return '0 s';
    if (a >= 1) return sg + num(a) + ' s';
    if (a >= 1e-3) return sg + num(a * 1e3) + ' ms';
    if (a >= 1e-6) return sg + num(a * 1e6) + ' µs';
    return sg + num(a * 1e9) + ' ns';
  }
  function fmtFreq(hz) {
    if (hz == null || !isFinite(hz) || hz <= 0) return '—';
    if (hz >= 1e6) return num(hz / 1e6) + ' MHz';
    if (hz >= 1e3) return num(hz / 1e3) + ' kHz';
    return num(hz) + ' Hz';
  }
  function niceDiv(sec) { for (const d of DIVS) if (d >= sec * 0.999) return d; return DIVS[DIVS.length - 1]; }

  function measure(d, t0, t1) {
    const t = d.t, v = d.v, n = t.length;
    if (t0 == null) t0 = n ? t[0] : 0;
    if (t1 == null) t1 = Infinity;
    const rises = [], falls = [], edges = [];
    let prev = n ? v[0] : 2;
    for (let j = 1; j < n; j++) {
      if (t[j] > t1) break;
      if (t[j] < t0) { prev = v[j]; continue; }
      const x = v[j];
      if (x === 1 && prev !== 1) rises.push(t[j]);
      else if (x === 0 && prev !== 0) falls.push(t[j]);
      edges.push(t[j]);
      prev = x;
    }
    let minPulse = null;
    for (let k = 1; k < edges.length; k++) { const dt = edges[k] - edges[k - 1]; if (dt > 0 && (minPulse == null || dt < minPulse)) minPulse = dt; }
    const out = { rises: rises.length, falls: falls.length, edges: edges.length, period: null, high: null, low: null, duty: null, minPulse };
    if (rises.length >= 2) {
      const span = rises[rises.length - 1] - rises[0], cnt = rises.length - 1;
      let hi = 0, fi = 0;
      for (let k = 0; k < cnt; k++) {
        const r0 = rises[k], r1 = rises[k + 1];
        while (fi < falls.length && falls[fi] <= r0) fi++;
        hi += fi < falls.length && falls[fi] < r1 ? falls[fi] - r0 : r1 - r0;
      }
      out.period = span / cnt; out.high = hi / cnt; out.low = out.period - out.high; out.duty = span ? hi / span : null;
    }
    return out;
  }

  function findTrigger(d, edge, tMin, tMax) {
    const t = d.t, v = d.v;
    for (let j = t.length - 1; j >= 1; j--) {
      if (t[j] > tMax) continue;
      if (t[j] <= tMin) break;
      const a = v[j - 1], b = v[j];
      if (edge === 'fall' ? (b === 0 && a !== 0) : edge === 'any' ? a !== b : (b === 1 && a !== 1)) return t[j];
    }
    return null;
  }

  function csv(rec, idx, t0, t1, fosc) {
    const cps = (fosc || 4e6) / 4, lv = x => x === 0 ? '0' : x === 1 ? '1' : 'Z';
    idx = idx || rec.channels.map((_, i) => i);
    const ds = idx.map(i => rec.read(i, t0, t1)), pos = ds.map(() => 0), cur = ds.map(d => d.v.length ? d.v[0] : 2);
    const head = ['time_s', 'cycle'].concat(idx.map(i => '"' + String(rec.channels[i].label || rec.channels[i].id).replace(/"/g, '""') + '"'));
    const rows = [head.join(',')];
    const times = new Set();
    for (const d of ds) for (let j = 0; j < d.t.length; j++) times.add(d.t[j]);
    const ts = Array.from(times).sort((a, b) => a - b);
    for (const tt of ts) {
      for (let k = 0; k < ds.length; k++) { const d = ds[k]; while (pos[k] < d.t.length && d.t[pos[k]] <= tt) { cur[k] = d.v[pos[k]]; pos[k]++; } }
      rows.push([(tt / cps).toPrecision(9).replace(/\.?0+$/, ''), String(tt)].concat(cur.map(lv)).join(','));
    }
    return rows.join('\n') + '\n';
  }

  const CSS = '.eelab-scope{font:11px "Segoe UI",Tahoma,-apple-system,sans-serif;color:#e4e4e4;background:#3a3a3a;border-top:2px solid #1f1f1f;display:flex;flex-direction:column;min-height:0}' +
    '.eelab-scope .sc-title{display:flex;align-items:center;gap:6px;padding:2px 8px;background:linear-gradient(#fdfdfd,#e3e3e3);color:#1a1a1a;font-weight:600;border-bottom:1px solid #8a8a8a}' +
    '.eelab-scope .sc-title i{width:12px;height:9px;border:1px solid #333;background:linear-gradient(#000 0 0) 50% 60%/100% 1px no-repeat,#0e0e0e;box-shadow:inset 0 0 0 1px #5a5a5a}' +
    '.eelab-scope .sc-bar{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:flex-end;padding:2px 6px 5px;background:#4a4a4a;border-bottom:1px solid #1f1f1f}' +
    '.eelab-scope fieldset{display:flex;gap:4px;align-items:center;margin:0;padding:1px 6px 4px;border:1px solid #6d6d6d;border-radius:3px}' +
    '.eelab-scope legend{padding:0 3px;color:#f0d34a;font-size:10px;font-weight:600;letter-spacing:.3px;text-transform:uppercase}' +
    '.eelab-scope button,.eelab-scope select{font:11px "Segoe UI",Tahoma,-apple-system,sans-serif;background:linear-gradient(#6a6a6a,#555);color:#f2f2f2;border:1px solid #2a2a2a;border-radius:2px;padding:1px 6px;height:20px;cursor:pointer}' +
    '.eelab-scope select{background:#2b2b2b}.eelab-scope button:hover{background:#727272}.eelab-scope button.on{background:#c9a31d;color:#111;border-color:#7a6210}' +
    '.eelab-scope .sc-cv{display:block;width:100%;cursor:crosshair;touch-action:none}' +
    '.eelab-scope .sc-info{padding:3px 8px;background:#2a2a2a;color:#d6d6d6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-top:1px solid #111;font-variant-numeric:tabular-nums}' +
    '.eelab-scope .sc-info i{font-style:normal;color:#f5e536}';

  function create(o) {
    o = o || {};
    const mount = o.mount;
    const nop = { frame() { }, reset() { }, destroy() { } };
    if (!mount || typeof document === 'undefined') return nop;
    if (!document.getElementById('eelab-scope-css')) { const st = document.createElement('style'); st.id = 'eelab-scope-css'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); }
    const S = { running: true, tdiv: 1e-3, trig: { id: '', edge: 'rise', mode: 'auto' }, lastTrig: null, searchFrom: -Infinity, armAt: 0, holdEnd: null,
      cur: { on: false, a: null, b: null }, hidden: new Set(), sig: '', win: null, lanes: [], chans: [], status: '' };
    let ui = null, drag = null;
    mount.hidden = true;

    const runner = () => { try { return o.getRunner ? o.getRunner() : null; } catch (e) { return null; } };
    const fosc = r => (o.getFosc && +o.getFosc()) || (r && r.fosc) || 4e6;
    const nowOf = r => { const c = o.getCyc ? +o.getCyc() : NaN; return isFinite(c) ? c : r ? r.lastCyc || 0 : 0; };
    const colorOf = c => c.kind === 'osc' ? OSCC['ABCD'.indexOf(c.pin)] || OSCC[0] : c.kind === 'probe' ? PRC : LAC;

    function build(chans) {
      mount.innerHTML = '';
      const box = document.createElement('div');
      box.className = 'eelab-scope';
      const tdOpts = DIVS.map(d => '<option value="' + d + '"' + (d === S.tdiv ? ' selected' : '') + '>' + fmtTime(d) + '/div</option>').join('');
      const chOpts = '<option value="">No trigger</option>' + chans.map(c => '<option value="' + esc(c.id) + '"' + (c.id === S.trig.id ? ' selected' : '') + '>' + esc(c.label) + '</option>').join('');
      box.innerHTML = '<div class="sc-title"><i></i>Digital Oscilloscope / Logic Analyser</div><div class="sc-bar">' +
        '<fieldset><legend>Horizontal</legend><button data-a="run" title="Hold / resume the display"></button>' +
        '<select data-a="tdiv" title="Time/div (mouse wheel over the screen also works)">' + tdOpts + '</select>' +
        '<button data-a="auto" title="Fit the time base to the signal">Auto Setup</button></fieldset>' +
        '<fieldset><legend>Trigger</legend><select data-a="tch" title="Trigger source">' + chOpts + '</select>' +
        '<select data-a="tedge" title="Trigger edge"><option value="rise">↑ Rising</option><option value="fall">↓ Falling</option><option value="any">↕ Both</option></select>' +
        '<select data-a="tmode" title="Trigger mode"><option value="auto">Auto</option><option value="normal">Normal</option><option value="single">One-Shot</option></select></fieldset>' +
        '<fieldset><legend>Measure</legend><button data-a="cur" title="Two cursors: click = place, drag = move, right-click = clear">Cursors</button>' +
        '<button data-a="csv" title="Save the visible range as CSV">CSV</button>' +
        '<button data-a="clear" title="Clear the recording">Clear</button></fieldset></div>' +
        '<canvas class="sc-cv"></canvas><div class="sc-info"></div>';
      mount.appendChild(box);
      const q = s => box.querySelector(s);
      ui = { box, cv: q('canvas'), info: q('.sc-info'), run: q('[data-a=run]'), tdiv: q('[data-a=tdiv]'), tch: q('[data-a=tch]'), tedge: q('[data-a=tedge]'), tmode: q('[data-a=tmode]'), curb: q('[data-a=cur]') };
      ui.tedge.value = S.trig.edge; ui.tmode.value = S.trig.mode;
      ui.tdiv.onchange = () => setDiv(+ui.tdiv.value);
      ui.tch.onchange = () => { S.trig.id = ui.tch.value; rearm(); };
      ui.tedge.onchange = () => { S.trig.edge = ui.tedge.value; rearm(); };
      ui.tmode.onchange = () => { S.trig.mode = ui.tmode.value; rearm(); S.running = true; S.holdEnd = null; };
      box.querySelector('.sc-bar').addEventListener('click', e => {
        const a = e.target && e.target.getAttribute && e.target.getAttribute('data-a');
        if (a === 'run') { const r = runner(); if (S.running) { S.running = false; S.holdEnd = S.win ? S.win[1] : nowOf(r); } else { S.running = true; S.holdEnd = null; rearm(); } }
        else if (a === 'cur') { S.cur.on = !S.cur.on; if (!S.cur.on) { S.cur.a = S.cur.b = null; } }
        else if (a === 'auto') autoset();
        else if (a === 'csv') exportCsv();
        else if (a === 'clear') { const r = runner(); if (r && r.rec) r.rec.clear(); rearm(); S.cur.a = S.cur.b = null; }
        S.dirty = true;
      });
      box.addEventListener('keydown', e => e.stopPropagation());
      ui.cv.addEventListener('pointerdown', down);
      ui.cv.addEventListener('pointermove', move);
      ui.cv.addEventListener('pointerup', up);
      ui.cv.addEventListener('pointercancel', () => { drag = null; });
      ui.cv.addEventListener('wheel', wheel, { passive: false });
      ui.cv.addEventListener('contextmenu', ctx);
      ui.cv.addEventListener('dblclick', e => { const ln = laneAt(e); if (ln && pos(e)[0] < GUT) { e.preventDefault(); } });
    }
    function esc(s) { return String(s).replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x])); }
    function rearm() { S.lastTrig = null; S.searchFrom = -Infinity; const r = runner(); S.armAt = r ? nowOf(r) : 0; if (S.trig.mode !== 'single') S.armAt = -Infinity; }
    function setDiv(d) {
      if (S.win && !S.running) { const c = (S.win[0] + S.win[1]) / 2, cps = fosc(runner()) / 4, W = 10 * d * cps; S.holdEnd = c + W / 2; }
      S.tdiv = d; if (ui) ui.tdiv.value = String(d); S.dirty = true;
    }
    function pos(e) { const b = ui.cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; }
    function laneAt(e) { const y = pos(e)[1]; return S.lanes.find(l => y >= l.y && y < l.y + l.h) || null; }
    function xToT(x) { const w = S.pw || 1; return S.win[0] + (x - GUT) / w * (S.win[1] - S.win[0]); }
    function tToX(t) { return GUT + (t - S.win[0]) / (S.win[1] - S.win[0]) * (S.pw || 1); }
    function snap(t, lane) {
      const r = runner(); if (!r || !lane || !S.win) return t;
      const tol = 6 / (S.pw || 1) * (S.win[1] - S.win[0]);
      const d = r.rec.read(lane.i, t - tol, t + tol);
      let best = t, bd = tol;
      for (let j = 1; j < d.t.length; j++) { const dd = Math.abs(d.t[j] - t); if (dd <= bd) { bd = dd; best = d.t[j]; } }
      return best;
    }
    function down(e) {
      if (!S.win || e.button !== 0) return;
      const [x] = pos(e);
      if (x < GUT) { const ln = laneAt(e); if (ln) { if (S.hidden.has(ln.c.id)) S.hidden.delete(ln.c.id); else S.hidden.add(ln.c.id); S.dirty = true; } return; }
      ui.cv.setPointerCapture(e.pointerId);
      let which = null;
      if (S.cur.on) for (const k of ['a', 'b']) if (S.cur[k] != null && Math.abs(tToX(S.cur[k]) - x) < 6) which = k;
      drag = { x0: x, which, moved: false, end0: S.win[1], lane: laneAt(e) };
    }
    function move(e) {
      if (!drag) return;
      const [x] = pos(e);
      if (!drag.moved && Math.abs(x - drag.x0) < 3) return;
      drag.moved = true;
      if (drag.which) { S.cur[drag.which] = snap(xToT(x), drag.lane); S.dirty = true; return; }
      const dt = (x - drag.x0) / (S.pw || 1) * (S.win[1] - S.win[0]);
      S.running = false; S.holdEnd = drag.end0 - dt; S.dirty = true;
    }
    function up(e) {
      const d = drag; drag = null;
      if (!d || d.moved || d.which || !S.cur.on) return;
      const t = snap(xToT(pos(e)[0]), d.lane);
      if (S.cur.a == null) S.cur.a = t;
      else if (S.cur.b == null) S.cur.b = t;
      else if (Math.abs(t - S.cur.a) < Math.abs(t - S.cur.b)) S.cur.a = t; else S.cur.b = t;
      S.dirty = true;
    }
    function wheel(e) {
      if (!S.win) return;
      e.preventDefault();
      const i = DIVS.indexOf(S.tdiv), j = Math.max(0, Math.min(DIVS.length - 1, i + (e.deltaY > 0 ? 1 : -1)));
      if (j === i) return;
      const x = pos(e)[0], f = Math.max(0, Math.min(1, (x - GUT) / (S.pw || 1))), tm = xToT(x), cps = fosc(runner()) / 4, W = 10 * DIVS[j] * cps;
      if (!S.running) S.holdEnd = tm + (1 - f) * W;
      S.tdiv = DIVS[j]; ui.tdiv.value = String(DIVS[j]); S.dirty = true;
    }
    function ctx(e) {
      const ln = laneAt(e), r = runner();
      if (ln && pos(e)[0] < GUT && ln.c.probe && r && r.unprobe) { e.preventDefault(); r.unprobe(ln.c.id); }
      else if (S.cur.on) { e.preventDefault(); S.cur.a = S.cur.b = null; S.dirty = true; }
    }
    function autoset() {
      const r = runner(); if (!r) return;
      const ch = r.rec.channels, now = nowOf(r), cps = fosc(r) / 4;
      let pick = -1, best = null;
      const order = ch.map((c, i) => i).sort((a, b) => (ch[a].kind === 'osc' ? 0 : 1) - (ch[b].kind === 'osc' ? 0 : 1) || a - b);
      const ti = ch.findIndex(c => c.id === S.trig.id);
      if (ti >= 0) order.unshift(ti);
      for (const i of order) { const m = measure(r.rec.read(i, now - 4e6, now)); if (m.period) { pick = i; best = m; break; } if (!best && m.minPulse) best = m; }
      let d = 1e-3;
      if (best && best.period) d = niceDiv(best.period * 3 / 10 / cps);
      else if (best && best.minPulse) d = niceDiv(best.minPulse * 12 / 10 / cps);
      S.tdiv = d; if (ui) ui.tdiv.value = String(d);
      if (pick >= 0) { S.trig.id = ch[pick].id; S.trig.edge = 'rise'; if (ui) { ui.tch.value = S.trig.id; ui.tedge.value = 'rise'; } }
      S.running = true; S.holdEnd = null; rearm();
    }
    function exportCsv() {
      const r = runner(); if (!r || !S.win) return;
      const idx = r.rec.channels.map((c, i) => i).filter(i => !S.hidden.has(r.rec.channels[i].id));
      const t1 = Math.min(S.win[1], nowOf(r));
      const text = csv(r.rec, idx, Math.max(0, S.win[0]), t1, fosc(r));
      if (o.save) o.save('olcum', 'csv', text);
    }

    function frame() {
      const r = runner();
      if (!r || !r.rec || !r.rec.channels.length) { if (!mount.hidden) mount.hidden = true; return; }
      if (mount.hidden) mount.hidden = false;
      const chans = r.rec.channels, sig = chans.map(c => c.id + '=' + c.label).join('|');
      if (sig !== S.sig || !ui || !ui.box.isConnected) { S.sig = sig; build(chans); }
      S.chans = chans;
      const F = fosc(r), cps = F / 4, now = nowOf(r), W = 10 * S.tdiv * cps;
      let t0, t1, status;
      const ti = chans.findIndex(c => c.id === S.trig.id);
      if (!S.running && S.holdEnd != null) { t1 = S.holdEnd; t0 = t1 - W; status = S.trig.mode === 'single' && S.lastTrig != null ? 'One-shot: triggered' : 'Held'; }
      else if (ti >= 0) {
        S.running = true; S.trigd = false;
        const upto = now - W * (1 - PRE), from = Math.max(S.searchFrom, S.armAt, upto - Math.max(W * 50, 4e6));
        if (upto > from) {
          const te = findTrigger(r.rec.read(ti, from, upto), S.trig.edge, from, upto);
          S.searchFrom = upto;
          if (te != null) S.lastTrig = te;
        }
        if (S.lastTrig != null && (S.trig.mode !== 'auto' || now - S.lastTrig <= W * 3)) {
          t0 = S.lastTrig - W * PRE; t1 = t0 + W; status = 'Triggered'; S.trigd = true;
          if (S.trig.mode === 'single') { S.running = false; S.holdEnd = t1; status = 'One-shot: triggered'; }
        } else { t1 = now; t0 = now - W; status = S.trig.mode === 'auto' ? 'Auto (no trigger)' : 'Waiting for trigger…'; }
      } else { S.running = true; S.trigd = false; t1 = now; t0 = now - W; status = 'Free running'; }
      S.win = [t0, t1]; S.status = status;
      if (ui) ui.run.textContent = S.running ? '⏸ Hold' : '▶ Run';
      if (ui) ui.curb.classList.toggle('on', S.cur.on);
      draw(r, now, cps);
    }

    function draw(r, now, cps) {
      const cv = ui.cv, chans = S.chans;
      const cssW = cv.clientWidth || (mount.clientWidth || 600);
      if (!cssW) return;
      S.lanes = [];
      let y = AXIS;
      chans.forEach((c, i) => { const h = S.hidden.has(c.id) ? 14 : c.kind === 'osc' ? 46 : 26; S.lanes.push({ c, i, y, h }); y += h; });
      const cssH = y + 4, dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      if (cv.width !== Math.round(cssW * dpr) || cv.height !== Math.round(cssH * dpr)) { cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); cv.style.height = cssH + 'px'; }
      const g = cv.getContext && cv.getContext('2d');
      const [t0, t1] = S.win, pw = Math.max(10, cssW - GUT - 8);
      S.pw = pw;
      const X = t => GUT + (t - t0) / (t1 - t0) * pw;
      const tEnd = Math.min(t1, now);
      const data = S.lanes.map(l => S.hidden.has(l.c.id) ? null : r.rec.read(l.i, t0, tEnd));
      const meas = data.map(d => d ? measure(d, t0, tEnd) : null);
      if (g) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.fillStyle = '#000'; g.fillRect(0, 0, cssW, cssH);
        g.fillStyle = '#1c1c1c'; g.fillRect(0, 0, GUT, cssH);
        g.font = '10px -apple-system,BlinkMacSystemFont,sans-serif'; g.textBaseline = 'middle';
        const trigOn = S.trigd && S.lastTrig != null;
        const ref = trigOn ? S.lastTrig : null;
        for (let k = 0; k <= 10; k++) {
          const x = GUT + k * pw / 10;
          g.strokeStyle = k === 0 || k === 10 ? '#6a6a6a' : '#3c3c3c'; g.lineWidth = 1;
          if (k % 10 && g.setLineDash) g.setLineDash([1, 3]);
          g.beginPath(); g.moveTo(x + 0.5, AXIS - 3); g.lineTo(x + 0.5, cssH); g.stroke();
          if (g.setLineDash) g.setLineDash([]);
          if (k < 10 && (k % 2 === 0 || pw > 500)) {
            const tt = t0 + k * (t1 - t0) / 10;
            g.fillStyle = '#a8a8a8'; g.textAlign = 'left';
            g.fillText(ref != null ? fmtTime((tt - ref) / cps) : fmtTime(tt / cps), x + 2, 8);
          }
        }
        if (trigOn) { const x = X(S.lastTrig); g.fillStyle = '#ff9f43'; g.beginPath(); g.moveTo(x - 4, AXIS - 6); g.lineTo(x + 4, AXIS - 6); g.lineTo(x, AXIS - 1); g.fill(); }
        S.lanes.forEach((l, li) => {
          const c = l.c, col = colorOf(c), hid = S.hidden.has(c.id);
          g.strokeStyle = '#333'; g.beginPath(); g.moveTo(0, l.y + l.h + 0.5); g.lineTo(cssW, l.y + l.h + 0.5); g.stroke();
          g.fillStyle = hid ? '#5c5c5c' : col; g.fillRect(4, l.y + 4, 4, Math.min(l.h - 8, 18));
          g.textAlign = 'left'; g.fillStyle = hid ? '#6d6d6d' : '#ececec';
          g.fillText(clip(g, c.label, GUT - 16), 12, l.y + (hid ? 7 : 9));
          if (hid) return;
          const m = meas[li];
          if (m) {
            g.fillStyle = '#b4b4b4';
            const s1 = m.period ? fmtFreq(cps / m.period) + '  ' + num(m.duty * 100, 3) + '%' : m.minPulse ? 'min ' + fmtTime(m.minPulse / cps) : m.edges ? m.edges + ' edges' : '';
            if (s1) g.fillText(clip(g, s1, GUT - 16), 12, l.y + 21);
            if (c.kind === 'osc' && m.period) g.fillText(clip(g, 'T ' + fmtTime(m.period / cps) + '  H ' + fmtTime(m.high / cps), GUT - 16), 12, l.y + 33);
          }
          const d = data[li], n = d.t.length;
          if (!n) return;
          const yH = l.y + 5, yL = l.y + l.h - 5, yZ = (yH + yL) / 2, Y = v => v === 1 ? yH : v === 0 ? yL : yZ;
          g.save(); g.beginPath(); g.rect(GUT, l.y, pw, l.h); g.clip();
          g.strokeStyle = col; g.lineWidth = 1.4;
          const bars = [], zs = [];
          let x = X(Math.max(d.t[0], t0)), v = d.v[0], busy = -1;
          g.beginPath(); g.moveTo(x, Y(v));
          for (let j = 1; j <= n; j++) {
            const last = j === n, nx = X(last ? tEnd : d.t[j]);
            if (!last && Math.floor(nx) === Math.floor(x)) {
              if (busy !== Math.floor(nx)) { busy = Math.floor(nx); bars.push(nx); }
              v = d.v[j]; g.moveTo(x, Y(v)); continue;
            }
            if (v === 2) { zs.push(x, nx); g.moveTo(nx, yZ); } else g.lineTo(nx, Y(v));
            if (!last) { v = d.v[j]; g.lineTo(nx, Y(v)); x = nx; }
          }
          for (const bx of bars) { g.moveTo(bx, yH); g.lineTo(bx, yL); }
          g.stroke();
          if (zs.length) { g.setLineDash([3, 3]); g.strokeStyle = '#7d8790'; g.beginPath(); for (let k = 0; k < zs.length; k += 2) { g.moveTo(zs[k], yZ); g.lineTo(zs[k + 1], yZ); } g.stroke(); g.setLineDash([]); }
          g.restore();
        });
        if (now < t1 && now > t0) { const x = X(now); g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(x, AXIS, GUT + pw - x, cssH - AXIS); }
        if (S.cur.on) for (const [k, cc] of [['a', '#ffd84a'], ['b', '#5ad1ff']]) {
          const t = S.cur[k]; if (t == null || t < t0 || t > t1) continue;
          const x = Math.round(X(t)) + 0.5;
          g.save(); g.setLineDash([4, 3]); g.strokeStyle = cc; g.lineWidth = 1; g.beginPath(); g.moveTo(x, AXIS - 2); g.lineTo(x, cssH); g.stroke(); g.restore();
          g.fillStyle = cc; g.textAlign = 'center'; g.fillText(k.toUpperCase(), x, AXIS - 8 < 6 ? 6 : AXIS - 8);
        }
      }
      let info = S.status + ' · ' + fmtTime(S.tdiv) + '/div (' + Math.round(S.tdiv * cps).toLocaleString('en-US') + ' cycles) · Fosc ' + fmtFreq(cps * 4);
      if (S.cur.on) {
        const a = S.cur.a, b = S.cur.b, ra = ref0();
        if (a == null) info += ' · Cursor: click the screen to place A';
        else if (b == null) info += ' · A=' + fmtTime((a - ra) / cps) + ' · click again to place B';
        else { const dt = Math.abs(b - a); info += ' · A=' + fmtTime((a - ra) / cps) + ' B=' + fmtTime((b - ra) / cps) + ' · <i>Δt=' + fmtTime(dt / cps) + ' (' + (Math.round(dt * 10) / 10).toLocaleString('en-US') + ' cycles) · 1/Δt=' + fmtFreq(dt ? cps / dt : 0) + '</i>'; }
      }
      if (ui.info._s !== info) { ui.info._s = info; ui.info.innerHTML = info; }
    }
    function ref0() { return S.trigd && S.lastTrig != null ? S.lastTrig : 0; }
    function clip(g, s, w) { s = String(s); if (!g.measureText || g.measureText(s).width <= w) return s; while (s.length > 1 && g.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; }

    function reset() {
      S.running = true; S.holdEnd = null; S.lastTrig = null; S.searchFrom = -Infinity; S.armAt = -Infinity; S.cur.a = S.cur.b = null; S.win = null; S.sig = '';
      const r = runner(); if (r && r.rec) r.rec.clear();
      mount.hidden = true;
    }
    function destroy() { mount.innerHTML = ''; ui = null; mount.hidden = true; }
    return { frame, reset, destroy, autoset, state: () => ({ running: S.running, tdiv: S.tdiv, trigger: Object.assign({}, S.trig), cursors: { a: S.cur.a, b: S.cur.b }, window: S.win && S.win.slice() }) };
  }

  const SCOPE = { create, measure, findTrigger, csv, fmtTime, fmtFreq, niceDiv, DIVS };
  if (typeof module !== 'undefined' && module.exports) module.exports = SCOPE;
  root.SCOPE = SCOPE;
})(typeof window !== 'undefined' ? window : globalThis);
