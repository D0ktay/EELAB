(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const G = 10, SELC = '#ff0000';
  let WIRE = '#004000', GRIDC = '#bdbdaf', SHEETC = '#0000c0';
  const snap = v => Math.round(v / G) * G;
  const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
  const k2 = v => v[0] + ',' + v[1];
  const clone = x => JSON.parse(JSON.stringify(x));
  const OFF = { on: false, pins: {}, lit: {}, pressed: false };
  const SKIP = new Set(['btn-hit', 'part-hit', 'term-hit', 'mute-hit', 'pot-hit']);

  function outline(LIB, p) {
    const b = LIB.bbox(p);
    let x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
    for (const q of LIB.types[p.type].pins) { const pt = LIB.pinPos(p, q.num); if (pt) { x0 = Math.min(x0, pt[0]); y0 = Math.min(y0, pt[1]); x1 = Math.max(x1, pt[0]); y1 = Math.max(y1, pt[1]); } }
    return [x0, y0, x1, y1];
  }
  function contentBox(c, LIB) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const ext = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const p of c.parts || []) {
      if (!LIB.types[p.type]) continue;
      const b = LIB.bbox(p); ext(b.x, b.y - 14); ext(b.x + b.w, b.y + b.h + 12);
      const o = outline(LIB, p); ext(o[0], o[1]); ext(o[2], o[3]);
    }
    for (const w of c.wires || []) for (const v of w.points || []) ext(v[0], v[1]);
    return isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }

  const escX = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function ser(n, out) {
    if (!n) return;
    if (n.nodeType === 3) { out.push(escX(n.nodeValue)); return; }
    if (n.nodeType === 8) return;
    const tag = n.tag || n.tagName; if (!tag) return;
    const attrs = [];
    if (n.attrs) { for (const k in n.attrs) attrs.push([k, n.attrs[k]]); }
    else if (n.attributes) for (let i = 0; i < n.attributes.length; i++) attrs.push([n.attributes[i].name, n.attributes[i].value]);
    const cls = attrs.find(a => a[0] === 'class');
    if (cls && SKIP.has(cls[1])) return;
    out.push('<' + tag);
    for (const [k, v] of attrs) { if (k === 'style' && /cursor/.test(v)) continue; if (k === 'transform' && v === '') continue; out.push(' ' + k + '="' + escX(v) + '"'); }
    const kids = n.attrs ? n.children : n.childNodes, text = n.attrs ? n.textContent : '';
    if ((!kids || !kids.length) && !text) { out.push('/>'); return; }
    out.push('>');
    if (text) out.push(escX(text));
    if (kids) for (let i = 0; i < kids.length; i++) ser(kids[i], out);
    out.push('</' + tag + '>');
  }
  function colorsFrom(LIB) { const k = LIB && LIB.colors; if (k) { WIRE = k.wire || WIRE; GRIDC = k.grid || GRIDC; SHEETC = k.sheet || SHEETC; } }
  function buildSVG(c, LIB, SIM, opts) {
    opts = opts || {}; colorsFrom(LIB);
    const parts = (c.parts || []).filter(p => LIB.types[p.type]), wires = (c.wires || []).filter(w => w && w.points && w.points.length > 1);
    const b = contentBox({ parts, wires }, LIB) || { x: 0, y: 0, w: 400, h: 300 };
    const m = opts.margin == null ? 20 : +opts.margin, title = opts.title ? String(opts.title) : '';
    const x = Math.floor(b.x - m), y = Math.floor(b.y - m), w = Math.ceil(b.w + 2 * m), h = Math.ceil(b.h + 2 * m + (title ? 14 : 0));
    const out = ['<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="' + w + '" height="' + h + '" viewBox="' + [x, y, w, h].join(' ') + '" font-family="Arial,sans-serif">'];
    if (opts.bg !== false) out.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + escX(typeof opts.bg === 'string' ? opts.bg : '#ffffff') + '"/>');
    out.push('<g fill="none" stroke="' + WIRE + '" stroke-width="1.3" stroke-linejoin="round">');
    for (const wr of wires) out.push('<polyline points="' + wr.points.map(v => v[0] + ',' + v[1]).join(' ') + '"/>');
    out.push('</g>');
    const holder = document.createElementNS(NS, 'g');
    for (const p of parts) { const g = LIB.render(p, holder); if (g.parentNode !== holder) holder.appendChild(g); ser(g, out); }
    if (SIM && SIM.extract) { out.push('<g fill="' + WIRE + '">'); for (const j of SIM.extract({ parts, wires }, LIB).junctions) out.push('<circle cx="' + j[0] + '" cy="' + j[1] + '" r="2.4"/>'); out.push('</g>'); }
    if (title) out.push('<text x="' + (x + m) + '" y="' + (y + h - 6) + '" font-size="9" fill="#444">' + escX(title) + '</text>');
    out.push('</svg>\n');
    return { svg: out.join(''), x, y, w, h };
  }
  function toSVG(c, LIB, SIM, opts) { return buildSVG(c, LIB, SIM, opts).svg; }

  const clampW = (w, f) => Math.max(150 / w, Math.min(8000 / w, f));
  function viewFor(vb, kind, p) {
    p = p || [vb.x + vb.w / 2, vb.y + vb.h / 2];
    if (kind === 'centre') return { x: p[0] - vb.w / 2, y: p[1] - vb.h / 2, w: vb.w, h: vb.h };
    const f = kind === 'in' ? 1 / 1.25 : kind === 'out' ? 1.25 : 1, k = clampW(vb.w, f);
    return { x: p[0] - vb.w * k / 2, y: p[1] - vb.h * k / 2, w: vb.w * k, h: vb.h * k };
  }
  function rectView(vb, r) {
    const asp = vb.w / vb.h, cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2;
    let w = Math.max(1, r[2] - r[0]) * 1.04, h = Math.max(1, r[3] - r[1]) * 1.04;
    if (w / h > asp) h = w / asp; else w = h * asp;
    if (w < 150) { w = 150; h = w / asp; } else if (w > 8000) { w = 8000; h = w / asp; }
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  function create(o) {
    const svg = o.svg, LIB = o.lib, SIM = o.sim;
    colorsFrom(LIB);
    let C = { version: 1, parts: [], wires: [] };
    let run = false, tool = 'select', placeType = null, placeRot = 0, wd = null, drag = null, pan = null, press = null, potDrag = null, band = null, spaceDown = false;
    const selP = new Set(), selW = new Set();
    let undoS = [], redoS = [], vb = { x: 0, y: 0, w: 1080, h: 670 }, gEl = {}, painted = {}, lastState = {}, hover = null, ghostPos = null;
    let clip = null, pasteN = 0, pasteAt = null, track = null, lastPt = null, lastClient = null, diag = false;
    const editCbs = [];

    const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
    svg.innerHTML = '';
    const defs = el('defs', {}, svg);
    const pat = el('pattern', { id: 'edgrid', x: -5, y: -5, width: G, height: G, patternUnits: 'userSpaceOnUse' }, defs);
    const gline = el('path', { d: 'M5 0V10M0 5H10', fill: 'none', stroke: GRIDC, 'stroke-width': 0.5 }, pat);
    const dot = el('rect', { x: 4.6, y: 4.6, width: 0.8, height: 0.8, fill: '#808078' }, pat);
    const gridR = el('rect', { class: 'ed-grid', x: -20000, y: -20000, width: 40000, height: 40000, fill: 'url(#edgrid)' }, svg);
    const gC = el('g', { id: 'ed-content' }, svg);
    const sheet = el('rect', { id: 'ed-sheet', x: 30, y: 20, width: 1030, height: 635, fill: 'none', stroke: SHEETC, 'stroke-width': 1.2 }, gC);
    const gW = el('g', {}, gC), gP = el('g', {}, gC), gJ = el('g', {}, gC), gO = el('g', { 'pointer-events': 'none' }, svg);
    let gridMode = 'lines';
    const setVB = () => {
      svg.setAttribute('viewBox', [vb.x, vb.y, vb.w, vb.h].join(' '));
      const m = svg.getScreenCTM && svg.getScreenCTM(), px = m ? m.a : 1, sz = Math.max(0.8, Math.min(1.6, 1.3 / px));
      dot.setAttribute('x', 5 - sz / 2); dot.setAttribute('y', 5 - sz / 2); dot.setAttribute('width', sz); dot.setAttribute('height', sz);
      gline.setAttribute('stroke-width', Math.max(0.3, 0.9 / px));
      gline.setAttribute('display', gridMode === 'lines' ? 'inline' : 'none'); dot.setAttribute('display', gridMode === 'dots' ? 'inline' : 'none');
      gridR.setAttribute('opacity', gridMode !== 'off' && px * G >= (gridMode === 'lines' ? 6 : 4) ? 1 : 0);
      if (o.onView) o.onView(view());
    };
    const view = () => ({ x: vb.x, y: vb.y, w: vb.w, h: vb.h, sheet: { x: +sheet.getAttribute('x'), y: +sheet.getAttribute('y'), w: +sheet.getAttribute('width'), h: +sheet.getAttribute('height') } });
    setVB();

    const snapshot = () => JSON.stringify({ parts: C.parts, wires: C.wires });
    const restore = s => { const d = JSON.parse(s); C.parts = d.parts; C.wires = d.wires; };
    function commit(before) { undoS.push(before); if (undoS.length > 200) undoS.shift(); redoS = []; changed(); }
    function changed() { draw(); if (o.onChange) o.onChange(); }
    const partById = id => C.parts.find(p => p.id === id);
    const pinsOf = p => { const t = LIB.types[p.type]; return t ? t.pins.map(q => ({ num: q.num, pt: LIB.pinPos(p, q.num) })) : []; };
    const upp = () => { const m = svg.getScreenCTM(); return m ? 1 / m.a : 1; };
    const tol = () => Math.min(9, Math.max(4, 6 * upp()));
    function pt(e) { const m = svg.getScreenCTM(); if (!m) return [0, 0]; const q = svg.createSVGPoint(); q.x = e.clientX; q.y = e.clientY; const r = q.matrixTransform(m.inverse()); return [r.x, r.y]; }
    const clearSel = () => { selP.clear(); selW.clear(); };
    const getRunner = () => o.runner ? o.runner() : (typeof runner !== 'undefined' ? runner : null); // eslint-disable-line no-undef

    function keepSet(skipWire) {
      const k = new Set();
      for (const p of C.parts) for (const q of pinsOf(p)) if (q.pt) k.add(q.pt.join(','));
      C.wires.forEach((w, i) => { if (i !== skipWire) for (const v of w.points) k.add(v[0] + ',' + v[1]); });
      return k;
    }
    function simplify(pts, keep) {
      const a = [];
      for (const p of pts) if (!a.length || !eq(a[a.length - 1], p)) a.push([p[0], p[1]]);
      for (let i = 1; i < a.length - 1;) {
        const p = a[i - 1], q = a[i], r = a[i + 1];
        const col = (p[0] === q[0] && q[0] === r[0]) || (p[1] === q[1] && q[1] === r[1]);
        const back = col && ((q[0] - p[0]) * (r[0] - q[0]) + (q[1] - p[1]) * (r[1] - q[1])) < 0;
        if (col && !back && !(keep && keep.has(q.join(',')))) a.splice(i, 1); else i++;
      }
      return a;
    }
    function lpath(a, b, dg) {
      if (eq(a, b)) return [];
      if (dg || a[0] === b[0] || a[1] === b[1]) return [b];
      return Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? [[b[0], a[1]], b] : [[a[0], b[1]], b];
    }

    function hitPin(p) {
      let best = null, bd = tol();
      for (const part of C.parts) for (const q of pinsOf(part)) {
        if (!q.pt) continue;
        const d = Math.hypot(q.pt[0] - p[0], q.pt[1] - p[1]);
        if (d <= bd) { bd = d; best = { id: part.id, num: q.num, pt: q.pt.slice() }; }
      }
      return best;
    }
    function hitWire(p) {
      let best = null, bd = tol();
      C.wires.forEach((w, wi) => {
        for (let i = 1; i < w.points.length; i++) {
          const a = w.points[i - 1], b = w.points[i], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
          let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0;
          t = Math.max(0, Math.min(1, t));
          const x = a[0] + t * dx, y = a[1] + t * dy, d = Math.hypot(p[0] - x, p[1] - y);
          if (d <= bd) {
            bd = d;
            let s;
            if (dy === 0) s = [Math.max(Math.min(a[0], b[0]), Math.min(Math.max(a[0], b[0]), snap(x))), a[1]];
            else if (dx === 0) s = [a[0], Math.max(Math.min(a[1], b[1]), Math.min(Math.max(a[1], b[1]), snap(y)))];
            else s = t < 0.5 ? a.slice() : b.slice();
            best = { wi, id: w.id, pt: s };
          }
        }
      });
      return best;
    }
    function hitPart(p) {
      for (let i = C.parts.length - 1; i >= 0; i--) {
        const part = C.parts[i]; if (!LIB.types[part.type]) continue;
        const b = LIB.bbox(part);
        if (p[0] >= b.x - 3 && p[0] <= b.x + b.w + 3 && p[1] >= b.y - 3 && p[1] <= b.y + b.h + 3) return part;
      }
      return null;
    }
    function target(p) {
      const pin = hitPin(p); if (pin) return { kind: 'pin', pt: pin.pt };
      const w = hitWire(p); if (w) return { kind: 'wire', pt: w.pt };
      return { kind: 'grid', pt: [snap(p[0]), snap(p[1])] };
    }

    function draw() {
      gW.innerHTML = ''; gP.innerHTML = ''; gJ.innerHTML = ''; gEl = {}; painted = {};
      for (const w of C.wires) el('polyline', { points: w.points.map(p => p.join(',')).join(' '), fill: 'none', stroke: WIRE, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, gW);
      for (const p of C.parts) {
        if (!LIB.types[p.type]) continue;
        let g = LIB.render(p, gP);
        if (g.parentNode !== gP) gP.appendChild(g);
        gEl[p.id] = g;
        const st = run ? (lastState[p.id] || OFF) : OFF;
        LIB.update(g, p, st); painted[p.id] = JSON.stringify(st);
      }
      if (termFocus && gEl[termFocus] && LIB.focus) LIB.focus(gEl[termFocus], true);
      for (const j of SIM.extract(C, LIB).junctions) el('circle', { cx: j[0], cy: j[1], r: 2.4, fill: WIRE }, gJ);
      const b = contentBox(C, LIB);
      let x0 = 30, y0 = 20, x1 = 1060, y1 = 655;
      if (b) { x0 = Math.min(x0, b.x - 20); y0 = Math.min(y0, b.y - 20); x1 = Math.max(x1, b.x + b.w + 20); y1 = Math.max(y1, b.y + b.h + 20); }
      sheet.setAttribute('x', x0); sheet.setAttribute('y', y0); sheet.setAttribute('width', x1 - x0); sheet.setAttribute('height', y1 - y0);
      overlay();
    }

    let lastSel = -1;
    const mark = (q, a) => el('rect', { x: q[0] - 4, y: q[1] - 4, width: 8, height: 8, fill: 'none', stroke: '#e11313', 'stroke-width': 1.2 }, a || gO);
    function overlay() {
      gO.innerHTML = '';
      for (const id in gEl) { const on = selP.has(id); if (gEl[id]._sel !== on) { gEl[id]._sel = on; gEl[id].setAttribute('class', on ? 'part sel' : 'part'); } }
      const nSel = selP.size + selW.size; if (nSel !== lastSel) { lastSel = nSel; if (o.onSelect) o.onSelect(nSel); }
      if (!run && hover && tool === 'select' && !wd && !drag && !band && !pan) {
        const hp = hitPart(hover);
        if (hp && !selP.has(hp.id)) { const q = outline(LIB, hp); el('rect', { x: q[0] - 3, y: q[1] - 3, width: q[2] - q[0] + 6, height: q[3] - q[1] + 6, fill: 'none', stroke: '#404040', 'stroke-width': upp(), 'stroke-dasharray': '3 3' }, gO); }
      }
      for (const id of selP) {
        const p = partById(id);
        if (!p || !LIB.types[p.type]) continue;
        const [x0, y0, x1, y1] = outline(LIB, p);
        el('rect', { x: x0 - 3, y: y0 - 3, width: x1 - x0 + 6, height: y1 - y0 + 6, fill: 'none', stroke: SELC, 'stroke-width': upp(), 'stroke-dasharray': '2 3', opacity: 0.55 }, gO);
      }
      for (const id of selW) {
        const w = C.wires.find(x => x.id === id);
        if (w) el('polyline', { points: w.points.map(p => p.join(',')).join(' '), fill: 'none', stroke: SELC, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, gO);
      }
      if (band) {
        const x = Math.min(band.p0[0], band.p1[0]), y = Math.min(band.p0[1], band.p1[1]);
        el('rect', { x, y, width: Math.abs(band.p1[0] - band.p0[0]), height: Math.abs(band.p1[1] - band.p0[1]), fill: 'none', stroke: SELC, 'stroke-width': upp(), 'stroke-dasharray': '4 3' }, gO);
      }
      if (run) return;
      if (tool === 'place' && placeType && ghostPos) {
        const t = LIB.types[placeType];
        const gp = { id: (t.prefix || 'X') + '?', type: placeType, x: ghostPos[0], y: ghostPos[1], rot: placeRot, value: t.defaultValue || '' };
        const g = LIB.render(gp, gO); if (g.parentNode !== gO) gO.appendChild(g);
        g.setAttribute('opacity', 0.55); LIB.update(g, gp, OFF);
      }
      if (wd) {
        const tg = hover ? target(hover) : null;
        const pts = wd.pts.concat(tg ? lpath(wd.pts[wd.pts.length - 1], tg.pt, diag) : []);
        el('polyline', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: WIRE, 'stroke-width': 1.3, 'stroke-dasharray': '4 2' }, gO);
        if (tg && tg.kind !== 'grid') mark(tg.pt);
      } else if (hover && tool !== 'place' && !band && !drag) {
        const pin = hitPin(hover);
        const w = !pin && tool === 'wire' ? hitWire(hover) : null;
        const q = pin ? pin.pt : w ? w.pt : null;
        if (q) mark(q);
        svg.style.cursor = spaceDown ? 'grab' : q || tool === 'wire' ? 'crosshair' : 'default';
      }
    }

    function follow(att, snapW, pos) {
      const by = new Map();
      for (const a of att) { if (!by.has(a.wi)) by.set(a.wi, []); by.get(a.wi).push(a); }
      for (const [wi, list] of by) {
        const orig = snapW[wi].points, n = orig.length, pts = orig.map(v => v.slice());
        const fixed = new Set(list.map(a => a.vi));
        for (const a of list) { const q = pos(orig[a.vi]); pts[a.vi] = [Math.round(q[0]), Math.round(q[1])]; }
        for (const a of list) {
          if (a.vi !== 0 && a.vi !== n - 1) continue;
          const ni = a.vi === 0 ? 1 : n - 2;
          if (n <= 2 || fixed.has(ni)) continue;
          if (orig[a.vi][1] === orig[ni][1]) pts[ni] = [pts[ni][0], pts[a.vi][1]];
          else pts[ni] = [pts[a.vi][0], pts[ni][1]];
        }
        const out = [pts[0]];
        for (let k = 1; k < pts.length; k++) {
          const a = out[out.length - 1], b = pts[k];
          if (a[0] !== b[0] && a[1] !== b[1]) {
            const ph = out.length > 1 && out[out.length - 2][1] === a[1];
            out.push(ph ? [a[0], b[1]] : [b[0], a[1]]);
          }
          out.push(b);
        }
        C.wires[wi].points = out;
      }
      const keep = keepSet(-1);
      for (const wi of by.keys()) {
        const p = simplify(C.wires[wi].points, keep);
        C.wires[wi].points = p.length >= 2 ? p : C.wires[wi].points;
      }
    }
    function movingSet(carryW) {
      const s = new Set();
      for (const id of selP) { const p = partById(id); if (p) for (const q of pinsOf(p)) if (q.pt) s.add(k2(q.pt)); }
      for (const w of C.wires) if (selW.has(w.id) || (carryW && carryW.has(w.id))) for (const v of w.points) s.add(k2(v));
      return s;
    }
    function moveCtx() {
      const pins = movingSet(null), carry = new Set();
      for (const w of C.wires) if (!selW.has(w.id) && pins.has(k2(w.points[0])) && pins.has(k2(w.points[w.points.length - 1]))) carry.add(w.id);
      const moving = movingSet(carry), att = [];
      C.wires.forEach((w, wi) => { if (selW.has(w.id) || carry.has(w.id)) return; w.points.forEach((v, vi) => { if (moving.has(k2(v))) att.push({ wi, vi }); }); });
      return { parts: [...selP].map(partById).filter(Boolean).map(pp => ({ pp, x0: pp.x, y0: pp.y })), snapW: clone(C.wires), att, moving, carry, dx: 0, dy: 0, before: snapshot() };
    }
    function applyMove(d, dx, dy) {
      for (const m of d.parts) { m.pp.x = m.x0 + dx; m.pp.y = m.y0 + dy; }
      C.wires = clone(d.snapW);
      for (const w of C.wires) if (selW.has(w.id) || d.carry.has(w.id)) w.points = w.points.map(v => [v[0] + dx, v[1] + dy]);
      follow(d.att, d.snapW, v => d.moving.has(k2(v)) ? [v[0] + dx, v[1] + dy] : v);
      d.dx = dx; d.dy = dy;
    }
    function moveBy(dx, dy) {
      if (run || !selP.size) return;
      const d = moveCtx(); applyMove(d, dx, dy); commit(d.before);
    }

    function nextId(prefix) {
      let n = 0;
      const re = new RegExp('^' + prefix.replace(/[^A-Za-z0-9]/g, '\\$&') + '(\\d+)$');
      for (const p of C.parts) { const m = re.exec(p.id); if (m) n = Math.max(n, +m[1]); }
      return prefix + (n + 1);
    }
    function nextWireId() { let n = 0; for (const w of C.wires) { const m = /^w(\d+)$/.exec(w.id); if (m) n = Math.max(n, +m[1]); } return 'w' + (n + 1); }

    function finishWire() {
      if (!wd) return;
      const pts = simplify(wd.pts, keepSet(-1));
      const before = wd.before;
      wd = null;
      if (pts.length >= 2) { C.wires.push({ id: nextWireId(), points: pts }); commit(before); }
      else overlay();
    }
    function wireClick(p, dg) {
      const tg = target(p), last = wd.pts[wd.pts.length - 1];
      if (eq(tg.pt, last)) { if (tg.kind !== 'grid' && wd.pts.length > 1) finishWire(); return; }
      (wd.stack = wd.stack || []).push(wd.pts.length);
      wd.pts.push(...lpath(last, tg.pt, dg));
      if (tg.kind !== 'grid') finishWire(); else overlay();
    }
    function startWire(p0) { wd = { pts: [p0], before: snapshot(), stack: [] }; clearSel(); overlay(); }
    function wireBack() {
      if (!wd) return false;
      if (wd.stack && wd.stack.length) wd.pts.length = wd.stack.pop();
      else if (wd.pts.length > 1) wd.pts.pop();
      else wd = null;
      overlay(); return true;
    }

    function ghostAt(p) {
      const b = LIB.bbox({ type: placeType, x: 0, y: 0, rot: placeRot });
      return [snap(p[0] - b.x - b.w / 2), snap(p[1] - b.y - b.h / 2)];
    }

    svg.addEventListener('pointerdown', e => {
      const p = pt(e);
      closeProps();
      if (track) { track = null; svg.style.cursor = ''; if (e.preventDefault) e.preventDefault(); return; }
      if (e.button === 1 || (e.button === 0 && (e.altKey || spaceDown))) { startPan(e); if (e.button === 1) pan.mid = true; return; }
      if (e.button !== 0) return;
      diag = !!(e.ctrlKey || e.metaKey);
      const near = c => e.target.closest && e.target.closest(c);
      if ((run || tool === 'select') && !wd && near('.mute-hit')) { e.preventDefault(); if (LIB.setMuted) LIB.setMuted(!LIB.muted()); return; }
      if (run) {
        const th = near('.term-hit'), tg = th && th.closest('g.part');
        if (tg && tg.dataset.id) { e.preventDefault(); setTermFocus(tg.dataset.id); return; }
        setTermFocus(null);
        const ph = near('.pot-hit'), pg = ph && ph.closest('g.part');
        if (pg && pg.dataset.id) {
          e.preventDefault();
          potDrag = { id: pg.dataset.id, el: ph, pid: e.pointerId, last: null };
          svg.setPointerCapture(e.pointerId);
          potMove(e);
          return;
        }
        const hit = near('.btn-hit');
        const g = hit && hit.closest('g.part');
        if (g && g.dataset.id) {
          e.preventDefault();
          const key = hit.getAttribute('data-key');
          press = { id: key != null ? g.dataset.id + ':' + key : g.dataset.id, pid: e.pointerId };
          svg.setPointerCapture(e.pointerId);
          if (o.onPress) o.onPress(press.id, true);
          return;
        }
        if (e.shiftKey) { band = { p0: p, p1: p, pid: e.pointerId, zoom: true }; svg.setPointerCapture(e.pointerId); overlay(); return; }
        startPan(e); return;
      }
      if (tool === 'place' && placeType) {
        const t = LIB.types[placeType], at = ghostAt(p), before = snapshot();
        const part = { id: nextId(t.prefix || 'X'), type: placeType, x: at[0], y: at[1], rot: placeRot, value: t.defaultValue || '' };
        C.parts.push(part); clearSel(); selP.add(part.id); commit(before); return;
      }
      if (wd) { wireClick(p, diag); return; }
      const pin = hitPin(p);
      if (pin && !e.shiftKey) { startWire(pin.pt); return; }
      const w = hitWire(p);
      if (tool === 'wire') { startWire(w ? w.pt : [snap(p[0]), snap(p[1])]); return; }
      const part = w ? null : hitPart(p);
      if (w || part) {
        const set = w ? selW : selP, id = w ? w.id : part.id;
        if (e.shiftKey || e.metaKey || e.ctrlKey) { if (set.has(id)) set.delete(id); else set.add(id); overlay(); return; }
        const was = set.has(id) && selP.size + selW.size > 1;
        if (!set.has(id)) { clearSel(); set.add(id); }
        if (selP.size) { drag = Object.assign(moveCtx(), { p0: p, moved: false, pid: e.pointerId, only: was ? [w ? 'w' : 'p', id] : null }); svg.setPointerCapture(e.pointerId); }
        overlay(); return;
      }
      const zb = e.shiftKey && !e.ctrlKey && !e.metaKey;
      if (!zb && !(e.ctrlKey || e.metaKey)) clearSel();
      band = { p0: p, p1: p, pid: e.pointerId, zoom: zb };
      svg.setPointerCapture(e.pointerId); overlay();
    });
    function potFrac(e, r) {
      try {
        const m = r.getScreenCTM && r.getScreenCTM();
        if (!m || !svg.createSVGPoint) return null;
        const q = svg.createSVGPoint(); q.x = e.clientX; q.y = e.clientY;
        const l = q.matrixTransform(m.inverse()), x = +r.getAttribute('x'), w = +r.getAttribute('width');
        return Math.max(0, Math.min(1, (l.x - x - 1) / (w - 2)));
      } catch (err) { return null; }
    }
    function potMove(e) {
      const f = potFrac(e, potDrag.el);
      if (f == null) return;
      const k = (Math.round(f * 100) / 100).toFixed(2);
      if (k === potDrag.last) return;
      potDrag.last = k;
      if (o.onPress) o.onPress(potDrag.id + ':=' + k, true);
    }
    function startPan(e) { pan = { cx: e.clientX, cy: e.clientY, x: vb.x, y: vb.y, u: upp(), pid: e.pointerId }; svg.setPointerCapture(e.pointerId); svg.style.cursor = 'grabbing'; }
    svg.addEventListener('pointermove', e => {
      if (o.onCursor) o.onCursor(pt(e));
      lastPt = pt(e); lastClient = [e.clientX, e.clientY]; diag = !!(e.ctrlKey || e.metaKey);
      if (track) { vb.x = track.x - (e.clientX - track.cx) * track.u; vb.y = track.y - (e.clientY - track.cy) * track.u; setVB(); return; }
      if (pan) {
        if (pan.mid && Math.hypot(e.clientX - pan.cx, e.clientY - pan.cy) > 3) pan.moved = true;
        vb.x = pan.x - (e.clientX - pan.cx) * pan.u; vb.y = pan.y - (e.clientY - pan.cy) * pan.u; setVB(); return;
      }
      if (potDrag) { potMove(e); return; }
      if (press) return;
      const p = pt(e);
      if (drag) {
        const dx = snap(p[0] - drag.p0[0]), dy = snap(p[1] - drag.p0[1]);
        if (!drag.moved && Math.hypot(p[0] - drag.p0[0], p[1] - drag.p0[1]) < 4) return;
        if (drag.moved && dx === drag.dx && dy === drag.dy) return;
        drag.moved = true; applyMove(drag, dx, dy);
        draw(); return;
      }
      if (band) { band.p1 = p; overlay(); return; }
      if (run) return;
      hover = p;
      if (tool === 'place' && placeType) ghostPos = ghostAt(p);
      overlay();
    });
    function finishBand() {
      const b = band; band = null;
      const x0 = Math.min(b.p0[0], b.p1[0]), x1 = Math.max(b.p0[0], b.p1[0]), y0 = Math.min(b.p0[1], b.p1[1]), y1 = Math.max(b.p0[1], b.p1[1]);
      if (x1 - x0 < 3 && y1 - y0 < 3) { overlay(); return; }
      if (b.zoom) { if (x1 - x0 >= 5 && y1 - y0 >= 5) { vb = rectView(vb, [x0, y0, x1, y1]); setVB(); } overlay(); return; }
      const inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
      for (const p of C.parts) { if (!LIB.types[p.type]) continue; const q = outline(LIB, p); if (inside(q[0], q[1]) && inside(q[2], q[3])) selP.add(p.id); }
      for (const w of C.wires) if (w.points.every(v => inside(v[0], v[1]))) selW.add(w.id);
      overlay();
    }
    const endPtr = () => {
      if (pan) {
        const was = pan; pan = null; svg.style.cursor = '';
        if (was.mid && !was.moved) { track = { cx: was.cx, cy: was.cy, x: vb.x, y: vb.y, u: upp() }; svg.style.cursor = 'grabbing'; }
      }
      if (potDrag) potDrag = null;
      if (press) { const id = press.id; press = null; if (o.onPress) o.onPress(id, false); }
      if (drag) {
        const d = drag; drag = null;
        if (d.moved) commit(d.before);
        else { if (d.only) { clearSel(); (d.only[0] === 'w' ? selW : selP).add(d.only[1]); } overlay(); }
      }
      if (band) finishBand();
    };
    svg.addEventListener('pointerup', endPtr);
    svg.addEventListener('pointercancel', endPtr);
    svg.addEventListener('pointerleave', () => { if (!wd && !drag && !band) { hover = null; ghostPos = null; overlay(); } });
    svg.addEventListener('dblclick', e => {
      const p = pt(e);
      if (run) {
        const pin = hitPin(p), w = pin ? null : hitWire(p);
        if (!pin && !w) return;
        const r = getRunner();
        if (!r || !r.probe) return;
        const ch = r.probe(pin ? { pin: pin.id + '.' + pin.num } : { wire: w.id });
        if (ch && o.toast) o.toast(ch.label + ' added to the oscilloscope (right-click its label in the panel to remove).');
        if (o.onProbe) o.onProbe(ch);
        return;
      }
      if (wd) { finishWire(); return; }
      if (tool !== 'select') return;
      const part = hitPart(p);
      if (part) openProps(part, e);
    });
    svg.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (track) { track = null; svg.style.cursor = ''; return; }
      if (wd) { wireBack(); return; }
      if (run) {
        const th = e.target && e.target.closest && e.target.closest('.term-hit'), tg = th && th.closest('g.part');
        if (tg && tg.dataset.id) termMenu(e, tg.dataset.id);
        return;
      }
      if (tool !== 'select') { setTool('select'); return; }
      const p = pt(e), w = hitWire(p), part = w ? null : hitPart(p);
      if (part && !selP.has(part.id)) { clearSel(); selP.add(part.id); }
      else if (w && !selW.has(w.id)) { clearSel(); selW.add(w.id); }
      else if (!part && !w) { clearSel(); }
      overlay();
      ctxMenu(e, part, w, p);
    });
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const pad = e.wheelDeltaY ? e.wheelDeltaY === -3 * e.deltaY : e.deltaMode === 0;
      if (e.ctrlKey || e.metaKey) zoomAt(pt(e), Math.exp(e.deltaY * 0.01));
      else if (!pad && !e.deltaX) zoomAt(pt(e), e.deltaY > 0 ? 1.15 : 1 / 1.15);
      else { const u = upp(), k = e.deltaMode === 1 ? 16 : 1; vb.x += e.deltaX * u * k; vb.y += e.deltaY * u * k; setVB(); }
    }, { passive: false });
    let gs = null;
    svg.addEventListener('gesturestart', e => { e.preventDefault(); gs = { w: vb.w, h: vb.h, x: vb.x, y: vb.y, p: pt(e) }; });
    svg.addEventListener('gesturechange', e => {
      e.preventDefault(); if (!gs) return;
      const f = Math.max(150 / gs.w, Math.min(8000 / gs.w, 1 / e.scale));
      vb.w = gs.w * f; vb.h = gs.h * f; vb.x = gs.p[0] - (gs.p[0] - gs.x) * f; vb.y = gs.p[1] - (gs.p[1] - gs.y) * f; setVB();
    });
    svg.addEventListener('gestureend', e => { e.preventDefault(); gs = null; });

    function zoomAt(p, f) {
      f = Math.max(150 / vb.w, Math.min(8000 / vb.w, f));
      vb.x = p[0] - (p[0] - vb.x) * f; vb.y = p[1] - (p[1] - vb.y) * f; vb.w *= f; vb.h *= f; setVB();
    }
    function zoom(f) { zoomAt([vb.x + vb.w / 2, vb.y + vb.h / 2], f); }
    function zoomKey(kind, p) {
      p = p || lastPt;
      if (kind === 'all') { fit(); return; }
      if (kind !== 'in' && kind !== 'out' && kind !== 'centre') return;
      vb = viewFor(vb, kind, p); setVB();
    }
    function fit() {
      const b = contentBox(C, LIB);
      if (!b) vb = { x: 0, y: 0, w: 1080, h: 670 };
      else {
        const m = 30, w = Math.max(400, b.w + 2 * m), h = Math.max(250, b.h + 2 * m);
        vb = { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h };
      }
      setVB();
    }

    let props = null, menu = null;
    function closeProps() { if (props) { props.remove(); props = null; } closeMenu(); }
    function closeMenu() { if (menu) { menu.remove(); menu = null; } }
    function hostPos(box, e, w, h) {
      const host = svg.parentNode, r = host.getBoundingClientRect();
      box.style.left = Math.max(4, Math.min(r.width - w - 4, e.clientX - r.left + 6)) + 'px';
      box.style.top = Math.max(4, Math.min(r.height - h - 4, e.clientY - r.top + 6)) + 'px';
      host.appendChild(box);
    }
    function mkInput(r, adv) {
      const lb = document.createElement('label'), sp = document.createElement('span');
      sp.textContent = r.label; lb.appendChild(sp); lb.appendChild(document.createTextNode(' '));
      let inp, extra = null;
      if (r.options) {
        inp = document.createElement('select');
        for (const [v, tx] of r.options) { const op = document.createElement('option'); op.value = String(v); op.textContent = tx; inp.appendChild(op); }
        inp.value = String(r.value);
        if (r.disabled) inp.disabled = true;
      } else {
        inp = document.createElement('input'); inp.value = r.value == null ? '' : String(r.value);
        if (r.placeholder) inp.placeholder = r.placeholder;
        if (r.file || (!r.apply && !r.key)) inp.readOnly = true;
        if (r.combo) {
          const dl = document.createElement('datalist'), id = 'dl-' + r.key;
          dl.id = id; for (const v of r.combo) { const op = document.createElement('option'); op.value = v; dl.appendChild(op); }
          inp.setAttribute('list', id); extra = dl;
        }
      }
      if (r.title) inp.title = r.title;
      lb.appendChild(inp); if (extra) lb.appendChild(extra);
      return { lb, inp };
    }
    function openProps(part, e) {
      closeProps();
      const term = part.type === 'TERMINAL', t = LIB.types[part.type] || {};
      const extra = (o.componentInfo && o.componentInfo(part)) || [];
      const nat = LIB.editFields ? LIB.editFields(part, { projectClockHz: o.projectClock ? o.projectClock() : undefined, cfgHint: (extra.find(r => /Configuration Word/.test(r.label)) || {}).value }) : [];
      props = document.createElement('div');
      props.className = 'props pdlg';
      props.innerHTML = '<div class="pdlg-t"><span></span><button name="x" title="Close">✕</button></div><div class="pdlg-b">' +
        '<label><span>Part Reference:</span> <input name="id"></label><label><span></span> <input name="value"></label>' +
        '<label><span>Device:</span> <input name="dev" readonly></label></div><div class="pdlg-f"><button name="ok" class="def">OK</button> <button name="cancel">Cancel</button></div>';
      props.querySelector('.pdlg-t span').textContent = term ? 'Edit Terminal Label' : 'Edit Component';
      props.querySelectorAll('.pdlg-b label span')[1].textContent = term ? 'String:' : 'Part Value:';
      const iid = props.querySelector('[name=id]'), ival = props.querySelector('[name=value]'), idev = props.querySelector('[name=dev]');
      iid.value = part.id; ival.value = part.value || ''; idev.value = part.type; idev.title = t.desc || '';
      const body = props.querySelector('.pdlg-b'), applies = [], natIn = [], bridge = {};
      const used = new Set();
      for (const r of extra) {
        const n = nat.find(f => f.label === r.label && !f.advanced);
        if (n) {
          used.add(n);
          if (r.apply) bridge[n.key] = r;
          const m = mkInput(n); body.appendChild(m.lb); natIn.push([n, m.inp]);
          continue;
        }
        const m = mkInput(r); body.appendChild(m.lb);
        if (r.apply) applies.push([r, m.inp]);
      }
      for (const n of nat) if (!n.advanced && !used.has(n)) { const m = mkInput(n); body.appendChild(m.lb); natIn.push([n, m.inp]); }
      const files = {};
      const advs = nat.filter(n => n.advanced);
      if (advs.length) {
        const dt = document.createElement('details'), sm = document.createElement('summary');
        sm.textContent = 'Advanced Properties'; dt.appendChild(sm);
        for (const n of advs) {
          const m = mkInput(n); dt.appendChild(m.lb); natIn.push([n, m.inp]);
          if (n.file) {
            const fi = document.createElement('input'), bt = document.createElement('button');
            fi.type = 'file'; fi.accept = n.file; fi.hidden = true; bt.textContent = 'Browse…'; bt.type = 'button';
            bt.onclick = () => fi.click();
            fi.onchange = () => {
              const f = fi.files && fi.files[0]; if (!f) return;
              const rd = new FileReader();
              rd.onload = () => {
                const u = new Uint8Array(rd.result); let bin = '';
                for (let k = 0; k < u.length; k++) bin += String.fromCharCode(u[k]);
                files[n.key] = { name: f.name, b64: btoa(bin) }; m.inp.value = f.name;
              };
              rd.readAsArrayBuffer(f);
            };
            const cl = document.createElement('button'); cl.textContent = '×'; cl.type = 'button'; cl.title = 'Clear';
            cl.onclick = () => { files[n.key] = { name: '', b64: '' }; m.inp.value = ''; };
            m.lb.appendChild(bt); m.lb.appendChild(cl); m.lb.appendChild(fi);
          }
        }
        body.appendChild(dt);
      }
      const ok = () => {
        const id = iid.value.trim(), val = ival.value;
        if (!id || /\s/.test(id)) { o.toast && o.toast('Part Reference must not be empty or contain spaces.'); return; }
        if (id !== part.id && partById(id)) { o.toast && o.toast('Part Reference ' + id + ' is already in use.'); return; }
        const upd = [];
        for (const [f, inp] of natIn) {
          if (f.disabled || f.noStore) continue;
          if (f.file) { if (files[f.key]) upd.push([f, null]); continue; }
          if (String(inp.value) === String(f.value)) continue;
          const r = f.validate ? f.validate(inp.value) : { ok: true };
          if (!r.ok) { o.toast && o.toast(r.msg); inp.focus && inp.focus(); return; }
          upd.push([f, inp.value]);
        }
        const before = snapshot(), changed = {};
        for (const [f, raw] of upd) {
          if (f.file) {
            const fl = files[f.key];
            if (fl.b64) { part[f.key] = fl.name; part[f.fileData] = fl.b64; } else { delete part[f.key]; delete part[f.fileData]; }
            changed[f.key] = part[f.key];
            continue;
          }
          const r = LIB.applyField(part, f, raw);
          changed[f.key] = part[f.key];
          const br = bridge[f.key];
          if (br && f.key === 'clock' && r.ok) { const hz = LIB.parseEng(raw); if (br.options && br.options.some(op => +op[0] === hz)) br.apply(hz); }
        }
        for (const [r, inp] of applies) if (String(inp.value) !== String(r.value)) r.apply(inp.value);
        if (id !== part.id) changed.id = id;
        if (val !== (part.value || '')) changed.value = val;
        if (!Object.keys(changed).length) { closeProps(); return; }
        if (selP.has(part.id)) { selP.delete(part.id); selP.add(id); }
        part.id = id; part.value = val; closeProps(); commit(before);
        fireEdit(part, changed);
      };
      props.querySelector('[name=ok]').onclick = ok;
      props.querySelector('[name=cancel]').onclick = closeProps;
      props.querySelector('[name=x]').onclick = closeProps;
      props.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') ok(); if (ev.key === 'Escape') closeProps(); });
      props.addEventListener('pointerdown', ev => ev.stopPropagation());
      hostPos(props, e, 290, 150 + 26 * (extra.length + nat.length));
      (term ? ival : iid).focus(); (term ? ival : iid).select();
    }
    function fireEdit(part, changed) {
      if (o.onEditPart) o.onEditPart(part, changed);
      for (const f of editCbs) f(part, changed);
    }
    function editUnderPointer() {
      if (run) return false;
      const part = (lastPt && hitPart(lastPt)) || (selP.size === 1 ? partById([...selP][0]) : null);
      if (!part) { if (o.toast) o.toast('Point at a component, then press Ctrl+E.'); return false; }
      const c = lastClient || [40, 40];
      openProps(part, { clientX: c[0], clientY: c[1] });
      return true;
    }
    function findAndEdit(ref) {
      if (run) return false;
      if (ref == null) ref = o.prompt ? o.prompt('Find and Edit Component — Reference:', '') : (typeof prompt === 'function' ? prompt('Find and Edit Component — Reference:', '') : null);
      ref = ref == null ? '' : String(ref).trim();
      if (!ref) return false;
      const part = partById(ref) || C.parts.find(p => p.id.toLowerCase() === ref.toLowerCase());
      if (!part) { if (o.toast) o.toast('Component ' + ref + ' was not found.'); return false; }
      selP.clear(); selW.clear(); selP.add(part.id); overlay();
      const c = lastClient || [40, 40];
      openProps(part, { clientX: c[0], clientY: c[1] });
      return true;
    }
    function editProps(id) { const p = partById(id || [...selP][0]); if (!p || run) return false; const b = svg.getBoundingClientRect ? svg.getBoundingClientRect() : { left: 0, top: 0 }; openProps(p, { clientX: b.left + 40, clientY: b.top + 40 }); return true; }
    function ctxMenu(e, part, w, p) {
      const sel = selP.size + selW.size, items = [];
      if (part) {
        items.push(['Drag Object', '', null], [part.type === 'TERMINAL' ? 'Edit Label' : 'Edit Properties', '', () => openProps(part, e)],
          ['Delete Object', 'Del', del], null,
          ['Rotate Clockwise', 'R', () => rotate(1)], ['Rotate Anti-Clockwise', '', () => rotate(3)], ['Rotate 180 degrees', '', () => rotate(2)],
          ['X-Mirror', '', null], ['Y-Mirror', '', null], null);
      } else if (w) items.push(['Delete Wire', 'Del', del], null);
      if (sel) items.push(['Cut To Clipboard', 'Ctrl+X', cut], ['Copy To Clipboard', 'Ctrl+C', copy], ['Duplicate', 'Ctrl+D', duplicate], null);
      items.push(['Paste From Clipboard', 'Ctrl+V', clip ? () => paste(p) : null], ['Select All Objects', 'Ctrl+A', selectAll], null,
        ['Zoom In', 'F6', () => zoomAt(p, 1 / 1.25)], ['Zoom Out', 'F7', () => zoomAt(p, 1.25)], ['Zoom All', 'F8', fit]);
      popMenu(e, items);
    }
    function popMenu(e, items) {
      closeMenu();
      menu = document.createElement('div');
      menu.className = 'ctxm';
      for (const it of items) {
        const d = document.createElement('div');
        if (!it) { d.className = 'sep'; menu.appendChild(d); continue; }
        d.className = it[2] ? 'it' : 'it off';
        const a = document.createElement('span'), k = document.createElement('kbd');
        a.textContent = it[0]; k.textContent = it[1]; d.appendChild(a); d.appendChild(k);
        if (it[2]) d.onclick = () => { closeMenu(); it[2](); };
        menu.appendChild(d);
      }
      menu.addEventListener('pointerdown', ev => ev.stopPropagation());
      menu.addEventListener('contextmenu', ev => ev.preventDefault());
      hostPos(menu, e, 210, items.length * 21);
    }
    function termMenu(e, id) {
      const r = getRunner(), inf = (r && r.termInfo && r.termInfo(id)) || {}, cmd = c => () => { if (r && r.termCmd) r.termCmd(id, c); };
      const ck = (on, t) => (on ? '✓ ' : '   ') + t;
      popMenu(e, [['Clear Screen', '', cmd('clear')], [ck(inf.paused, 'Pause'), '', cmd('pause')], null,
        ['Copy', '', () => { const tx = r && r.termText ? r.termText(id) : ''; if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(tx).catch(() => { }); }],
        ['Paste', '', () => { if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(t => { if (r && r.termPaste) r.termPaste(id, t); }).catch(() => { }); }], null,
        [ck(inf.hex, 'Hex Display Mode'), '', cmd('hex')], [ck(inf.echo, 'Echo Typed Characters'), '', cmd('echo')]]);
    }
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('pointerdown', ev => { if (menu && !menu.contains(ev.target)) closeMenu(); }, true);

    function rotate(n) {
      if (run) return;
      n = ((Math.round(n == null ? 1 : n) % 4) + 4) % 4;
      if (tool === 'place') { placeRot = (placeRot + 90 * n) % 360; if (hover) ghostPos = ghostAt(hover); overlay(); if (o.onTool) o.onTool(tool, info()); return; }
      if (!selP.size && !selW.size) return;
      if (!n) return;
      const before = snapshot();
      for (let k = 0; k < n; k++) rotate1();
      commit(before);
    }
    function rotate1() {
      const snapW = clone(C.wires), mv = new Map();
      if (selP.size === 1 && !selW.size) {
        const part = partById([...selP][0]); if (!part) return;
        const old = pinsOf(part);
        part.rot = ((part.rot || 0) + 90) % 360;
        for (const q of old) if (q.pt) mv.set(k2(q.pt), LIB.pinPos(part, q.num));
      } else {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        const ext = v => { x0 = Math.min(x0, v[0]); y0 = Math.min(y0, v[1]); x1 = Math.max(x1, v[0]); y1 = Math.max(y1, v[1]); };
        for (const id of selP) { const p = partById(id); if (p) { const q = outline(LIB, p); ext([q[0], q[1]]); ext([q[2], q[3]]); } }
        for (const w of C.wires) if (selW.has(w.id)) w.points.forEach(ext);
        const cx = snap((x0 + x1) / 2), cy = snap((y0 + y1) / 2), R = v => [cx - (v[1] - cy), cy + (v[0] - cx)];
        for (const id of selP) {
          const p = partById(id); if (!p) continue;
          for (const q of pinsOf(p)) if (q.pt) mv.set(k2(q.pt), R(q.pt));
          const t = LIB.types[p.type], c = R([p.x + t.w / 2, p.y + t.h / 2]);
          p.x = Math.round(c[0] - t.w / 2); p.y = Math.round(c[1] - t.h / 2); p.rot = ((p.rot || 0) + 90) % 360;
        }
        for (const w of C.wires) if (selW.has(w.id)) w.points = w.points.map(v => { const n = R(v); mv.set(k2(v), n); return n; });
      }
      const att = [];
      snapW.forEach((w, wi) => { if (selW.has(w.id)) return; w.points.forEach((v, vi) => { if (mv.has(k2(v))) att.push({ wi, vi }); }); });
      const sel = new Set(selW), kept = C.wires.map(w => sel.has(w.id) ? w.points : null);
      C.wires = clone(snapW);
      C.wires.forEach((w, i) => { if (kept[i]) w.points = kept[i]; });
      follow(att, snapW, v => mv.get(k2(v)) || v);
    }
    function del() {
      if (run || (!selP.size && !selW.size)) return;
      const before = snapshot();
      C.parts = C.parts.filter(p => !selP.has(p.id));
      C.wires = C.wires.filter(w => !selW.has(w.id));
      clearSel(); commit(before);
    }
    function copy() {
      if (run || (!selP.size && !selW.size)) return false;
      const pins = movingSet(null), ws = C.wires.filter(w => selW.has(w.id) || (pins.has(k2(w.points[0])) && pins.has(k2(w.points[w.points.length - 1]))));
      clip = clone({ parts: C.parts.filter(p => selP.has(p.id)), wires: ws });
      pasteN = 0; pasteAt = null;
      return true;
    }
    function paste(at, noHover) {
      if (run || !clip || (!clip.parts.length && !clip.wires.length)) return false;
      const b = contentBox(clip, LIB) || { x: 0, y: 0 };
      let dx, dy;
      const h = at || (noHover ? null : hover);
      if (h && (!pasteAt || Math.hypot(h[0] - pasteAt[0], h[1] - pasteAt[1]) > 15)) { dx = snap(h[0] - b.x); dy = snap(h[1] - b.y); pasteAt = h.slice(); pasteN = 0; }
      else { pasteN++; dx = 20 * pasteN; dy = 20 * pasteN; if (pasteAt) { dx += snap(pasteAt[0] - b.x); dy += snap(pasteAt[1] - b.y); } }
      const before = snapshot();
      clearSel();
      for (const p of clip.parts) {
        const t = LIB.types[p.type]; if (!t) continue;
        const np = Object.assign(clone(p), { id: nextId(t.prefix || 'X'), x: p.x + dx, y: p.y + dy });
        C.parts.push(np); selP.add(np.id);
      }
      for (const w of clip.wires) { const id = nextWireId(); C.wires.push({ id, points: w.points.map(v => [v[0] + dx, v[1] + dy]) }); selW.add(id); }
      commit(before);
      return true;
    }
    function cut() { if (copy()) del(); }
    function duplicate() { if (copy()) paste(null, true); }
    function selectAll() { if (run) return; clearSel(); for (const p of C.parts) selP.add(p.id); for (const w of C.wires) selW.add(w.id); overlay(); }
    function select(ids) {
      clearSel();
      for (const id of ids || []) { if (partById(id)) selP.add(id); else if (C.wires.some(w => w.id === id)) selW.add(id); }
      overlay();
    }
    function undo() { if (run || !undoS.length) return; wd = null; redoS.push(snapshot()); restore(undoS.pop()); clearSel(); changed(); }
    function redo() { if (run || !redoS.length) return; wd = null; undoS.push(snapshot()); restore(redoS.pop()); clearSel(); changed(); }
    const SELM = { component: 'DEVICES', terminal: 'TERMINALS', instrument: 'INSTRUMENTS', probe: 'PROBES' };
    let selMode = 'component';
    const lastType = {};
    const modeTypes = m => m === 'probe' ? ['LOGICPROBE'].filter(t => LIB.types[t]) :
      LIB.order.filter(t => LIB.types[t] && (LIB.types[t].mode || 'component') === m).sort((a, b) => m === 'component' ? (LIB.types[a].label || a).localeCompare(LIB.types[b].label || b) : 0);
    const info = () => ({ mode: selMode, type: placeType, rot: placeRot });
    function setTool(t, type) {
      if (run) return;
      wd = null;
      if (t === 'place' && type && LIB.types[type]) {
        tool = 'place'; placeType = type; if (hover) ghostPos = ghostAt(hover); clearSel();
        if (modeTypes(selMode).indexOf(type) < 0) selMode = LIB.types[type].mode || 'component';
        lastType[selMode] = type;
      }
      else { tool = t === 'wire' ? 'wire' : 'select'; placeType = null; ghostPos = null; }
      svg.style.cursor = tool === 'select' ? '' : tool === 'wire' ? 'crosshair' : 'copy';
      devList();
      overlay();
      if (o.onTool) o.onTool(tool, info());
    }
    function setSelector(m, keepTool) {
      if (!SELM[m]) return selMode;
      selMode = m;
      if (!keepTool && !run) { const lt = lastType[m]; if (lt && modeTypes(m).indexOf(lt) >= 0) setTool('place', lt); else setTool('select'); }
      else devList();
      return selMode;
    }

    let devQ = '', devBox = null, devIn = null, devTitle = null;
    function devMatches() {
      const q = devQ.trim().toLocaleLowerCase('tr'), qe = devQ.trim().toLowerCase();
      if (!q) return modeTypes(selMode);
      const catTr = {};
      for (const c of LIB.categories || []) for (const t of c.types) catTr[t] = (c.name || '') + ' ' + (c.tr || '');
      const hit = t => {
        const ty = LIB.types[t]; if (!ty) return false;
        const h = t + ' ' + (ty.label || '') + ' ' + (ty.kw || '') + ' ' + (ty.kwEn || '') + ' ' + (ty.desc || '') + ' ' + (catTr[t] || '');
        return h.toLocaleLowerCase('tr').indexOf(q) >= 0 || h.toLowerCase().indexOf(qe) >= 0;
      };
      const cur = modeTypes(selMode).filter(hit);
      return cur.concat(LIB.order.filter(t => cur.indexOf(t) < 0 && hit(t)));
    }
    function devList() {
      const d = o.devList; if (!d) return;
      if (!devBox || devBox.parentNode !== d) {
        d.innerHTML = '';
        const hd = document.createElement('div');
        hd.className = 'osel-h';
        const pb = document.createElement('button'), lb = document.createElement('button');
        pb.textContent = 'P'; pb.title = 'Pick Devices (P)'; pb.className = 'osel-p';
        lb.textContent = 'L'; lb.title = 'Library Manager'; lb.className = 'osel-l';
        pb.onclick = () => { if (o.onPick) o.onPick(); };
        lb.onclick = () => { if (o.toast) o.toast('The Library Manager is not available in EELAB. Use P (Pick Devices) to browse the built-in library.'); };
        devTitle = document.createElement('span');
        hd.appendChild(pb); hd.appendChild(lb); hd.appendChild(devTitle);
        d.appendChild(hd);
        devIn = document.createElement('input');
        devIn.type = 'search'; devIn.placeholder = 'Search (EN / TR)…'; devIn.value = devQ; devIn.className = 'osel-q';
        devIn.title = 'Filter the object selector — English or Turkish keywords (e.g. resistor / direnç)';
        devIn.oninput = () => { devQ = devIn.value; devList(); };
        devIn.onkeydown = e => {
          e.stopPropagation();
          if (e.key === 'Enter') { const m = devMatches(); if (m.length) setTool('place', m[0]); }
          if (e.key === 'Escape') { devQ = ''; devIn.value = ''; devList(); devIn.blur(); }
        };
        d.appendChild(devIn);
        devBox = document.createElement('nav');
        devBox.className = 'osel-list';
        d.appendChild(devBox);
      }
      devTitle.textContent = devQ.trim() ? 'SEARCH' : SELM[selMode];
      devBox.innerHTML = '';
      const ms = devMatches();
      for (const t of ms) {
        const it = document.createElement('div');
        it.textContent = LIB.types[t].label || t;
        it.title = t + (LIB.types[t].desc ? ' — ' + LIB.types[t].desc : '');
        if (tool === 'place' && placeType === t) it.className = 's';
        it.onclick = () => setTool(tool === 'place' && placeType === t ? 'select' : 'place', t);
        devBox.appendChild(it);
      }
      if (!ms.length) { const n = document.createElement('i'); n.textContent = 'No matches'; n.className = 'osel-none'; devBox.appendChild(n); }
      d.classList.toggle('off', run);
    }

    let termFocus = null;
    function setTermFocus(id) {
      id = id || null;
      if (id === termFocus) return;
      if (termFocus && gEl[termFocus]) LIB.focus && LIB.focus(gEl[termFocus], false);
      termFocus = id;
      if (typeof window !== 'undefined') window.TERM_FOCUS = id;
      if (id && gEl[id]) LIB.focus && LIB.focus(gEl[id], true);
    }
    function termKey(id, ch) {
      if (o.onTermKey) return o.onTermKey(id, ch);
      const r = getRunner();
      return r && r.termKey ? r.termKey(id, ch) : false;
    }
    addEventListener('keydown', e => {
      if (!run || !termFocus || /TEXTAREA|INPUT|SELECT/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      let ch = null;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); setTermFocus(null); return; }
      if (e.key === 'Enter') ch = 13; else if (e.key === 'Backspace') ch = 8; else if (e.key === 'Tab') ch = 9; else if (e.key.length === 1) ch = e.key;
      if (ch == null) return;
      e.preventDefault(); e.stopImmediatePropagation();
      termKey(termFocus, ch);
    }, true);
    addEventListener('keyup', e => { if (run && termFocus && !/TEXTAREA|INPUT|SELECT/.test(e.target.tagName)) e.stopImmediatePropagation(); }, true);
    document.addEventListener('pointerdown', e => { if (termFocus && !svg.contains(e.target)) setTermFocus(null); }, true);

    const typing = e => /TEXTAREA|INPUT|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
    addEventListener('keyup', e => { if (e.key === ' ' && spaceDown) { spaceDown = false; overlay(); } });
    addEventListener('blur', () => { spaceDown = false; });
    addEventListener('keydown', e => {
      if (run || props || typing(e)) return;
      const k = e.key, mod = e.metaKey || e.ctrlKey, kl = k.toLowerCase();
      if (k === ' ' && hover) { e.preventDefault(); if (!spaceDown) { spaceDown = true; overlay(); } return; }
      if (mod && kl === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && kl === 'y') { e.preventDefault(); redo(); return; }
      if (mod && kl === 'e' && !e.shiftKey && !e.altKey) { e.preventDefault(); editUnderPointer(); return; }
      if (mod && !e.shiftKey && !e.altKey && (kl === 'c' || kl === 'x' || kl === 'v' || kl === 'd' || kl === 'a')) {
        if (kl === 'v' ? !clip : kl === 'a' ? !hover && !selP.size && !selW.size : !selP.size && !selW.size) return;
        if ((kl === 'c' || kl === 'x') && typeof window !== 'undefined' && window.getSelection && String(window.getSelection())) return;
        e.preventDefault();
        if (kl === 'c') copy(); else if (kl === 'x') cut(); else if (kl === 'v') paste(); else if (kl === 'd') duplicate(); else selectAll();
        return;
      }
      if (mod || e.altKey) return;
      if (k === 'Escape' && menu) { closeMenu(); return; }
      if (k === 'Escape') { if (wd) { wd = null; overlay(); } else if (tool !== 'select') setTool('select'); else { clearSel(); overlay(); } return; }
      if (e.code === 'NumpadAdd' || e.code === 'NumpadSubtract') {
        if (tool === 'place' || selP.size || selW.size) { e.preventDefault(); rotate(e.code === 'NumpadAdd' ? 3 : 1); }
        return;
      }
      if (k === 'e' || k === 'E') { e.preventDefault(); findAndEdit(); return; }
      if (k === 'r' || k === 'R') { e.preventDefault(); rotate(); return; }
      if (k === 'w' || k === 'W') { setTool(tool === 'wire' ? 'select' : 'wire'); return; }
      if ((k === 'p' || k === 'P') && o.onPick) { e.preventDefault(); o.onPick(); return; }
      if (k === 'g' || k === 'G') { const gm = setGrid(); if (o.onGrid) o.onGrid(gm); return; }
      if (/^Arrow/.test(k) && selP.size) { e.preventDefault(); const s = e.shiftKey ? 50 : 10; moveBy(k === 'ArrowLeft' ? -s : k === 'ArrowRight' ? s : 0, k === 'ArrowUp' ? -s : k === 'ArrowDown' ? s : 0); return; }
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); if (wd) wireBack(); else del(); }
    });

    function load(c) {
      C = { version: 1, parts: (c.parts || []).map(p => Object.assign({ rot: 0, value: '' }, p)), wires: (c.wires || []).map(w => ({ id: w.id, points: w.points.map(v => [v[0], v[1]]) })) };
      const seen = new Set();
      C.wires.forEach((w, i) => { if (!w.id || seen.has(w.id)) w.id = 'w_' + i; seen.add(w.id); });
      undoS = []; redoS = []; clearSel(); wd = null; lastState = {};
      draw(); fit();
    }
    function get() { return clone({ version: 1, parts: C.parts, wires: C.wires }); }
    function setRun(v) {
      run = !!v;
      if (run) { wd = null; drag = null; band = null; clearSel(); hover = null; ghostPos = null; tool = 'select'; placeType = null; svg.style.cursor = ''; closeProps(); }
      else { setTermFocus(null); lastState = {}; paint(() => OFF); }
      devList(); overlay();
    }
    function paint(fn) {
      for (const p of C.parts) {
        const g = gEl[p.id]; if (!g) continue;
        const st = fn(p), s = JSON.stringify(st);
        lastState[p.id] = st;
        if (painted[p.id] !== s) { LIB.update(g, p, st); painted[p.id] = s; }
      }
    }

    function exportSVG(opts) { return buildSVG(get(), LIB, SIM, Object.assign({ bg: true }, opts || {})).svg; }
    function exportPNG(opts) {
      opts = opts || {};
      const sc = +opts.scale || 2, r = buildSVG(get(), LIB, SIM, Object.assign({ bg: true }, opts));
      return new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
          try {
            const cv = document.createElement('canvas');
            cv.width = Math.round(r.w * sc); cv.height = Math.round(r.h * sc);
            const g = cv.getContext('2d');
            g.drawImage(img, 0, 0, cv.width, cv.height);
            res(cv.toDataURL('image/png'));
          } catch (e) { rej(e); }
        };
        img.onerror = () => rej(new Error('Could not convert the schematic to PNG.'));
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.svg);
      });
    }
    function print(opts) {
      opts = opts || {};
      const r = buildSVG(get(), LIB, SIM, Object.assign({ bg: true }, opts));
      const f = document.createElement('iframe');
      f.setAttribute('aria-hidden', 'true');
      f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      document.body.appendChild(f);
      const d = f.contentWindow.document;
      d.open();
      d.write('<!doctype html><html><head><meta charset="utf-8"><title>' + escX(opts.title || 'EELAB schematic') + '</title><style>@page{size:' + (r.w >= r.h ? 'landscape' : 'portrait') +
        ';margin:10mm}html,body{margin:0;background:#fff}svg{display:block;width:100%;height:auto;max-height:96vh}</style></head><body>' + r.svg.replace(/^<\?xml[^>]*>\s*/, '') + '</body></html>');
      d.close();
      setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } finally { setTimeout(() => f.remove(), 1500); } }, 80);
      return true;
    }
    function selection() { return { parts: [...selP], wires: [...selW] }; }

    devList();
    draw();
    function centerOn(x, y) { vb.x = x - vb.w / 2; vb.y = y - vb.h / 2; setVB(); }
    function setGrid(v) {
      const order = ['lines', 'dots', 'off'];
      gridMode = v == null ? order[(order.indexOf(gridMode) + 1) % 3] : v === true ? 'lines' : v === false ? 'off' : order.indexOf(v) >= 0 ? v : gridMode;
      setVB(); return gridMode;
    }
    return { load, get, setRun, paint, fit, zoom, zoomKey, editUnderPointer, findAndEdit, onEditPart: cb => { if (typeof cb === 'function') editCbs.push(cb); }, undo, redo, rotate, del, setTool, setSelector, editProps, view, centerOn, setGrid, info, parts: () => C.parts,
      copy, cut, paste, duplicate, selectAll, select, selection, moveBy, exportSVG, exportPNG, print, bounds: () => contentBox(C, LIB) };
  }

  const EDITOR = { create, toSVG, contentBox, viewFor, rectView };
  if (typeof module !== 'undefined' && module.exports) module.exports = EDITOR;
  if (root) root.EDITOR = EDITOR;
})(typeof window !== 'undefined' ? window : null);
