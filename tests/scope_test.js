const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const LIB = require('../js/library.js'), SIM = require('../js/sim.js'), SCOPE = require('../js/scope.js');

let failed = 0, passed = 0, skipped = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e.stack || e).toString().split('\n').slice(0, 4).join('\n     ')); }
}
const skip = (name, why) => { skipped++; console.log('skip ' + name + ' (' + why + ')'); };
const Q = (id, type, value) => ({ id, type, x: 0, y: 0, rot: 0, value: value == null ? LIB.types[type].defaultValue || '' : value });
function mk(parts, nets) {
  SIM.layout(parts, LIB, 1400);
  const r = SIM.route({ parts, nets }, LIB);
  assert.deepStrictEqual(r.warnings, [], 'yönlendirme');
  return { version: 1, parts, wires: r.wires };
}
const loadC = n => JSON.parse(fs.readFileSync(path.join(ROOT, 'circuits', n + '.json'), 'utf8'));
const arr = d => Array.from(d.t).map((t, i) => [t, d.v[i]]);

test('kayıt: alet kanalları, PIC pin adı etiketi, bağlı olmayan uç kanal açmaz', () => {
  const c = mk([Q('U1', 'PIC16F628A'), Q('OSC1', 'OSCILLOSCOPE'), Q('LA1', 'LOGIC-ANALYSER')], [['U1.9', 'OSC1.A'], ['U1.6', 'LA1.A0', 'OSC1.C']]);
  const run = new SIM.Runner(SIM.compile(c, LIB));
  assert.deepStrictEqual(run.rec.channels.map(ch => [ch.id, ch.label, ch.kind]), [['OSC1:A', 'OSC1 A (RB3)', 'osc'], ['OSC1:C', 'OSC1 C (RB0)', 'osc'], ['LA1:A0', 'LA1 A0 (RB0)', 'la']]);
  assert.strictEqual(run.recOn, true);
  assert.deepStrictEqual(arr(run.rec.read(0, 0, 1e9)), [[0, 2]], 'TRIS=1 → boşta (Z)');
  run.port(0xFF, 0, 0x00, 0x08, 100);
  run.port(0xFF, 0, 0x00, 0x00, 250);
  run.port(0xFF, 0, 0x00, 0x09, 400);
  run.port(0xFF, 0, 0x00, 0x09, 500);
  assert.deepStrictEqual(arr(run.rec.read(0, 0, 1e9)), [[0, 2], [100, 1], [250, 0], [400, 1]]);
  assert.deepStrictEqual(arr(run.rec.read(0, 120, 300)), [[120, 1], [250, 0]], 't0 anındaki seviye dahil');
  assert.deepStrictEqual(arr(run.rec.read(2, 0, 1e9)), [[0, 2], [100, 0], [400, 1]]);
  assert.strictEqual(run.rec.level(0, 300), 0);
  run.port(0xFF, 0, 0x00, 0x00, 400);
  assert.deepStrictEqual(arr(run.rec.read(0, 0, 1e9)), [[0, 2], [100, 1], [250, 0]], 'aynı çevrimde geri dönen geçiş silinir');
  run.port(0xFF, 0, 0x00, 0x08, 50);
  assert.deepStrictEqual(arr(run.rec.read(0, 0, 1e9)), [[50, 1]], 'zaman geri giderse (reset) kayıt baştan');
  run.rec.clear();
  assert.strictEqual(run.rec.count(0), 1);
});

test('kayıt: düğme/LOGICSTATE ile değişen net + prob (tele çift tık)', () => {
  const c = mk([Q('L1', 'LOGICSTATE'), Q('D1', 'LED-RED'), Q('G', 'GROUND'), Q('LA1', 'LOGIC-ANALYSER')], [['L1.1', 'D1.A', 'LA1.A3'], ['D1.K', 'G.1']]);
  const run = new SIM.Runner(SIM.compile(c, LIB));
  run.press('L1', true, 1000); run.press('L1', true, 3000);
  assert.deepStrictEqual(arr(run.rec.read(0)), [[0, 0], [1000, 1], [3000, 0]]);
  const wk = c.wires.find(w => SIM.extract(c, LIB).wireNet[w.id] === SIM.extract(c, LIB).pinNet['D1.K']);
  const ch = run.probe({ wire: wk.id });
  assert.strictEqual(ch.id, 'PRB1'); assert.strictEqual(run.probe({ wire: wk.id }), ch, 'aynı ağa ikinci prob eklenmez');
  assert.deepStrictEqual(arr(run.rec.read(1)), [[3000, 0]]);
  assert.strictEqual(run.probe({ pin: 'YOK.1' }), null);
  assert.strictEqual(run.unprobe('PRB1'), true); assert.strictEqual(run.rec.channels.length, 1);
});

test('halka tampon: kanal başına 65 536 geçiş, taşınca en eskiler düşer', () => {
  const c = mk([Q('U1', 'PIC16F628A'), Q('LA1', 'LOGIC-ANALYSER')], [['U1.6', 'LA1.A0']]);
  const run = new SIM.Runner(SIM.compile(c, LIB));
  assert.strictEqual(SIM.REC_CAP, 65536);
  const N = 70000;
  for (let k = 1; k <= N; k++) run.port(0xFF, 0, 0x00, k & 1, k * 10);
  assert.strictEqual(run.rec.count(0), N + 1);
  assert.strictEqual(run.rec.dropped(0), N + 1 - 65536);
  const all = run.rec.read(0);
  assert.strictEqual(all.t.length, 65536);
  assert.strictEqual(run.rec.oldest(0), (N + 1 - 65536) * 10);
  assert.strictEqual(all.t[0], run.rec.oldest(0)); assert.strictEqual(all.t[65535], N * 10); assert.strictEqual(all.v[65535], N & 1);
  for (let i = 1; i < all.t.length; i++) if (all.t[i] <= all.t[i - 1] || all.v[i] === all.v[i - 1]) throw new Error('sıra bozuk @' + i);
  const w = run.rec.read(0, 600005, 600100);
  assert.deepStrictEqual(arr(w).slice(0, 2), [[600005, 0], [600010, 1]]);
});

test('alet yokken kayıt kodu hiç çalışmaz (Runner.port maliyeti aynı)', () => {
  const lab3 = loadC('lab3'), run = new SIM.Runner(SIM.compile(lab3, LIB));
  assert.strictEqual(run.rec.channels.length, 0); assert.strictEqual(run.recOn, false);
  let n = 0;
  run.rec.sample = () => { n++; };
  run.rec.push = () => { n++; };
  for (let k = 0; k < 20000; k++) run.port(0xF0, k & 3, 0x00, (k * 7) & 0xFF, k);
  run.press('SW1', true, 20001); run.frame(30000);
  assert.strictEqual(n, 0);
  const base = (() => { try { return cp.execSync('git show 8ad4c11:js/sim.js', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch (e) { return null; } })();
  if (!base) { console.log('     (git yok: hız karşılaştırması atlandı)'); return; }
  const f = path.join(os.tmpdir(), 'eelab_sim_base_' + process.pid + '.js');
  fs.writeFileSync(f, base);
  const OLD = require(f); fs.unlinkSync(f);
  const bench = S => {
    const r = new S.Runner(S.compile(lab3, LIB));
    for (let k = 0; k < 64; k++) r.port(0xF0, k & 3, 0x00, k, k);
    let best = Infinity;
    for (let rep = 0; rep < 7; rep++) {
      const t0 = process.hrtime.bigint();
      for (let k = 0; k < 200000; k++) r.port(0xF0, (k >> 6) & 3, 0x00, (k >> 4) & 0x3F, k);
      best = Math.min(best, Number(process.hrtime.bigint() - t0));
    }
    return best / 200000;
  };
  bench(OLD); bench(SIM);
  const a = bench(OLD), b = bench(SIM);
  console.log('     (port(): eski ' + a.toFixed(0) + ' ns, yeni ' + b.toFixed(0) + ' ns / çağrı)');
  assert(b <= a * 1.35 + 30, 'yavaşlama: ' + a + ' → ' + b);
});

test('SCOPE.measure / findTrigger / csv / biçimler', () => {
  const d = { t: new Float64Array([0, 100, 125, 200, 225, 300, 325, 400]), v: new Uint8Array([0, 1, 0, 1, 0, 1, 0, 1]) };
  const m = SCOPE.measure(d, 0, 450);
  assert.deepStrictEqual([m.period, m.high, m.low, m.duty, m.rises, m.falls, m.minPulse], [100, 25, 75, 0.25, 4, 3, 25]);
  assert.strictEqual(SCOPE.findTrigger(d, 'rise', 0, 350), 300);
  assert.strictEqual(SCOPE.findTrigger(d, 'fall', 0, 350), 325);
  assert.strictEqual(SCOPE.findTrigger(d, 'rise', 300, 350), null);
  assert.strictEqual(SCOPE.fmtTime(104e-6), '104 µs'); assert.strictEqual(SCOPE.fmtTime(0.0125), '12.5 ms'); assert.strictEqual(SCOPE.fmtFreq(4902), '4.9 kHz');
  assert.strictEqual(SCOPE.niceDiv(3.1e-4), 5e-4); assert.strictEqual(SCOPE.DIVS[0], 1e-6);
  const c = mk([Q('L1', 'LOGICSTATE'), Q('L2', 'LOGICSTATE'), Q('LA1', 'LOGIC-ANALYSER')], [['L1.1', 'LA1.A0'], ['L2.1', 'LA1.A1']]);
  const run = new SIM.Runner(SIM.compile(c, LIB));
  run.press('L1', true, 10); run.press('L2', true, 20); run.press('L1', true, 30);
  assert.strictEqual(SCOPE.csv(run.rec, null, 0, 100, 4e6), 'time_s,cycle,"LA1 A0","LA1 A1"\n0,0,0,0\n0.00001,10,1,0\n0.00002,20,1,1\n0.00003,30,0,1\n');
});

function makeHarness(circuit, hex, fosc) {
  const PIC = require('../js/pic.js');
  const m = SIM.compile(circuit, LIB), run = new SIM.Runner(m);
  run.setClock(fosc || 4e6);
  let c = null;
  const sync = () => {
    if (!c) return;
    run.setPullups((c.P.ram[0x81] & 0x80) ? 0 : 0xFF, c.P.cyc);
    const d = c.drive(), r = run.port(d[0], d[1], d[2], d[3], c.P.cyc);
    c.P.inA = r.inA; c.P.inB = r.inB; c.P.flB = 0;
  };
  c = PIC.create({ onPort: sync, onUartTx: (b, cy) => run.uartTx(b, cy) });
  c.load(PIC.parseHex(hex)); c.P.fosc = fosc || 4e6; c.reset(); sync();
  const press = (id, v) => { const r = run.press(id, v, c.P.cyc); c.P.inA = r.inA; c.P.inB = r.inB; };
  return { c, run, m, press };
}
let HEX = null;
function hexes() {
  if (HEX !== null) return HEX;
  HEX = false;
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'eelab_sc_'));
  const b = cp.spawnSync('python3', [path.join(__dirname, 'build_test.py'), '--out', out], { encoding: 'utf8' });
  if (b.status === 0 && fs.existsSync(path.join(out, 'Pwm_Demo.hex'))) HEX = n => fs.readFileSync(path.join(out, n + '.hex'), 'utf8');
  else console.log('     (derleme yapılamadı: ' + (b.stdout + b.stderr).split('\n').slice(-3).join(' ') + ')');
  return HEX;
}
const ch = (run, id) => run.rec.channels.findIndex(c => c.id === id);

if (fs.existsSync(path.join(ROOT, 'js/pic.js')) && hexes()) {
  test('M5 PWM: Pwm_Demo (scope_demo, OSC1.A = RB3) periyot ve doluluk PR2/CCPR1L ile ±1 çevrim', () => {
    const h = makeHarness(loadC('scope_demo'), HEX('Pwm_Demo'));
    h.c.run(60000);
    const R = h.c.P.ram, pre = [1, 4, 16, 16][R[0x12] & 3], pr2 = R[0x92], dc = (R[0x15] << 2) | ((R[0x17] >> 4) & 3);
    const wantT = (pr2 + 1) * pre, wantH = dc * pre / 4;
    const i = ch(h.run, 'OSC1:A'), t0 = 10000, t1 = 60000;
    const m = SCOPE.measure(h.run.rec.read(i, t0, t1), t0, t1);
    console.log('     (PR2=' + pr2 + ' ön bölücü=' + pre + ' DC=' + dc + ' → T=' + wantT + ' H=' + wantH + '; ölçülen T=' + m.period.toFixed(2) + ' H=' + m.high.toFixed(2) + ', f=' + SCOPE.fmtFreq(1e6 / m.period) + ')');
    assert(Math.abs(m.period - wantT) <= 1, 'periyot ' + m.period + ' / ' + wantT);
    assert(Math.abs(m.high - wantH) <= 1, 'yüksek süre ' + m.high + ' / ' + wantH);
    assert(m.rises > 100);
    const run = h.run, before = run.rec.count(i);
    h.c.run(560000);
    const m2 = SCOPE.measure(run.rec.read(i, 520000, 560000), 520000, 560000);
    assert(Math.abs(m2.period - wantT) <= 1 && m2.high > m.high + 10, '500 ms sonra doluluk artar: ' + m2.high);
    assert(run.rec.count(i) > before);
    const lit = run.state(loadC('scope_demo').parts.find(p => p.id === 'D1'), run.frame(h.c.P.cyc));
    assert(lit.lit.ON === true, 'PWM ile LED pencere içinde yanık görünür');
    assert.strictEqual(run.frame(h.c.P.cyc).conflict, false, 'TRISB=0 iken "Logic contention" yok (VT1.TXD ↔ RB1 arasında R2)');
    assert.deepStrictEqual(run.contention(), []);
  });

  test('M5 UART: Uart_Demo, LA1.A0 = RB2/TX: bit süresi 104 çevrim (9600 baud @4 MHz), çözülen metin', () => {
    const h = makeHarness(loadC('scope_demo'), HEX('Uart_Demo'));
    h.c.run(240000);
    const d = h.run.rec.read(ch(h.run, 'LA1:A0'), 0, h.c.P.cyc), m = SCOPE.measure(d);
    let sw = 0, sn = 0;
    for (let j = 2; j < d.t.length; j++) { const w = d.t[j] - d.t[j - 1], n = Math.round(w / m.minPulse); if (n <= 9) { sw += w; sn += n; } }
    const bit = sw / sn;
    let s = '';
    for (let j = 1; j < d.t.length;) {
      if (d.v[j] !== 0) { j++; continue; }
      const st = d.t[j];
      let byte = 0;
      for (let b = 0; b < 8; b++) { const tt = st + bit * (1.5 + b); if (h.run.rec.level(ch(h.run, 'LA1:A0'), tt) === 1) byte |= 1 << b; }
      s += String.fromCharCode(byte);
      const stop = st + bit * 9.5;
      while (j < d.t.length && d.t[j] <= stop) j++;
    }
    console.log('     (en kısa darbe ' + m.minPulse + ', ortalama bit ' + bit.toFixed(2) + ' çevrim, metin ' + JSON.stringify(s) + ')');
    assert(Math.abs(bit - 104) <= 1, 'bit süresi ' + bit);
    assert(Math.abs(m.minPulse - 104) <= 2, 'en kısa darbe ' + m.minPulse);
    assert.strictEqual(s, 'EE321 UART\r\n');
    assert.strictEqual(h.run.state(loadC('scope_demo').parts.find(p => p.id === 'VT1'), h.run.res).text, 'EE321 UART\n');
  });

  test('Task1 zamanlaması: osiloskoplu devrede de 1 sn ≈ 10 sayım', () => {
    const lab3 = loadC('lab3');
    lab3.parts.push({ id: 'OSC9', type: 'OSCILLOSCOPE', x: 20, y: 700, rot: 0, value: '' });
    const pin = LIB.pinPos(lab3.parts.find(p => p.id === 'U1'), '17'), oa = LIB.pinPos(lab3.parts[lab3.parts.length - 1], 'A');
    lab3.wires.push({ id: 'wosc', points: [pin, [pin[0] + 20, pin[1]], [pin[0] + 20, 760], [oa[0] - 0, 760], oa].filter((v, i, a) => !i || v[0] !== a[i - 1][0] || v[1] !== a[i - 1][1]) });
    const h = makeHarness(lab3, fs.readFileSync(path.join(ROOT, 'projeler/Task1.hex'), 'utf8'));
    assert.deepStrictEqual(h.run.rec.channels.map(c => c.label), ['OSC9 A (RA0)']);
    const ds = lab3.parts.filter(p => p.type === '7SEG-MPX1-CC').sort((x, y) => x.x - y.x);
    const show = () => { const d = h.run.frame(h.c.P.cyc); return ds.map(p => SIM.decode(d.lit[p.id])).join(''); };
    const go = n => h.c.run(h.c.P.cyc + n);
    go(300000);
    h.press('SW1', true); go(50000); h.press('SW1', false);
    go(1000000); const s1 = +show(); go(1000000); const s2 = +show();
    assert(s1 >= 8 && s1 <= 12 && s2 - s1 >= 9 && s2 - s1 <= 11, s1 + ' ' + s2);
    const m = SCOPE.measure(h.run.rec.read(0, 0, h.c.P.cyc));
    assert(m.edges >= 15, 'RA0 geçişleri kaydedildi: ' + m.edges);
  });
} else skip('PWM/UART ölçümleri', 'js/pic.js ya da derleyici yok');

class FE {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.parentNode = null; this.textContent = ''; this.style = {}; this.ls = {}; this.dataset = {}; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'data-id') this.dataset.id = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { if (c.parentNode) c.remove(); c.parentNode = this; this.children.push(c); return c; }
  remove() { if (this.parentNode) { const a = this.parentNode.children; a.splice(a.indexOf(this), 1); this.parentNode = null; } }
  set innerHTML(v) { for (const c of this.children) c.parentNode = null; this.children = []; }
  get isConnected() { let p = this; while (p.parentNode) p = p.parentNode; return p.tag === 'svg'; }
  addEventListener(t, f) { (this.ls[t] = this.ls[t] || []).push(f); }
  fire(t, e) { for (const f of this.ls[t] || []) f(e); }
  contains() { return true; }
  setPointerCapture() { }
  getScreenCTM() { return { a: 1, inverse() { return this; } }; }
  createSVGPoint() { return { x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } }; }
  all(f) { const out = []; const w = e => { if (f(e)) out.push(e); e.children.forEach(w); }; w(this); return out; }
}
const WL = {};
global.document = { createElementNS: (ns, t) => new FE(t), createElement: t => new FE(t), addEventListener() { } };
global.addEventListener = (t, f) => { (WL[t] = WL[t] || []).push(f); };
const EDITOR = require('../js/editor.js');

function xmlCheck(s) {
  s = s.replace(/^<\?xml[^?]*\?>\s*/, '');
  const re = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[A-Za-z_:][\w:.-]*="[^"<]*")*)\s*(\/?)>|([^<]+)/y;
  const st = [];
  let n = 0, m;
  while (re.lastIndex < s.length) {
    const at = re.lastIndex;
    m = re.exec(s);
    if (!m) throw new Error('geçersiz XML @' + at + ': ' + s.slice(at, at + 60));
    if (m[5] != null) { if (/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(m[5])) throw new Error('kaçışsız & @' + at); continue; }
    const seen = new Set();
    for (const a of (m[3] || '').match(/[\w:.-]+(?==")/g) || []) { if (seen.has(a)) throw new Error('çift öznitelik ' + a); seen.add(a); }
    if (m[1]) { if (st.pop() !== m[2]) throw new Error('kapanış uyuşmuyor </' + m[2] + '> @' + at); }
    else if (!m[4]) st.push(m[2]);
    n++;
  }
  if (st.length) throw new Error('kapanmamış: ' + st.join(','));
  return n;
}

test('M8 EDITOR.toSVG: geçerli bağımsız XML, tüm parçalar, tıklama alanları ve çalışma rengi yok', () => {
  for (const name of ['lab3', 'scope_demo', 'hc595_demo', 'labels_demo', 'lcd20x4_demo']) {
    const c = loadC(name), svg = EDITOR.toSVG(c, LIB, SIM, { title: 'EELAB — ' + name + ' & <test>' });
    const n = xmlCheck(svg);
    assert(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/.test(svg), 'başlık');
    for (const p of c.parts) assert(svg.indexOf('data-id="' + p.id + '"') > 0, name + ': parça yok ' + p.id);
    assert.strictEqual((svg.match(/<g class="part"/g) || []).length, c.parts.length);
    assert.strictEqual((svg.match(/<polyline /g) || []).length, c.wires.length);
    assert(!/btn-hit|part-hit|term-hit|mute-hit|cursor:pointer/.test(svg), 'etkileşim öğeleri çıkarılmalı');
    assert(!/#ff4040|#4040ff/i.test(svg), 'çalışma (pin) renkleri olmamalı');
    assert(/fill="#ffffff"/.test(svg), 'beyaz arka plan');
    assert(svg.indexOf('EELAB — ' + name + ' &amp; &lt;test&gt;') > 0, 'başlık metni kaçışlı');
    if (name === 'lab3') console.log('     (lab3.svg: ' + n + ' öğe, ' + svg.length + ' bayt)');
  }
  assert(!/<rect x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*" fill="#ffffff"/.test(EDITOR.toSVG(loadC('lab3'), LIB, SIM, { bg: false })), 'bg:false');
});

function editorWith(c, extra) {
  const svg = new FE('svg'), host = new FE('div');
  host.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 700 });
  host.appendChild(svg);
  const ed = EDITOR.create(Object.assign({ svg, lib: LIB, sim: SIM }, extra || {}));
  ed.load(c);
  const ev = (x, y, o) => Object.assign({ clientX: x, clientY: y, button: 0, pointerId: 1, target: { closest: () => null, tagName: 'svg' }, preventDefault() { } }, o || {});
  return {
    ed, svg,
    down: (x, y, o) => svg.fire('pointerdown', ev(x, y, o)), move: (x, y, o) => svg.fire('pointermove', ev(x, y, o)), up: (x, y, o) => svg.fire('pointerup', ev(x, y, o)),
    drag(a, b, o) { this.down(a[0], a[1], o); this.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, o); this.move(b[0], b[1], o); this.up(b[0], b[1], o); },
    key: (key, o) => { for (const f of WL.keydown || []) f(Object.assign({ key, target: { tagName: 'BODY' }, preventDefault() { }, stopPropagation() { }, stopImmediatePropagation() { } }, o || {})); },
    dbl: (x, y) => svg.fire('dblclick', ev(x, y))
  };
}
const grid = c => { for (const p of c.parts) assert(p.x % 10 === 0 && p.y % 10 === 0, 'ızgara ' + p.id); for (const w of c.wires) for (let i = 0; i < w.points.length; i++) { const [x, y] = w.points[i]; assert(x % 10 === 0 && y % 10 === 0, 'tel ızgara ' + w.id); if (i) assert(x === w.points[i - 1][0] || y === w.points[i - 1][1], 'eğik tel ' + w.id); } };

test('S1 editör: kutu ile çoklu seçim → taşı (bağlı tel izler) → netlist aynı', () => {
  const c = { version: 1, parts: [{ id: 'R1', type: 'RES', x: 100, y: 100, rot: 0, value: '1k' }, { id: 'R2', type: 'RES', x: 200, y: 100, rot: 0, value: '2k' }, { id: 'R3', type: 'RES', x: 400, y: 300, rot: 0, value: '3k' }],
    wires: [{ id: 'w1', points: [[150, 110], [190, 110]] }, { id: 'w2', points: [[260, 110], [300, 110], [300, 310], [390, 310]] }] };
  const T = editorWith(c), nets0 = SIM.pinNets(c, LIB);
  T.drag([80, 80], [270, 140]);
  assert.deepStrictEqual(T.ed.selection(), { parts: ['R1', 'R2'], wires: ['w1'] });
  T.drag([120, 110], [170, 140]);
  const g = T.ed.get();
  assert.deepStrictEqual(g.parts.map(p => [p.id, p.x, p.y]), [['R1', 150, 130], ['R2', 250, 130], ['R3', 400, 300]]);
  assert.deepStrictEqual(g.wires.find(w => w.id === 'w1').points, [[200, 140], [240, 140]], 'seçili tel taşınır');
  assert.deepStrictEqual(SIM.pinNets(g, LIB), nets0, 'netlist korunur'); grid(g);
  T.key('z', { metaKey: true });
  assert.deepStrictEqual(T.ed.get().parts[0].x, 100, 'geri al');
  T.down(110, 110); T.up(110, 110);
  assert.deepStrictEqual(T.ed.selection(), { parts: ['R1'], wires: [] }, 'tek tıkla tek seçim');
  T.down(210, 110, { shiftKey: true }); T.up(210, 110);
  assert.deepStrictEqual(T.ed.selection().parts, ['R1', 'R2'], 'shift ile ekle');
  T.down(700, 600); T.up(700, 600);
  assert.deepStrictEqual(T.ed.selection(), { parts: [], wires: [] }, 'boşa tıklayınca seçim kalkar');
});

test('S1 editör: kopyala/yapıştır yeni benzersiz id, iç teller kopyalanır; ⌘X/⌘D/Delete; grup döndürme', () => {
  const c = { version: 1, parts: [{ id: 'R1', type: 'RES', x: 100, y: 100, rot: 0, value: '1k' }, { id: 'D1', type: 'LED-RED', x: 200, y: 100, rot: 0, value: '' }, { id: 'LBL1', type: 'TERMINAL', x: 300, y: 300, rot: 0, value: 'X' }],
    wires: [{ id: 'w1', points: [[150, 110], [190, 110]] }] };
  const T = editorWith(c);
  T.ed.select(['R1', 'D1']);
  T.key('c', { metaKey: true });
  T.move(500, 400);
  T.key('v', { metaKey: true });
  let g = T.ed.get();
  assert.deepStrictEqual(g.parts.map(p => p.id), ['R1', 'D1', 'LBL1', 'R2', 'D2']);
  assert.deepStrictEqual(T.ed.selection(), { parts: ['R2', 'D2'], wires: ['w2'] });
  const r2 = g.parts.find(p => p.id === 'R2'), pb = EDITOR.contentBox({ parts: g.parts.filter(p => p.id === 'R2' || p.id === 'D2'), wires: [] }, LIB);
  assert(Math.abs(pb.x - 500) < 10 && Math.abs(pb.y - 400) < 10 && r2.value === '1k', 'imleç konumuna yapıştırılır ' + JSON.stringify(pb));
  assert(SIM.pinNets(g, LIB).some(n => n.join() === 'D2.A,R2.2'), 'iç tel kopyalandı');
  const before = SIM.pinNets(T.ed.get(), LIB);
  T.key('r');
  g = T.ed.get(); grid(g);
  assert.deepStrictEqual(g.parts.filter(p => p.id === 'R2' || p.id === 'D2').map(p => p.rot), [90, 90]);
  assert.deepStrictEqual(SIM.pinNets(g, LIB), before, 'grup döndürmede bağlantı korunur');
  const r2b = g.parts.find(p => p.id === 'R2'), d2b = g.parts.find(p => p.id === 'D2');
  T.key('d', { metaKey: true });
  g = T.ed.get();
  assert.deepStrictEqual(g.parts.slice(-2).map(p => [p.id, p.x, p.y, p.rot]), [['R3', r2b.x + 20, r2b.y + 20, 90], ['D3', d2b.x + 20, d2b.y + 20, 90]], 'çoğalt: +20,+20');
  assert.deepStrictEqual(T.ed.selection().parts, ['R3', 'D3']);
  T.ed.select(['LBL1']); T.key('c', { metaKey: true }); T.ed.paste([600, 100]);
  g = T.ed.get();
  assert.strictEqual(g.parts.find(p => p.id === 'LBL2').value, 'X', 'etiket kopyası aynı ağ adını taşır');
  T.ed.select(['R2', 'D2', 'w2']);
  const n0 = g.parts.length;
  T.key('Backspace');
  assert.strictEqual(T.ed.get().parts.length, n0 - 2); assert(!T.ed.get().wires.some(w => w.id === 'w2'));
  T.ed.select(['R3']); T.key('x', { metaKey: true });
  assert(!T.ed.get().parts.some(p => p.id === 'R3'), 'kes');
  T.ed.select(['R1']); T.key('ArrowRight', { shiftKey: true });
  assert.strictEqual(T.ed.get().parts[0].x, 150, 'ok tuşu ile kaydır');
  assert.deepStrictEqual(T.ed.get().wires.find(w => w.id === 'w1').points[0], [200, 110], 'kayınca tel izler');
  T.key('a', { metaKey: true });
  assert.strictEqual(T.ed.selection().parts.length, T.ed.get().parts.length, 'tümünü seç');
});

test('S1 editör: çalışırken tele/pine çift tık → osiloskop probu; exportSVG örneği', () => {
  const c = loadC('lcd_demo');
  let probed = [];
  const fake = { probe: t => { probed.push(t); return { id: 'PRB1', label: 'Probe 1' }; } };
  const T = editorWith(c, { runner: () => fake, toast: () => { } });
  T.ed.setRun(true);
  const w = c.wires[0], a = w.points[0], b = w.points[1], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  T.dbl(mid[0], mid[1]);
  const pin = LIB.pinPos(c.parts.find(p => p.id === 'LCD1'), '4');
  T.dbl(pin[0], pin[1]);
  assert.deepStrictEqual(probed, [{ wire: w.id }, { pin: 'LCD1.4' }]);
  T.ed.setRun(false);
  const s = T.ed.exportSVG({ title: 'lcd' });
  xmlCheck(s);
  assert(s.indexOf('data-id="LCD1"') > 0 && /viewBox="-?\d+ -?\d+ \d+ \d+"/.test(s));
  assert(T.ed.bounds().w > 100);
});

test('M5 SCOPE.create paneli (sahte DOM + canvas): oto ölçek, tetik, imleçler, tut/çalış, CSV', () => {
  const texts = [];
  const ctx = new Proxy({}, { get: (t, k) => k === 'measureText' ? (x => ({ width: String(x).length * 6 })) : k === 'fillText' ? (x => texts.push(String(x))) : k in t ? t[k] : () => { }, set: (t, k, v) => { t[k] = v; return true; } });
  const memo = {};
  class HE extends FE {
    constructor(t) { super(t); this.classList = { toggle: (c, v) => { this.cls = v; } }; this.clientWidth = 800; this.value = ''; }
    set innerHTML(v) { for (const c of this.children) c.parentNode = null; this.children = []; this._html = v; }
    get innerHTML() { return this._html || ''; }
    querySelector(sel) { const k = this.tag + this.uid + sel; if (!memo[k]) { memo[k] = new HE(sel === 'canvas' ? 'canvas' : 'x'); if (sel === 'canvas') memo[k].getContext = () => ctx; } return memo[k]; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 300 }; }
  }
  let uid = 0;
  const oldCE = document.createElement;
  document.createElement = t => { const e = new HE(t); e.uid = ++uid; return e; };
  document.getElementById = () => null; document.head = new HE('head');
  const mount = new HE('svg'); mount.uid = 0;
  const c = mk([Q('U1', 'PIC16F628A'), Q('LA1', 'LOGIC-ANALYSER'), Q('OSC1', 'OSCILLOSCOPE')], [['U1.6', 'LA1.A0', 'OSC1.B']]);
  let run = null, now = 0;
  const saved = [];
  const sc = SCOPE.create({ mount, getRunner: () => run, getCyc: () => now, getFosc: () => 4e6, save: (n, e, t) => saved.push([n, e, t]) });
  sc.frame();
  assert.strictEqual(mount.hidden, true, 'runner yokken gizli');
  run = new SIM.Runner(SIM.compile(c, LIB));
  for (let k = 0; k < 400; k++) { run.port(0xFF, 0, 0x00, 1, k * 1000 + 3); run.port(0xFF, 0, 0x00, 0, k * 1000 + 253); }
  now = 400000;
  sc.frame();
  assert.strictEqual(mount.hidden, false);
  const box = mount.children[0], bar = box.querySelector('.sc-bar'), cv = box.querySelector('canvas');
  assert(/Digital Oscilloscope/.test(box.innerHTML) && /data-a="csv"/.test(box.innerHTML));
  const click = a => bar.fire('click', { target: { getAttribute: () => a } });
  sc.autoset(); sc.frame();
  let st = sc.state();
  assert.strictEqual(st.tdiv, 5e-4, 'oto ölçek: 1 kHz → 0,5 ms/böl');
  assert.strictEqual(st.trigger.id, 'OSC1:B');
  const W = 10 * 5e-4 * 1e6;
  assert.strictEqual(st.window[0] % 1000, (3 - 0.2 * W + 1e6) % 1000, 'pencere tetik kenarına kilitli');
  assert(texts.some(t => /1 kHz +25%/.test(t)), 'kanal ölçümü: ' + texts.filter(t => /Hz/.test(t)).join(' | '));
  click('cur');
  const X = t => 150 + (t - st.window[0]) / W * (800 - 150 - 8);
  const e1 = X(st.window[0] + 1003 - (st.window[0] % 1000) + 0), ev = x => ({ clientX: x, clientY: 30, button: 0, pointerId: 1, preventDefault() { } });
  cv.fire('pointerdown', ev(e1 + 2)); cv.fire('pointerup', ev(e1 + 2));
  const e2 = X(st.window[0] + 1253 - (st.window[0] % 1000));
  cv.fire('pointerdown', ev(e2 - 2)); cv.fire('pointerup', ev(e2 - 2));
  sc.frame();
  st = sc.state();
  assert.strictEqual(st.cursors.b - st.cursors.a, 250, 'imleçler kenarlara yapışır');
  assert(/Δt=250 µs \(250 cycles\) · 1\/Δt=4 kHz/.test(box.querySelector('.sc-info')._html), box.querySelector('.sc-info')._html);
  click('run'); sc.frame();
  assert.strictEqual(sc.state().running, false, 'Tut');
  const w0 = sc.state().window;
  now += 50000; sc.frame();
  assert.deepStrictEqual(sc.state().window, w0, 'tutulurken pencere sabit');
  cv.fire('wheel', { clientX: 475, deltaY: 1, preventDefault() { } }); sc.frame();
  assert.strictEqual(sc.state().tdiv, 1e-3, 'tekerlek ile zaman/böl');
  click('csv');
  assert.strictEqual(saved.length, 1); assert.deepStrictEqual(saved[0].slice(0, 2), ['olcum', 'csv']);
  assert(/^time_s,cycle,"LA1 A0 \(RB0\)","OSC1 B \(RB0\)"\n/.test(saved[0][2]) && saved[0][2].split('\n').length > 10, saved[0][2].slice(0, 80));
  click('run'); sc.frame();
  assert.strictEqual(sc.state().running, true);
  const ch = run.probe('U1.7');
  sc.frame();
  assert(/Probe 1 \(RB1\)/.test(box.innerHTML) || /Probe 1 \(RB1\)/.test(mount.children[0].innerHTML), 'prob kanalı panelde');
  sc.reset(); assert.strictEqual(mount.hidden, true); assert(ch);
  document.createElement = oldCE;
});

console.log('\n' + passed + ' geçti, ' + failed + ' başarısız' + (skipped ? ', ' + skipped + ' atlandı' : ''));
process.exit(failed ? 1 : 0);
