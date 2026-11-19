// Uçtan uca: gerçek sunucu (geçici EELAB_HOME) + HTTP API + Node'da PIC çekirdeği ve devre çözücü.
// Her şablon: /api/new → /api/file (settings.circuit) → /api/build → eşlendiği devrede çalıştır → çıktıyı doğrula.
// Ayrıca: üç .pdsprj içe aktarma → derle → simüle et, ayar kalıcılığı, teslim zip'i, şema dışa aktarma.
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), cp = require('child_process'), assert = require('assert');
const ROOT = path.join(__dirname, '..', '..');
const PIC = require(path.join(ROOT, 'js/pic.js')), SIM = require(path.join(ROOT, 'js/sim.js')), LIB = require(path.join(ROOT, 'js/library.js'));
const PY = process.env.EELAB_PY || 'python3';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e && e.stack || e).split('\n').slice(0, 6).join('\n     ')); }
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'eelab_e2e_'));
const HOME = path.join(TMP, 'EE Lab Öğrenci'), STATE = path.join(TMP, 'state'), OLD = path.join(TMP, 'eski');
fs.mkdirSync(OLD);
let srv, base;

function start() {
  return new Promise((res, rej) => {
    const env = Object.assign({}, process.env, { EELAB_HOME: HOME, EELAB_STATE_DIR: STATE, EELAB_MIGRATE_FROM: OLD, EELAB_NO_REVEAL: "1" });
    srv = cp.spawn(PY, ['-B', path.join(ROOT, 'server.py'), '--no-open', '--port', '0'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const to = setTimeout(() => rej(new Error('sunucu açılmadı: ' + out)), 20000);
    const on = d => { out += d; const m = /EELAB \S+ (http:\/\/127\.0\.0\.1:\d+)/.exec(out); if (m && !base) { base = m[1]; clearTimeout(to); res(); } };
    srv.stdout.on('data', on); srv.stderr.on('data', on);
    srv.on('exit', c => { if (!base) rej(new Error('sunucu çıktı (' + c + '): ' + out)); });
  });
}
function req(method, p, body) {
  return new Promise((res, rej) => {
    const u = new URL(base + p);
    const data = body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    const r = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method,
      headers: Object.assign({ Host: u.host }, data ? { 'Content-Type': Buffer.isBuffer(body) ? 'application/octet-stream' : 'application/json', 'Content-Length': data.length } : {}) }, x => {
      const ch = []; x.on('data', c => ch.push(c)); x.on('end', () => { const b = Buffer.concat(ch); let j; try { j = JSON.parse(b.toString()); } catch (e) { j = { _raw: b }; } res({ status: x.statusCode, body: j }); });
    });
    r.on('error', rej); r.setTimeout(120000, () => r.destroy(new Error('zaman aşımı ' + p)));
    if (data) r.write(data); r.end();
  });
}
const get = async p => (await req('GET', p)).body, post = async (p, b) => (await req('POST', p, b)).body;

// ---- Node simülasyonu: index.html'deki portChg/inputs akışının aynısı ----
function attach(hexText, circuit, fosc, noAnalog) {
  const m = SIM.compile(circuit, LIB), run = new SIM.Runner(m);
  if (run.setClock) run.setClock(fosc);
  let c;
  const sync = r => { if (r) { c.P.inA = r.inA; c.P.inB = r.inB; c.P.flB = run.setPullups ? 0 : (r.flB || 0); } };
  const portChg = () => {
    if (run.setPullups) run.setPullups((c.P.ram[0x81] & 0x80) ? 0 : 0xFF, c.P.cyc);
    const d = c.drive(); sync(run.port(d[0], d[1], d[2], d[3], c.P.cyc));
    if (s.onPort) s.onPort(d);
  };
  const s = { m, run, circuit, onPort: null };
  c = PIC.create({ onPort: portChg, onUartTx: (b, t) => run.uartTx && run.uartTx(b, t) });
  if (c.attachRunner && !noAnalog) c.attachRunner(() => run);
  const h = PIC.parseHex(hexText); assert(h.n > 0, 'HEX boş');
  c.load(h); c.P.fosc = fosc; c.reset(); portChg();
  s.c = c;
  s.part = id => circuit.parts.find(p => p.id === id || p.type === id);
  s.to = cyc => { while (c.P.cyc < cyc) { if (run.uartRx) for (let b; (b = run.uartRx()) != null;) c.rxPush(b); c.run(Math.min(cyc, c.P.cyc + 16000)); s.r = run.frame(c.P.cyc); } return s.r; };
  s.adv = n => s.to(c.P.cyc + n);
  s.press = (id, v) => sync(run.press(id, v, c.P.cyc));
  s.lit = id => { const r = s.r || run.frame(c.P.cyc); return !!(r.lit[id] && r.lit[id].ON); };
  s.leds = ids => ids.reduce((a, id, i) => a | (s.lit(id) ? 1 << i : 0), 0);
  s.digit = id => SIM.decode((s.r || run.frame(c.P.cyc)).lit[id] || {});
  s.mpx = (id, n) => { const L = (s.r.lit[id]) || {}; let t = ''; for (let d = 1; d <= n; d++) { const o = {}; for (const g of SIM.SEGN) o[g] = !!L[d + g]; t += SIM.decode(o); } return t; };
  s.state = id => run.state(s.part(id), s.r || run.frame(c.P.cyc));
  // Gösterge/LED kalıcılık penceresi (run.win, 20 ms) geçişte iki durumu bir an birleştirir; yalnız pencereden uzun süre aynı kalan değer alınır.
  s.sample = (fn, step, total) => {
    const seq = [], end = c.P.cyc + total; let prev, since = 0;
    while (c.P.cyc < end) { s.adv(step); const v = fn(); if (v !== prev) { prev = v; since = c.P.cyc; } else if (c.P.cyc - since >= (run.win || 0) && (!seq.length || seq[seq.length - 1] !== v)) seq.push(v); }
    return seq;
  };
  return s;
}
const LEDS8 = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'];
const startsWith = (seq, want, what) => assert.deepStrictEqual(seq.slice(0, want.length), want, what + ': ' + JSON.stringify(seq.slice(0, want.length + 4)));

// ---- şablon başına beklenen davranış (M9) ----
const CHECKS = {
  blank_c(s) { s.adv(50000); assert.strictEqual(s.c.peek().pb, 0); assert.strictEqual(s.c.peek().trisB, 0); },
  blank_asm(s) { s.adv(50000); assert.strictEqual(s.c.peek().pb, 0); assert.strictEqual(s.c.peek().trisB, 0); },
  lab1(s) {
    s.adv(100000); assert.strictEqual(s.leds(LEDS8), 0, 'buton yokken LED sönük');
    s.press('SW1', true);
    startsWith(s.sample(() => s.leds(LEDS8), 20000, 3400000), [1, 2, 4, 8, 16, 32, 64, 128], 'SW1 (A) basılı: kayan LED');
    s.press('SW1', false); s.press('SW2', true); s.adv(200000);
    assert.strictEqual(s.leds(LEDS8), 0xFF, 'SW2 (B) basılı: hepsi yanık');
    s.press('SW2', false); s.adv(500000); assert.strictEqual(s.leds(LEDS8), 0, 'bırakınca sönük');
  },
  lab2(s) { startsWith(s.sample(() => s.digit('DS1'), 20000, 2400000), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], 'LAB2 7448 göstergesi sayar'); },
  lab3(s) {
    const ds = s.circuit.parts.filter(p => p.type === '7SEG-MPX1-CC').map(p => p.id);
    const seq = s.sample(() => ds.map(d => s.digit(d)).join(''), 20000, 1250000);
    const mv = ds.map((_, i) => seq.map(t => t[i]).filter((v, j, a) => j === 0 || a[j - 1] !== v));
    const ones = mv.find(x => x.length > 5);
    assert(ones, 'sayan hane yok: ' + JSON.stringify(seq.slice(0, 6)));
    startsWith(ones, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], 'birler hanesi 100 ms\'de bir');
    assert(mv.filter(x => x.length > 1).length === 1, 'yalnız birler hanesi değişmeli');
  },
  timer0(s) {
    const t = []; let last = s.lit('D1');
    while (s.c.P.cyc < 2200000) { s.adv(10000); const v = s.lit('D1'); if (v !== last) { t.push(s.c.P.cyc); last = v; } }
    assert(t.length >= 3, 'RB0 LED en az 3 kez değişmeli: ' + t);
    const per = (t[2] - t[1]) / 1000;
    assert(per > 450 && per < 550, 'yarım periyot ≈ 500 ms, ölçülen ' + per.toFixed(1));
  },
  rb0_int(s) {
    s.adv(50000); assert.strictEqual(s.leds(['D1', 'D2', 'D3', 'D4']), 0);
    for (let i = 1; i <= 5; i++) { s.press('SW1', true); s.adv(20000); s.press('SW1', false); s.adv(20000);
      assert.strictEqual(s.leds(['D1', 'D2', 'D3', 'D4']), i, i + '. basıştan sonra LED = ' + i); }
  },
  seven_seg(s) {
    const seq = s.sample(() => s.mpx('DS1', 4), 10000, 450000).filter(t => /^\d{4}$/.test(t));
    assert(seq.includes('0001') && seq.includes('0002') && seq.includes('0003'), '4 haneli tarama sayar: ' + JSON.stringify(seq.slice(0, 8)));
  },
  lcd(s) {
    s.adv(1700000); const l = s.state('LM016L').lcd;
    assert(l && /^EELAB/.test(l.lines[0]) && /^Sayac:\s*[2-4]\b/.test(l.lines[1].replace(/\s+/g, ' ')), JSON.stringify(l));
  },
  keypad_lcd(s) {
    s.adv(200000);
    for (const k of ['5', '9', '+']) {
      s.press('KP1:' + k, true); s.adv(60000); s.press('KP1:' + k, false); s.adv(60000);
      const l = s.state('LM016L').lcd; assert(l && l.lines[0].startsWith('Tus: ' + k), k + ' → ' + JSON.stringify(l));
    }
  },
  uart(s) {
    s.adv(300000);
    const vt = s.part('VIRTUAL-TERMINAL').id;
    assert(/^EELAB UART\r?\n/.test(s.state(vt).text), JSON.stringify(s.state(vt).text));
    for (const ch of 'ok') { s.run.termKey(vt, ch); s.adv(30000); }
    assert(/EELAB UART\r?\nok$/.test(s.state(vt).text), 'echo: ' + JSON.stringify(s.state(vt).text));
  },
  pwm(s) {
    const ed = []; let lv = -1;
    s.onPort = d => { const v = (d[3] >> 3) & 1; if (v !== lv) { ed.push([s.c.P.cyc, v]); lv = v; } };
    s.adv(20000); ed.length = 0; s.adv(4000);
    const rise = ed.filter(e => e[1] === 1).map(e => e[0]), fall = ed.filter(e => e[1] === 0).map(e => e[0]);
    assert(rise.length > 10, 'RB3 PWM yok');
    const per = rise[rise.length - 1] - rise[rise.length - 2];
    const hi = fall.find(f => f > rise[rise.length - 2]) - rise[rise.length - 2];
    assert(Math.abs(per - 200) <= 1, 'periyot 200 çevrim (5 kHz), ölçülen ' + per);
    assert(hi > 30 && hi < 70, 'doluluk ≈ %25, yüksek ' + hi);
    s.adv(600000); ed.length = 0; s.adv(4000);
    const r2 = ed.filter(e => e[1] === 1).map(e => e[0]), hi2 = ed.find(e => e[1] === 0 && e[0] > r2[r2.length - 2])[0] - r2[r2.length - 2];
    assert(hi2 > hi + 30, 'doluluk 500 ms sonra artmalı: ' + hi + ' → ' + hi2);
  },
  comparator(s) {
    s.adv(50000);
    const vm = () => s.state('VM1').volts;
    assert.strictEqual(s.lit('D1'), false, 'pot %30 (1,5 V) < VREF 2,5 V → LED sönük');
    assert.strictEqual(vm(), 1.5);
    const seq = [];
    for (const x of ['0.45', '0.49', '0.51', '0.55', '0.90', '0.40', '0.60', '0.10']) {
      s.press('RV1:=' + x, true); s.adv(30000);
      seq.push([x, s.lit('D1'), vm()]);
    }
    assert.deepStrictEqual(seq.map(e => e[1]), [false, false, true, true, true, false, true, false], 'LED = RA0 > VREF: ' + JSON.stringify(seq));
    assert.deepStrictEqual(seq.map(e => e[2]), [2.25, 2.45, 2.55, 2.75, 4.5, 2, 3, 0.5], 'voltmetre = silecek');
    s.press('RV1:=0.45', true); s.adv(30000); assert.strictEqual(s.lit('D1'), false);
    for (let i = 0; i < 2; i++) { s.press('RV1:+', true); s.press('RV1:+', false); s.adv(30000); }
    assert.strictEqual(s.lit('D1'), true, '+ düğmesi iki kez: %45 → %55 — ' + vm());
    for (let i = 0; i < 2; i++) { s.press('RV1:-', true); s.press('RV1:-', false); s.adv(30000); }
    assert.strictEqual(s.lit('D1'), false, '- düğmesi iki kez: %55 → %45 — ' + vm());
    const cm = s.c.peek().cmcon;
    assert.strictEqual(cm & 0x1F, 0x12, 'CMCON = 0x12 (C1INV, mod 010)'); assert(Math.abs(s.c.vref() - 2.5) < 1e-9, 'VRCON = 0xAC → 2,5 V');
  },
  eeprom(s) {
    startsWith(s.sample(() => s.leds(LEDS8), 20000, 2200000).filter(v => v), [1, 2, 4, 8, 16, 32, 64, 128], 'EEPROM\'dan okunan kayan bit');
    assert.strictEqual(s.c.ee[1], 1); assert.strictEqual(s.c.ee[8], 128);
  },
};

(async () => {
  try { await start(); } catch (e) { console.log('FAIL sunucu: ' + e.message); process.exit(1); }
  let tpls = [];

  await test('API: ping, info, çalışma klasörü (geçici, Türkçe karakterli yol)', async () => {
    const p = await get('/api/ping'); assert.strictEqual(p.app, 'EELAB');
    const i = await get('/api/info'); assert.strictEqual(i.home, HOME); assert(i.toolchain && i.toolchain.mode !== 'missing', JSON.stringify(i.toolchain));
    const w = await post('/api/workspace', { action: 'create', name: 'E2E' }); assert.strictEqual(w.current, 'E2E');
    assert(fs.existsSync(path.join(HOME, 'Ornekler')) && fs.existsSync(path.join(HOME, 'E2E')));
  });

  await test('şablon listesi: 14 şablon, boşlar dışında hepsinin devresi var ve açılıyor', async () => {
    tpls = await get('/api/templates'); tpls = Array.isArray(tpls) ? tpls : tpls.templates;
    assert(tpls.length >= 14, 'şablon sayısı ' + tpls.length);
    for (const t of tpls) {
      assert(CHECKS[t.id], 'denetimi olmayan şablon: ' + t.id);
      if (/^blank_/.test(t.id)) continue;
      assert(t.circuit, t.id + ' devresiz');
      const c = await get('/api/circuit?name=' + t.circuit); assert(c.parts && c.parts.length, t.circuit);
      for (const p of c.parts) assert(LIB.types[p.type], t.circuit + ': ' + p.type);
    }
  });

  for (const t of (await get('/api/templates'))) {
    await test('şablon ' + t.id + ' → ' + (t.circuit || '(devre yok)') + ': derle + simüle et', async () => {
      const name = 'T_' + t.id + '.' + t.lang;
      const n = await post('/api/new', { name, template: t.id, fosc: t.fosc }); assert(n.ok, JSON.stringify(n));
      const f = await get('/api/file?name=' + name);
      assert.strictEqual(f.lang, t.lang); assert.strictEqual(f.fosc, t.fosc);
      assert.strictEqual(f.settings && f.settings.circuit || undefined, t.circuit, 'dosya↔devre eşlemesi');
      const b = await post('/api/build', { name, code: f.code, fosc: f.fosc });
      assert(b.ok, (b.messages || []).join('\n') + (b.error || ''));
      assert(b.debug && b.debug.lines && b.debug.lines.length, 'debug.lines boş');
      const h = PIC.parseHex(b.hex); assert(h.n > 0 && h.n <= 2048, 'ROM ' + h.n);
      const circ = t.circuit ? await get('/api/circuit?name=' + t.circuit) : { parts: [{ id: 'U1', type: 'PIC16F628A', x: 200, y: 160 }], wires: [] };
      CHECKS[t.id](attach(b.hex, circ, t.fosc));
    });
  }

  await test('scope_demo + PWM şablonu: TRISB=0 iken "Logic contention" yok, OSC1.A\'da PWM', async () => {
    const f = await get('/api/file?name=T_pwm.c'), b = await post('/api/build', { name: 'T_pwm.c', code: f.code, fosc: 4000000 });
    assert(b.ok, (b.messages || []).join('\n'));
    const s = attach(b.hex, await get('/api/circuit?name=scope_demo'), 4000000);
    let bad = 0;
    for (let i = 0; i < 20; i++) { s.adv(10000); if (s.r.conflict) bad++; }
    assert.strictEqual(bad, 0, 'çatışma: ' + JSON.stringify(s.run.contention()));
    assert(s.run.rec.count(s.run.rec.channels.findIndex(c => c.id === 'OSC1:A')) > 100, 'RB3 PWM kaydı');
  });

  await test('karşılaştırıcı: core.attachRunner bağlanmasa da (dijital geri dönüş, 2,5 V eşik) LED VREF\'te değişir', async () => {
    const f = await get('/api/file?name=T_comparator.c'), b = await post('/api/build', { name: 'T_comparator.c', code: f.code, fosc: 4000000 });
    const s = attach(b.hex, await get('/api/circuit?name=comparator_demo'), 4000000, true);
    s.adv(50000); const seq = [s.lit('D1')];
    for (const x of ['0.40', '0.60', '0.20', '0.95']) { s.press('RV1:=' + x, true); s.adv(30000); seq.push(s.lit('D1')); }
    assert.deepStrictEqual(seq, [false, false, true, false, true]);
  });

  await test('ayarlar: breakpoints/watches birleşir ve /api/file ile geri gelir', async () => {
    let r = await post('/api/settings', { name: 'T_lab3.c', breakpoints: [14, 16] }); assert(r.ok);
    r = await post('/api/settings', { name: 'T_lab3.c', watches: [{ name: 'birler', fmt: 'dec' }] }); assert(r.ok);
    const f = await get('/api/file?name=T_lab3.c');
    assert.deepStrictEqual(f.settings.breakpoints, [14, 16]); assert.strictEqual(f.settings.watches.length, 1);
    assert.strictEqual(f.settings.circuit, 'lab3', 'devre eşlemesi korunur');
  });

  await test('hata ayıklama bilgisi: lab3 şablonunda birler++ satırına breakpoint → orada durur', async () => {
    const f = await get('/api/file?name=T_lab3.c'), b = await post('/api/build', { name: 'T_lab3.c', code: f.code, fosc: 4000000 });
    const ln = f.code.split('\n').findIndex(l => /birler\+\+/.test(l)) + 1;
    const addrs = b.debug.lines.filter(x => x[1] === ln).map(x => x[0]); assert(addrs.length, 'satır ' + ln + ' adres yok');
    const s = attach(b.hex, await get('/api/circuit?name=lab3'), 4000000);
    for (const a of addrs) s.c.bp.set(a);
    const r1 = s.c.runDbg(3000000, 5000); assert.strictEqual(r1.stop, 'bp'); const c1 = s.c.P.cyc;
    s.c.stepIn(); const r2 = s.c.runDbg(3000000, 5000); assert.strictEqual(r2.stop, 'bp');
    const d = s.c.P.cyc - c1; assert(d > 99000 && d < 103000, 'iki duruş arası ≈ 100 ms, ölçülen ' + d);
    const sym = b.debug.symbols.find(x => x.name === 'birler'); assert(sym, 'birler sembolü');
    assert.strictEqual(s.c.mem.read(sym.addr), 1, 'ikinci duruşta birler = 1');
  });

  const pds = [
    ['Lab3.pdsprj', async (r, s) => {
      const meta = r.meta || {}; assert.strictEqual(meta.clock, 8000000);
      const f = await get('/api/file?name=T_lab3.c'), b = await post('/api/build', { name: 'T_lab3.c', code: f.code, fosc: 4000000 });
      const t = attach(b.hex, s, 4000000), ds = s.parts.filter(p => p.type === '7SEG-MPX1-CC').map(p => p.id);
      const seq = t.sample(() => ds.map(d => t.digit(d)).join(''), 20000, 600000);
      assert(new Set(seq).size >= 5, 'içe aktarılan Lab3 devresinde gösterge değişmeli: ' + JSON.stringify(seq));
    }],
    ['LAB2.pdsprj', async (r, s) => {
      await post('/api/workspace', { action: 'open', name: 'Ornekler' });
      const f = await get('/api/file?name=Lab2.asm');
      assert.strictEqual(f.settings.circuit, 'lab2', 'Ornekler/Lab2.asm → lab2 devresi');
      const b = await post('/api/build', { name: 'Lab2.asm', code: f.code, fosc: 4000000 }); assert(b.ok, (b.messages || []).join('\n'));
      await post('/api/workspace', { action: 'open', name: 'E2E' });
      const t = attach(b.hex, s, 4000000); t.adv(20000);
      assert.strictEqual(t.digit('DS1'), '4', 'Lab2.asm: dizideki tek sayı adedi (4) göstergede');
    }],
    ['Led_Switch.pdsprj', async (r, s) => {
      const code = 'void main() {\n\tCMCON = 0x07;\n\tTRISA = 0x80;\n\twhile (1) {\n\t\tif (PORTA.B7) PORTA.B0 = 1; else PORTA.B0 = 0;\n\t}\n}\n';
      assert((await post('/api/new', { name: 'E2E_Switch.c', fosc: 8000000 })).ok);
      const b = await post('/api/build', { name: 'E2E_Switch.c', code, fosc: 8000000 }); assert(b.ok, (b.messages || []).join('\n'));
      const t = attach(b.hex, s, 8000000), sw = s.parts.find(p => p.type === 'SWITCH').id, led = s.parts.find(p => p.type === 'LED-RED').id;
      t.adv(20000); const a = t.lit(led);
      t.press(sw, true); t.press(sw, false); t.adv(20000); const b2 = t.lit(led);
      assert(a !== b2, 'SWITCH değişince RA0 LED değişmeli (' + a + ' → ' + b2 + ')');
    }],
  ];
  for (const [fn, chk] of pds) {
    await test('.pdsprj içe aktar → yönlendir → simüle et: ' + fn, async () => {
      const r = await post('/api/import-pdsprj', fs.readFileSync(path.join(ROOT, 'tests/fixtures', fn)));
      assert(!r.error, r.error); assert.deepStrictEqual(r.unsupported || [], []);
      const parts = r.parts.map(p => Object.assign({ rot: 0, value: '' }, p));
      if (SIM.overlaps(parts, LIB)) SIM.layout(parts, LIB);
      const ro = SIM.route({ parts, wires: [], nets: r.nets }, LIB); assert.deepStrictEqual(ro.warnings, []);
      const s = { version: 1, parts, wires: ro.wires };
      const got = SIM.pinNets(s, LIB, true);
      for (const n of SIM.canon(r.nets)) assert(got.some(g => n.every(a => g.includes(a))), 'ağ kayboldu: ' + n);
      await chk(r, s);
    });
  }
  await test('bozuk .pdsprj → {error}, sunucu ayakta', async () => {
    const r = await req('POST', '/api/import-pdsprj', Buffer.from('PK\x03\x04bozuk'));
    assert(r.body.error, JSON.stringify(r.body)); assert.strictEqual((await get('/api/ping')).app, 'EELAB');
  });

  await test('teslim paketi: zip Teslim/ altında, beklenen dosyalar', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await post('/api/circuit-save', { name: 'lab3', circuit: await get('/api/circuit?name=lab3') });
    const r = await post('/api/export', { name: 'T_lab3', files: ['T_lab3.c', 'T_lab3.hex', 'lab3.json'], student: { ad: 'Deneme Öğrenci', no: '123' },
      fosc: 4000000, config: 0x3F18, rom: 100, circuitName: 'lab3', svg, pngBase64: png });
    assert(r.ok && r.path && r.path.startsWith(path.join(HOME, 'Teslim')), JSON.stringify(r));
    const ls = cp.execFileSync('/usr/bin/unzip', ['-Z1', r.path], { encoding: 'utf8' }).trim().split('\n').map(x => x.replace(/^.*\//, ''));
    for (const x of ['T_lab3.c', 'T_lab3.hex', 'lab3.json', 'sema.png', 'sema.svg', 'BENIOKU.txt']) assert(ls.includes(x), x + ' yok: ' + ls);
    const entry = cp.execFileSync('/usr/bin/unzip', ['-Z1', r.path], { encoding: 'utf8' }).split('\n').find(x => /BENIOKU\.txt$/.test(x));
    const ben = cp.execFileSync('/usr/bin/unzip', ['-p', r.path, entry], { encoding: 'utf8' });
    assert(/Deneme Öğrenci/.test(ben) && /123/.test(ben) && /4 MHz|4000000/.test(ben), ben);
  });

  await test('şema dışa aktarma: /api/export-file svg + png çalışma klasörüne', async () => {
    let r = await post('/api/export-file', { name: 'lab3_sema', ext: 'svg', text: '<svg xmlns="http://www.w3.org/2000/svg"/>' });
    assert(r.ok && fs.existsSync(r.path), JSON.stringify(r));
    r = await post('/api/export-file', { name: 'lab3_sema', ext: 'png', base64: 'iVBORw0KGgo=' });
    assert(r.ok && fs.existsSync(r.path) && path.dirname(r.path) === path.join(HOME, 'E2E'), JSON.stringify(r));
  });

  await test('uygulama klasörüne yazılmadı', async () => {
    const st = cp.execFileSync('git', ['-C', ROOT, 'status', '--porcelain', '--', 'projeler', 'circuits', 'templates'], { encoding: 'utf8' });
    assert(!/\.hex|\?\? projeler/.test(st), st);
  });

  srv.kill('SIGTERM');
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('\ne2e: ' + passed + ' geçti, ' + failed + ' başarısız');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log('FAIL ' + e.stack); if (srv) srv.kill(); process.exit(1); });
