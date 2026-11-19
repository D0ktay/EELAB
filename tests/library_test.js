const fs = require('fs'), path = require('path'), assert = require('assert');
const LIB = require('../js/library.js');
const CDIR = path.join(__dirname, '../circuits');
const circuit = JSON.parse(fs.readFileSync(path.join(CDIR, 'lab3.json'), 'utf8'));
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const SEG8 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'];
const DEC = ['7', '1', '2', '6', '3', '4', '5', '13', '12', '11', '10', '9', '15', '14'];
const LED = ['A', 'K'], TWO = ['1', '2'];
const SPEC = {
  'PIC16F628A': ['17', '18', '1', '2', '3', '4', '15', '16', '6', '7', '8', '9', '10', '11', '12', '13'],
  '7448': DEC, '7447': DEC,
  '7SEG-MPX1-CC': SEG8.concat('K'), '7SEG-MPX1-CA': SEG8.concat('COM'),
  '7SEG-MPX4-CC': SEG8.concat(['1', '2', '3', '4']), '7SEG-MPX4-CA': SEG8.concat(['1', '2', '3', '4']),
  '7SEG-BCD': ['1', '2', '4', '8'],
  'LED-RED': LED, 'LED-GREEN': LED, 'LED-YELLOW': LED, 'LED-BLUE': LED,
  'LED-BARGRAPH-RED': range(10, i => 'A' + (i + 1)).concat(range(10, i => 'K' + (i + 1))),
  'LM016L': range(14, i => String(i + 1)),
  'BUTTON': TWO, 'SWITCH': TWO, 'DIPSW_8': range(16, i => String(i + 1)),
  'KEYPAD-PHONETYPE': ['A', 'B', 'C', 'D', '1', '2', '3'], 'KEYPAD-SMALLCALC': ['A', 'B', 'C', 'D', '1', '2', '3', '4'],
  'LOGICSTATE': ['1'], 'LOGICPROBE': ['1'],
  'RES': TWO, 'CAP': TWO, 'CAP-ELEC': TWO, 'CRYSTAL': TWO, 'POWER': ['1'], 'GROUND': ['1'],
  'BUZZER': TWO, 'MOTOR': TWO, 'NPN': ['B', 'C', 'E'],
  'VIRTUAL-TERMINAL': ['RXD', 'TXD', 'RTS', 'CTS'],
  '7SEG-MPX2-CC': SEG8.concat(['1', '2']), '7SEG-MPX2-CA': SEG8.concat(['1', '2']),
  'LM044L': range(14, i => String(i + 1)), 'TRAFFIC-LIGHTS': ['R', 'A', 'G'],
  '74HC595': ['14', '11', '12', '10', '13', '15', '1', '2', '3', '4', '5', '6', '7', '9'],
  'L293D': ['1', '2', '7', '9', '10', '15', '3', '6', '11', '14'], 'RELAY': ['1', '2', 'COM', 'NC', 'NO'],
  'TERMINAL': ['1'], 'OSCILLOSCOPE': ['A', 'B', 'C', 'D'], 'LOGIC-ANALYSER': range(8, i => 'A' + i),
  'POT-HG': ['1', '2', '3'], 'DC-VOLTMETER': ['+', '-']
};
let checks = 0;
for (const t in SPEC) {
  const ty = LIB.types[t];
  assert(ty, 'tip yok: ' + t);
  assert.strictEqual(ty.type, t);
  assert(ty.prefix && ty.label && typeof ty.defaultValue === 'string', 'meta eksik: ' + t);
  assert.deepStrictEqual(ty.pins.map(p => p.num).sort(), SPEC[t].slice().sort(), 'pinler: ' + t);
  for (const p of ty.pins) assert(typeof p.num === 'string' && p.x % 10 === 0 && p.y % 10 === 0, 'pin izgara disi (rot 0) ' + t + '.' + p.num);
  assert((ty.w + ty.h) % 20 === 0 && ty.w % 10 === 0 && ty.h % 10 === 0, 'w+h 20 katı olmalı: ' + t);
  for (const rot of [0, 90, 180, 270]) {
    const part = { id: 'X', type: t, x: 100, y: 200, rot };
    const b = LIB.bbox(part);
    for (const v of [b.x, b.y, b.w, b.h]) assert(v % 10 === 0, 'bbox izgara disi ' + t + ' ' + rot);
    const seen = new Set();
    for (const n of SPEC[t]) {
      const p = LIB.pinPos(part, n);
      assert(p[0] % 10 === 0 && p[1] % 10 === 0, 'pin izgara disi ' + t + '.' + n + ' rot ' + rot);
      seen.add(p.join(','));
      checks++;
    }
    assert.strictEqual(seen.size, SPEC[t].length, 'ust uste pin ' + t + ' rot ' + rot);
  }
  const p0 = { id: 'X', type: t, x: 0, y: 0, rot: 0 }, p90 = Object.assign({}, p0, { rot: 90 }), p180 = Object.assign({}, p0, { rot: 180 });
  for (const n of SPEC[t]) {
    const a = LIB.pinPos(p0, n), b = LIB.pinPos(p90, n), c = LIB.pinPos(p180, n), cx = ty.w / 2, cy = ty.h / 2;
    assert.deepStrictEqual(b, [cx - (a[1] - cy), cy + (a[0] - cx)], 'saat yönünde 90° ' + t + '.' + n);
    assert.deepStrictEqual(c, [ty.w - a[0], ty.h - a[1]], '180° ' + t + '.' + n);
  }
}
assert.deepStrictEqual(Object.keys(LIB.types).sort(), Object.keys(SPEC).sort(), 'fazla/eksik tip');
assert.deepStrictEqual(LIB.categories.map(c => c.name), ['Microprocessor ICs', 'Optoelectronics', 'TTL 74 series', 'TTL 74HC series', 'Switches & Relays', 'Debugging Tools', 'Resistors', 'Capacitors', 'Miscellaneous',
  'Speakers & Sounders', 'Electromechanical', 'Transistors', 'Analog ICs', 'Terminals', 'Virtual Instruments']);
for (const t of LIB.order) assert(LIB.types[t].desc && LIB.types[t].cat && /^(component|terminal|instrument)$/.test(LIB.types[t].mode), 'açıklama/kategori/mod: ' + t);
assert.deepStrictEqual(LIB.order, [].concat(...LIB.categories.map(c => c.types)));
assert.deepStrictEqual(LIB.order.slice().sort(), Object.keys(SPEC).sort(), 'her tip tam bir kategoride');
assert.deepStrictEqual(LIB.pinPos({ type: 'LED-RED', x: 0, y: 0, rot: 90 }, 'A'), [20, -20], 'LED rot 90: A üstte');
assert.deepStrictEqual(LIB.pinPos({ type: 'DIPSW_8', x: 0, y: 0 }, '9')[1], LIB.pinPos({ type: 'DIPSW_8', x: 0, y: 0 }, '1')[1], 'DIPSW: 1 ↔ 9 aynı hizada');
assert.strictEqual(LIB.types['KEYPAD-SMALLCALC'].keys.map(r => r.join('')).join('/'), '789//456x/123-/C0=+');
assert.strictEqual(LIB.types['KEYPAD-PHONETYPE'].keys.map(r => r.join('')).join('/'), '123/456/789/*0#');
console.log('OK: ' + Object.keys(SPEC).length + ' tip, ' + checks + ' pin/döndürme kontrolü');

class FE {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.parentNode = null; this.textContent = ''; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  remove() { if (this.parentNode) { const a = this.parentNode.children; a.splice(a.indexOf(this), 1); this.parentNode = null; } }
  get isConnected() { let p = this; while (p.parentNode) p = p.parentNode; return p.tag === 'svg'; }
  all(f) { const out = []; const w = e => { if (f(e)) out.push(e); e.children.forEach(w); }; w(this); return out; }
}
global.document = { createElementNS: (ns, tag) => new FE(tag) };
const svg = new FE('svg');
const STATES = [
  { on: false, pins: {}, lit: {}, pressed: false },
  { on: true, pins: { '1': 1, '2': 0, A: 1, K: 0 }, lit: { ON: true, A: true, '1A': true, '3': true }, pressed: true, sw: true, sws: { 2: true }, keys: { '5': true, '+': true }, level: 1,
    lcd: { lines: ['HELLO', 'W\u0000RLD'], cursor: { row: 1, col: 3 }, disp: true, cg: range(64, i => i % 3 ? 0x1F : 0) }, text: 'merhaba\n' + 'x'.repeat(80) + '\nson', spin: -0.5, sound: true, freq: 1000 },
  { on: true, pins: {}, lit: {}, level: 2, lcd: { lines: ['', ''], cursor: null, disp: false }, text: '', spin: 0, sound: false }
];
for (const t of LIB.order) for (const rot of [0, 90]) {
  const part = { id: 'Z1', type: t, x: 50, y: 60, rot, value: LIB.types[t].defaultValue };
  const g = LIB.render(part, svg);
  assert.strictEqual(g.attrs['data-id'], 'Z1');
  assert(/translate\(50,60\) rotate\(/.test(g.attrs.transform), 'transform ' + t);
  for (const s of STATES) LIB.update(g, part, s);
  const hits = g.all(e => e.attrs.class === 'btn-hit');
  const keys = hits.map(h => h.getAttribute('data-key'));
  const want = { BUTTON: [null], SWITCH: [null], LOGICSTATE: [null], DIPSW_8: range(8, i => String(i + 1)),
    'KEYPAD-PHONETYPE': [].concat(...LIB.types['KEYPAD-PHONETYPE'].keys), 'KEYPAD-SMALLCALC': [].concat(...LIB.types['KEYPAD-SMALLCALC'].keys), 'POT-HG': ['-', '+'] }[t] || [];
  assert.deepStrictEqual(keys, want, 'btn-hit/data-key ' + t);
  if (t === 'VIRTUAL-TERMINAL') assert.strictEqual(g.all(e => e.attrs.class === 'term-hit').length, 1);
  if (t === 'BUZZER') assert.strictEqual(g.all(e => e.attrs.class === 'mute-hit').length, 1);
  if (t === 'POT-HG') assert.strictEqual(g.all(e => e.attrs.class === 'pot-hit').length, 1);
}
{
  const part = { id: 'LCD1', type: 'LM016L', x: 0, y: 0, rot: 0 }, g = LIB.render(part, svg);
  LIB.update(g, part, STATES[1]);
  const texts = g.all(e => e.tag === 'text' && e.attrs['font-size'] === '17').map(e => e.textContent);
  assert.strictEqual(texts.slice(0, 5).join(''), 'HELLO', 'LCD 1. satır');
  assert.strictEqual(texts[16] + texts[18] + texts[19], 'WRL', 'LCD 2. satır');
  assert.strictEqual(texts[17], '', 'CGRAM karakteri metin değil piksel');
  LIB.update(g, part, STATES[0]);
  assert.strictEqual(g.all(e => e.tag === 'text' && e.attrs['font-size'] === '17').map(e => e.textContent).join('').trim(), '', 'durunca LCD boş');
  const vt = { id: 'VT1', type: 'VIRTUAL-TERMINAL', x: 0, y: 0 }, gv = LIB.render(vt, svg);
  LIB.update(gv, vt, STATES[1]);
  const rows = gv.all(e => e.tag === 'text' && e.attrs['xml:space'] === 'preserve').map(e => e.textContent).filter(Boolean);
  assert.deepStrictEqual(rows, ['merhaba', 'x'.repeat(36), 'x'.repeat(36), 'x'.repeat(8), 'son'], 'terminal satır kaydırma');
  const led = { id: 'D1', type: 'LED-GREEN', x: 0, y: 0 }, gl = LIB.render(led, svg);
  LIB.update(gl, led, { on: true, pins: {}, lit: { ON: true } });
  assert.strictEqual(gl.all(e => e.tag === 'path' && e.attrs.d === 'M13,3 L13,17 L27,10 Z')[0].attrs.fill, '#2ee82e');
  assert.strictEqual(LIB.muted(), true, 'ses varsayılan kapalı');
  const l4 = { id: 'LCD2', type: 'LM044L', x: 0, y: 0 }, g4 = LIB.render(l4, svg);
  LIB.update(g4, l4, { on: true, pins: {}, lit: {}, lcd: { lines: ['SATIR 1', 'SATIR 2', 'SATIR 3', '12345678901234567890'], cursor: { row: 2, col: 5 } } });
  const ch4 = g4.all(e => e.attrs.class === 'lcd-ch').map(e => e.textContent);
  assert.strictEqual(ch4.length, 80, '20x4 hücre');
  assert.deepStrictEqual([0, 1, 2, 3].map(r => ch4.slice(r * 20, r * 20 + 20).join('').trim()), ['SATIR 1', 'SATIR 2', 'SATIR 3', '12345678901234567890'], 'LM044L 4 satır');
  const tl = { id: 'TL1', type: 'TRAFFIC-LIGHTS', x: 0, y: 0 }, gt = LIB.render(tl, svg);
  LIB.update(gt, tl, { on: true, pins: {}, lit: { R: true } });
  assert.deepStrictEqual(gt.all(e => e.tag === 'circle').map(e => e.attrs.fill), ['#ff2a1a', '#4a3410', '#12401a'], 'trafik lambası: yalnız kırmızı');
  const lb = { id: 'LBL1', type: 'TERMINAL', x: 0, y: 0, rot: 180, value: 'SDA' }, gb = LIB.render(lb, svg);
  const lt = gb.all(e => e.tag === 'text' && e.textContent === 'SDA');
  assert.strictEqual(lt.length, 1, 'etiket metni'); assert.strictEqual(lt[0].attrs.transform, 'rotate(180,34,10)', '180°de metin düz okunur');
}
console.log('OK: tüm tipler render/update (sahte DOM)');

function netsOf(c) {
  const parent = {}, find = k => (parent[k] === undefined || parent[k] === k) ? (parent[k] = k) : (parent[k] = find(parent[k]));
  const union = (a, b) => { parent[find(a)] = find(b); };
  const key = p => p[0] + ',' + p[1];
  const pinAt = {};
  for (const part of c.parts) {
    assert(LIB.types[part.type], 'bilinmeyen tip ' + part.type);
    for (const pin of LIB.types[part.type].pins) {
      const k = key(LIB.pinPos(part, pin.num));
      assert(!pinAt[k], 'iki pin ayni noktada: ' + k + ' ' + pinAt[k] + ' / ' + part.id + '.' + pin.num);
      pinAt[k] = part.id + '.' + pin.num; find(k);
    }
  }
  const segs = [];
  for (const w of c.wires) for (let i = 0; i < w.points.length; i++) {
    const p = w.points[i];
    assert(p[0] % 10 === 0 && p[1] % 10 === 0, 'tel izgara disi ' + w.id);
    if (i) {
      const q = w.points[i - 1];
      assert(p[0] === q[0] || p[1] === q[1], 'egik tel ' + w.id);
      union(key(p), key(q)); segs.push([q, p]);
    }
  }
  const onSeg = (p, s) => (s[0][0] === s[1][0] && p[0] === s[0][0] && p[1] >= Math.min(s[0][1], s[1][1]) && p[1] <= Math.max(s[0][1], s[1][1])) ||
    (s[0][1] === s[1][1] && p[1] === s[0][1] && p[0] >= Math.min(s[0][0], s[1][0]) && p[0] <= Math.max(s[0][0], s[1][0]));
  for (const w of c.wires) for (const p of [w.points[0], w.points[w.points.length - 1]]) {
    let touches = !!pinAt[key(p)];
    for (const s of segs) if (onSeg(p, s) && !(w.points.some(q => q === s[0]) && w.points.some(q => q === s[1]))) { union(key(p), key(s[0])); touches = true; }
    assert(touches, 'bosta tel ucu ' + w.id + ' @' + key(p));
  }
  const netOf = ref => { const k = Object.keys(pinAt).find(k => pinAt[k] === ref); assert(k, 'pin yok ' + ref); return find(k); };
  return {
    pinAt, find, netOf,
    same: (a, b) => assert.strictEqual(netOf(a), netOf(b), a + ' ile ' + b + ' bagli olmali'),
    diff: (a, b) => assert.notStrictEqual(netOf(a), netOf(b), a + ' ile ' + b + ' bagli olmamali'),
    gnd: a => assert(c.parts.some(p => p.type === 'GROUND' && netOf(p.id + '.1') === netOf(a)), a + ' toprakta olmali')
  };
}

{
  const { pinAt, find, netOf, same, diff } = netsOf(circuit);
  const resOn = ref => { const n = netOf(ref); const r = circuit.parts.filter(p => p.type === 'RES').find(p => netOf(p.id + '.1') === n || netOf(p.id + '.2') === n); assert(r, 'direnc yok ' + ref); return netOf(r.id + '.1') === n ? r.id + '.2' : r.id + '.1'; };
  [['17', '7'], ['18', '1'], ['1', '2'], ['2', '6']].forEach(c => same('U1.' + c[0], 'U2.' + c[1]));
  [['6', '7'], ['7', '1'], ['8', '2'], ['9', '6']].forEach(c => same('U1.' + c[0], 'U3.' + c[1]));
  [['10', '7'], ['11', '1'], ['12', '2'], ['13', '6']].forEach(c => same('U1.' + c[0], 'U4.' + c[1]));
  const OUT = { A: '13', B: '12', C: '11', D: '10', E: '9', F: '15', G: '14' };
  [['U2', 'DS3'], ['U3', 'DS2'], ['U4', 'DS1']].forEach(([u, d]) => { for (const s in OUT) same(resOn(u + '.' + OUT[s]), d + '.' + s); });
  ['DS1', 'DS2', 'DS3'].forEach(d => { const g = circuit.parts.filter(p => p.type === 'GROUND').some(p => netOf(p.id + '.1') === netOf(d + '.K')); assert(g, d + '.K topraga bagli olmali'); });
  same('PWR1.1', 'SW1.1'); same('SW1.2', 'R10.1'); same('SW1.2', 'U1.4'); same('R10.2', 'GND1.1');
  same('PWR2.1', 'SW2.1'); same('SW2.2', 'R11.1'); same('SW2.2', 'U1.15'); same('R11.2', 'GND2.1');
  diff('U1.4', 'U1.15'); diff('U1.17', 'U1.18'); diff('SW1.1', 'SW1.2'); diff('U2.13', 'U3.13'); diff('DS1.A', 'DS2.A'); diff('U1.6', 'U1.10');
  const nets = new Set(Object.keys(pinAt).map(find));
  console.log('OK lab3: ' + circuit.parts.length + ' parca, ' + circuit.wires.length + ' tel, ' + nets.size + ' net (bagsiz pinler dahil)');
}

const load = n => JSON.parse(fs.readFileSync(path.join(CDIR, n + '.json'), 'utf8'));
const RB = i => 'U1.' + (6 + i), RA = ['U1.17', 'U1.18', 'U1.1', 'U1.2'];
const EX = {
  lab1_led_switch(c, n) {
    for (let i = 0; i < 8; i++) {
      n.same(RB(i), 'R' + (i + 1) + '.1'); n.same('R' + (i + 1) + '.2', 'D' + (i + 1) + '.A'); n.gnd('D' + (i + 1) + '.K');
      assert.strictEqual(c.parts.find(p => p.id === 'R' + (i + 1)).value, '220');
    }
    n.same('SW1.2', RA[0]); n.same('SW1.2', 'R9.1'); n.gnd('R9.2'); n.same('PWR1.1', 'SW1.1');
    n.same('SW2.2', RA[1]); n.same('SW2.2', 'R10.1'); n.gnd('R10.2'); n.same('PWR2.1', 'SW2.1');
    n.diff(RA[0], RA[1]); n.diff(RB(0), RB(1));
  },
  lcd_demo(c, n) {
    n.same(RB(4), 'LCD1.4'); n.same(RB(5), 'LCD1.6');
    for (let i = 0; i < 4; i++) n.same(RB(i), 'LCD1.' + (11 + i));
    n.gnd('LCD1.5'); n.gnd('LCD1.1'); n.same('LCD1.2', 'PWR1.1');
    for (let i = 7; i <= 10; i++) n.diff('LCD1.' + i, 'LCD1.1');
  },
  keypad_demo(c, n) {
    for (let i = 0; i < 4; i++) { n.same(RB(i), 'KP1.' + (i + 1)); n.same(RB(i), 'R' + (i + 1) + '.1'); n.gnd('R' + (i + 1) + '.2'); n.same(RB(4 + i), 'KP1.' + 'ABCD'[i]); }
    for (let i = 0; i < 4; i++) n.same(RA[i], 'LCD1.' + (11 + i));
    n.same('U1.15', 'LCD1.4'); n.same('U1.16', 'LCD1.6'); n.gnd('LCD1.5');
  },
  uart_demo(c, n) { n.same(RB(2), 'VT1.RXD'); n.same(RB(1), 'VT1.TXD'); n.diff('VT1.RXD', 'VT1.TXD'); },
  mux4_demo(c, n) {
    SEG8.forEach((s, i) => n.same(RB(i), 'DS1.' + s));
    for (let i = 0; i < 4; i++) n.same(RA[i], 'DS1.' + (i + 1));
  },
  mux2_demo(c, n) { SEG8.forEach((s, i) => n.same(RB(i), 'DS1.' + s)); n.same(RA[0], 'DS1.1'); n.same(RA[1], 'DS1.2'); n.diff('DS1.1', 'DS1.2'); },
  hc595_demo(c, n) {
    n.same(RB(0), 'U2.14'); n.same(RB(1), 'U2.11'); n.same(RB(2), 'U2.12'); n.same('PWR1.1', 'U2.10'); n.gnd('U2.13');
    ['15', '1', '2', '3', '4', '5', '6', '7'].forEach((q, i) => { n.same('U2.' + q, 'R' + (i + 1) + '.1'); n.same('R' + (i + 1) + '.2', 'D' + (i + 1) + '.A'); n.gnd('D' + (i + 1) + '.K'); });
  },
  lcd20x4_demo(c, n) { n.same(RB(4), 'LCD1.4'); n.same(RB(5), 'LCD1.6'); for (let i = 0; i < 4; i++) n.same(RB(i), 'LCD1.' + (11 + i)); n.gnd('LCD1.5'); n.gnd('LCD1.1'); n.same('LCD1.2', 'PWR1.1'); },
  scope_demo(c, n) { n.same(RB(3), 'OSC1.A'); n.same(RB(3), 'R1.1'); n.same(RB(2), 'OSC1.B'); n.same(RB(2), 'LA1.A0'); n.same(RB(2), 'VT1.RXD'); n.same(RB(1), 'LA1.A1'); n.same(RB(1), 'R2.1'); n.same('R2.2', 'VT1.TXD'); n.diff(RB(1), 'VT1.TXD'); n.same(RB(0), 'LA1.A2'); n.diff('OSC1.A', 'OSC1.B'); },
  comparator_demo(c, n) { n.same(RA[0], 'RV1.3'); n.same(RA[0], 'VM1.+'); n.gnd('RV1.1'); n.gnd('VM1.-'); n.same('RV1.2', 'PWR1.1'); n.same(RB(0), 'R1.1'); n.same('R1.2', 'D1.A'); n.gnd('D1.K'); n.diff(RA[0], RA[2]); },
  traffic_demo(c, n) { ['R', 'A', 'G'].forEach((k, i) => { n.same(RB(i), 'TL1.' + k); n.same(RB(3 + i), 'TL2.' + k); }); },
  l293d_demo(c, n) { n.same(RB(0), 'U2.2'); n.same(RB(1), 'U2.7'); n.same(RB(3), 'U2.1'); n.same('U2.3', 'M1.1'); n.same('U2.6', 'M1.2'); },
  relay_demo(c, n) { n.same(RB(0), 'R1.1'); n.same('R1.2', 'Q1.B'); n.gnd('Q1.E'); n.same('Q1.C', 'RL1.2'); n.same('PWR1.1', 'RL1.1'); n.same('PWR1.1', 'RL1.COM'); n.same('RL1.NO', 'R2.1'); n.same('RL1.NC', 'R3.1'); n.diff('RL1.NO', 'RL1.NC'); },
  labels_demo(c, n) { for (let k = 0; k < 4; k++) { n.same(RB(2 * k), 'LBL' + (k + 1) + '.1'); n.same('LBL' + (k + 5) + '.1', 'R' + (k + 1) + '.1'); assert.strictEqual(c.parts.find(p => p.id === 'LBL' + (k + 1)).value, c.parts.find(p => p.id === 'LBL' + (k + 5)).value); } n.same(RA[0], 'LBL9.1'); }
};
for (const name in EX) {
  const c = load(name), n = netsOf(c);
  assert.strictEqual(c.version, 1);
  EX[name](c, n);
  console.log('OK ' + name + ': ' + c.parts.length + ' parca, ' + c.wires.length + ' tel');
}
