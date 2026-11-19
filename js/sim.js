(function (root) {
  'use strict';
  const G = 10;
  const SEG = [0x7E, 0x30, 0x6D, 0x79, 0x33, 0x5B, 0x1F, 0x70, 0x7F, 0x73, 0x0D, 0x19, 0x23, 0x4B, 0x0F, 0x00];
  const SEGN = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const PICPIN = { 17: [0, 0], 18: [0, 1], 1: [0, 2], 2: [0, 3], 3: [0, 4], 4: [0, 5], 15: [0, 6], 16: [0, 7] };
  for (let b = 0; b < 8; b++) PICPIN[6 + b] = [1, b];
  const R = Math.round;
  const pkey = (x, y) => R(x) + ',' + R(y);

  function extract(c, lib, noLabels) {
    const parts = (c && c.parts) || [];
    const wires = ((c && c.wires) || []).filter(w => w && w.points && w.points.length);
    const ids = new Map(), up = [];
    const id = k => { let i = ids.get(k); if (i === undefined) { i = up.length; ids.set(k, i); up.push(i); } return i; };
    const find = i => { while (up[i] !== i) { up[i] = up[up[i]]; i = up[i]; } return i; };
    const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) up[a] = b; };
    const pins = [], labels = new Map();
    for (const p of parts) {
      const t = lib.types[p.type]; if (!t) continue;
      for (const pn of t.pins) {
        const q = lib.pinPos(p, pn.num); if (!q) continue;
        const node = id(pkey(q[0], q[1]));
        pins.push({ addr: p.id + '.' + pn.num, x: R(q[0]), y: R(q[1]), node });
        if (p.type === 'TERMINAL' && !noLabels) { const nm = labelName(p); if (nm) { if (labels.has(nm)) uni(node, labels.get(nm)); else labels.set(nm, node); } }
      }
    }
    const hs = new Map(), vs = new Map(), ds = [], wnode = [];
    const add = (m, k, v) => { let a = m.get(k); if (!a) m.set(k, a = []); a.push(v); };
    const deg = new Map();
    const bump = (k, n) => deg.set(k, (deg.get(k) || 0) + n);
    wires.forEach((w, wi) => {
      const pts = w.points.map(p => [R(p[0]), R(p[1])]);
      const n0 = id(pkey(pts[0][0], pts[0][1])); wnode.push(n0);
      for (let i = 0; i < pts.length; i++) {
        uni(n0, id(pkey(pts[i][0], pts[i][1])));
        if (pts.length > 1) bump(pkey(pts[i][0], pts[i][1]), i === 0 || i === pts.length - 1 ? 1 : 2);
        if (!i) continue;
        const a = pts[i - 1], b = pts[i];
        if (a[1] === b[1] && a[0] !== b[0]) add(hs, a[1], [Math.min(a[0], b[0]), Math.max(a[0], b[0]), wi]);
        else if (a[0] === b[0] && a[1] !== b[1]) add(vs, a[0], [Math.min(a[1], b[1]), Math.max(a[1], b[1]), wi]);
        else if (a[0] !== b[0]) ds.push([a, b, wi]);
      }
    });
    for (const p of pins) if (deg.has(pkey(p.x, p.y))) bump(pkey(p.x, p.y), 1);
    wires.forEach((w, wi) => {
      const ends = w.points.length > 1 ? [w.points[0], w.points[w.points.length - 1]] : [w.points[0]];
      for (const e of ends) {
        const x = R(e[0]), y = R(e[1]);
        let tee = false;
        for (const h of hs.get(y) || []) if (h[2] !== wi && x >= h[0] && x <= h[1]) { uni(wnode[wi], wnode[h[2]]); if (x > h[0] && x < h[1]) tee = true; }
        for (const v of vs.get(x) || []) if (v[2] !== wi && y >= v[0] && y <= v[1]) { uni(wnode[wi], wnode[v[2]]); if (y > v[0] && y < v[1]) tee = true; }
        for (const d of ds) {
          if (d[2] === wi) continue;
          const [a, b] = d, cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
          if (cr === 0 && x >= Math.min(a[0], b[0]) && x <= Math.max(a[0], b[0]) && y >= Math.min(a[1], b[1]) && y <= Math.max(a[1], b[1])) {
            uni(wnode[wi], wnode[d[2]]);
            if (!(x === a[0] && y === a[1]) && !(x === b[0] && y === b[1])) tee = true;
          }
        }
        if (tee) bump(pkey(x, y), 2);
      }
    });
    const netOf = new Map(), nets = [], pinNet = {}, wireNet = {};
    const getNet = r => { let n = netOf.get(r); if (n === undefined) { n = nets.length; netOf.set(r, n); nets.push({ pins: [], wires: [] }); } return n; };
    for (const p of pins) { const n = getNet(find(p.node)); nets[n].pins.push(p.addr); pinNet[p.addr] = n; }
    wires.forEach((w, wi) => { const n = getNet(find(wnode[wi])); nets[n].wires.push(w.id); wireNet[w.id] = n; });
    const junctions = [];
    for (const [k, n] of deg) if (n >= 3) junctions.push(k.split(',').map(Number));
    return { nets, pinNet, wireNet, junctions };
  }

  function labelName(p) { return String(p.value == null ? '' : p.value).trim().toUpperCase(); }
  const RAIL1 = new Set(['VCC', 'VDD', '+5V', '5V']), RAIL0 = new Set(['GND', 'VSS', '0V']);

  function canon(nets) {
    return nets.map(n => n.slice().sort()).filter(n => n.length > 1).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  }
  function pinNets(c, lib, noLabels) { return canon(extract(c, lib, noLabels).nets.map(n => n.pins)); }

  const VDD = 5, RMIN = 1e-3, VREF_R = 2000;
  function ohms(v, def) {
    const m = /^\s*([0-9]*\.?[0-9]+)\s*([kKmMrR]|meg|MEG|Meg)?\s*([0-9]*)\s*(?:ohm|Ω|R)?\s*$/.exec(String(v == null ? '' : v));
    if (!m) return def;
    const mul = { k: 1e3, K: 1e3, m: 1e6, M: 1e6, meg: 1e6, MEG: 1e6, Meg: 1e6, r: 1, R: 1 }[m[2]] || 1;
    let x = parseFloat(m[1]);
    if (m[3]) x = parseFloat(m[1] + '.' + m[3]);
    x *= mul;
    return x > 0 && isFinite(x) ? x : def;
  }
  const HEXSEG = [0x7E, 0x30, 0x6D, 0x79, 0x33, 0x5B, 0x5F, 0x70, 0x7F, 0x7B, 0x77, 0x1F, 0x4E, 0x3D, 0x4F, 0x47];
  const TOGGLE = new Set(['SWITCH', 'LOGICSTATE', 'DIPSW_8']);
  const DECOUT = ['13', '12', '11', '10', '9', '15', '14'];

  function compile(c, lib) {
    const ex = extract(c, lib), N = ex.nets.length;
    const net = (p, num) => { const n = ex.pinNet[p.id + '.' + num]; return n === undefined ? -1 : n; };
    const m = { ex, N, c1: [], c0: [], shorts: [], res: [], dec: [], ttl: [], lits: [], bcd: [], logic: [], npn: [], lcd: [], term: [], buzz: [], motor: [],
      hc: [], l293: [], relay: [], inst: [], pic: null, pics: 0, partPins: {}, buttons: [], types: {}, resR: [], pot: [], vm: [] };
    const pe = lib && lib.parseEng ? lib.parseEng : () => NaN;
    const ttOf = p => { const x = pe(p.ttrigmin); return x > 0 && x <= 1 ? x : 0.001; };
    m.tt = {};
    const lit = (p, items) => { m.tt[p.id] = ttOf(p); m.lits.push({ id: p.id, items: items.map(([k, a, b]) => [k, net(p, a), b == null ? -2 : net(p, b)]) }); };
    for (const p of (c.parts || [])) {
      const t = lib.types[p.type]; if (!t) continue;
      m.types[p.id] = p.type;
      m.partPins[p.id] = t.pins.map(q => [q.num, net(p, q.num)]);
      switch (p.type) {
        case 'POWER': m.c1.push(net(p, '1')); break;
        case 'GROUND': m.c0.push(net(p, '1')); break;
        case 'BUTTON': m.shorts.push({ key: p.id, a: net(p, '1'), b: net(p, '2') }); m.buttons.push(p); break;
        case 'SWITCH': m.shorts.push({ key: p.id, a: net(p, '1'), b: net(p, '2') }); break;
        case 'DIPSW_8': for (let i = 1; i <= 8; i++) m.shorts.push({ key: p.id + ':' + i, a: net(p, String(i)), b: net(p, String(i + 8)) }); break;
        case 'KEYPAD-PHONETYPE': case 'KEYPAD-SMALLCALC':
          t.keys.forEach((row, r) => row.forEach((k, ci) => m.shorts.push({ key: p.id + ':' + k, a: net(p, 'ABCD'[r]), b: net(p, String(ci + 1)) })));
          break;
        case 'LOGICSTATE': m.logic.push({ id: p.id, n: net(p, '1'), init: String(p.value || '').trim() === '1' }); break;
        case 'RES': m.res.push([net(p, '1'), net(p, '2')]); m.resR.push(ohms(p.value, 10000)); break;
        case 'POT-HG': {
          const pos = typeof p.pos === 'number' && p.pos >= 0 && p.pos <= 1 ? p.pos : 0.5;
          m.pot.push({ id: p.id, a: net(p, '1'), b: net(p, '2'), w: net(p, '3'), r: ohms(p.value, 10000), init: pos });
          break;
        }
        case 'DC-VOLTMETER': m.vm.push({ id: p.id, p: net(p, '+'), n: net(p, '-') }); break;
        case '7448': case '7447': {
          const d = { id: p.id, inv: p.type === '7447', inp: ['7', '1', '2', '6'].map(n => net(p, n)), lt: net(p, '3'), bi: net(p, '4'), rbi: net(p, '5'), out: DECOUT.map(n => net(p, n)) };
          m.dec.push(d); m.ttl.push(...d.inp, d.lt, d.bi, d.rbi); break;
        }
        case '7SEG-MPX1-CC': lit(p, SEGN.concat('DP').map(s => [s, s, 'K'])); break;
        case '7SEG-MPX1-CA': lit(p, SEGN.concat('DP').map(s => [s, 'COM', s])); break;
        case '7SEG-MPX4-CC': case '7SEG-MPX4-CA': case '7SEG-MPX2-CC': case '7SEG-MPX2-CA': {
          const ca = /CA$/.test(p.type), it = [], nd = /MPX2/.test(p.type) ? 2 : 4;
          for (let d = 1; d <= nd; d++) for (const s of SEGN.concat('DP')) it.push(ca ? [d + s, String(d), s] : [d + s, s, String(d)]);
          lit(p, it); break;
        }
        case 'LED-RED': case 'LED-GREEN': case 'LED-YELLOW': case 'LED-BLUE': lit(p, [['ON', 'A', 'K']]); break;
        case 'LED-BARGRAPH-RED': lit(p, Array.from({ length: 10 }, (_, i) => [String(i + 1), 'A' + (i + 1), 'K' + (i + 1)])); break;
        case '7SEG-BCD': m.tt[p.id] = ttOf(p); m.bcd.push({ id: p.id, n: ['1', '2', '4', '8'].map(b => net(p, b)) }); break;
        case 'NPN': m.npn.push({ id: p.id, b: net(p, 'B'), c: net(p, 'C'), e: net(p, 'E') }); break;
        case 'LM016L': case 'LM044L': m.lcd.push({ id: p.id, clk: (x => x >= 50e3 && x <= 1e6 ? x : 250e3)(pe(p.clock)), cols: p.type === 'LM044L' ? 20 : 16, rows: p.type === 'LM044L' ? 4 : 2, rs: net(p, '4'), rw: net(p, '5'), e: net(p, '6'), d: [7, 8, 9, 10, 11, 12, 13, 14].map(n => net(p, String(n))) }); break;
        case 'TRAFFIC-LIGHTS': lit(p, [['R', 'R', null], ['A', 'A', null], ['G', 'G', null]]); break;
        case '74HC595': m.hc.push({ id: p.id, ds: net(p, '14'), sh: net(p, '11'), st: net(p, '12'), mr: net(p, '10'), oe: net(p, '13'), q: ['15', '1', '2', '3', '4', '5', '6', '7'].map(n => net(p, n)), q7s: net(p, '9') }); break;
        case 'L293D': {
          const ch = [['1', '2', '3'], ['1', '7', '6'], ['9', '10', '11'], ['9', '15', '14']].map(([e, a, y]) => ({ en: net(p, e), a: net(p, a), y: net(p, y) }));
          m.l293.push({ id: p.id, ch }); for (const c of ch) m.ttl.push(c.en, c.a); break;
        }
        case 'RELAY':
          m.relay.push({ id: p.id, a: net(p, '1'), b: net(p, '2') });
          m.shorts.push({ key: p.id + ':K', a: net(p, 'COM'), b: net(p, 'NO') }, { key: p.id + ':K', inv: true, a: net(p, 'COM'), b: net(p, 'NC') });
          break;
        case 'TERMINAL': { const nm = labelName(p); if (RAIL1.has(nm)) m.c1.push(net(p, '1')); else if (RAIL0.has(nm)) m.c0.push(net(p, '1')); break; }
        case 'OSCILLOSCOPE': case 'LOGIC-ANALYSER': m.inst.push({ id: p.id, type: p.type, pins: t.pins.map(q => [q.num, net(p, q.num)]) }); break;
        case 'VIRTUAL-TERMINAL': m.term.push({ id: p.id, rxd: net(p, 'RXD'), txd: net(p, 'TXD'), cfg: lib && lib.termCfg ? lib.termCfg(p) : { baud: 9600, dataBits: 8, parity: 'NONE', stopBits: 1, xonxoff: 0, sigPol: 0, ctlPol: 0 } }); break;
        case 'BUZZER': m.buzz.push({ id: p.id, a: net(p, '1'), b: net(p, '2') }); break;
        case 'MOTOR': m.motor.push({ id: p.id, a: net(p, '1'), b: net(p, '2') }); break;
        case 'PIC16F628A':
          m.pics++;
          if (!m.pic) {
            const pins = [new Array(8).fill(-1), new Array(8).fill(-1)];
            for (const k in PICPIN) pins[PICPIN[k][0]][PICPIN[k][1]] = net(p, k);
            m.pic = { id: p.id, pins, props: lib && lib.picProps ? lib.picProps(p) : null };
          }
          break;
      }
    }
    m.ttl = m.ttl.filter(n => n >= 0);
    m.btn = m.shorts;
    const via = n => { const s = new Set([n]); if (n >= 0) for (const [a, b] of m.res) { if (a === n && b >= 0) s.add(b); else if (b === n && a >= 0) s.add(a); } return s; };
    for (const t of m.term) { t.rxs = via(t.rxd); t.txs = via(t.txd); }
    return m;
  }

  function picDrive(trisA, latA, trisB, latB) {
    let dA = (~trisA) & 0xDF & 255;
    if (latA & 0x10) dA &= ~0x10;
    const dB = (~trisB) & 255;
    return [dA, latA & dA, dB, latB & dB];
  }

  function eval7448(d, val) {
    const v = n => n < 0 ? 1 : (val[n] === 0 ? 0 : 1);
    const code = v(d.inp[0]) | v(d.inp[1]) << 1 | v(d.inp[2]) << 2 | v(d.inp[3]) << 3;
    const lt = v(d.lt), bi = v(d.bi), rbi = v(d.rbi);
    const rbo = rbi === 0 && lt === 1 && code === 0;
    const o = new Array(8);
    for (let j = 0; j < 7; j++) o[j] = (bi === 0 || rbo) ? 0 : lt === 0 ? 1 : (SEG[code] >> (6 - j)) & 1;
    o[7] = rbo ? 0 : 1;
    return o;
  }
  function eval7447(d, val) {
    const o = eval7448(d, val);
    for (let j = 0; j < 7; j++) o[j] ^= 1;
    return o;
  }

  function evalDyn(m, val, seq) {
    const out = [];
    for (const h of m.hc) {
      const s = seq && seq[h.id], sr = s ? s.sr : 0, q = s ? s.q : 0;
      if (!(h.oe >= 0 && val[h.oe] === 1)) for (let b = 0; b < 8; b++) if (h.q[b] >= 0) out.push(h.q[b], (q >> b) & 1);
      if (h.q7s >= 0) out.push(h.q7s, (sr >> 7) & 1);
    }
    for (const d of m.l293) for (const c of d.ch) {
      if (c.y < 0 || (c.en >= 0 && val[c.en] === 0)) continue;
      out.push(c.y, c.a >= 0 && val[c.a] === 0 ? 0 : 1);
    }
    return out;
  }

  function elements(m, pot) {
    const el = [];
    m.res.forEach((r, i) => el.push([r[0], r[1], m.resR[i] || 10000]));
    for (const q of m.pot) {
      const x = pot && q.id in pot ? pot[q.id] : q.init;
      el.push([q.a, q.w, Math.max(RMIN, q.r * x)], [q.w, q.b, Math.max(RMIN, q.r * (1 - x))]);
    }
    return el;
  }
  function analogCore(N, root, fix, el, extra) {
    const V = new Float64Array(N).fill(NaN), G = new Map(), adj = new Map();
    for (let r = 0; r < N; r++) if (fix[r] >= 0) V[r] = fix[r] === 3 ? VDD / 2 : fix[r] * VDD;
    const link = (a, b, g) => {
      if (a === b) return;
      let x = adj.get(a); if (!x) adj.set(a, x = new Map()); x.set(b, (x.get(b) || 0) + g);
      let y = adj.get(b); if (!y) adj.set(b, y = new Map()); y.set(a, (y.get(a) || 0) + g);
    };
    for (const [a, b, R] of el) if (a >= 0 && b >= 0) link(root[a], root[b], 1 / R);
    const src = new Map();
    if (extra) for (const [n, v, R] of extra) if (n >= 0) { const r = root[n]; if (fix[r] < 0) { const s = src.get(r) || [0, 0]; s[0] += 1 / R; s[1] += v / R; src.set(r, s); } }
    const seen = new Uint8Array(N);
    for (const start of new Set([...adj.keys(), ...src.keys()])) {
      if (seen[start] || fix[start] >= 0) continue;
      const comp = [start]; seen[start] = 1;
      let fixed = false;
      for (let k = 0; k < comp.length; k++) {
        const u = comp[k];
        if (src.has(u)) fixed = true;
        const nb = adj.get(u); if (!nb) continue;
        for (const v of nb.keys()) {
          if (fix[v] >= 0) { fixed = true; continue; }
          if (!seen[v]) { seen[v] = 1; comp.push(v); }
        }
      }
      if (!fixed) continue;
      const n = comp.length, idx = new Map();
      comp.forEach((u, i) => idx.set(u, i));
      const A = Array.from({ length: n }, () => new Float64Array(n + 1));
      comp.forEach((u, i) => {
        const nb = adj.get(u), s = src.get(u);
        if (s) { A[i][i] += s[0]; A[i][n] += s[1]; }
        if (nb) for (const [v, g] of nb) {
          A[i][i] += g;
          if (fix[v] >= 0) A[i][n] += g * V[v]; else A[i][idx.get(v)] -= g;
        }
      });
      for (let c = 0; c < n; c++) {
        let pv = c;
        for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[pv][c])) pv = r;
        if (pv !== c) { const t = A[c]; A[c] = A[pv]; A[pv] = t; }
        const d = A[c][c];
        if (!d) continue;
        for (let r = 0; r < n; r++) {
          if (r === c || !A[r][c]) continue;
          const f = A[r][c] / d;
          for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
        }
      }
      comp.forEach((u, i) => { const d = A[i][i]; V[u] = d ? A[i][n] / d : NaN; });
    }
    return V;
  }

  function solve(m, drv, pressed, seq, pot) {
    const N = m.N, up = new Int32Array(N);
    pressed = pressed || {};
    for (let i = 0; i < N; i++) up[i] = i;
    const find = i => { while (up[i] !== i) { up[i] = up[up[i]]; i = up[i]; } return i; };
    for (const b of m.shorts) if ((b.inv ? !pressed[b.key] : pressed[b.key]) && b.a >= 0 && b.b >= 0) { const x = find(b.a), y = find(b.b); if (x !== y) up[x] = y; }
    const root = new Int32Array(N);
    for (let i = 0; i < N; i++) root[i] = find(i);
    const ela = m.pot.length ? elements(m, pot) : null;
    const res = (ela || m.res).filter(r => r[0] >= 0 && r[1] >= 0).map(r => [root[r[0]], root[r[1]]]);
    const pull = [];
    if (drv && m.pic && drv[4]) for (let b = 0; b < 8; b++) if ((drv[4] >> b) & 1 && m.pic.pins[1][b] >= 0) pull.push(m.pic.pins[1][b]);
    let dec = m.dec.map(() => null), npn = m.npn.map(() => false), val = new Int8Array(N).fill(2), conflict = false, dyn = null, fixOut = null, gvOut = null;
    const hasDyn = m.hc.length + m.l293.length > 0;
    for (let it = 0; it < 12; it++) {
      const d1 = new Uint8Array(N), d0 = new Uint8Array(N);
      const drive = (n, v) => { if (n < 0) return; if (v) d1[root[n]] = 1; else d0[root[n]] = 1; };
      for (const n of m.c1) drive(n, 1);
      for (const n of m.c0) drive(n, 0);
      for (const l of m.logic) drive(l.n, pressed[l.id] ? 1 : 0);
      for (const t of m.term) drive(t.txd, 1);
      if (drv && m.pic) for (let port = 0; port < 2; port++) {
        const dm = drv[port * 2], vv = drv[port * 2 + 1];
        for (let b = 0; b < 8; b++) if ((dm >> b) & 1) drive(m.pic.pins[port][b], (vv >> b) & 1);
      }
      dec.forEach((o, i) => {
        if (!o) return;
        const d = m.dec[i];
        for (let j = 0; j < 7; j++) if (!d.inv || !o[j]) drive(d.out[j], o[j]);
        if (o[7] === 0) drive(d.bi, 0);
      });
      if (dyn) for (let k = 0; k < dyn.length; k += 2) drive(dyn[k], dyn[k + 1]);
      const gv = new Int8Array(N).fill(-1), lvl = new Int32Array(N).fill(-1);
      conflict = false;
      for (let r = 0; r < N; r++) {
        if (d1[r] && d0[r]) { gv[r] = 3; lvl[r] = 0; conflict = true; }
        else if (d1[r]) { gv[r] = 1; lvl[r] = 0; }
        else if (d0[r]) { gv[r] = 0; lvl[r] = 0; }
      }
      npn.forEach((on, i) => { const q = m.npn[i]; if (on && q.c >= 0 && gv[root[q.c]] === -1) { gv[root[q.c]] = 0; lvl[root[q.c]] = 0; } });
      for (let L = 0; res.length; L++) {
        const acc = new Map();
        for (const [a, b] of res) {
          for (const [x, y] of [[a, b], [b, a]]) {
            if (lvl[x] === L && gv[y] === -1) acc.set(y, (acc.get(y) || 0) | (gv[x] === 1 ? 2 : gv[x] === 0 ? 1 : 4));
          }
        }
        if (!acc.size) break;
        for (const [y, f] of acc) { gv[y] = f === 2 ? 1 : f === 1 ? 0 : 3; lvl[y] = L + 1; }
      }
      if (ela) {
        let mixed = false;
        for (let r = 0; r < N; r++) if (gv[r] === 3 && lvl[r] > 0) { mixed = true; break; }
        if (mixed) {
          const fx = new Int8Array(N).fill(-1);
          for (let r = 0; r < N; r++) if (lvl[r] === 0) fx[r] = gv[r];
          const V = analogCore(N, root, fx, ela);
          for (let r = 0; r < N; r++) if (gv[r] === 3 && lvl[r] > 0 && V[r] === V[r]) gv[r] = V[r] >= VDD / 2 ? 1 : 0;
        }
      }
      for (const n of m.ttl) if (gv[root[n]] === -1) gv[root[n]] = 1;
      for (const n of pull) if (gv[root[n]] === -1) gv[root[n]] = 1;
      for (let i = 0; i < N; i++) { const g = gv[root[i]]; val[i] = g === 0 ? 0 : g === 1 ? 1 : 2; }
      const nd = m.dec.map(d => d.inv ? eval7447(d, val) : eval7448(d, val));
      const nn = m.npn.map(q => q.b >= 0 && q.e >= 0 && val[q.b] === 1 && val[q.e] === 0);
      let same = nn.every((v, i) => v === npn[i]);
      for (let i = 0; i < nd.length && same; i++) if (!dec[i] || dec[i].join() !== nd[i].join()) same = false;
      let ndyn = null;
      if (hasDyn) { ndyn = evalDyn(m, val, seq); if (same && (!dyn || dyn.join() !== ndyn.join())) same = false; }
      if (same) { fixOut = lvl; gvOut = gv; break; }
      dec = nd; npn = nn; dyn = ndyn; fixOut = lvl; gvOut = gv;
    }
    let inA = 0, inB = 0, flA = 0, flB = 0;
    if (m.pic) for (let b = 0; b < 8; b++) {
      const a = m.pic.pins[0][b], bb = m.pic.pins[1][b];
      if (a >= 0 && val[a] === 1) inA |= 1 << b;
      if (bb >= 0 && val[bb] === 1) inB |= 1 << b;
      if (a < 0 || val[a] === 2) flA |= 1 << b;
      if (bb < 0 || val[bb] === 2) flB |= 1 << b;
    }
    const lit = {};
    for (const s of m.lits) {
      const L = {};
      for (const [k, a, c] of s.items) L[k] = a >= 0 && val[a] === 1 && (c === -2 || (c >= 0 && val[c] === 0));
      lit[s.id] = L;
    }
    for (const s of m.bcd) {
      const L = {};
      if (s.n.some(n => n >= 0 && val[n] !== 2)) {
        const v = s.n.reduce((acc, n, i) => acc | (n >= 0 && val[n] === 1 ? 1 << i : 0), 0);
        for (let j = 0; j < 7; j++) L[SEGN[j]] = !!((HEXSEG[v] >> (6 - j)) & 1);
      }
      lit[s.id] = L;
    }
    return { val, inA, inB, flA, flB, lit, conflict, root, lvl: fixOut, gv: gvOut };
  }
  function fixOf(r) {
    const N = r.root.length, fix = new Int8Array(N).fill(-1);
    if (r.lvl) for (let i = 0; i < N; i++) if (r.lvl[i] === 0 && r.gv[i] >= 0) fix[i] = r.gv[i];
    return fix;
  }

  function analog(m, r, pot, vref) {
    if (!r || !r.root) return null;
    const extra = [];
    if (vref != null && m.pic && m.pic.pins[0][2] >= 0) extra.push([m.pic.pins[0][2], vref, VREF_R]);
    const V = analogCore(m.N, r.root, fixOf(r), elements(m, pot), extra), out = new Float64Array(m.N);
    for (let i = 0; i < m.N; i++) out[i] = V[r.root[i]];
    return out;
  }

  function decode(lit) {
    if (!lit) return ' ';
    let v = 0;
    for (let i = 0; i < 7; i++) if (lit[SEGN[i]]) v |= 1 << (6 - i);
    if (!v) return ' ';
    const d = SEG.indexOf(v);
    if (d >= 0 && d < 10) return String(d);
    return v === 0x5F ? '6' : v === 0x7B ? '9' : v === 0x72 ? '7' : '?';
  }

  function lcdNew() {
    return { dd: [new Uint8Array(40).fill(32), new Uint8Array(40).fill(32)], cg: new Uint8Array(64), row: 0, col: 0, cga: 0, cgMode: false, inc: 1, shiftOn: 0, sh: 0,
      disp: 0, cur: 0, blink: 0, dl8: true, two: 1, half: -1, e: 0, cgUsed: false, busyUntil: 0, lastC: -1, clk: 250e3 };
  }
  function lcdMove(s, dir) {
    s.col += dir;
    if (s.col > 39) { s.col = 0; s.row ^= 1; } else if (s.col < 0) { s.col = 39; s.row ^= 1; }
  }
  function lcdExec(s, rs, b) {
    if (rs) {
      if (s.cgMode) { s.cg[s.cga & 63] = b & 0x1F; s.cga = (s.cga + (s.inc ? 1 : -1)) & 63; s.cgUsed = true; return; }
      s.dd[s.row][s.col] = b;
      lcdMove(s, s.inc ? 1 : -1);
      if (s.shiftOn) s.sh += s.inc ? 1 : -1;
      return;
    }
    if (b & 0x80) { const a = b & 0x7F; s.row = a >= 0x40 ? 1 : 0; s.col = Math.min(39, a & 0x3F); s.cgMode = false; }
    else if (b & 0x40) { s.cga = b & 0x3F; s.cgMode = true; }
    else if (b & 0x20) { s.dl8 = !!(b & 0x10); s.two = (b >> 3) & 1; s.half = -1; }
    else if (b & 0x10) { if (b & 8) s.sh += b & 4 ? -1 : 1; else lcdMove(s, b & 4 ? 1 : -1); }
    else if (b & 8) { s.disp = (b >> 2) & 1; s.cur = (b >> 1) & 1; s.blink = b & 1; }
    else if (b & 4) { s.inc = (b >> 1) & 1; s.shiftOn = b & 1; }
    else if (b & 2) { s.row = 0; s.col = 0; s.sh = 0; s.cgMode = false; }
    else if (b & 1) { s.dd[0].fill(32); s.dd[1].fill(32); s.row = 0; s.col = 0; s.sh = 0; s.inc = 1; s.cgMode = false; }
  }
  const LCD_BUSY = { cmd: 'Controller received command whilst busy.', data: 'Controller received data whilst busy.' };
  function lcdBusy(s, rs, b, cyc, fosc) {
    if (cyc == null || !(fosc > 0)) return null;
    if (cyc < s.lastC) s.busyUntil = 0;
    const w = cyc < s.busyUntil ? (rs ? LCD_BUSY.data : LCD_BUSY.cmd) : null;
    const slow = !rs && (b === 1 || (b & 0xFE) === 2);
    s.busyUntil = cyc + (slow ? 1.64e-3 : 40e-6) * (250e3 / (s.clk || 250e3)) * fosc / 4; s.lastC = cyc;
    return w;
  }
  function lcdClock(s, rs, data, nib, cyc, fosc) {
    if (s.dl8) { const w = lcdBusy(s, rs, data, cyc, fosc); lcdExec(s, rs, data); return w; }
    if (s.half < 0) { s.half = nib; return null; }
    const b = (s.half << 4) | nib;
    s.half = -1;
    const w = lcdBusy(s, rs, b, cyc, fosc);
    lcdExec(s, rs, b);
    return w;
  }
  function lcdView(s, cols, rows) {
    cols = cols || 16; rows = rows || 2;
    const blank = Array.from({ length: rows }, () => '');
    if (!s.disp) return { lines: blank, cursor: null, disp: false };
    const off = ((s.sh % 40) + 40) % 40, lines = [];
    for (let r = 0; r < rows; r++) {
      const base = (r >> 1) * cols, dd = s.dd[r & 1];
      let t = '';
      for (let c = 0; c < cols; c++) t += String.fromCharCode(dd[(base + c + off) % 40]);
      lines.push(t.replace(/ +$/, ''));
    }
    const vc = ((s.col - off) % 40 + 40) % 40;
    let cursor = null;
    if (s.cur || s.blink) {
      if (vc < cols) cursor = { row: s.row, col: vc, blink: !!s.blink };
      else if (rows > 2 && vc < 2 * cols) cursor = { row: s.row + 2, col: vc - cols, blink: !!s.blink };
    }
    const v = { lines, cursor, disp: true };
    if (s.cgUsed) v.cg = Array.from(s.cg);
    return v;
  }

  const REC_CAP = 65536;
  class Rec {
    constructor(runner, cap) { this.r = runner; this.cap = cap || REC_CAP; this.channels = []; this.b = []; this.pn = 0; }
    add(ch, cyc) {
      this.channels.push(ch);
      const c = { t: new Float64Array(this.cap), v: new Uint8Array(this.cap), n: 0, lt: -1, lv: -1 };
      this.b.push(c);
      const res = this.r.res;
      if (res) this.push(this.b.length - 1, cyc == null ? this.r.lastCyc : cyc, ch.net >= 0 ? res.val[ch.net] : 2);
      this.r.recOn = true;
      return ch;
    }
    push(i, cyc, lv) {
      const c = this.b[i], cap = this.cap;
      if (c.n && cyc < c.lt) { this.restart(cyc); return; }
      if (c.lv === lv) return;
      if (c.n && cyc === c.lt) {
        const k = (c.n - 1) % cap;
        if (c.n > 1 && c.v[(c.n - 2) % cap] === lv) { c.n--; c.lv = lv; c.lt = c.t[(c.n - 1) % cap]; return; }
        c.v[k] = lv; c.lv = lv; return;
      }
      const k = c.n % cap;
      c.t[k] = cyc; c.v[k] = lv; c.n++; c.lt = cyc; c.lv = lv;
    }
    sample(res, cyc) {
      const v = res.val;
      for (let i = 0; i < this.channels.length; i++) { const n = this.channels[i].net; this.push(i, cyc, n >= 0 ? v[n] : 2); }
    }
    restart(cyc) {
      for (const c of this.b) { c.n = 0; c.lt = -1; c.lv = -1; }
      const res = this.r.res;
      if (res) this.sample(res, cyc);
    }
    clear() { this.restart(this.r.lastCyc || 0); }
    oldest(i) { const c = this.b[i]; if (!c || !c.n) return null; return c.t[Math.max(0, c.n - this.cap) % this.cap]; }
    count(i) { const c = this.b[i]; return c ? c.n : 0; }
    dropped(i) { const c = this.b[i]; return c ? Math.max(0, c.n - this.cap) : 0; }
    level(i, t) { const d = this.read(i, t, t); return d.v.length ? d.v[d.v.length - 1] : 2; }
    read(i, t0, t1) {
      const c = this.b[i], cap = this.cap;
      if (t1 == null) t1 = Infinity;
      if (t0 == null) t0 = -Infinity;
      if (!c || !c.n || t1 < t0) return { t: new Float64Array(0), v: new Uint8Array(0) };
      const lo = Math.max(0, c.n - cap), hi = c.n - 1, T = k => c.t[k % cap];
      const last = (x) => { let a = lo, z = hi, r = lo - 1; while (a <= z) { const mid = (a + z) >> 1; if (T(mid) <= x) { r = mid; a = mid + 1; } else z = mid - 1; } return r; };
      let k0 = last(t0); if (k0 < lo) k0 = lo;
      const k1 = last(t1);
      if (k1 < k0) return { t: new Float64Array(0), v: new Uint8Array(0) };
      const n = k1 - k0 + 1, t = new Float64Array(n), v = new Uint8Array(n);
      for (let j = 0; j < n; j++) { const k = (k0 + j) % cap; t[j] = c.t[k]; v[j] = c.v[k]; }
      if (t[0] < t0) t[0] = t0;
      return { t, v };
    }
  }

  const WIN = 20000, RING = 4096, POT_STEP = 0.05;
  function uartLib() {
    if (typeof UART !== 'undefined' && UART && UART.transfer) return UART; // eslint-disable-line no-undef
    if (typeof global !== 'undefined' && global.UART && global.UART.transfer) return global.UART;
    if (typeof require === 'function') { try { const u = require('./uart.js'); if (u && u.transfer) return u; } catch (e) { /* not present */ } }
    return null;
  }
  const dir2 = (r, a, b) => { if (!r || a < 0 || b < 0) return 0; const x = r.val[a], y = r.val[b]; return x === 1 && y === 0 ? 1 : x === 0 && y === 1 ? -1 : 0; };
  function pinLabel(m, net) {
    if (!m.pic || net < 0) return '';
    for (let port = 0; port < 2; port++) for (let b = 0; b < 8; b++) if (m.pic.pins[port][b] === net) return (port ? 'RB' : 'RA') + b;
    return '';
  }
  class Runner {
    constructor(m, opts) {
      opts = opts || {};
      this.m = m; this.pressed = {}; this.cache = new Map(); this.solves = 0; this.budget = 3000;
      for (const l of m.logic) if (l.init) this.pressed[l.id] = true;
      this.rr = new Array(RING); this.rt = new Float64Array(RING); this.rn = 0;
      this.cur = null; this.res = null; this.last = [255, 0, 255, 0]; this.lastCyc = 0;
      this.win = WIN; this.fosc = 4e6; this.pull = 0;
      this.lcd = {}; for (const d of m.lcd) { this.lcd[d.id] = lcdNew(); this.lcd[d.id].clk = d.clk; }
      this.warn = []; this.fCyc = -1; this.rxPend = [];
      this.term = {}; for (const t of m.term) this.term[t.id] = { text: '', q: [], cr: false, hex: false, hexText: '', echo: false, paused: false, hold: [], bell: 0 };
      this.seq = {}; for (const h of m.hc) this.seq[h.id] = { sr: 0, q: 0, sh: 0, st: 0 };
      this.seqOn = m.lcd.length + m.hc.length + m.relay.length > 0;
      this.recOn = false; this.probes = 0;
      this.pot = {}; for (const q of m.pot) this.pot[q.id] = q.init;
      this.aver = 0; this.pver = 0; this.vref = null;
      this.rec = new Rec(this, opts.recCap);
      const ex = m.ex, used = n => n >= 0 && ex.nets[n] && (ex.nets[n].pins.length > 1 || ex.nets[n].wires.length > 0);
      const chans = [];
      for (const ins of m.inst) for (const [pin, net] of ins.pins) if (used(net)) {
        const pl = pinLabel(m, net);
        chans.push({ id: ins.id + ':' + pin, part: ins.id, pin, net, kind: ins.type === 'OSCILLOSCOPE' ? 'osc' : 'la', label: ins.id + ' ' + pin + (pl ? ' (' + pl + ')' : '') });
      }
      this.port(255, 0, 255, 0, 0, true);
      for (const ch of chans) this.rec.add(ch, 0);
    }
    get(key, drv, force) {
      let r = this.cache.get(key);
      if (r) return r;
      if (!force && !this.seqOn && !this.recOn && this.solves >= this.budget) return null;
      this.solves++;
      if (this.cache.size > 4096) this.cache.clear();
      r = solve(this.m, this.m.pic ? drv : null, this.pressed, this.seq, this.pot);
      r.drv = drv;
      this.cache.set(key, r);
      return r;
    }
    port(trisA, latA, trisB, latB, cyc, force) {
      const drv = this.m.pic ? picDrive(trisA, latA, trisB, latB) : [0, 0, 0, 0];
      const pl = this.m.pic ? this.pull & trisB & 255 : 0;
      drv.push(pl);
      const key = (((drv[0] * 256 + drv[1]) * 256 + drv[2]) * 256 + drv[3]) + pl * 4294967296;
      this.last = [trisA, latA, trisB, latB]; this.lastCyc = cyc || 0;
      if (key === this.cur && !force) return this.res;
      let r = this.get(key, drv, force);
      if (!r) return this.res;
      if (this.seqOn) r = this.settle(r, key, drv);
      if (r !== this.res) { const i = this.rn % RING; this.rr[i] = r; this.rt[i] = cyc || 0; this.rn++; this.aver++; }
      this.cur = key; this.res = r;
      if (this.recOn) this.rec.sample(r, cyc || 0);
      return r;
    }
    settle(r, key, drv) {
      for (let k = 0; k < 8 && this.edges(r); k++) {
        this.cache.clear();
        this.solves++;
        r = solve(this.m, this.m.pic ? drv : null, this.pressed, this.seq, this.pot);
        r.drv = drv;
        this.cache.set(key, r);
      }
      return r;
    }
    edges(r) {
      const v = r.val, hi = n => n >= 0 && v[n] === 1 ? 1 : 0;
      let changed = false;
      for (const d of this.m.lcd) {
        const s = this.lcd[d.id], e = hi(d.e);
        if (s.e && !e && !hi(d.rw)) {
          let data = 0;
          for (let i = 0; i < 8; i++) data |= hi(d.d[i]) << i;
          const w = lcdClock(s, hi(d.rs), data, data >> 4, this.lastCyc, this.fosc);
          if (w) this.addWarn(d.rows > 2 ? 'LM044L' : 'LM016L', d.id, w);
        }
        s.e = e;
      }
      for (const h of this.m.hc) {
        const s = this.seq[h.id], sh = hi(h.sh), st = hi(h.st), mr = h.mr >= 0 && v[h.mr] === 0 ? 0 : 1;
        let sr = s.sr, q = s.q;
        if (st && !s.st) q = s.sr;
        if (!mr) sr = 0;
        else if (sh && !s.sh) sr = ((sr << 1) | hi(h.ds)) & 255;
        s.sh = sh; s.st = st;
        if (sr !== s.sr || q !== s.q) { s.sr = sr; s.q = q; changed = true; }
      }
      for (const rl of this.m.relay) {
        const on = dir2(r, rl.a, rl.b) !== 0, k = rl.id + ':K';
        if (!!this.pressed[k] !== on) { this.pressed[k] = on; changed = true; }
      }
      return changed;
    }
    probe(target, label) {
      const ex = this.m.ex;
      let net = -1;
      if (typeof target === 'number') net = target;
      else if (target && target.wire != null) net = ex.wireNet[target.wire];
      else if (target && target.pin != null) net = ex.pinNet[target.pin];
      else if (typeof target === 'string') net = ex.pinNet[target] !== undefined ? ex.pinNet[target] : ex.wireNet[target];
      if (net === undefined || net < 0 || net >= this.m.N) return null;
      const ex2 = this.rec.channels.find(c => c.net === net && c.probe);
      if (ex2) return ex2;
      const k = ++this.probes, pl = pinLabel(this.m, net);
      return this.rec.add({ id: 'PRB' + k, part: null, pin: null, net, kind: 'probe', probe: true, label: label || ('Probe ' + k + (pl ? ' (' + pl + ')' : '')) });
    }
    unprobe(id) {
      const i = this.rec.channels.findIndex(c => c.id === id && c.probe);
      if (i < 0) return false;
      this.rec.channels.splice(i, 1); this.rec.b.splice(i, 1);
      this.recOn = this.rec.channels.length > 0;
      return true;
    }
    netOf(target) {
      const ex = this.m.ex;
      let net;
      if (typeof target === 'number') net = target;
      else if (target && target.wire != null) net = ex.wireNet[target.wire];
      else if (target && target.pin != null) net = ex.pinNet[target.pin];
      else if (target && target.pic != null) {
        if (!this.m.pic) return -1;
        const k = String(target.pic).toUpperCase(), mm = /^R([AB])([0-7])$/.exec(k);
        net = mm ? this.m.pic.pins[mm[1] === 'A' ? 0 : 1][+mm[2]] : typeof target.pic === 'number' ? this.m.pic.pins[0][target.pic] : -1;
      }
      else if (typeof target === 'string') net = ex.pinNet[target] !== undefined ? ex.pinNet[target] : ex.wireNet[target];
      return net === undefined || net < 0 || net >= this.m.N ? -1 : net;
    }
    volts() {
      const r = this.res;
      if (!r) return null;
      if (r.avp !== this.pver) { r.av = analog(this.m, r, this.pot, this.vref); r.avp = this.pver; }
      return r.av;
    }
    analog(target) {
      const n = this.netOf(target);
      if (n < 0) return null;
      const V = this.volts();
      if (!V) return null;
      const v = V[n];
      return v === v ? Math.round(v * 1e6) / 1e6 : null;
    }
    picAnalog(bit) {
      if (!this.m.pic) return null;
      const n = this.m.pic.pins[0][bit & 7];
      if (n < 0) return null;
      const V = this.volts();
      return V && V[n] === V[n] ? V[n] : null;
    }
    setVref(v) {
      v = v == null || !(v === v) ? null : +v;
      if (v === this.vref) return;
      this.vref = v; this.aver++; this.pver++;
    }
    potPos(id) { return id in this.pot ? this.pot[id] : null; }
    setPot(id, x, cyc) {
      if (!(id in this.pot) || !(x === x)) return this.res;
      x = Math.max(0, Math.min(1, Math.round(x * 1000) / 1000));
      if (x === this.pot[id]) return this.res;
      this.pot[id] = x; this.aver++; this.pver++;
      this.cache.clear();
      const l = this.last;
      return this.port(l[0], l[1], l[2], l[3], cyc == null ? this.lastCyc : cyc, true);
    }
    contention() {
      const r = this.res;
      if (!r || !r.conflict || !r.root) return [];
      const ex = this.m.ex, fix = fixOf(r), out = [];
      for (let rt = 0; rt < this.m.N; rt++) {
        if (fix[rt] !== 3) continue;
        const nets = [];
        for (let j = 0; j < this.m.N; j++) if (r.root[j] === rt) nets.push(j);
        let lb = '';
        for (const j of nets) if (!lb) lb = pinLabel(this.m, j);
        const pins = [].concat(...nets.map(j => ex.nets[j].pins));
        out.push(lb || pins[0] || ('#' + rt));
      }
      return out;
    }
    press(id, v, cyc) {
      id = String(id);
      const t = this.m.types[id.split(':')[0]];
      if (t === 'POT-HG') {
        const pid = id.split(':')[0], k = id.slice(pid.length + 1), x = this.pot[pid];
        if (!v || x == null) return this.res;
        if (k === '+' || k === '-') return this.setPot(pid, x + (k === '+' ? POT_STEP : -POT_STEP), cyc);
        if (k[0] === '=') return this.setPot(pid, parseFloat(k.slice(1)), cyc);
        return this.res;
      }
      if (TOGGLE.has(t)) { if (!v) return this.res; this.pressed[id] = !this.pressed[id]; }
      else { if (!!this.pressed[id] === !!v) return this.res; this.pressed[id] = !!v; }
      this.cache.clear();
      const l = this.last;
      return this.port(l[0], l[1], l[2], l[3], cyc == null ? this.lastCyc : cyc, true);
    }
    setPullups(mask, cyc) {
      mask &= 255;
      if (mask === this.pull) return this.res;
      this.pull = mask;
      const l = this.last;
      return this.port(l[0], l[1], l[2], l[3], cyc == null ? this.lastCyc : cyc, true);
    }
    setClock(fosc) {
      if (!(fosc > 0)) return;
      this.fosc = fosc; this.win = Math.max(500, Math.round(fosc / 4 * 0.02));
    }
    addWarn(mod, id, text) {
      for (const w of this.warn) if (w.id === id && w.text === text) { w.count = (w.count || 1) + 1; return; }
      if (this.warn.length < 200) this.warn.push({ mod, id, cyc: this.lastCyc, text });
    }
    warnings() { const w = this.warn; this.warn = []; return w; }
    pinLevel(id, pin) {
      const n = this.m.ex.pinNet[id + '.' + pin], r = this.res;
      return n === undefined || n < 0 || !r ? 2 : r.val[n];
    }
    uartTx(byte, cyc, frame) {
      if (!this.m.pic) return false;
      const tx = this.m.pic.pins[1][2], U = frame && frame.bitCyc > 0 ? uartLib() : null;
      let ok = false;
      if (tx >= 0) for (const t of this.m.term) if (t.rxd === tx || (t.rxs && t.rxs.has(tx))) {
        ok = true;
        if (U) {
          const c = t.cfg;
          for (const r of U.transfer(byte, { bitCyc: frame.bitCyc, dataBits: frame.dataBits === 9 ? 9 : 8 },
            { bitCyc: this.fosc / 4 / c.baud, dataBits: c.dataBits, parity: c.parity, stopBits: c.stopBits, invert: !!c.sigPol })) this.termPut(this.term[t.id], r.byte);
        } else this.termPut(this.term[t.id], byte);
      }
      return ok;
    }
    uartRx(cfg) {
      if (!this.m.pic) return null;
      const rx = this.m.pic.pins[1][1];
      if (rx < 0) return null;
      const U = cfg && cfg.bitCyc > 0 ? uartLib() : null;
      if (cfg && this.rxPend.length) return this.rxPend.shift();
      for (const t of this.m.term) if (t.txd === rx || (t.txs && t.txs.has(rx))) {
        const q = this.term[t.id].q;
        while (q.length) {
          const b = q.shift();
          if (!cfg) return b;
          if (!U) return { byte: b, ferr: 0 };
          const c = t.cfg;
          const out = U.transfer(b, { bitCyc: this.fosc / 4 / c.baud, dataBits: c.dataBits, parity: c.parity, stopBits: c.stopBits, invert: !!c.sigPol },
            { bitCyc: cfg.bitCyc, dataBits: cfg.dataBits === 9 ? 9 : 8 }).map(r => ({ byte: r.byte, ferr: r.ferr ? 1 : 0 }));
          if (out.length) { for (let k = 1; k < out.length; k++) this.rxPend.push(out[k]); return out[0]; }
        }
      }
      return null;
    }
    termKey(id, ch) {
      const s = this.term[id]; if (!s) return false;
      let c = typeof ch === 'number' ? ch : ch === '\n' ? 13 : String(ch).charCodeAt(0);
      if (!(c >= 0)) return false;
      if (c > 255) c = 63;
      if (s.q.length < 256) s.q.push(c);
      if (s.echo) this.termPut(s, c);
      return true;
    }
    termPut(s, b) {
      b &= 255;
      if (s.paused) { if (s.hold.length < 4096) s.hold.push(b); return; }
      s.hexText += (b < 16 ? '0' : '') + b.toString(16).toUpperCase() + ' ';
      if (s.hexText.length > 6000) s.hexText = s.hexText.slice(-4000);
      if (b === 13) s.text += '\n';
      else if (b === 8) { if (s.text.length && s.text[s.text.length - 1] !== '\n') s.text = s.text.slice(0, -1); }
      else if (b === 7) s.bell++;
      else if (b >= 32) s.text += String.fromCharCode(b);
      if (s.text.length > 6000) s.text = s.text.slice(-4000);
    }
    termInfo(id) { const s = this.term[id]; return s ? { paused: s.paused, hex: s.hex, echo: s.echo } : null; }
    termText(id) { const s = this.term[id]; return s ? (s.hex ? s.hexText : s.text) : ''; }
    termPaste(id, text) { let n = 0; for (const ch of String(text == null ? '' : text)) if (ch !== '\n' || !/\r\n/.test(String(text))) { if (this.termKey(id, ch)) n++; } return n; }
    termCmd(id, cmd) {
      const s = this.term[id]; if (!s) return null;
      if (cmd === 'clear') { s.text = ''; s.hexText = ''; }
      else if (cmd === 'pause') { s.paused = !s.paused; if (!s.paused) { const h = s.hold; s.hold = []; for (const b of h) this.termPut(s, b); } }
      else if (cmd === 'hex') s.hex = !s.hex;
      else if (cmd === 'echo') s.echo = !s.echo;
      return this.termInfo(id);
    }
    ttc(id) { const t = this.m.tt && this.m.tt[id]; return Math.max(1, Math.round(this.fosc / 4 * (t > 0 ? t : 0.001))); }
    frame(cyc) {
      this.solves = 0;
      const stalled = cyc <= this.fCyc; this.fCyc = cyc;
      const l = this.last, cur = this.port(l[0], l[1], l[2], l[3], cyc, true);
      const W = this.win, t0 = cyc - W, share = new Map(), seq = [];
      let end = cyc;
      for (let n = this.rn - 1; n >= 0 && n >= this.rn - RING; n--) {
        const i = n % RING, t = this.rt[i], s = Math.max(t, t0), r = this.rr[i];
        if (end > s) { share.set(r, (share.get(r) || 0) + end - s); seq.push(r); }
        end = t;
        if (t <= t0) break;
      }
      const out = Object.assign({}, cur);
      if (share.size > 1) {
        const lit = {}, acc = {};
        for (const id in cur.lit) {
          const base = cur.lit[id], tc = Math.min(this.ttc(id), W), L = {};
          lit[id] = L;
          for (const k in base) L[k] = false;
          if (cyc < tc) {
            for (const k in base) L[k] = !!base[k];
            for (const [r, t] of share) {
              if (r === cur || t < W * 0.05) continue;
              const q = r.lit[id];
              if (q) for (const k in q) if (q[k]) L[k] = true;
            }
            continue;
          }
          for (const [r, t] of share) {
            const q = r.lit[id];
            if (q) for (const k in q) if (q[k]) acc[k] = (acc[k] || 0) + t;
          }
          for (const k in acc) L[k] = acc[k] >= tc || (stalled && !!base[k]);
          for (const k in base) if (stalled && base[k]) L[k] = true;
          for (const k in acc) delete acc[k];
        }
        out.lit = lit;
      }
      out.spin = {}; out.sound = {};
      for (const mo of this.m.motor) {
        if (share.size <= 1) { out.spin[mo.id] = dir2(cur, mo.a, mo.b); continue; }
        let sum = 0, tot = 0;
        for (const [r, t] of share) { sum += dir2(r, mo.a, mo.b) * t; tot += t; }
        out.spin[mo.id] = tot ? sum / tot : 0;
      }
      for (const bz of this.m.buzz) {
        const act = r => r && dir2(r, bz.a, bz.b) !== 0;
        let flips = 0, prev = null;
        for (let k = seq.length - 1; k >= 0; k--) {
          const a = act(seq[k]);
          if (prev !== null && a !== prev) flips++;
          prev = a;
        }
        if (flips >= 2) out.sound[bz.id] = Math.round(flips / 2 / (W / (this.fosc / 4)));
        else out.sound[bz.id] = act(cur) ? 2000 : 0;
      }
      return out;
    }
    state(part, r) {
      const pins = {}, pp = this.m.partPins[part.id] || [], id = part.id;
      for (const [num, n] of pp) pins[num] = n >= 0 && r ? r.val[n] : 2;
      const s = { on: true, pins, lit: (r && r.lit[id]) || {}, pressed: !!this.pressed[id] };
      switch (part.type) {
        case 'SWITCH': s.sw = !!this.pressed[id]; break;
        case 'LOGICSTATE': s.sw = !!this.pressed[id]; s.level = s.sw ? 1 : 0; break;
        case 'DIPSW_8': s.sws = {}; for (let i = 1; i <= 8; i++) if (this.pressed[id + ':' + i]) s.sws[i] = true; break;
        case 'KEYPAD-PHONETYPE': case 'KEYPAD-SMALLCALC':
          s.keys = {}; for (const k in this.pressed) if (this.pressed[k] && k.indexOf(id + ':') === 0) s.keys[k.slice(id.length + 1)] = true;
          break;
        case 'LOGICPROBE': s.level = pins['1']; break;
        case 'POT-HG': { const q = this.m.pot.find(x => x.id === id); s.pos = this.pot[id]; s.volts = q ? this.analog(q.w) : null; break; }
        case 'DC-VOLTMETER': {
          const q = this.m.vm.find(x => x.id === id);
          const a = q ? this.analog(q.p) : null, b = q ? this.analog(q.n) : null;
          s.volts = a == null ? null : Math.round((a - (b || 0)) * 1000) / 1000;
          break;
        }
        case 'LM016L': s.lcd = this.lcd[id] ? lcdView(this.lcd[id], 16, 2) : null; break;
        case 'LM044L': s.lcd = this.lcd[id] ? lcdView(this.lcd[id], 20, 4) : null; break;
        case 'VIRTUAL-TERMINAL': { const ts = this.term[id]; s.text = ts ? (ts.hex ? ts.hexText : ts.text) : ''; if (ts) { s.bell = ts.bell; s.paused = ts.paused; } break; }
        case 'RELAY': s.sw = !!this.pressed[id + ':K']; break;
        case '74HC595': { const q = this.seq[id]; s.sr = q ? q.sr : 0; s.q = q ? q.q : 0; break; }
        case 'OSCILLOSCOPE': case 'LOGIC-ANALYSER': s.rec = this.rec.channels.some(c => c.part === id); break;
        case 'MOTOR': { const mo = this.m.motor.find(x => x.id === id); s.spin = r && r.spin && id in r.spin ? r.spin[id] : mo ? dir2(r, mo.a, mo.b) : 0; break; }
        case 'BUZZER': {
          const bz = this.m.buzz.find(x => x.id === id);
          const f = r && r.sound && id in r.sound ? r.sound[id] : bz && dir2(r, bz.a, bz.b) ? 2000 : 0;
          s.sound = f > 0; s.freq = f; break;
        }
      }
      return s;
    }
  }

  function route(c, lib) {
    const parts = (c.parts || []).filter(p => lib.types[p.type]);
    const warnings = [], wiresIn = (c.wires || []).filter(w => w.points && w.points.length > 1);
    const pinPt = {}, allPins = [];
    for (const p of parts) for (const q of lib.types[p.type].pins) {
      const a = p.id + '.' + q.num, pt = lib.pinPos(p, q.num);
      pinPt[a] = [R(pt[0] / G) * G, R(pt[1] / G) * G]; allPins.push(a);
    }
    const nup = [];
    const nfind = i => { while (nup[i] !== i) { nup[i] = nup[nup[i]]; i = nup[i]; } return i; };
    const pinR = {};
    (c.nets || []).forEach(n => {
      const i = nup.length; nup.push(i);
      for (const a of n) {
        if (!pinPt[a]) { warnings.push('Net pin not found: ' + a); continue; }
        if (pinR[a] !== undefined) { const x = nfind(pinR[a]); if (x !== i) nup[x] = i; }
        pinR[a] = i;
      }
    });
    let uniq = 1e6;
    const exW = wiresIn.length ? extract({ parts, wires: wiresIn }, lib) : null;
    const wireOwner = {};
    if (exW) for (const n of exW.nets) {
      if (!n.wires.length) continue;
      const rs = n.pins.filter(a => pinR[a] !== undefined).map(a => nfind(pinR[a]));
      let o;
      if (rs.length) { o = rs[0]; for (const r of rs) { const x = nfind(r); if (x !== nfind(o)) nup[x] = nfind(o); } }
      else o = uniq++;
      for (const w of n.wires) wireOwner[w] = o;
    }
    const own = o => o >= 1e6 ? o : nfind(o);
    const groups = new Map();
    for (const a in pinR) { const r = nfind(pinR[a]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(a); }

    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const ext = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    const boxes = [];
    for (const p of parts) {
      const b = lib.bbox(p);
      let bx0 = b.x, by0 = b.y, bx1 = b.x + b.w, by1 = b.y + b.h;
      for (const q of lib.types[p.type].pins) { const pt = pinPt[p.id + '.' + q.num]; bx0 = Math.min(bx0, pt[0]); by0 = Math.min(by0, pt[1]); bx1 = Math.max(bx1, pt[0]); by1 = Math.max(by1, pt[1]); }
      boxes.push([bx0, by0, bx1, by1]); ext(bx0, by0); ext(bx1, by1);
    }
    for (const w of wiresIn) for (const pt of w.points) ext(pt[0], pt[1]);
    if (!isFinite(x0)) return { wires: [], warnings };
    x0 = Math.floor(x0 / G) * G - 80; y0 = Math.floor(y0 / G) * G - 80; x1 = Math.ceil(x1 / G) * G + 80; y1 = Math.ceil(y1 / G) * G + 80;
    const W = (x1 - x0) / G + 1, H = (y1 - y0) / G + 1, S = W * H;
    if (S > 1.5e6) { warnings.push('Design is too large for the wire autorouter.'); return { wires: [], warnings }; }
    const idx = (x, y) => ((y - y0) / G) * W + (x - x0) / G;
    const node = new Float64Array(S).fill(-1), hseg = new Float64Array(S).fill(-1), vseg = new Float64Array(S).fill(-1);
    const pinAt = new Uint8Array(S), body = new Uint8Array(S);
    for (const [bx0, by0, bx1, by1] of boxes) {
      for (let y = Math.ceil(by0 / G) * G; y <= by1; y += G) for (let x = Math.ceil(bx0 / G) * G; x <= bx1; x += G) body[idx(x, y)] = 1;
    }
    for (const a of allPins) {
      const i = idx(pinPt[a][0], pinPt[a][1]), o = pinR[a] !== undefined ? own(pinR[a]) : uniq++;
      if (node[i] !== -1 && node[i] !== o) warnings.push('Overlapping pins: ' + a);
      node[i] = o; pinAt[i] = 1;
    }
    const mark = (pts, o) => {
      for (let k = 0; k < pts.length; k++) {
        const [x, y] = pts[k];
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && x % G === 0 && y % G === 0) node[idx(x, y)] = o;
        if (!k) continue;
        const [ax, ay] = pts[k - 1];
        if (ay === y && ax !== x) for (let xx = Math.min(ax, x); xx <= Math.max(ax, x); xx += G) hseg[idx(xx, y)] = o;
        else if (ax === x && ay !== y) for (let yy = Math.min(ay, y); yy <= Math.max(ay, y); yy += G) vseg[idx(x, yy)] = o;
      }
    };
    for (const w of wiresIn) mark(w.points.map(p => [R(p[0]), R(p[1])]), own(wireOwner[w.id]));

    const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
    const gstamp = new Int32Array(S), cost = new Float32Array(S * 4), prev = new Int32Array(S * 4), seen = new Int32Array(S * 4);
    let stamp = 0;
    const heap = [];
    const push = (f, s) => { heap.push([f, s]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
    const free = (v, o) => v === -1 || v === o;

    function search(start, tree, o) {
      stamp++;
      let gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity;
      for (const i of tree) {
        if (!free(node[i], o) || !free(hseg[i], o) || !free(vseg[i], o)) continue;
        gstamp[i] = stamp;
        const x = i % W, y = (i - x) / W;
        gx0 = Math.min(gx0, x); gy0 = Math.min(gy0, y); gx1 = Math.max(gx1, x); gy1 = Math.max(gy1, y);
      }
      if (!isFinite(gx0)) return null;
      const hfun = i => { const x = i % W, y = (i - x) / W; return Math.max(0, gx0 - x, x - gx1) + Math.max(0, gy0 - y, y - gy1); };
      heap.length = 0;
      for (let d = 0; d < 4; d++) { const s = start * 4 + d; seen[s] = stamp; cost[s] = 0; prev[s] = -1; push(hfun(start), s); }
      let n = 0;
      while (heap.length) {
        const [, s] = pop();
        const p = s >> 2, d = s & 3, cs = cost[s];
        if (gstamp[p] === stamp && p !== start) {
          const path = [];
          for (let t = s; t !== -1; t = prev[t]) path.push(t >> 2);
          return path.reverse();
        }
        if (++n > 400000) return null;
        const px = p % W, py = (p - px) / W;
        for (let nd = 0; nd < 4; nd++) {
          if (nd === ((d + 2) & 3) && p !== start) continue;
          const turn = p !== start && nd !== d;
          if (turn && (hseg[p] !== -1 || vseg[p] !== -1 || node[p] !== -1)) continue;
          const qx = px + DX[nd], qy = py + DY[nd];
          if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
          const q = qy * W + qx;
          if (gstamp[q] !== stamp) {
            if (node[q] !== -1 || pinAt[q]) continue;
            if ((nd & 1 ? vseg[q] : hseg[q]) !== -1) continue;
          }
          const cross = (nd & 1 ? hseg[q] : vseg[q]) !== -1;
          const c2 = cs + 1 + (body[q] ? 30 : 0) + (turn ? 3 : 0) + (cross ? 2 : 0);
          const t = q * 4 + nd;
          if (seen[t] === stamp && cost[t] <= c2) continue;
          seen[t] = stamp; cost[t] = c2; prev[t] = s;
          push(c2 + hfun(q), t);
        }
      }
      return null;
    }

    const out = [];
    let wn = 0;
    const used = new Set((c.wires || []).map(w => w.id));
    const nextId = () => { let id; do id = 'w' + (++wn); while (used.has(id)); used.add(id); return id; };
    const order = [...groups.entries()].map(([r, pins]) => {
      let ax0 = Infinity, ay0 = Infinity, ax1 = -Infinity, ay1 = -Infinity;
      for (const a of pins) { const [x, y] = pinPt[a]; ax0 = Math.min(ax0, x); ay0 = Math.min(ay0, y); ax1 = Math.max(ax1, x); ay1 = Math.max(ay1, y); }
      return { r, pins, size: ax1 - ax0 + ay1 - ay0 };
    }).sort((a, b) => a.size - b.size);
    for (const g of order) {
      const o = g.r;
      const tree = [];
      for (const w of wiresIn) if (own(wireOwner[w.id]) === o) {
        const pts = w.points.map(p => [R(p[0]), R(p[1])]);
        for (let k = 1; k < pts.length; k++) {
          const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
          if (ay === by) for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x += G) tree.push(idx(x, ay));
          else if (ax === bx) for (let y = Math.min(ay, by); y <= Math.max(ay, by); y += G) tree.push(idx(ax, y));
        }
      }
      const connected = new Set();
      if (exW) for (const a of g.pins) { const n = exW.pinNet[a]; if (n !== undefined && exW.nets[n].wires.length) connected.add(a); }
      let rest = g.pins.filter(a => !connected.has(a));
      if (!tree.length) { const a = rest.shift(); if (!a) continue; tree.push(idx(pinPt[a][0], pinPt[a][1])); }
      for (const a of connected) tree.push(idx(pinPt[a][0], pinPt[a][1]));
      while (rest.length) {
        let best = 0, bd = Infinity;
        rest.forEach((a, k) => {
          const [x, y] = pinPt[a];
          for (const i of tree) { const tx = i % W, ty = (i - tx) / W, dd = Math.abs(tx * G + x0 - x) + Math.abs(ty * G + y0 - y); if (dd < bd) { bd = dd; best = k; } }
        });
        const a = rest.splice(best, 1)[0], st = idx(pinPt[a][0], pinPt[a][1]);
        if (tree.includes(st)) continue;
        const path = search(st, tree, o);
        if (!path) { warnings.push('Could not route wire: ' + a + ' (' + g.pins.join(', ') + ')'); continue; }
        const pts = path.map(i => { const x = i % W; return [x * G + x0, ((i - x) / W) * G + y0]; });
        const v = [pts[0]];
        for (let k = 1; k < pts.length - 1; k++) {
          const a0 = pts[k - 1], b0 = pts[k], c0 = pts[k + 1];
          if ((a0[0] === b0[0]) !== (b0[0] === c0[0])) v.push(b0);
        }
        v.push(pts[pts.length - 1]);
        mark(v, o);
        for (const i of path) tree.push(i);
        out.push({ id: nextId(), points: v });
      }
    }
    const want = canon([...groups.values()]);
    const got = pinNets({ parts, wires: wiresIn.concat(out) }, lib, true);
    const gs = new Set(got.map(n => n.join('|')));
    for (const n of want) if (!gs.has(n.join('|'))) warnings.push('Net could not be fully routed: ' + n.join(', '));
    return { wires: out, warnings };
  }

  function outline(p, lib) {
    const b = lib.bbox(p);
    let x0 = b.x, y0 = b.y - 14, x1 = b.x + b.w, y1 = b.y + b.h + 12;
    for (const q of lib.types[p.type].pins) { const pt = lib.pinPos(p, q.num); x0 = Math.min(x0, pt[0]); y0 = Math.min(y0, pt[1]); x1 = Math.max(x1, pt[0]); y1 = Math.max(y1, pt[1]); }
    return [x0, y0, x1, y1];
  }
  function overlaps(parts, lib) {
    const bs = parts.filter(p => lib.types[p.type]).map(p => outline(p, lib));
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      if (a[0] < b[2] + 10 && b[0] < a[2] + 10 && a[1] < b[3] + 10 && b[1] < a[3] + 10) return true;
    }
    return false;
  }
  function layout(parts, lib, maxW) {
    maxW = maxW || 1000;
    const gap = 50, list = parts.filter(p => lib.types[p.type]);
    let x = 40, y = 40, rowH = 0;
    for (const p of list) {
      const o = outline(Object.assign({}, p, { x: 0, y: 0 }), lib), w = o[2] - o[0], h = o[3] - o[1];
      if (x > 40 && x + w > maxW) { x = 40; y += rowH + gap; rowH = 0; }
      p.x = Math.round((x - o[0]) / G) * G; p.y = Math.round((y - o[1]) / G) * G;
      x += Math.ceil((w + gap) / G) * G; rowH = Math.max(rowH, h);
    }
    return parts;
  }

  const SIM = { G, SEG, SEGN, HEXSEG, PICPIN, VDD, ohms, analog, analogCore, POT_STEP, extract, pinNets, canon, compile, solve, picDrive, eval7448, eval7447, decode, lcdNew, lcdClock, lcdExec, lcdView, LCD_BUSY, Runner, Rec, REC_CAP, evalDyn, route, overlaps, layout };
  if (typeof module !== 'undefined' && module.exports) module.exports = SIM;
  if (root) root.SIM = SIM;
})(typeof window !== 'undefined' ? window : null);
