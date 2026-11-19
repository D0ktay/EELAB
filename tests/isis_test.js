const assert = require('assert');
const LIB = require('../js/library.js'), SIM = require('../js/sim.js');

let failed = 0, passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e.stack || e).toString().split('\n').slice(0, 5).join('\n     ')); }
}

class FE {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.parentNode = null; this.textContent = ''; this.style = {}; this.ls = {}; this.dataset = {}; this.value = ''; this.memo = {}; this.className = ''; }
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
  focus() { } select() { }
  querySelector(sel) { return this.memo[sel] || (this.memo[sel] = new FE('input')); }
  querySelectorAll(sel) { return this.memo['*' + sel] || (this.memo['*' + sel] = [new FE('span'), new FE('span'), new FE('span')]); }
  getScreenCTM() { return { a: 1, inverse() { return this; } }; }
  createSVGPoint() { return { x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } }; }
  all(f) { const out = []; const w = e => { if (f(e)) out.push(e); e.children.forEach(w); }; w(this); return out; }
}
const WL = {}, made = [];
global.document = { createElementNS: (ns, t) => new FE(t), createElement: t => { const e = new FE(t); made.push(e); return e; }, createTextNode: t => { const e = new FE('#text'); e.textContent = t; return e; }, addEventListener() { } };
global.addEventListener = (t, f) => { (WL[t] = WL[t] || []).push(f); };
const EDITOR = require('../js/editor.js'), ISIS = require('../js/isis.js');

function editorWith(c, extra) {
  const svg = new FE('svg'), host = new FE('div');
  host.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 700 });
  host.appendChild(svg);
  const ed = EDITOR.create(Object.assign({ svg, lib: LIB, sim: SIM }, extra || {}));
  ed.load(c);
  const ev = (x, y, o) => Object.assign({ clientX: x, clientY: y, button: 0, pointerId: 1, target: { closest: () => null, tagName: 'svg' }, preventDefault() { } }, o || {});
  return {
    ed, svg, host,
    down: (x, y, o) => svg.fire('pointerdown', ev(x, y, o)), move: (x, y, o) => svg.fire('pointermove', ev(x, y, o)), up: (x, y, o) => svg.fire('pointerup', ev(x, y, o)),
    ctx: (x, y, o) => svg.fire('contextmenu', ev(x, y, o)),
    click(x, y, o) { this.down(x, y, o); this.up(x, y, o); },
    drag(a, b, o) { this.down(a[0], a[1], o); this.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, o); this.move(b[0], b[1], o); this.up(b[0], b[1], o); },
    key: (key, o) => { for (const f of WL.keydown || []) f(Object.assign({ key, target: { tagName: 'BODY' }, preventDefault() { }, stopPropagation() { }, stopImmediatePropagation() { } }, o || {})); }
  };
}
const R = (id, x, y, extra) => Object.assign({ id, type: 'RES', x, y, rot: 0, value: '1k' }, extra || {});
const base = () => ({ version: 1, parts: [R('R1', 100, 100), R('R2', 200, 300)], wires: [] });

test('LIB.parseEng: SI önekleri (m ≠ M büyük/küçük harfe duyarlı), birimler', () => {
  for (const [s, v] of [['18m', 0.018], ['10m', 0.01], ['1MHz', 1e6], ['250kHz', 250000], ['100m', 0.1], ['100M', 1e8], ['32.768kHz', 32768], ['4MHz', 4e6], ['1u', 1e-6], ['2.2n', 2.2e-9], ['1e3', 1000], ['10ms', 0.01], ['20 MHz', 2e7], [4000000, 4e6]]) assert.strictEqual(LIB.parseEng(s), v, String(s));
  for (const bad of ['', 'abc', '1x', 'MHz', '--1']) assert(isNaN(LIB.parseEng(bad)), bad);
  assert.strictEqual(LIB.fmtEng(4e6, 'Hz'), '4MHz'); assert.strictEqual(LIB.fmtEng(0.018, ''), '18m'); assert.strictEqual(LIB.fmtEng(32768, 'Hz'), '32.768kHz');
});

test('Terminal varsayılan alanları [DSN] ve baud listesi', () => {
  const t = LIB.types['VIRTUAL-TERMINAL'];
  assert.deepStrictEqual(t.baudList, [110, 300, 1200, 2400, 4800, 9600, 19200, 38400, 57600]);
  assert.deepStrictEqual(t.defaults, { baud: 9600, dataBits: 8, parity: 'NONE', stopBits: 1, xonxoff: 0, sigPol: 0, ctlPol: 0 });
  assert.deepStrictEqual(LIB.types.PIC16F628A.defaults, { clock: '1MHz', wdtPeriod: '18m', eeDelay: '10m', cfgword: '0x3F6B' });
  assert.strictEqual(LIB.TTRIGMIN, 0.001); assert.strictEqual(LIB.LCD_CLOCK, 250000);
});

test('ISIS.MENU_LABELS: View ve Debug menü etiketleri birebir', () => {
  assert.deepStrictEqual(ISIS.MENU_LABELS.View, ['Toggle Grid  G', null, 'Zoom In  F6', 'Zoom Out  F7', 'Zoom All  F8', 'Centre At Cursor  F5']);
  assert.deepStrictEqual(ISIS.MENU_LABELS.Debug, ['Start VSM Debugging  Ctrl+F12', 'Pause Animation  Pause', 'Stop VSM Debugging  Shift+Break', 'Step Over  F10', 'Step Into  F11', 'Step Out  Ctrl+F11', null,
    'PIC CPU Registers - U1', 'PIC CPU Data Memory - U1', 'PIC CPU Program Memory - U1', 'PIC CPU EPROM Memory - U1', 'PIC CPU Source Code - U1', 'Watch Window', null, 'Reset Persistent Model Data']);
  assert.strictEqual(ISIS.STEP_OUT_KEY, 'Ctrl+F11');
});

test('ISIS.menuDefs: Debug öğeleri o.debugCmd(ad) çağırır, geri çağırma yoksa gri; View öğeleri ED.zoomKey; System › Set Animation Options', () => {
  const calls = [], zk = [];
  const ED = { parts: () => [{ id: 'U7', type: 'PIC16F628A' }], zoomKey: k => zk.push(k), setGrid() { }, undo() { } };
  const items = (m, name) => m.find(x => x[0] === name)[1]();
  let m = ISIS.menuDefs({ debugCmd: n => calls.push(n), animOptions: () => calls.push('anim') }, ED, {});
  const dbg = items(m, 'Debug');
  assert.deepStrictEqual(dbg.map(x => x && (x[0] + (x[1] ? '  ' + x[1] : ''))).map(x => x && x.replace('U7', 'U1')), ISIS.MENU_LABELS.Debug);
  assert(dbg.filter(Boolean).every(x => typeof x[2] === 'function'));
  for (const it of dbg) if (it) it[2]();
  assert.deepStrictEqual(calls, ['start', 'pause', 'stop', 'stepOver', 'stepInto', 'stepOut', 'popup:regs', 'popup:data', 'popup:prog', 'popup:eeprom', 'popup:source', 'popup:watch', 'resetPersistent']);
  assert.strictEqual(dbg.find(x => x && /Registers/.test(x[0]))[0], 'PIC CPU Registers - U7', 'PIC referansı parçadan');
  const view = items(m, 'View'); for (const it of view) if (it && /^Zoom|Centre/.test(it[0])) it[2]();
  assert.deepStrictEqual(zk, ['in', 'out', 'all', 'centre']);
  calls.length = 0; items(m, 'System')[0][2](); assert.deepStrictEqual(calls, ['anim']);
  m = ISIS.menuDefs({}, ED, {});
  const grey = items(m, 'Debug').filter(Boolean).map(x => [x[0].replace(/ - .*/, ''), x[2]]);
  assert(grey.every(([, f]) => f === null), 'geri çağırma yok → hepsi gri');
  assert.strictEqual(items(m, 'System')[0][2], null);
  let ran = 0; m = ISIS.menuDefs({ run: () => ran++, pause: () => ran += 10, stop: () => ran += 100, step: () => ran += 1000 }, ED, {});
  const d2 = items(m, 'Debug'); for (const i of [0, 1, 2, 3]) d2[i][2]();
  assert.strictEqual(ran, 1111, 'eski index.html geri çağırmaları (run/pause/stop/step) çalışır');
  assert.strictEqual(d2.find(x => x && x[0] === 'Reset Persistent Model Data')[2], null);
});

test('EDITOR.viewFor / rectView: F6/F7 imleç merkezli ×0,8 / ×1,25; alana yakınlaştırma en-boy oranını korur', () => {
  const vb = { x: 0, y: 0, w: 1000, h: 600 };
  assert.deepStrictEqual(EDITOR.viewFor(vb, 'in', [400, 300]), { x: 400 - 400, y: 300 - 240, w: 800, h: 480 });
  assert.deepStrictEqual(EDITOR.viewFor(vb, 'out', [400, 300]), { x: 400 - 625, y: 300 - 375, w: 1250, h: 750 });
  assert.deepStrictEqual(EDITOR.viewFor(vb, 'centre', [900, 500]), { x: 400, y: 200, w: 1000, h: 600 });
  const r = EDITOR.rectView(vb, [200, 100, 400, 200]);
  assert(Math.abs(r.w / r.h - 1000 / 600) < 1e-9 && r.x < 200 && r.x + r.w > 400 && r.y < 100 && r.y + r.h > 200);
  assert(Math.abs(r.x + r.w / 2 - 300) < 1e-9 && Math.abs(r.y + r.h / 2 - 150) < 1e-9);
});

test('ED.zoomKey: in/out/all/centre imleç (son işaretçi) konumunda; menü ve tuşlar için dışa açık', () => {
  const T = editorWith(base());
  T.ed.zoomKey('all'); const v0 = T.ed.view();
  T.move(500, 300); T.ed.zoomKey('in');
  let v = T.ed.view();
  assert(Math.abs(v.w - v0.w * 0.8) < 1e-6 && Math.abs(v.x + v.w / 2 - 500) < 1e-6 && Math.abs(v.y + v.h / 2 - 300) < 1e-6, 'in');
  T.ed.zoomKey('out'); T.ed.zoomKey('out');
  v = T.ed.view(); assert(Math.abs(v.w - v0.w * 0.8 * 1.25 * 1.25) < 1e-6, 'out');
  T.ed.zoomKey('centre', [100, 100]); v = T.ed.view();
  assert(Math.abs(v.x + v.w / 2 - 100) < 1e-6 && Math.abs(v.y + v.h / 2 - 100) < 1e-6, 'centre pt ile');
  T.ed.zoomKey('all'); assert.deepStrictEqual(T.ed.view(), v0, 'all = fit');
  const T2 = editorWith(base()); T2.ed.zoomKey('in'); const w = T2.ed.view(); assert(Math.abs(w.x + w.w / 2 - (T2.ed.view().x + w.w / 2)) < 1e-9, 'imleç yokken görünüm merkezi');
});

test('Shift + sol sürükle (boş alan) = alana yakınlaştır; Ctrl/⌘ sürükle seçime ekler; parçada Shift-tık hâlâ seçime ekler', () => {
  const T = editorWith(base());
  T.ed.zoomKey('all');
  const v0 = T.ed.view();
  T.drag([500, 500], [600, 560], { shiftKey: true });
  const v = T.ed.view();
  assert(v.w < v0.w / 2, 'yakınlaştı'); assert(v.x < 500 && v.x + v.w > 600 && v.y < 500 && v.y + v.h > 560, 'kutuyu içerir');
  assert(Math.abs(v.w / v.h - v0.w / v0.h) < 1e-6);
  assert.deepStrictEqual(T.ed.selection(), { parts: [], wires: [] }, 'seçim değişmedi');
  T.ed.zoomKey('all'); T.drag([500, 500], [502, 502], { shiftKey: true }); assert.deepStrictEqual(T.ed.view(), v0, 'çok küçük kutu yok sayılır');
  T.ed.select(['R1']); T.drag([90, 280], [270, 380], { ctrlKey: true });
  assert.deepStrictEqual(T.ed.selection().parts, ['R1', 'R2'], 'Ctrl ile kutu seçimi ekler');
  T.ed.select(['R1']); T.click(210, 310, { shiftKey: true });
  assert.deepStrictEqual(T.ed.selection().parts, ['R1', 'R2']);
});

test('Orta tuş: tıkla = izli kaydırma aç/kapa; sürükle = kaydırma', () => {
  const T = editorWith(base()); T.ed.zoomKey('all');
  const v0 = T.ed.view();
  T.down(400, 300, { button: 1 }); T.move(430, 300, { button: 1 }); T.up(430, 300, { button: 1 });
  let v = T.ed.view(); assert(Math.abs(v.x - (v0.x - 30)) < 1e-6, 'sürükle: kaydırır'); assert.strictEqual(v.y, v0.y);
  T.down(400, 300, { button: 1 }); T.up(400, 300, { button: 1 });
  T.move(440, 330); v = T.ed.view();
  assert(Math.abs(v.x - (v0.x - 30 - 40)) < 1e-6 && Math.abs(v.y - (v0.y - 30)) < 1e-6, 'izli kaydırma: tuş basılı değilken fare ile sayfa kayar');
  T.move(460, 330); const vv = T.ed.view(); assert(Math.abs(vv.x - (v.x - 20)) < 1e-6);
  T.down(460, 330); T.up(460, 330);
  T.move(600, 400); assert.deepStrictEqual(T.ed.view(), vv, 'sonraki tık izlemeyi bitirir');
  assert.deepStrictEqual(T.ed.selection(), { parts: [], wires: [] }, 'o tık seçim/yerleştirme yapmaz');
});

test('Sayısal tuş takımı +/−: yerleştirirken ve seçiliyken saatin tersine / saat yönünde döndürür; R aynen', () => {
  const T = editorWith(base());
  T.ed.select(['R1']); T.key('+', { code: 'NumpadAdd' });
  assert.strictEqual(T.ed.get().parts[0].rot, 270, '+ = saatin tersine');
  T.key('-', { code: 'NumpadSubtract' }); assert.strictEqual(T.ed.get().parts[0].rot, 0);
  T.key('-', { code: 'NumpadSubtract' }); assert.strictEqual(T.ed.get().parts[0].rot, 90);
  T.key('r'); assert.strictEqual(T.ed.get().parts[0].rot, 180);
  T.ed.select([]); T.key('+', { code: 'NumpadAdd' }); assert.strictEqual(T.ed.get().parts[0].rot, 180, 'seçim/yerleştirme yoksa etkisiz');
  T.ed.setTool('place', 'RES'); T.key('+', { code: 'NumpadAdd' }); assert.strictEqual(T.ed.info().rot, 270);
  T.key('-', { code: 'NumpadSubtract' }); T.key('-', { code: 'NumpadSubtract' }); assert.strictEqual(T.ed.info().rot, 90);
});

test('Tel çekerken: sağ tık son çapayı kaldırır, çapa kalmayınca iptal eder; Backspace aynı; Ctrl ile çapraz segment', () => {
  const pin = (id, n) => LIB.pinPos(base().parts.find(p => p.id === id), n);
  const a = pin('R1', '1'), b = pin('R2', '1');
  let T = editorWith(base());
  T.click(a[0], a[1]);
  T.click(a[0], a[1] + 100);
  T.click(a[0] + 40, a[1] + 140);
  T.ctx(0, 0);
  T.click(b[0], b[1]);
  let w = T.ed.get().wires;
  assert.strictEqual(w.length, 1);
  assert(!w[0].points.some(p => p[0] === a[0] + 40 && p[1] === a[1] + 140), 'son çapa (köşe dahil) kalktı: ' + JSON.stringify(w[0].points));
  assert.deepStrictEqual(w[0].points[0], a); assert.deepStrictEqual(w[0].points[w[0].points.length - 1], b);
  T = editorWith(base());
  T.click(a[0], a[1]); T.click(a[0], a[1] + 100);
  T.ctx(0, 0); T.ctx(0, 0);
  T.click(b[0], b[1]);
  assert.strictEqual(T.ed.get().wires.length, 0, 'çapa kalmayınca sağ tık teli iptal eder; sonraki tık yeni tel başlatır');
  T = editorWith(base());
  T.click(a[0], a[1]); T.click(a[0], a[1] + 100); T.click(a[0] + 40, a[1] + 140);
  T.key('Backspace'); T.click(b[0], b[1]);
  assert(!T.ed.get().wires[0].points.some(p => p[1] === a[1] + 140), 'Backspace da son çapayı kaldırır');
  T = editorWith(base());
  T.click(a[0], a[1], { ctrlKey: true });
  T.click(a[0] + 60, a[1] + 90, { ctrlKey: true });
  T.click(b[0], b[1], { ctrlKey: true });
  assert.deepStrictEqual(T.ed.get().wires[0].points, [a, [a[0] + 60, a[1] + 90], b], 'Ctrl: Manhattan yok, çapraz');
  T = editorWith(base()); T.click(a[0], a[1]); T.click(b[0], b[1]);
  assert(T.ed.get().wires[0].points.length > 2 && T.ed.get().wires[0].points.every((p, i, ar) => !i || p[0] === ar[i - 1][0] || p[1] === ar[i - 1][1]), 'Ctrl yokken dik açılı');
  T.key('Escape');
});

// --- Edit Component dialogs (fake DOM) ---
const labelEls = () => made.filter(e => e.tag === 'label');
function fieldInput(label) {
  const lb = labelEls().filter(l => l.children[0] && l.children[0].textContent === label).pop();
  assert(lb, 'alan yok: ' + label);
  return lb.children.find(c => c.tag === 'input' || c.tag === 'select');
}
const propsBox = () => made.filter(e => e.tag === 'div' && e.className === 'props pdlg').pop();
function circ() {
  return { version: 1, parts: [{ id: 'U1', type: 'PIC16F628A', x: 100, y: 100, rot: 0, value: '' }, { id: 'VT1', type: 'VIRTUAL-TERMINAL', x: 400, y: 100, rot: 0, value: '' }, R('R1', 100, 400)], wires: [] };
}
test('E: "Find and Edit Component — Reference:" istemi → o parçanın penceresi; Ctrl+E işaretçinin altındaki parçayı düzenler', () => {
  const asked = [], toasts = [];
  const T = editorWith(circ(), { prompt: m => { asked.push(m); return 'r1'; }, toast: m => toasts.push(m) });
  T.key('e');
  assert.deepStrictEqual(asked, ['Find and Edit Component — Reference:']);
  assert(propsBox(), 'pencere açıldı'); assert.deepStrictEqual(T.ed.selection().parts, ['R1']);
  T.key('Escape');
  const n = made.length;
  T.ed.findAndEdit('nope'); assert(/not found/.test(toasts[toasts.length - 1]));
  T.ed.findAndEdit('U1'); assert(made.length > n);
  assert(labelEls().some(l => l.children[0] && l.children[0].textContent === 'Processor Clock Frequency:'));
  propsBox().querySelector('[name=cancel]').onclick();
  T.move(130, 150); const m0 = made.length; T.key('e', { ctrlKey: true });
  assert(made.length > m0, 'Ctrl+E pencere açtı');
  const T3 = editorWith(circ(), { toast: m => toasts.push(m) }); T3.move(5, 5); T3.key('e', { metaKey: true });
  assert(/Point at a component/.test(toasts[toasts.length - 1]), 'parça yokken ipucu');
});

test('Edit Component (PIC): Processor Clock Frequency doğrulanır, Advanced Properties kaydedilir, ED.onEditPart ateşlenir; eski satır köprüsü', () => {
  const events = [], toasts = [], legacy = [];
  const T = editorWith(circ(), {
    toast: m => toasts.push(m), projectClock: () => 8e6, onEditPart: (p, ch) => events.push(['o', p.id, ch]),
    componentInfo: p => p.type !== 'PIC16F628A' ? [] : [{ label: 'Program File:', value: 'x.hex' },
      { label: 'Processor Clock Frequency:', value: 8e6, options: [[4e6, '4MHz'], [8e6, '8MHz']], apply: v => legacy.push(v) },
      { label: 'Program Configuration Word:', value: '0x3F10' }]
  });
  T.ed.onEditPart((p, ch) => events.push(['cb', p.id, ch]));
  T.ed.findAndEdit('U1');
  const clk = fieldInput('Processor Clock Frequency:');
  assert.strictEqual(clk.value, '8MHz', 'varsayılan = proje saati (D4)');
  assert.strictEqual(fieldInput('Program Configuration Word:').placeholder, '0x3F10');
  assert.strictEqual(fieldInput('Watchdog Timer Period:').value, '18m'); assert.strictEqual(fieldInput('Data EEPROM Write Delay:').value, '10m');
  assert.strictEqual(fieldInput('Randomize Data Memory?').disabled, true); assert.strictEqual(fieldInput('Model PIC Start-up Delays?').disabled, true);
  assert(made.some(e => e.tag === 'details'), 'Advanced Properties açılır bölüm');
  const ok = () => propsBox().querySelector('[name=ok]').onclick();
  clk.value = '10kHz'; ok();
  assert(/between 32kHz and 20MHz/.test(toasts[toasts.length - 1]), toasts.join('|')); assert.strictEqual(T.ed.get().parts[0].clock, undefined);
  assert.deepStrictEqual(events, [], 'geçersizken olay yok');
  clk.value = '4MHz'; fieldInput('Watchdog Timer Period:').value = '33m'; fieldInput('Data EEPROM Write Delay:').value = '4m'; fieldInput('Program Configuration Word:').value = '0x3fff';
  ok();
  const u1 = T.ed.get().parts.find(p => p.id === 'U1');
  assert.deepStrictEqual([u1.clock, u1.wdtPeriod, u1.eeDelay, u1.cfgword], ['4MHz', '33m', '4m', '0x3FFF']);
  assert.deepStrictEqual(legacy, [4e6], 'eski Fosc satırına köprü (yalnız 4/8/20 MHz)');
  assert.strictEqual(events.length, 2);
  assert.deepStrictEqual(events[0], ['o', 'U1', { clock: '4MHz', cfgword: '0x3FFF', wdtPeriod: '33m', eeDelay: '4m' }]);
  assert.deepStrictEqual(events[1][2], events[0][2]);
  T.key('z', { metaKey: true }); assert.strictEqual(T.ed.get().parts[0].clock, undefined, 'geri al');
  T.ed.findAndEdit('U1'); fieldInput('Processor Clock Frequency:').value = '6MHz'; ok();
  assert.strictEqual(T.ed.get().parts[0].clock, '6MHz'); assert.deepStrictEqual(legacy, [4e6], '6MHz eski listede yok → köprü çağrılmaz');
  const n = events.length; T.ed.findAndEdit('U1'); ok(); assert.strictEqual(events.length, n, 'değişiklik yoksa olay yok');
});

test('Edit Component (VIRTUAL-TERMINAL): Baud/Data/Parity/Stop/XON-XOFF + Advanced polarite; varsayılana dönünce alan silinir', () => {
  const events = [];
  const T = editorWith(circ(), { onEditPart: (p, ch) => events.push(ch) });
  T.ed.findAndEdit('VT1');
  assert.strictEqual(fieldInput('Baud Rate:').value, '9600');
  assert.strictEqual(fieldInput('Baud Rate:').attrs.list, 'dl-baud');
  const dl = made.filter(e => e.tag === 'datalist').pop();
  assert.deepStrictEqual(dl.children.map(o => o.value), ['110', '300', '1200', '2400', '4800', '9600', '19200', '38400', '57600']);
  const ok = () => propsBox().querySelector('[name=ok]').onclick();
  fieldInput('Baud Rate:').value = '19200'; fieldInput('Parity:').value = 'EVEN'; fieldInput('Data Bits:').value = '7'; fieldInput('Stop Bits:').value = '2';
  fieldInput('Send XON/XOFF:').value = '1'; fieldInput('RX/TX Polarity:').value = '1'; fieldInput('RTS/CTS Polarity:').value = '1';
  ok();
  const vt = T.ed.get().parts.find(p => p.id === 'VT1');
  assert.deepStrictEqual([vt.baud, vt.parity, vt.dataBits, vt.stopBits, vt.xonxoff, vt.sigPol, vt.ctlPol], [19200, 'EVEN', 7, 2, 1, 1, 1]);
  assert.deepStrictEqual(LIB.termCfg(vt), { baud: 19200, dataBits: 7, parity: 'EVEN', stopBits: 2, xonxoff: 1, sigPol: 1, ctlPol: 0 + 1 });
  T.ed.findAndEdit('VT1'); fieldInput('Baud Rate:').value = '9600'; fieldInput('Parity:').value = 'NONE'; ok();
  const v2 = T.ed.get().parts.find(p => p.id === 'VT1');
  assert.strictEqual('baud' in v2, false); assert.strictEqual('parity' in v2, false); assert.strictEqual(v2.dataBits, 7);
  assert.strictEqual(events.length, 2);
});

test('Çalışırken sağ tık: terminal ekranında Clear Screen / Pause / Copy / Paste / Hex Display Mode / Echo Typed Characters menüsü; komutlar runner.termCmd', () => {
  const cmds = [], pasted = [];
  const fake = { termInfo: () => ({ paused: true, hex: false, echo: true }), termCmd: (id, c) => cmds.push([id, c]), termText: () => 'abc', termPaste: (id, t) => pasted.push([id, t]) };
  const T = editorWith(circ(), { runner: () => fake });
  T.ed.setRun(true);
  const g = { dataset: { id: 'VT1' } }, hit = { closest: () => g };
  const before = made.length;
  T.ctx(450, 150, { target: { closest: sel => sel === '.term-hit' ? hit : null, tagName: 'svg' } });
  const menu = made.slice(before).find(e => e.tag === 'div' && e.className === 'ctxm');
  assert(menu, 'menü açıldı');
  const rows = menu.children.map(d => d.className === 'sep' ? '-' : d.children[0].textContent);
  assert.deepStrictEqual(rows, ['Clear Screen', '✓ Pause', '-', 'Copy', 'Paste', '-', '   Hex Display Mode', '✓ Echo Typed Characters']);
  const item = t => menu.children.find(d => d.children[0] && d.children[0].textContent.trim().replace('✓ ', '') === t);
  item('Clear Screen').onclick(); item('Pause').onclick(); item('Hex Display Mode').onclick(); item('Echo Typed Characters').onclick();
  assert.deepStrictEqual(cmds, [['VT1', 'clear'], ['VT1', 'pause'], ['VT1', 'hex'], ['VT1', 'echo']]);
  const n = made.length; T.ctx(50, 50); assert.strictEqual(made.length, n, 'terminal dışında çalışırken menü yok');
  T.ed.setRun(false);
});

console.log('\n' + passed + ' geçti, ' + failed + ' başarısız');
process.exit(failed ? 1 : 0);
