const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const SIM = require('../js/sim.js');

const libPath = path.join(ROOT, 'js/library.js'), lab3Path = path.join(ROOT, 'circuits/lab3.json');
const realLib = fs.existsSync(libPath);
const P = (num, x, y) => ({ num: String(num), name: String(num), x, y });
const STUB = {
  types: {
    '7448': { w: 80, h: 120, pins: [P(7, -10, 10), P(1, -10, 20), P(2, -10, 30), P(6, -10, 40), P(4, -10, 70), P(5, -10, 80), P(3, -10, 90), P(13, 90, 10), P(12, 90, 20), P(11, 90, 30), P(10, 90, 40), P(9, 90, 50), P(15, 90, 60), P(14, 90, 70)] },
    '7SEG-MPX1-CC': { w: 100, h: 120, pins: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP', 'K'].map((n, i) => P(n, 10 + 10 * i, 130)) },
    'BUTTON': { w: 40, h: 20, pins: [P(1, -10, 10), P(2, 50, 10)] },
    'RES': { w: 40, h: 20, pins: [P(1, -10, 10), P(2, 50, 10)] },
    'POWER': { w: 20, h: 20, pins: [P(1, 10, 20)] },
    'GROUND': { w: 20, h: 20, pins: [P(1, 10, 0)] }
  },
  pinPos(part, num) { const p = this.types[part.type].pins.find(q => q.num === String(num)); return [part.x + p.x, part.y + p.y]; },
  bbox(part) { const t = this.types[part.type]; return { x: part.x, y: part.y, w: t.w, h: t.h }; }
};
const LIB = realLib ? require(libPath) : STUB;

let failed = 0, passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n     ')); }
}
function makeCore() {
  let runner = null;
  const apply = r => { if (!r || !api) return; api.P.inA = r.inA; api.P.inB = r.inB; if ('flB' in r) api.P.flB = r.flB; };
  const sync = () => { if (!runner || !api) return; const d = api.drive(); apply(runner.port(d[0], d[1], d[2], d[3], api.P.cyc)); };
  let api = null;
  const picPath = path.join(ROOT, 'js/pic.js');
  if (fs.existsSync(picPath)) {
    try {
      const PIC = require(picPath);
      const c = PIC.create({ onPort: () => sync(), onUartTx: (b, cy) => runner && runner.uartTx(b, cy) });
      api = { src: 'js/pic.js', P: c.P, step: c.step, parseHex: PIC.parseHex, drive: c.drive,
        load: h => { if (c.load) c.load(h); else { c.P.prog = h.prog; c.P.loaded = true; } }, reset: () => { c.reset(); sync(); } };
    } catch (e) { console.log('(js/pic.js yüklenemedi: ' + e.message + ')'); api = null; }
  }
  if (!api) {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const a = html.indexOf('/* ================= PIC16F628A'), b = html.indexOf('/* ================= simulasyon durumu');
    if (a < 0 || b < a || /require\(|process\./.test(html.slice(a, b))) return null;
    const c = new Function('ctx', 'let runner=null;function portChg(){if(ctx.sync)ctx.sync();}\n' + html.slice(a, b) +
      '\nreturn {P,step,picReset,parseHex};')({ get sync() { return sync; } });
    api = { src: 'index.html', P: c.P, step: c.step, parseHex: c.parseHex, drive: () => [c.P.ram[0x85], c.P.latA, c.P.ram[0x86], c.P.latB],
      load: h => { c.P.prog = h.prog; c.P.loaded = true; }, reset: () => { c.picReset(); sync(); } };
  }
  api.apply = apply;
  api.setRunner = r => { runner = r; };
  return api;
}
const part = (id, type, x, y, value) => ({ id, type, x, y, rot: 0, value: value || '' });
const pp = (c, id, n) => LIB.pinPos(c.parts.find(p => p.id === id), n);
const W = (id, ...points) => ({ id, points });

test('netlist: T bağlantı bağlı, düz kesişme bağlı değil', () => {
  const c = { parts: [part('R1', 'RES', 0, 0), part('R2', 'RES', 200, 200), part('R3', 'RES', 0, 100), part('R4', 'RES', 160, 100)], wires: [] };
  const a = pp(c, 'R1', '2'), b = pp(c, 'R2', '1'), r3 = pp(c, 'R3', '2'), r4 = pp(c, 'R4', '1');
  c.wires.push(W('wA', a, [a[0] + 100, a[1]]));
  c.wires.push(W('wT', [a[0] + 50, a[1]], [a[0] + 50, b[1]], b));
  c.wires.push(W('wX', r3, r4));
  const nets = SIM.pinNets(c, LIB);
  assert.deepStrictEqual(nets, [['R1.2', 'R2.1'], ['R3.2', 'R4.1']]);
  const ex = SIM.extract(c, LIB);
  assert.notStrictEqual(ex.wireNet.wX, ex.wireNet.wT);
  assert(ex.junctions.some(j => j[0] === a[0] + 50 && j[1] === a[1]), 'T noktasında bağlantı noktası olmalı');
  assert(!ex.junctions.some(j => j[0] === a[0] + 50 && j[1] === r3[1]), 'kesişmede bağlantı noktası olmamalı');
});

test('netlist: köşe başka telin ortasına denk gelirse bağlı değil, köşe-köşe bağlı', () => {
  const c = { parts: [part('R1', 'RES', 0, 0), part('R2', 'RES', 300, 0), part('R3', 'RES', 0, 200), part('R4', 'RES', 300, 200)], wires: [] };
  const a = pp(c, 'R1', '2'), b = pp(c, 'R2', '1'), d = pp(c, 'R3', '2'), e = pp(c, 'R4', '1');
  c.wires.push(W('h', a, b));
  c.wires.push(W('k', d, [d[0] + 100, d[1]], [d[0] + 100, a[1]], [d[0] + 100, a[1] - 50], [e[0] + 30, a[1] - 50], [e[0] + 30, e[1]], e));
  assert.deepStrictEqual(SIM.pinNets(c, LIB), [['R1.2', 'R2.1'], ['R3.2', 'R4.1']]);
  c.wires.push(W('m', [d[0] + 100, a[1] - 50], [d[0] + 100, a[1] - 80]));
  c.wires.push(W('n', [d[0] + 100, a[1] - 80], [d[0] + 150, a[1] - 80], [d[0] + 150, a[1]]));
  assert.deepStrictEqual(SIM.pinNets(c, LIB), [['R1.2', 'R2.1', 'R3.2', 'R4.1']]);
});

test('7448 doğruluk tablosu 0-9 (+ LT, BI, RBI)', () => {
  const EXP = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'cdefg', 'abc', 'abcdefg', 'abcfg'];
  const d = { inp: [0, 1, 2, 3], lt: 4, bi: 5, rbi: 6 };
  for (let n = 0; n < 10; n++) {
    const val = [n & 1, (n >> 1) & 1, (n >> 2) & 1, (n >> 3) & 1, 1, 1, 1];
    const o = SIM.eval7448(d, val);
    const got = 'abcdefg'.split('').filter((s, i) => o[i]).join('');
    assert.strictEqual(got, EXP[n], 'rakam ' + n);
  }
  assert.deepStrictEqual(SIM.eval7448(d, [1, 0, 1, 0, 0, 1, 1]).slice(0, 7), [1, 1, 1, 1, 1, 1, 1], 'LT=0 hepsi yanar');
  assert.deepStrictEqual(SIM.eval7448(d, [1, 0, 1, 0, 1, 0, 1]).slice(0, 7), [0, 0, 0, 0, 0, 0, 0], 'BI=0 söner');
  const rb = SIM.eval7448(d, [0, 0, 0, 0, 1, 1, 0]);
  assert.deepStrictEqual(rb, [0, 0, 0, 0, 0, 0, 0, 0], 'RBI=0 ve 0 girişinde söner, RBO=0');
  assert.deepStrictEqual(SIM.eval7448({ inp: [-1, -1, -1, -1], lt: -1, bi: -1, rbi: -1 }, []).slice(0, 7), [0, 0, 0, 0, 0, 0, 0], 'boşta girişler = 1 (15 = boş)');
});

test('7448 devre üzerinden: güç/toprakla 5 → 5 gösterir, boşta LT/BI/RBI = 1', () => {
  const c = { parts: [part('U1', '7448', 300, 100), part('PWR', 'POWER', 100, 0), part('GND', 'GROUND', 100, 300), part('DS', '7SEG-MPX1-CC', 600, 100), part('GK', 'GROUND', 680, 290)], wires: [] };
  const vcc = pp(c, 'PWR', '1'), gnd = pp(c, 'GND', '1');
  const ins = ['7', '1', '2', '6'], bits = [1, 0, 1, 0];
  ins.forEach((n, i) => {
    const q = pp(c, 'U1', n), x = 250 - 10 * i, src = bits[i] ? vcc : gnd;
    c.wires.push(W('i' + n, q, [x, q[1]], [x, src[1]], ...(x === src[0] ? [] : [[src[0], src[1]]])));
  });
  const outs = ['13', '12', '11', '10', '9', '15', '14'], segs = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  outs.forEach((n, i) => { const q = pp(c, 'U1', n), s = pp(c, 'DS', segs[i]), y = q[1]; c.wires.push(W('o' + n, q, [500 + 10 * i, y], [500 + 10 * i, 260 + 10 * i], [s[0], 260 + 10 * i], s)); });
  c.wires.push(W('k', pp(c, 'DS', 'K'), pp(c, 'GK', '1')));
  const m = SIM.compile(c, LIB), r = SIM.solve(m, null, {});
  assert.strictEqual(SIM.decode(r.lit.DS), '5');
  assert.strictEqual(r.val[m.ex.pinNet['U1.3']], 1);
  assert.strictEqual(r.val[m.ex.pinNet['U1.4']], 1);
});

function buttonCircuit() {
  const c = { parts: [part('PWR', 'POWER', 0, 0), part('SW', 'BUTTON', 40, 10, 'START/STOP'), part('R', 'RES', 110, 10, '10k'), part('G', 'GROUND', 170, 30)], wires: [] };
  c.wires.push(W('a', pp(c, 'PWR', '1'), pp(c, 'SW', '1')));
  c.wires.push(W('b', pp(c, 'SW', '2'), pp(c, 'R', '1')));
  const r2 = pp(c, 'R', '2'), g = pp(c, 'G', '1');
  c.wires.push(W('c', r2, [g[0], r2[1]], g));
  return c;
}
test('buton + pull-down: bırakılınca 0, basılınca 1', () => {
  const c = buttonCircuit(), m = SIM.compile(c, LIB);
  const n = m.ex.pinNet['SW.2'];
  assert.strictEqual(SIM.solve(m, null, {}).val[n], 0);
  assert.strictEqual(SIM.solve(m, null, { SW: true }).val[n], 1);
  c.wires = c.wires.filter(w => w.id !== 'c');
  const m2 = SIM.compile(c, LIB);
  assert.strictEqual(SIM.solve(m2, null, {}).val[m2.ex.pinNet['SW.2']], 2, 'pull-down yoksa boşta');
});

test('7 segment: yalnızca anot 1 VE K toprakta ise yanar (doğrudan ya da dirençle)', () => {
  const c = { parts: [part('DS', '7SEG-MPX1-CC', 0, 0), part('PW', 'POWER', -100, 200), part('RA', 'RES', -60, 230), part('G', 'GROUND', 80, 160)], wires: [] };
  const pw = pp(c, 'PW', '1'), a = pp(c, 'DS', 'A'), b = pp(c, 'DS', 'B'), k = pp(c, 'DS', 'K'), g = pp(c, 'G', '1');
  c.wires.push(W('wa', pw, [pw[0], 280], [a[0] - 20, 280], [a[0] - 20, 140], [a[0], 140], a));
  const ra1 = pp(c, 'RA', '1'), ra2 = pp(c, 'RA', '2');
  c.wires.push(W('wr1', ra1, [pw[0], ra1[1]]));
  c.wires.push(W('wr2', ra2, [b[0], ra2[1]], b));
  c.wires.push(W('wk', k, g));
  let m = SIM.compile(c, LIB), r = SIM.solve(m, null, {});
  assert.strictEqual(r.lit.DS.A, true, 'A doğrudan');
  assert.strictEqual(r.lit.DS.B, true, 'B dirençle');
  assert.strictEqual(r.lit.DS.C, false, 'C boşta');
  c.wires = c.wires.filter(w => w.id !== 'wk');
  m = SIM.compile(c, LIB); r = SIM.solve(m, null, {});
  assert.strictEqual(r.lit.DS.A, false, 'K bağlı değilken yanmaz');
  const c2 = JSON.parse(JSON.stringify(c));
  c2.parts.push(part('PK', 'POWER', 80, 100));
  c2.wires.push(W('wk2', k, pp(c2, 'PK', '1')));
  m = SIM.compile(c2, LIB); r = SIM.solve(m, null, {});
  assert.strictEqual(r.lit.DS.A, false, 'K = 1 iken yanmaz');
});

function stripRoute(c, layout) {
  const nets = SIM.pinNets(c, LIB);
  const parts = c.parts.map((p, i) => layout ? Object.assign({}, p, layout(p, i)) : Object.assign({}, p));
  const r = SIM.route({ parts, nets }, LIB);
  return { nets, parts, r };
}
function checkRouted(nets, parts, r) {
  assert.deepStrictEqual(r.warnings, []);
  for (const w of r.wires) {
    assert(w.points.length >= 2);
    for (let i = 0; i < w.points.length; i++) {
      const [x, y] = w.points[i];
      assert(x % 10 === 0 && y % 10 === 0, 'ızgara dışı nokta ' + w.id);
      if (i) { const [px, py] = w.points[i - 1]; assert(px === x || py === y, 'dik açılı olmayan parça ' + w.id); }
    }
  }
  assert.deepStrictEqual(SIM.pinNets({ parts, wires: r.wires }, LIB), SIM.canon(nets));
}

test('oto-yönlendirici: küçük devre (nets → wires → aynı netlist)', () => {
  const parts = [part('PW', 'POWER', 0, 0), part('SW', 'BUTTON', 100, 100, 'X'), part('R', 'RES', 300, 40), part('G', 'GROUND', 400, 200), part('R2', 'RES', 200, 250)];
  const nets = [['PW.1', 'SW.1', 'R2.1'], ['SW.2', 'R.1'], ['R.2', 'G.1', 'R2.2']];
  const r = SIM.route({ parts, nets }, LIB);
  checkRouted(nets, parts, r);
});

if (realLib && fs.existsSync(lab3Path)) {
  const lab3 = JSON.parse(fs.readFileSync(lab3Path, 'utf8'));

  test('oto-yönlendirici: lab3 netleri, lab3 yerleşimi', () => {
    const { nets, parts, r } = stripRoute(lab3);
    checkRouted(nets, parts, r);
  });
  test('oto-yönlendirici: lab3 netleri, içe aktarıcının ızgara yerleşimi', () => {
    const { nets, parts, r } = stripRoute(lab3, (p, i) => ({ x: 70 + (i % 9) * 110, y: 60 + Math.floor(i / 9) * 100 }));
    const bad = r.warnings.filter(w => !/^Üst üste/.test(w));
    if (r.warnings.length) console.log('     (uyarılar: ' + r.warnings.length + ', örn. ' + r.warnings[0] + ')');
    const got = SIM.pinNets({ parts, wires: r.wires }, LIB), want = SIM.canon(nets);
    const gs = new Set(got.map(n => n.join('|')));
    const missing = want.filter(n => !gs.has(n.join('|')));
    assert(missing.length === 0 || bad.length > 0, 'eksik net uyarısız kaldı');
    const ws = new Set(want.map(n => n.join('|')));
    const extra = got.filter(n => !ws.has(n.join('|')) && !want.some(w => n.every(a => w.includes(a))));
    assert.deepStrictEqual(extra, [], 'yanlış birleşmiş net');
  });
  test('oto-yönlendirici: seyrek ızgara yerleşimi (çakışmasız) tam bağlanır', () => {
    const { nets, parts, r } = stripRoute(lab3, (p, i) => ({ x: 70 + (i % 8) * 200, y: 60 + Math.floor(i / 8) * 220 }));
    checkRouted(nets, parts, r);
  });

  test('oto-yönlendirici: çakışan yerleşim → layout → tam bağlanır', () => {
    const { nets, parts } = stripRoute(lab3, (p, i) => ({ x: 70 + (i % 9) * 110, y: 60 + Math.floor(i / 9) * 100 }));
    assert(SIM.overlaps(parts, LIB));
    SIM.layout(parts, LIB);
    assert(!SIM.overlaps(parts, LIB));
    const t = Date.now(), r = SIM.route({ parts, nets }, LIB);
    console.log('     (' + r.wires.length + ' tel, ' + (Date.now() - t) + ' ms)');
    checkRouted(nets, parts, r);
  });
  test('lab3: RA=3, RB=0x12 → sol=1, orta=2, sağ=3', () => {
    const m = SIM.compile(lab3, LIB);
    const drv = SIM.picDrive(0xF0, 0x03, 0x00, 0x12);
    const r = SIM.solve(m, drv, {});
    const ds = lab3.parts.filter(p => p.type === '7SEG-MPX1-CC').sort((a, b) => a.x - b.x);
    assert.deepStrictEqual(ds.map(p => SIM.decode(r.lit[p.id])), ['1', '2', '3']);
    const segs = id => 'ABCDEFG'.split('').filter(s => r.lit[id][s]).join('');
    assert.strictEqual(segs(ds[0].id), 'BC');
    assert.strictEqual(segs(ds[1].id), 'ABDEG');
    assert.strictEqual(segs(ds[2].id), 'ABCDG');
    assert.strictEqual(r.lit[ds[0].id].DP, false);
    assert.strictEqual(r.conflict, false);
  });
  test('lab3: SW1 basılınca PIC pin 4 (RA5) = 1, bırakınca 0', () => {
    const m = SIM.compile(lab3, LIB), drv = SIM.picDrive(0xF0, 0, 0, 0);
    assert.strictEqual((SIM.solve(m, drv, {}).inA >> 5) & 1, 0);
    assert.strictEqual((SIM.solve(m, drv, { SW1: true }).inA >> 5) & 1, 1);
    assert.strictEqual((SIM.solve(m, drv, { SW2: true }).inA >> 6) & 1, 1);
    assert.strictEqual(m.pic.pins[0][5], m.ex.pinNet['U1.4']);
  });

  const hexPath = path.join(ROOT, 'projeler/Task1.hex');
  const core = makeCore();
  if (!core) console.log('(PIC çekirdeği bulunamadı: uçtan uca test atlandı)');
  if (core && fs.existsSync(hexPath)) test('uçtan uca: Task1.hex + lab3, SW1 basılınca sayaç sayar (' + core.src + ')', () => {
    const h = core.parseHex(fs.readFileSync(hexPath, 'utf8'));
    assert(h.n > 0);
    core.load(h);
    const m = SIM.compile(lab3, LIB), run = new SIM.Runner(m);
    core.setRunner(run); core.reset();
    const ds = lab3.parts.filter(p => p.type === '7SEG-MPX1-CC').sort((x, y) => x.x - y.x);
    const runFor = us => { const end = core.P.cyc + us; while (core.P.cyc < end) core.step(); };
    const show = () => { const d = run.frame(core.P.cyc); return ds.map(p => SIM.decode(d.lit[p.id])).join(''); };
    const press = (id, v) => core.apply(run.press(id, v, core.P.cyc));
    runFor(300000);
    assert.strictEqual(show(), '000', 'başlangıç');
    runFor(500000);
    assert.strictEqual(show(), '000', 'basılmadan saymamalı');
    press('SW1', true); runFor(50000); press('SW1', false);
    runFor(1000000);
    const s1 = show();
    runFor(1000000);
    const s2 = show();
    console.log('     ekran: 1 sn sonra ' + s1 + ', 2 sn sonra ' + s2);
    assert(/^\d{3}$/.test(s1) && /^\d{3}$/.test(s2));
    assert(+s1 >= 8 && +s1 <= 12, 's1=' + s1);
    assert(+s2 - +s1 >= 9 && +s2 - +s1 <= 11, 's2-s1=' + (+s2 - +s1));
    press('SW1', true); runFor(50000); press('SW1', false); runFor(20000);
    const s3 = show(); runFor(500000);
    assert.strictEqual(show(), s3, 'tekrar basınca durmalı');
    press('SW2', true); runFor(50000); press('SW2', false); runFor(200000);
    assert.strictEqual(show(), '000', 'RESET sıfırlamalı');
  });
} else console.log('(library.js / lab3.json yok: lab3 testleri atlandı, stub kütüphane kullanıldı)');

if (realLib) {
  const mk = (parts, nets) => {
    parts = parts.map(p => Object.assign({ rot: 0, value: LIB.types[p.type].defaultValue || '' }, p));
    SIM.layout(parts, LIB, 1400);
    const r = SIM.route({ parts, nets }, LIB);
    assert.deepStrictEqual(r.warnings, [], 'yönlendirme');
    const c = { parts, wires: r.wires };
    assert.deepStrictEqual(SIM.pinNets(c, LIB), SIM.canon(nets), 'netlist');
    return c;
  };
  const Q = (id, type, value) => ({ id, type, x: 0, y: 0, value });
  const loadC = n => JSON.parse(fs.readFileSync(path.join(ROOT, 'circuits', n + '.json'), 'utf8'));
  const segOf = (lit, pre) => { const o = {}; for (const s of SIM.SEGN.concat('DP')) o[s] = !!(lit && lit[pre + s]); return o; };
  const rbCode = n => { let v = 0; for (let j = 0; j < 7; j++) if ((SIM.SEG[n] >> (6 - j)) & 1) v |= 1 << j; return v; };

  test('LED: A=1,K=0 yanar (doğrudan/dirençle), ters ya da K boşta yanmaz', () => {
    const c = mk([Q('PW', 'POWER'), Q('G', 'GROUND'), Q('D1', 'LED-RED'), Q('D2', 'LED-GREEN'), Q('R2', 'RES', '220'), Q('D3', 'LED-YELLOW'), Q('D4', 'LED-BLUE'),
      Q('D5', 'LED-RED'), Q('R5a', 'RES'), Q('R5b', 'RES')],
      [['PW.1', 'D1.A', 'R2.1', 'D3.K', 'D4.A', 'R5a.1'], ['R2.2', 'D2.A'], ['G.1', 'D1.K', 'D2.K', 'D3.A', 'R5b.2'], ['R5a.2', 'D5.A'], ['D5.K', 'R5b.1']]);
    const m = SIM.compile(c, LIB), r = SIM.solve(m, null, {});
    assert.deepStrictEqual(['D1', 'D2', 'D3', 'D4', 'D5'].map(d => r.lit[d].ON), [true, true, false, false, true]);
    const run = new SIM.Runner(m), st = run.state(c.parts.find(p => p.id === 'D1'), run.frame(0));
    assert.strictEqual(st.lit.ON, true); assert.strictEqual(st.pins.A, 1); assert.strictEqual(st.pins.K, 0);
  });

  test('7SEG-MPX1: CC (anot 1, K 0) ve CA (COM 1, segment 0)', () => {
    const c = mk([Q('PW', 'POWER'), Q('G', 'GROUND'), Q('CC', '7SEG-MPX1-CC'), Q('CA', '7SEG-MPX1-CA')],
      [['PW.1', 'CC.A', 'CA.COM', 'CA.B'], ['G.1', 'CC.K', 'CA.A', 'CC.B']]);
    const r = SIM.solve(SIM.compile(c, LIB), null, {});
    assert.strictEqual(r.lit.CC.A, true); assert.strictEqual(r.lit.CC.B, false); assert.strictEqual(r.lit.CC.C, false);
    assert.strictEqual(r.lit.CA.A, true); assert.strictEqual(r.lit.CA.B, false); assert.strictEqual(r.lit.CA.C, false, 'CA segment boşta → sönük');
  });

  test('7447: aktif-düşük açık-kollektör çıkışlar, CA ekranda 0-9', () => {
    const segs = ['A', 'B', 'C', 'D', 'E', 'F', 'G'], outs = ['13', '12', '11', '10', '9', '15', '14'];
    const parts = [Q('PW', 'POWER'), Q('U1', '7447'), Q('DS', '7SEG-MPX1-CA')], nets = [['PW.1', 'DS.COM']];
    ['7', '1', '2', '6'].forEach((n, i) => { parts.push(Q('L' + i, 'LOGICSTATE')); nets.push(['L' + i + '.1', 'U1.' + n]); });
    outs.forEach((o, i) => { parts.push(Q('R' + i, 'RES', '220')); nets.push(['U1.' + o, 'R' + i + '.1'], ['R' + i + '.2', 'DS.' + segs[i]]); });
    const c = mk(parts, nets), m = SIM.compile(c, LIB), run = new SIM.Runner(m);
    let cur = 0;
    for (let n = 0; n < 10; n++) {
      for (let b = 0; b < 4; b++) if (((cur ^ n) >> b) & 1) run.press('L' + b, true, n);
      cur = n;
      const r = run.frame(n * 100000 + 50000);
      assert.strictEqual(SIM.decode(r.lit.DS), String(n), 'rakam ' + n);
      if (n === 5) {
        assert.strictEqual(r.val[m.ex.pinNet['U1.13']], 0, 'QA aktif → 0');
        assert.strictEqual(r.val[m.ex.pinNet['U1.12']], 2, 'QB pasif → boşta (açık kollektör)');
      }
    }
    assert.deepStrictEqual(SIM.eval7447({ inp: [0, 1, 2, 3], lt: 4, bi: 5, rbi: 6 }, [0, 0, 0, 1, 1, 1, 1]).slice(0, 7), [0, 0, 0, 0, 0, 0, 0], '8 → tüm çıkışlar 0');
  });

  test('7SEG-BCD: 1/2/4/8 girişleri onaltılık rakam gösterir', () => {
    const c = mk([Q('L1', 'LOGICSTATE'), Q('L2', 'LOGICSTATE'), Q('L4', 'LOGICSTATE'), Q('L8', 'LOGICSTATE', '1'), Q('DS', '7SEG-BCD'), Q('DX', '7SEG-BCD')],
      [['L1.1', 'DS.1'], ['L2.1', 'DS.2'], ['L4.1', 'DS.4'], ['L8.1', 'DS.8']]);
    const run = new SIM.Runner(SIM.compile(c, LIB));
    assert.strictEqual(SIM.decode(run.frame(0).lit.DS), '8', 'L8 başlangıç değeri 1');
    run.press('L1', true); assert.strictEqual(SIM.decode(run.frame(1).lit.DS), '9');
    run.press('L1', true); run.press('L2', true);
    const a = run.frame(2).lit.DS;
    assert.strictEqual('ABCDEFG'.split('').filter(s => a[s]).join(''), 'ABCEFG', 'A harfi');
    assert.deepStrictEqual(run.frame(3).lit.DX, {}, 'bağlantısız BCD boş');
  });

  test('7SEG-MPX4-CC tarama (mux4_demo): pencere ile "1234" titreşimsiz, tek anda tek hane', () => {
    const c = loadC('mux4_demo'), m = SIM.compile(c, LIB), run = new SIM.Runner(m);
    let cyc = 0;
    const digit = d => { run.port(0xF0, 0x0F, 0x00, 0, cyc += 2); run.port(0xF0, 0x0F, 0x00, rbCode(d + 1), cyc += 2); run.port(0xF0, 0x0F & ~(1 << d), 0x00, rbCode(d + 1), cyc += 2); cyc += 4000; };
    const shown = r => [1, 2, 3, 4].map(d => SIM.decode(segOf(r.lit.DS1, d))).join('');
    for (let k = 0; k < 40; k++) {
      digit(k % 4);
      if (k >= 8) assert.strictEqual(shown(run.frame(cyc)), '1234', 'kare ' + k);
    }
    const one = SIM.solve(m, SIM.picDrive(0xF0, 0x0F & ~2, 0, rbCode(2)), {});
    assert.strictEqual(shown(one), ' 2  ', 'anlık durumda yalnız seçili hane');
    assert.strictEqual(one.lit.DS1['2DP'], false);
  });

  test('7SEG-MPX4-CA: hane ucu 1 ve segment 0 → yanar', () => {
    const c = mk([Q('PW', 'POWER'), Q('G', 'GROUND'), Q('DS', '7SEG-MPX4-CA')], [['PW.1', 'DS.2'], ['G.1', 'DS.A', 'DS.1']]);
    const r = SIM.solve(SIM.compile(c, LIB), null, {});
    assert.strictEqual(r.lit.DS['2A'], true); assert.strictEqual(r.lit.DS['1A'], false); assert.strictEqual(r.lit.DS['2B'], false);
  });

  test('LED-BARGRAPH-RED: 10 bağımsız LED', () => {
    const c = mk([Q('PW', 'POWER'), Q('G', 'GROUND'), Q('BAR', 'LED-BARGRAPH-RED')], [['PW.1', 'BAR.A1', 'BAR.A2', 'BAR.K4'], ['G.1', 'BAR.K1', 'BAR.K2', 'BAR.K3', 'BAR.A3', 'BAR.A4']]);
    const L = SIM.solve(SIM.compile(c, LIB), null, {}).lit.BAR;
    assert.deepStrictEqual([1, 2, 3, 4, 5].map(i => L[String(i)]), [true, true, false, false, false]);
  });

  test('KEYPAD-SMALLCALC (keypad_demo): mikroC tarama — satır RB4..7 çıkış, sütun RB0..3 giriş + 10k pull-down, kod = satır*4+sütun+1', () => {
    const c = loadC('keypad_demo'), m = SIM.compile(c, LIB), run = new SIM.Runner(m);
    const scan = () => {
      for (let r = 0; r < 4; r++) {
        const res = run.port(0xFF, 0, 0x0F, 1 << (4 + r), r);
        const col = res.inB & 0x0F;
        if (col) return r * 4 + [1, 2, 4, 8].indexOf(col) + 1;
      }
      return 0;
    };
    assert.strictEqual(scan(), 0, 'tuşsuz: sütunlar pull-down ile 0');
    const keys = LIB.types['KEYPAD-SMALLCALC'].keys, got = {};
    keys.forEach((row, r) => row.forEach((k, ci) => {
      run.press('KP1:' + k, true);
      assert.deepStrictEqual(run.state(c.parts.find(p => p.id === 'KP1'), run.res).keys, { [k]: true });
      got[k] = scan();
      assert.strictEqual(got[k], r * 4 + ci + 1, 'tuş ' + k);
      run.press('KP1:' + k, false);
    }));
    assert.deepStrictEqual([got['7'], got['/'], got['1'], got['C'], got['+']], [1, 4, 9, 13, 16]);
    assert.strictEqual(scan(), 0);
  });

  test('KEYPAD-PHONETYPE: basılı tuş satır ile sütunu kısa devre eder', () => {
    const c = mk([Q('PW', 'POWER'), Q('KP', 'KEYPAD-PHONETYPE'), Q('R1', 'RES'), Q('R2', 'RES'), Q('G', 'GROUND')],
      [['PW.1', 'KP.B'], ['KP.1', 'R1.1'], ['KP.2', 'R2.1'], ['R1.2', 'R2.2', 'G.1']]);
    const m = SIM.compile(c, LIB), run = new SIM.Runner(m), v = (r, a) => r.val[m.ex.pinNet[a]];
    assert.deepStrictEqual([v(run.res, 'KP.1'), v(run.res, 'KP.2')], [0, 0]);
    run.press('KP:5', true);
    assert.deepStrictEqual([v(run.res, 'KP.1'), v(run.res, 'KP.2')], [0, 1]);
    run.press('KP:5', false); run.press('KP:4', true);
    assert.deepStrictEqual([v(run.res, 'KP.1'), v(run.res, 'KP.2')], [1, 0]);
    run.press('KP:1', true);
    assert.strictEqual(v(run.res, 'KP.1'), 1, 'farklı satırdaki tuş satır B\'yi etkilemez');
    run.press('KP:4', false);
    assert.strictEqual(v(run.res, 'KP.1'), 0, 'A satırı boşta, sütun pull-down → 0');
  });

  test('SWITCH ve DIPSW_8: v=true ile durum değişir (kalıcı), v=false yok sayılır', () => {
    const c = mk([Q('PW', 'POWER'), Q('S1', 'SWITCH'), Q('R1', 'RES'), Q('DSW', 'DIPSW_8'), Q('R2', 'RES'), Q('R3', 'RES'), Q('G', 'GROUND')],
      [['PW.1', 'S1.1', 'DSW.1', 'DSW.3'], ['S1.2', 'R1.1'], ['DSW.9', 'R2.1'], ['DSW.11', 'R3.1'], ['R1.2', 'R2.2', 'R3.2', 'G.1']]);
    const m = SIM.compile(c, LIB), run = new SIM.Runner(m), v = a => run.res.val[m.ex.pinNet[a]];
    const sp = c.parts.find(p => p.id === 'S1'), dp = c.parts.find(p => p.id === 'DSW');
    assert.strictEqual(v('S1.2'), 0);
    run.press('S1', true); assert.strictEqual(v('S1.2'), 1);
    run.press('S1', false); assert.strictEqual(v('S1.2'), 1, 'bırakınca açık kalmaz');
    assert.strictEqual(run.state(sp, run.res).sw, true);
    run.press('S1', true); assert.strictEqual(v('S1.2'), 0);
    run.press('DSW:3', true); run.press('DSW:3', false);
    assert.deepStrictEqual([v('DSW.9'), v('DSW.11')], [0, 1], 'yalnız 3 ↔ 11');
    assert.deepStrictEqual(run.state(dp, run.res).sws, { 3: true });
    run.press('DSW:1', true);
    assert.deepStrictEqual([v('DSW.9'), v('DSW.11')], [1, 1]);
  });

  test('LOGICSTATE güçlü sürücü + LOGICPROBE 0/1/?', () => {
    const c = mk([Q('L1', 'LOGICSTATE'), Q('P1', 'LOGICPROBE'), Q('P2', 'LOGICPROBE'), Q('PW', 'POWER'), Q('R', 'RES')], [['L1.1', 'P1.1', 'R.1'], ['R.2', 'PW.1']]);
    const m = SIM.compile(c, LIB), run = new SIM.Runner(m), P = id => c.parts.find(p => p.id === id);
    const lv = () => [run.state(P('L1'), run.res).level, run.state(P('P1'), run.frame(0)).level, run.state(P('P2'), run.frame(0)).level];
    assert.deepStrictEqual(lv(), [0, 0, 2], 'LOGICSTATE 0, pull-up direncini yener');
    run.press('L1', true); run.press('L1', false);
    assert.deepStrictEqual(lv(), [1, 1, 2]);
    run.press('L1', true);
    assert.deepStrictEqual(lv(), [0, 0, 2]);
  });

  test('NPN anahtar: B=1, E=0 → C zayıf 0 (pull-up\'ı yener, güçlü 1\'i yenmez)', () => {
    const c = mk([Q('L1', 'LOGICSTATE'), Q('RB', 'RES', '4k7'), Q('Q1', 'NPN'), Q('RC', 'RES'), Q('PW', 'POWER'), Q('G', 'GROUND'), Q('D1', 'LED-RED'),
      Q('L2', 'LOGICSTATE', '1'), Q('Q2', 'NPN')],
      [['L1.1', 'RB.1'], ['RB.2', 'Q1.B', 'Q2.B'], ['PW.1', 'RC.1', 'D1.A'], ['RC.2', 'Q1.C', 'D1.K'], ['Q1.E', 'Q2.E', 'G.1'], ['L2.1', 'Q2.C']]);
    const m = SIM.compile(c, LIB), run = new SIM.Runner(m), v = a => run.res.val[m.ex.pinNet[a]];
    assert.strictEqual(v('Q1.C'), 1); assert.strictEqual(run.res.lit.D1.ON, false);
    run.press('L1', true);
    assert.strictEqual(v('Q1.C'), 0); assert.strictEqual(run.res.lit.D1.ON, true, 'NPN ile LED yanar');
    assert.strictEqual(v('Q2.C'), 1, 'güçlü 1 kalır'); assert.strictEqual(run.res.conflict, false);
  });

  const nib = (run, st, rs, n) => { const b = (rs ? 0x10 : 0) | (n & 15); for (const e of [0, 0x20, 0]) run.port(0xFF, 0, 0x00, b | e, st.cyc += 20); };
  const lcd4 = (run, st, rs, byte) => { nib(run, st, rs, byte >> 4); nib(run, st, rs, byte & 15); };
  const lcdInit = (run, st) => { for (const n of [3, 3, 3, 2]) nib(run, st, 0, n); for (const b of [0x28, 0x08, 0x01, 0x06, 0x0C]) lcd4(run, st, 0, b); };
  test('LM016L 4-bit (lcd_demo, mikroC: RS=RB4 EN=RB5 D4..D7=RB0..RB3): init + "HELLO"', () => {
    const c = loadC('lcd_demo'), m = SIM.compile(c, LIB), run = new SIM.Runner(m), st = { cyc: 0 }, lp = c.parts.find(p => p.id === 'LCD1');
    const view = () => run.state(lp, run.frame(st.cyc)).lcd;
    assert.deepStrictEqual(view().lines, ['', ''], 'açılışta ekran kapalı');
    lcdInit(run, st);
    for (const ch of 'HELLO') lcd4(run, st, 1, ch.charCodeAt(0));
    let v = view();
    assert.strictEqual(v.lines[0], 'HELLO');
    assert.strictEqual(v.lines[1], '');
    assert.strictEqual(v.cursor, null, '0x0C: imleç kapalı');
    lcd4(run, st, 0, 0xC0 + 3);
    for (const ch of 'WORLD') lcd4(run, st, 1, ch.charCodeAt(0));
    lcd4(run, st, 0, 0x0E);
    v = view();
    assert.deepStrictEqual(v.lines, ['HELLO', '   WORLD']);
    assert.deepStrictEqual(v.cursor, { row: 1, col: 8, blink: false });
    lcd4(run, st, 0, 0x18);
    assert.deepStrictEqual(view().lines, ['ELLO', '  WORLD'], 'ekran sola kaydı');
    lcd4(run, st, 0, 0x02);
    assert.deepStrictEqual(view().lines, ['HELLO', '   WORLD'], 'home kaydırmayı sıfırlar');
    lcd4(run, st, 0, 0x40);
    for (const b of [0x0E, 0x11, 0x11, 0x11, 0x1F, 0x1B, 0x1F, 0]) lcd4(run, st, 1, b);
    lcd4(run, st, 0, 0x80 + 15); lcd4(run, st, 1, 0);
    v = view();
    assert.strictEqual(v.lines[0].length, 16); assert.strictEqual(v.lines[0].charCodeAt(15), 0);
    assert.deepStrictEqual(v.cg.slice(0, 8), [0x0E, 0x11, 0x11, 0x11, 0x1F, 0x1B, 0x1F, 0]);
    lcd4(run, st, 0, 0x01);
    assert.deepStrictEqual(view().lines, ['', '']);
    lcd4(run, st, 0, 0x08);
    lcd4(run, st, 1, 65);
    assert.deepStrictEqual(view().lines, ['', ''], 'ekran kapalıyken görünmez');
    lcd4(run, st, 0, 0x0C);
    assert.strictEqual(view().lines[0], 'A');
  });

  test('LM016L 8-bit mod + RW=1 iken yazmaz + sadece düşen kenar', () => {
    const parts = [Q('U1', 'PIC16F628A'), Q('LCD', 'LM016L'), Q('G', 'GROUND')], nets = [['LCD.1', 'G.1'], ['U1.17', 'LCD.4'], ['U1.18', 'LCD.6'], ['U1.1', 'LCD.5']];
    for (let i = 0; i < 8; i++) nets.push(['U1.' + (6 + i), 'LCD.' + (7 + i)]);
    const c = mk(parts, nets), run = new SIM.Runner(SIM.compile(c, LIB)), lp = c.parts.find(p => p.id === 'LCD');
    let cyc = 0;
    const wr = (rs, b, rw) => { const a = (rs ? 1 : 0) | (rw ? 4 : 0); run.port(0xF0, a, 0, b, cyc += 10); run.port(0xF0, a | 2, 0, b, cyc += 10); run.port(0xF0, a, 0, b, cyc += 10); };
    for (const b of [0x38, 0x0F, 0x01, 0x06]) wr(0, b);
    for (const ch of 'AB') wr(1, ch.charCodeAt(0));
    wr(1, 90, true);
    run.port(0xF0, 1 | 2, 0, 88, cyc += 10);
    wr(0, 0xC0); for (const ch of 'CD') wr(1, ch.charCodeAt(0));
    const v = run.state(lp, run.res).lcd;
    assert.deepStrictEqual(v.lines, ['AB', 'CD']);
    assert.deepStrictEqual(v.cursor, { row: 1, col: 2, blink: true });
  });

  test('UART: uartTx → RB2 netindeki terminal; termKey → uartRx (RB1); TXD boşta 1', () => {
    const c = loadC('uart_demo'), m = SIM.compile(c, LIB), run = new SIM.Runner(m), vt = c.parts.find(p => p.id === 'VT1');
    for (const ch of 'Merhaba\r\nPIC') assert.strictEqual(run.uartTx(ch.charCodeAt(0), 100), true);
    assert.strictEqual(run.state(vt, run.frame(200)).text, 'Merhaba\nPIC');
    run.uartTx(8, 300);
    assert.strictEqual(run.state(vt, run.res).text, 'Merhaba\nPI');
    assert.strictEqual(run.uartRx(), null);
    assert.strictEqual(run.termKey('VT1', 'a'), true); run.termKey('VT1', 13); run.termKey('VT1', 'ş');
    assert.deepStrictEqual([run.uartRx(), run.uartRx(), run.uartRx(), run.uartRx()], [97, 13, 63, null]);
    assert.strictEqual((run.port(0xFF, 0, 0xFF, 0, 400).inB >> 1) & 1, 1, 'RB1 terminal TXD ile 1');
    const c2 = JSON.parse(JSON.stringify(c)); c2.wires = [];
    const r2 = new SIM.Runner(SIM.compile(c2, LIB));
    assert.strictEqual(r2.uartTx(65, 0), false); r2.termKey('VT1', 'x');
    assert.strictEqual(r2.uartRx(), null, 'bağlı değilse PIC\'e gitmez');
  });

  test('BUZZER: DC fark → ses; penceredeki salınım → frekans; MOTOR yön ve PWM ortalaması', () => {
    const c = mk([Q('U1', 'PIC16F628A'), Q('BZ', 'BUZZER'), Q('M1', 'MOTOR'), Q('G', 'GROUND')], [['U1.6', 'BZ.1'], ['BZ.2', 'G.1'], ['U1.7', 'M1.1'], ['U1.8', 'M1.2']]);
    const run = new SIM.Runner(SIM.compile(c, LIB)), P = id => c.parts.find(p => p.id === id);
    let cyc = 0;
    run.port(0xFF, 0, 0, 0x01 | 0x02, cyc += 10);
    let f = run.frame(cyc += 30000);
    assert.deepStrictEqual([run.state(P('BZ'), f).sound, run.state(P('BZ'), f).freq], [true, 2000]);
    assert.strictEqual(run.state(P('M1'), f).spin, 1);
    run.port(0xFF, 0, 0, 0x04, cyc += 10); f = run.frame(cyc += 30000);
    assert.strictEqual(run.state(P('BZ'), f).sound, false);
    assert.strictEqual(run.state(P('M1'), f).spin, -1);
    for (let k = 0; k < 200; k++) run.port(0xFF, 0, 0, (k & 1) ? 0x01 : 0x00, cyc += 250);
    f = run.frame(cyc);
    const s = run.state(P('BZ'), f);
    assert(s.sound && Math.abs(s.freq - 2000) < 200, 'frekans ~2 kHz: ' + s.freq);
    for (let k = 0; k < 200; k++) run.port(0xFF, 0, 0, (k & 1) ? 0x02 : 0x00, cyc += 100);
    const sp = run.state(P('M1'), run.frame(cyc)).spin;
    assert(Math.abs(sp - 0.5) < 0.06, 'PWM %50 → spin ~0.5: ' + sp);
    run.setClock(20e6); assert.strictEqual(run.win, 100000);
    run.setClock(8e6); assert.strictEqual(run.win, 40000);
  });

  test('PORTB pull-up (RBPU): flB boşta maskesi + setPullups; buton 0\'a çeker', () => {
    const c = mk([Q('U1', 'PIC16F628A'), Q('SW', 'BUTTON'), Q('G', 'GROUND')], [['U1.6', 'SW.1'], ['SW.2', 'G.1']]);
    const run = new SIM.Runner(SIM.compile(c, LIB));
    let r = run.port(0xFF, 0, 0xFF, 0, 1);
    assert.strictEqual(r.flB, 0xFF); assert.strictEqual(r.inB, 0);
    r = run.press('SW', true, 2); assert.strictEqual(r.flB & 1, 0, 'basılı → RB0 toprakta');
    run.press('SW', false, 3);
    r = run.setPullups(0xFF, 4); assert.strictEqual(r.inB, 0xFF);
    r = run.press('SW', true, 5); assert.strictEqual(r.inB, 0xFE);
    r = run.port(0xFF, 0, 0x00, 0xFF, 6); assert.strictEqual(r.conflict, true, 'çıkış 1 + buton toprak → çakışma');
  });

  test('CAP / CAP-ELEC / CRYSTAL dekoratif: iletmez', () => {
    const c = mk([Q('PW', 'POWER'), Q('C1', 'CAP'), Q('C2', 'CAP-ELEC'), Q('X1', 'CRYSTAL'), Q('R', 'RES'), Q('G', 'GROUND')],
      [['PW.1', 'C1.1', 'C2.1', 'X1.1'], ['C1.2', 'C2.2', 'X1.2', 'R.1'], ['R.2', 'G.1']]);
    const m = SIM.compile(c, LIB);
    assert.strictEqual(SIM.solve(m, null, {}).val[m.ex.pinNet['R.1']], 0);
  });

  test('lab1_led_switch: PORTB=0x55 → D1,D3,D5,D7; SW1/SW2 → RA0/RA1', () => {
    const c = loadC('lab1_led_switch'), m = SIM.compile(c, LIB), run = new SIM.Runner(m);
    const r = run.port(0xFF, 0, 0x00, 0x55, 10);
    assert.deepStrictEqual([1, 2, 3, 4, 5, 6, 7, 8].map(i => r.lit['D' + i].ON), [true, false, true, false, true, false, true, false]);
    assert.strictEqual(run.press('SW1', true, 20).inA & 3, 1);
    assert.strictEqual(run.press('SW2', true, 30).inA & 3, 3);
    assert.strictEqual(run.press('SW1', false, 40).inA & 3, 2);
  });

  test('keypad_demo: LCD PORTA üzerinde (RS=RA6, EN=RA7, D4..D7=RA0..RA3)', () => {
    const c = loadC('keypad_demo'), run = new SIM.Runner(SIM.compile(c, LIB)), lp = c.parts.find(p => p.id === 'LCD1');
    let cyc = 0;
    const nb = (rs, n) => { const b = (rs ? 0x40 : 0) | (n & 15); for (const e of [0, 0x80, 0]) run.port(0x30, b | e, 0x0F, 0, cyc += 20); };
    const by = (rs, b) => { nb(rs, b >> 4); nb(rs, b & 15); };
    for (const n of [3, 3, 3, 2]) nb(0, n);
    for (const b of [0x28, 0x0C, 0x01, 0x06]) by(0, b);
    for (const ch of 'Tus: 7') by(1, ch.charCodeAt(0));
    assert.strictEqual(run.state(lp, run.res).lcd.lines[0], 'Tus: 7');
  });
}

if (realLib) {
  const Q = (id, type, value) => ({ id, type, x: 0, y: 0, rot: 0, value: value == null ? LIB.types[type].defaultValue || '' : value });
  const build = (parts, nets) => { SIM.layout(parts, LIB, 1400); const r = SIM.route({ parts, nets }, LIB); assert.deepStrictEqual(r.warnings, [], 'yönlendirme'); return { parts, wires: r.wires }; };
  const mk2 = (parts, nets) => { const c = build(parts, nets); assert.deepStrictEqual(SIM.pinNets(c, LIB), SIM.canon(nets), 'netlist'); return c; };

  test('TERMINAL: aynı adlı etiketler (büyük/küçük harf, boşluk duyarsız) ağları birleştirir; VCC/GND etiketi besleme', () => {
    const c = build([Q('L1', 'LOGICSTATE'), Q('T1', 'TERMINAL', 'DATA'), Q('T2', 'TERMINAL', ' data '), Q('D1', 'LED-RED'), Q('G', 'GROUND'), Q('T3', 'TERMINAL', 'BAŞKA'),
      Q('T4', 'TERMINAL', 'VCC'), Q('D2', 'LED-GREEN'), Q('T5', 'TERMINAL', 'GND')],
      [['L1.1', 'T1.1'], ['T2.1', 'D1.A'], ['D1.K', 'G.1'], ['T4.1', 'D2.A'], ['D2.K', 'T5.1']]);
    const nets = SIM.pinNets(c, LIB);
    assert(nets.some(n => n.join() === ['D1.A', 'L1.1', 'T1.1', 'T2.1'].join()), JSON.stringify(nets));
    assert(!nets.some(n => n.includes('T3.1')), 'tek etiket bağlanmaz');
    const m = SIM.compile(c, LIB), run = new SIM.Runner(m);
    assert.strictEqual(run.res.lit.D1.ON, false);
    run.press('L1', true);
    assert.strictEqual(run.res.lit.D1.ON, true, 'etiket üzerinden LED yanar');
    assert.strictEqual(run.res.lit.D2.ON, true, 'VCC/GND etiketleri');
  });

  const hc595 = cascade => {
    const parts = [Q('U1', 'PIC16F628A'), Q('U2', '74HC595'), Q('G', 'GROUND')], nets = [['U1.6', 'U2.14'], ['U1.7', 'U2.11'], ['U1.8', 'U2.12'], ['U1.9', 'U2.10'], ['U1.10', 'U2.13']];
    const gnd = ['G.1'];
    for (let i = 0; i < 8; i++) { parts.push(Q('D' + i, 'LED-RED')); nets.push(['U2.' + ['15', '1', '2', '3', '4', '5', '6', '7'][i], 'D' + i + '.A']); gnd.push('D' + i + '.K'); }
    if (cascade) { parts.push(Q('U3', '74HC595'), Q('P', 'LOGICPROBE')); nets.push(['U2.9', 'U3.14'], ['U3.15', 'P.1']); nets[1].push('U3.11'); nets[2].push('U3.12'); }
    nets.push(gnd);
    return mk2(parts, nets);
  };
  const shiftOut = (run, st, bits, mr, oe) => {
    const B = (ds, sh, stc) => (ds ? 1 : 0) | (sh ? 2 : 0) | (stc ? 4 : 0) | (mr === 0 ? 0 : 8) | (oe ? 16 : 0);
    for (const b of bits) { run.port(0xFF, 0, 0x00, B(b, 0, 0), st.cyc += 4); run.port(0xFF, 0, 0x00, B(b, 1, 0), st.cyc += 4); run.port(0xFF, 0, 0x00, B(b, 0, 0), st.cyc += 4); }
    run.port(0xFF, 0, 0x00, B(0, 0, 1), st.cyc += 4); run.port(0xFF, 0, 0x00, B(0, 0, 0), st.cyc += 4);
  };
  const msb = v => Array.from({ length: 8 }, (_, i) => (v >> (7 - i)) & 1);
  test('74HC595: SH_CP yükselen kenarda kaydırır, ST_CP ile mandallar; OE=1 → yüksek empedans; MR=0 → sıfırlar', () => {
    const c = hc595(false), m = SIM.compile(c, LIB), run = new SIM.Runner(m), st = { cyc: 0 }, P = id => c.parts.find(p => p.id === id);
    const leds = () => Array.from({ length: 8 }, (_, i) => run.res.lit['D' + i].ON ? 1 : 0).reverse().join('');
    assert.strictEqual(leds(), '00000000');
    run.port(0xFF, 0, 0x00, 8, st.cyc += 4);
    for (const b of msb(0xA5)) { run.port(0xFF, 0, 0, b | 8, st.cyc += 4); run.port(0xFF, 0, 0, b | 2 | 8, st.cyc += 4); run.port(0xFF, 0, 0, b | 8, st.cyc += 4); }
    assert.strictEqual(leds(), '00000000', 'mandallanmadan çıkış değişmez');
    assert.strictEqual(run.state(P('U2'), run.res).sr, 0xA5);
    assert.strictEqual(run.res.val[m.ex.pinNet['U2.9']], 1, "Q7' = kaydırma yazmacının 7. biti");
    run.port(0xFF, 0, 0, 4 | 8, st.cyc += 4); run.port(0xFF, 0, 0, 8, st.cyc += 4);
    assert.strictEqual(leds(), '10100101', 'Q7..Q0');
    shiftOut(run, st, msb(0x3C), 1, 1);
    assert.strictEqual(run.res.val[m.ex.pinNet['U2.15']], 2, 'OE=1 → Q0 boşta');
    assert.strictEqual(leds(), '00000000');
    run.port(0xFF, 0, 0, 8, st.cyc += 4);
    assert.strictEqual(leds(), '00111100', 'OE=0 → mandaldaki değer');
    run.port(0xFF, 0, 0, 0, st.cyc += 4);
    assert.strictEqual(run.state(P('U2'), run.res).sr, 0, 'MR=0 kaydırma yazmacını siler');
    assert.strictEqual(leds(), '00111100', 'MR depolama yazmacını silmez');
    run.port(0xFF, 0, 0, 4, st.cyc += 4); run.port(0xFF, 0, 0, 0, st.cyc += 4);
    assert.strictEqual(leds(), '00000000', 'sonraki mandal sıfırı yükler');
  });
  test("74HC595 zincir: Q7' → ikinci DS, 16 bit kaydırma", () => {
    const c = hc595(true), m = SIM.compile(c, LIB), run = new SIM.Runner(m), st = { cyc: 0 }, P = id => c.parts.find(p => p.id === id);
    shiftOut(run, st, msb(0x81).concat(msb(0x42)), 1, 0);
    assert.deepStrictEqual([run.state(P('U3'), run.res).q, run.state(P('U2'), run.res).q], [0x81, 0x42]);
    assert.strictEqual(run.state(P('P'), run.res).level, 1, 'U3.Q0');
  });

  test('LM044L 20x4: satır adresleri 0x00/0x40/0x14/0x54, 4-bit', () => {
    const parts = [Q('U1', 'PIC16F628A'), Q('LCD', 'LM044L'), Q('G', 'GROUND')], nets = [['U1.10', 'LCD.4'], ['U1.11', 'LCD.6'], ['LCD.5', 'LCD.1', 'G.1']];
    for (let i = 0; i < 4; i++) nets.push(['U1.' + (6 + i), 'LCD.' + (11 + i)]);
    const c = mk2(parts, nets), run = new SIM.Runner(SIM.compile(c, LIB)), lp = c.parts.find(p => p.id === 'LCD'), st = { cyc: 0 };
    const nb = (rs, n) => { const b = (rs ? 0x10 : 0) | (n & 15); for (const e of [0, 0x20, 0]) run.port(0xFF, 0, 0x00, b | e, st.cyc += 20); };
    const by = (rs, b) => { nb(rs, b >> 4); nb(rs, b & 15); };
    for (const n of [3, 3, 3, 2]) nb(0, n);
    for (const b of [0x28, 0x0C, 0x01, 0x06]) by(0, b);
    const put = (addr, t) => { by(0, 0x80 | addr); for (const ch of t) by(1, ch.charCodeAt(0)); };
    put(0x00, 'Satir 1'); put(0x40, 'Satir 2'); put(0x14, 'Satir 3'); put(0x54, 'Satir 4: 20 karakter');
    const v = run.state(lp, run.res).lcd;
    assert.deepStrictEqual(v.lines, ['Satir 1', 'Satir 2', 'Satir 3', 'Satir 4: 20 karakter'], JSON.stringify(v.lines));
    by(0, 0x0E); by(0, 0x80 | 0x14 + 3);
    assert.deepStrictEqual(run.state(lp, run.res).lcd.cursor, { row: 2, col: 3, blink: false });
  });

  test('7SEG-MPX2-CC/CA + TRAFFIC-LIGHTS (iç ortak toprak)', () => {
    const c = mk2([Q('PW', 'POWER'), Q('G', 'GROUND'), Q('CC', '7SEG-MPX2-CC'), Q('CA', '7SEG-MPX2-CA'), Q('TL', 'TRAFFIC-LIGHTS')],
      [['PW.1', 'CC.A', 'CA.2', 'TL.A'], ['G.1', 'CC.2', 'CA.B', 'TL.G']]);
    const r = SIM.solve(SIM.compile(c, LIB), null, {});
    assert.strictEqual(r.lit.CC['2A'], true); assert.strictEqual(r.lit.CC['1A'], false);
    assert.strictEqual(r.lit.CA['2B'], true); assert.strictEqual(r.lit.CA['1B'], false);
    assert.deepStrictEqual(r.lit.TL, { R: false, A: true, G: false });
  });

  test('L293D: EN boşta = etkin, Y = A; EN=0 → çıkış boşta; motor yönü', () => {
    const c = mk2([Q('L1', 'LOGICSTATE'), Q('L2', 'LOGICSTATE'), Q('LE', 'LOGICSTATE', '1'), Q('U', 'L293D'), Q('M', 'MOTOR')],
      [['L1.1', 'U.2'], ['L2.1', 'U.7'], ['LE.1', 'U.1'], ['U.3', 'M.1'], ['U.6', 'M.2']]);
    const m = SIM.compile(c, LIB), run = new SIM.Runner(m), M = c.parts.find(p => p.id === 'M'), v = a => run.res.val[m.ex.pinNet[a]];
    assert.strictEqual(run.state(M, run.frame(1e5)).spin, 0);
    run.press('L1', true, 1e5);
    assert.deepStrictEqual([v('U.3'), v('U.6')], [1, 0]);
    assert.strictEqual(run.state(M, run.frame(2e5)).spin, 1);
    run.press('L1', true, 2e5); run.press('L2', true, 2e5);
    assert.strictEqual(run.state(M, run.frame(3e5)).spin, -1);
    run.press('LE', true, 3e5);
    assert.deepStrictEqual([v('U.3'), v('U.6')], [2, 2], 'EN=0');
    assert.strictEqual(v('U.11'), 1, 'boşta TTL girişleri 1 → 3Y = 1');
  });

  test('RELAY: bobin enerjisiz → COM-NC, enerjili → COM-NO', () => {
    const c = mk2([Q('L1', 'LOGICSTATE'), Q('RL', 'RELAY'), Q('PW', 'POWER'), Q('D1', 'LED-RED'), Q('D2', 'LED-GREEN'), Q('G', 'GROUND')],
      [['L1.1', 'RL.1'], ['RL.2', 'G.1', 'D1.K', 'D2.K'], ['PW.1', 'RL.COM'], ['RL.NO', 'D1.A'], ['RL.NC', 'D2.A']]);
    const run = new SIM.Runner(SIM.compile(c, LIB)), RLp = c.parts.find(p => p.id === 'RL');
    assert.deepStrictEqual([run.res.lit.D1.ON, run.res.lit.D2.ON, run.state(RLp, run.res).sw], [false, true, false]);
    run.press('L1', true);
    assert.deepStrictEqual([run.res.lit.D1.ON, run.res.lit.D2.ON, run.state(RLp, run.res).sw], [true, false, true]);
    run.press('L1', true);
    assert.deepStrictEqual([run.res.lit.D1.ON, run.res.lit.D2.ON], [false, true]);
    assert.deepStrictEqual(SIM.solve(SIM.compile(c, LIB), null, {}).lit.D2, { ON: true }, 'durağan çözümde NC kapalı');
  });

  const loadS7 = n => JSON.parse(fs.readFileSync(path.join(ROOT, 'circuits', n + '.json'), 'utf8'));
  test('S7 analog: değer ayrıştırma (10k, 4k7, 1R5, 2.2k, 1M, 10kΩ)', () => {
    const t = { '10k': 1e4, '4k7': 4700, '220': 220, '1R5': 1.5, '2.2k': 2200, '1M': 1e6, '10kΩ': 1e4, ' 33 k ': 33000, '': 7, 'abc': 7, '0': 7 };
    for (const k in t) assert.strictEqual(SIM.ohms(k, 7), t[k], k);
  });

  const chain = (vals, extra) => {
    const parts = [part('PWR1', 'POWER', -20, -10)];
    vals.forEach((v, i) => parts.push(part('R' + (i + 1), 'RES', 60 * i, 0, v)));
    parts.push(part('GND1', 'GROUND', 60 * vals.length - 20, 10));
    return { version: 1, parts: parts.concat(extra || []), wires: [] };
  };
  test('S7 analog: seri direnç zinciri (POWER-R-R-R-GROUND) düğüm gerilimleri; voltmetre; boşta = null', () => {
    const c = chain(['10k', '30k'], [part('VM1', 'DC-VOLTMETER', 60, -10), part('R9', 'RES', 300, 300, '1k')]);
    const run = new SIM.Runner(SIM.compile(c, LIB));
    assert.strictEqual(run.analog('R1.1'), 5); assert.strictEqual(run.analog('R1.2'), 3.75); assert.strictEqual(run.analog('GND1.1'), 0);
    assert.strictEqual(run.state(c.parts.find(p => p.id === 'VM1'), run.res).volts, 3.75, 'voltmetre (- boşta = toprak)');
    assert.strictEqual(run.analog('R9.1'), null, 'hiçbir kaynağa bağlı olmayan ağ');
    assert.strictEqual(run.analog({ pin: 'R2.1' }), 3.75); assert.strictEqual(run.analog(-1), null);
    const c3 = chain(['1k', '2k', '2k']), r3 = new SIM.Runner(SIM.compile(c3, LIB));
    assert.strictEqual(r3.analog('R2.1'), 4); assert.strictEqual(r3.analog('R3.1'), 2);
    assert.strictEqual(r3.res.val[r3.netOf('R2.1')], 1, 'dijital çözüm değişmedi (POT yokken en yakın sürücü)');
    assert.strictEqual(r3.volts(), r3.volts(), 'analog sonuç önbellekte');
  });

  const potC = (load, extra) => {
    const parts = [part('RV1', 'POT-HG', 0, 0, '10k'), part('GND1', 'GROUND', -20, 10), part('PWR1', 'POWER', 60, -10), part('LP1', 'LOGICPROBE', 40, -20)];
    if (load) parts.push(part('RL', 'RES', 40, -20, load), part('GND2', 'GROUND', 80, -10));
    return { version: 1, parts: parts.concat(extra || []), wires: [] };
  };
  test('S7 POT-HG: silecek = konum × 5 V; -/+ adımları, sürükleme (=x), sınırlar; yük altında bölücü; dijital eşik 2,5 V', () => {
    const c = potC(), run = new SIM.Runner(SIM.compile(c, LIB));
    assert.deepStrictEqual(LIB.pinPos(c.parts[0], '3'), [30, -10]);
    assert.strictEqual(run.analog('RV1.3'), 2.5);
    run.press('RV1:=0.2', true); assert.strictEqual(run.analog('RV1.3'), 1);
    assert.strictEqual(run.state(c.parts[3], run.res).level, 0, 'LOGICPROBE 1 V → 0');
    run.press('RV1:+', true); run.press('RV1:+', false); assert.strictEqual(run.potPos('RV1'), 0.25);
    run.press('RV1:=0.9', true); assert.strictEqual(run.analog('RV1.3'), 4.5);
    assert.strictEqual(run.state(c.parts[3], run.res).level, 1, 'LOGICPROBE 4,5 V → 1');
    for (let i = 0; i < 5; i++) run.press('RV1:+', true);
    assert.strictEqual(run.potPos('RV1'), 1); assert.strictEqual(run.analog('RV1.3'), 5);
    run.press('RV1:=-3', true); assert.strictEqual(run.analog('RV1.3'), 0);
    const st = run.state(c.parts[0], run.res); assert.strictEqual(st.pos, 0); assert.strictEqual(st.volts, 0);
    const a0 = run.aver; run.press('RV1:=0.5', true); assert(run.aver > a0, 'aver artar (çekirdek yeniden değerlendirir)');
    const L = potC('10k'), rl = new SIM.Runner(SIM.compile(L, LIB));
    assert(Math.abs(rl.analog('RV1.3') - 2) < 1e-6, '5k üst, 5k‖10k alt → 2,0 V: ' + rl.analog('RV1.3'));
    const P2 = potC(null), p2 = Object.assign({}, P2.parts[0], { pos: 0.8 }); P2.parts[0] = p2;
    assert.strictEqual(new SIM.Runner(SIM.compile(P2, LIB)).analog('RV1.3'), 4, 'devre JSON "pos" başlangıç konumu');
  });

  if (fs.existsSync(path.join(ROOT, 'circuits/comparator_demo.json'))) test('S7 comparator_demo: RA0 = silecek, picAnalog, VREF çıkışı (RA2), ağ yoksa null', () => {
    const c = loadS7('comparator_demo'), run = new SIM.Runner(SIM.compile(c, LIB));
    assert.strictEqual(run.analog({ pic: 'RA0' }), 1.5, 'pos 0.3 → 1,5 V');
    assert(Math.abs(run.picAnalog(0) - 1.5) < 1e-9);
    assert.strictEqual(run.state(c.parts.find(p => p.id === 'VM1'), run.res).volts, 1.5);
    assert.strictEqual(run.picAnalog(2), null, 'RA2 boşta');
    run.setVref(1.25); assert(Math.abs(run.picAnalog(2) - 1.25) < 1e-9, 'VROE: RA2 = VREF');
    run.setVref(null); assert.strictEqual(run.picAnalog(2), null);
    run.port(0xFE, 0x01, 0xFF, 0, 10); assert.strictEqual(run.analog({ pic: 'RA0' }), 5, 'PIC çıkışı güçlü 5 V (pot silecekle çatışmaz: zayıf)');
    assert.strictEqual(run.res.conflict, false);
  });

  test('S7 Logic contention: ağ adları; scope_demo (R2 seri) + TRISB=0 çatışmasız, terminal RX R2 üzerinden', () => {
    const u = loadS7('uart_demo'), ru = new SIM.Runner(SIM.compile(u, LIB));
    ru.port(0xFF, 0, 0x00, 0x00, 10);
    assert.strictEqual(ru.res.conflict, true, 'uart_demo: RB1 çıkış 0, terminal TXD 1 → gerçek çatışma');
    assert.deepStrictEqual(ru.contention(), ['RB1']);
    const s = loadS7('scope_demo'), rs = new SIM.Runner(SIM.compile(s, LIB));
    for (const lat of [0x00, 0xFF, 0x08]) { rs.port(0xFF, 0, 0x00, lat, 10); assert.strictEqual(rs.res.conflict, false, 'PORTB=' + lat); assert.deepStrictEqual(rs.contention(), []); }
    rs.port(0xFF, 0, 0x02, 0x00, 20);
    assert.strictEqual((rs.res.inB >> 1) & 1, 1, 'RB1 giriş: terminal TXD boşta 1 (R2 üzerinden)');
    rs.termKey('VT1', 'A'); assert.strictEqual(rs.uartRx(), 65, 'terminal → PIC RX R2 üzerinden');
    assert.strictEqual(rs.uartTx(66, 30), true);
  });

  for (const name of ['hc595_demo', 'lcd20x4_demo', 'l293d_demo', 'scope_demo', 'labels_demo', 'traffic_demo', 'relay_demo', 'mux2_demo', 'comparator_demo']) {
    const f = path.join(ROOT, 'circuits', name + '.json');
    if (fs.existsSync(f)) test('örnek devre derlenir ve çalışır: ' + name, () => {
      const c = JSON.parse(fs.readFileSync(f, 'utf8')), m = SIM.compile(c, LIB), run = new SIM.Runner(m);
      for (const p of c.parts) assert(LIB.types[p.type], p.type);
      run.port(0xFF, 0, 0x02, 0x55, 10); run.frame(100);
      for (const p of c.parts) run.state(p, run.res);
      assert.strictEqual(run.res.conflict, false);
    });
  }
}

console.log('\n' + passed + ' geçti, ' + failed + ' başarısız');
process.exit(failed ? 1 : 0);
