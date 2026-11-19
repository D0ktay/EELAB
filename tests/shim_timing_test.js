// WS-4: mikroC tam zamanlama (libModel 'mikroc') — G-DLY, G-DLY-TASK1, G-LCD (FIDELITY_PLAN §2.3).
// Kodu server.build ile derler (python3 alt süreç), HEX'i js/pic.js'de çalıştırır, port yazma anlarını sayar.
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const PY = process.env.EELAB_PY || 'python3';

function loadPic() {
  try { const P = require('../js/pic.js'); if (P && P.create && P.parseHex) return P; } catch (e) { /* başka WS düzenliyor olabilir */ }
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'eelab_pic_')), 'pic.js');
  fs.writeFileSync(tmp, cp.execFileSync('git', ['show', 'HEAD:js/pic.js'], { cwd: ROOT }));
  console.log('not  js/pic.js yüklenemedi, HEAD sürümü kullanılıyor');
  return require(tmp);
}
const PIC = loadPic();

let failed = 0, passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e.stack || e.message || e).toString().split('\n').slice(0, 8).join('\n     ')); }
}

const HELPER = `
import json, os, shutil, sys, tempfile
sys.path.insert(0, ${JSON.stringify(ROOT)})
import server
a = json.load(sys.stdin)
work = tempfile.mkdtemp(prefix="eelab_tt_")
server.PROJ = work
server.SETTINGS = os.path.join(work, ".ayarlar.json")
try:
    r = server.build(a["name"], a["code"], a.get("fosc"), a.get("libModel"))
    print(json.dumps({k: r.get(k) for k in ("ok", "hex", "debug", "messages", "mc", "libModel", "fosc")}))
finally:
    shutil.rmtree(work, ignore_errors=True)
`;
function build(name, code, fosc, libModel) {
  const out = cp.execFileSync(PY, ['-c', HELPER], { input: JSON.stringify({ name, code, fosc, libModel }), maxBuffer: 64 << 20 });
  const r = JSON.parse(out.toString());
  assert(r.ok, name + ' derlenemedi:\n' + (r.messages || []).join('\n'));
  return r;
}
function core(hex) { const c = PIC.create({}); c.load(PIC.parseHex(hex)); c.reset(); return c; }

// PORTB her değiştiğinde (değer → o yazmanın bittiği çevrim) kaydeder.
function portWrites(hex, until) {
  const c = core(hex), at = {};
  let prev = c.P.latB;
  while (c.P.cyc < until) {
    c.step();
    if (c.P.latB !== prev) { prev = c.P.latB; if (!(prev in at)) at[prev] = c.P.cyc; }
  }
  return at;
}

const DLY = (fosc, body) => `void main() {
\tCMCON = 0x07;
\tTRISB = 0;
\tPORTB = 1; asm nop; PORTB = 2;
${body}
\twhile (1) { }
}
`;
// t(a→b) = (b yazması bitişi) − (a yazması bitişi) = gecikme + bir port yazmasının bedeli.
// Bedel: aynı kalıp, gecikme yerine tek NOP (asm nop) → t(1→2) − 1.
function delays(r, pairs, until) {
  const at = portWrites(r.hex, until);
  const cost = at[2] - at[1] - 1;
  return pairs.map(([a, b]) => { assert(a in at && b in at, 'port yazması yok ' + a + '/' + b); return at[b] - at[a] - cost; });
}

test('G-DLY @4 MHz: Delay_ms(100)=100000, Delay_ms(200)−Delay_ms(100)=100000, Delay_us(50)=50, Delay_Cyc(3)=30, Delay_Cyc(255)=2550', () => {
  const r = build('Dly4.c', DLY(4e6, '\tPORTB = 3; Delay_ms(100); PORTB = 4;\n\tPORTB = 5; Delay_ms(200); PORTB = 6;\n\tPORTB = 7; Delay_us(50); PORTB = 8;\n\tPORTB = 9; Delay_Cyc(3); PORTB = 10;\n\tPORTB = 11; Delay_Cyc(255); PORTB = 12;\n\tPORTB = 13; delay_ms(1 + 2 * 2); PORTB = 14;'), 4000000, 'mikroc');
  assert.strictEqual(r.libModel, 'mikroc');
  const [d100, d200, u50, c3, c255, e5] = delays(r, [[3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14]], 400000);
  assert.strictEqual(d100, 100000);
  assert.strictEqual(d200 - d100, 100000);
  assert.strictEqual(d200, 200000);
  assert.strictEqual(u50, 50);
  assert.strictEqual(c3, 30);
  assert.strictEqual(c255, 2550);
  assert.strictEqual(e5, 5000, 'sabit ifade delay_ms(1 + 2 * 2)');
  console.log('     mikroc: Delay_ms(100)=%d Delay_ms(200)=%d Delay_us(50)=%d Delay_Cyc(3)=%d Delay_Cyc(255)=%d', d100, d200, u50, c3, c255);
});

test('G-DLY @8 MHz: Delay_ms(10)=20000, Delay_us(1)=2', () => {
  const r = build('Dly8.c', DLY(8e6, '\tPORTB = 3; Delay_ms(10); PORTB = 4;\n\tPORTB = 5; Delay_us(1); PORTB = 6;\n\tPORTB = 7; Delay_5500us(); PORTB = 8;'), 8000000, 'mikroc');
  const [m10, u1, u5500] = delays(r, [[3, 4], [5, 6], [7, 8]], 100000);
  assert.strictEqual(m10, 20000);
  assert.strictEqual(u1, 2);
  assert.strictEqual(u5500, 11000);
});

test('G-DLY @20 MHz: Delay_1sec()=5 000 000', () => {
  const r = build('Dly20.c', DLY(20e6, '\tPORTB = 3; Delay_1sec(); PORTB = 4;'), 20000000, 'mikroc');
  const [s1] = delays(r, [[3, 4]], 5100000);
  assert.strictEqual(s1, 5000000);
});

test('değişken argüman → Vdelay_ms çalışma zamanı döngüsü (yaklaşık, ≥ istenen)', () => {
  const r = build('DlyV.c', 'unsigned int t = 3;\n' + DLY(4e6, '\tPORTB = 3; Delay_ms(t); PORTB = 4;'), 4000000, 'mikroc');
  const [v] = delays(r, [[3, 4]], 100000);
  assert(v >= 3000 && v < 3200, 'Vdelay_ms(3) = ' + v);
});

test("'eelab' kipi aynı kodda eski (yaklaşık) gecikmeyi korur", () => {
  const r = build('DlyE.c', DLY(4e6, '\tPORTB = 3; Delay_ms(100); PORTB = 4;'), 4000000, 'eelab');
  assert.strictEqual(r.libModel, 'eelab');
  const [d] = delays(r, [[3, 4]], 200000);
  assert(d !== 100000 && Math.abs(d - 100000) < 1000, 'eelab Delay_ms(100) = ' + d);
  console.log('     eelab: Delay_ms(100) = %d çevrim', d);
});

function task1Period(libModel) {
  const code = fs.readFileSync(path.join(ROOT, 'projeler', 'Task1.c'), 'utf8');
  const r = build('Task1.c', code, 4000000, libModel);
  const ln = code.split('\n').findIndex(l => /^\s*ones\+\+;/.test(l)) + 1;
  const as = r.debug.lines.filter(x => x[1] === ln).map(x => x[0]).sort((a, b) => a - b);
  assert(as.length, 'ones++ satırı eşlenmedi');
  const c = core(r.hex);
  c.bp.set(as[0]);
  c.runDbg(200000);
  c.P.inA = 0x20; c.runDbg(260000); c.P.inA = 0;
  const hits = [];
  for (let i = 0; i < 4; i++) { const x = c.runDbg(c.P.cyc + 1e6); assert.strictEqual(x.stop, 'bp'); hits.push(c.P.cyc); }
  const d = hits.slice(1).map((x, i) => x - hits[i]);
  assert(d[0] === d[1] && d[1] === d[2], 'periyot sabit değil ' + d);
  return d[0];
}

// Plan G-DLY-TASK1 "< 100 300" sınırı SDCC'nin döngü gövdesi kodunu (10 tur × int i karşılaştırma/artırma,
// RA5/RA6 sınamaları, her erişimde BANKSEL ≈ 51,5 Tcy) hesaba katmıyordu. Gecikmenin kendisi tam 10×10 000;
// ek yük iki kipte de aynı C kodundan gelir: mikroc − 100 000 == eelab − 10 × eelab delay_ms(10).
test('G-DLY-TASK1: ones++ kronometresi — mikroc = 100 000 + döngü ek yükü, eelab 100 605', () => {
  const ex = task1Period('mikroc'), lg = task1Period('eelab');
  const r = build('DlyE10.c', DLY(4e6, '\tPORTB = 3; delay_ms(10); PORTB = 4;'), 4000000, 'eelab');
  const [e10] = delays(r, [[3, 4]], 50000);
  console.log('     Task1 ones++ periyodu: mikroc %d çevrim (döngü ek yükü %d), eelab %d çevrim (eelab delay_ms(10) = %d)', ex, ex - 100000, lg, e10);
  assert.strictEqual(lg, 100605);
  assert.strictEqual(ex - 100000, lg - 10 * e10, 'ek yük iki kipte aynı olmalı');
  assert(ex > 100000 && ex < lg && ex - 100000 < 600, 'mikroc ' + ex);
});

test('G-LCD (mikroc): init ≥16,5 ms, nibble arası 5,5 ms, komut sonrası ≥5,5 ms, veri sonrası ≥50 µs, E ≥1 Tcy', () => {
  const r = build('Lcd_Demo.c', fs.readFileSync(path.join(ROOT, 'projeler', 'Lcd_Demo.c'), 'utf8'), 4000000, 'mikroc');
  const c = core(r.hex), ev = [];
  let prev = c.P.latB, rise = -1;
  while (c.P.cyc < 300000) {
    c.step();
    const v = c.P.latB;
    if (v !== prev) {
      if ((v & 0x20) && !(prev & 0x20)) rise = c.P.cyc;
      if (!(v & 0x20) && (prev & 0x20)) ev.push({ rise, fall: c.P.cyc, rs: (v >> 4) & 1, nib: v & 15 });
      prev = v;
    }
  }
  assert(ev.length > 40, 'E darbesi az: ' + ev.length);
  assert(ev[0].rise >= 16500, 'ilk E ' + ev[0].rise);
  assert.deepStrictEqual(ev.slice(0, 4).map(e => e.nib), [3, 3, 3, 2]);
  for (let i = 0; i < 4; i++) assert(ev[i + 1].rise - ev[i].fall >= 5500, 'init nibble ' + i + ' boşluğu ' + (ev[i + 1].rise - ev[i].fall));
  const bytes = [];
  for (let i = 4; i + 1 < ev.length; i += 2) bytes.push({ v: (ev[i].nib << 4) | ev[i + 1].nib, rs: ev[i].rs, fall: ev[i + 1].fall, next: ev[i + 2] ? ev[i + 2].rise : null });
  assert.deepStrictEqual(bytes.slice(0, 5).map(b => b.v), [0x28, 0x08, 0x01, 0x06, 0x0F]);
  let cmd = 0, dat = 0, minDat = Infinity;
  for (const b of bytes) {
    if (b.next == null) continue;
    const gap = b.next - b.fall;
    if (b.rs) { dat++; assert(gap >= 50, 'veri sonrası ' + gap); minDat = Math.min(minDat, gap); }
    else { cmd++; assert(gap >= 5500, 'komut 0x' + b.v.toString(16) + ' sonrası ' + gap); }
  }
  assert(cmd >= 7 && dat >= 10 && minDat < 5500, 'cmd ' + cmd + ' veri ' + dat);
  const w = Math.min(...ev.map(e => e.fall - e.rise));
  assert(w >= 1, 'E genişliği ' + w);
  console.log('     LCD: ilk E @%d çevrim, %d komut / %d veri baytı, en kısa veri boşluğu %d, E genişliği ≥ %d Tcy', ev[0].rise, cmd, dat, minDat, w);
});

test('G-BAUD: UART1_Init(9600) @4 MHz → 1509 ipucu, SPBRG=25, BRGH=1; 115200 → %8.51', () => {
  const r = build('Baud.c', 'void main() {\n\tUART1_Init(9600);\n\twhile (1) { }\n}\n', 4000000, 'mikroc');
  const h = r.mc.filter(m => m.key === 'baud');
  assert.strictEqual(h.length, 1);
  assert.deepStrictEqual({ type: h[0].type, no: h[0].no, key: h[0].key, args: h[0].args, line: h[0].line }, { type: 'warning', no: 1509, key: 'baud', args: [9615, '0.16'], line: 2 });
  assert.strictEqual(h[0].text, 'Generated baud rate is 9615 bps (error = 0.16 percent)');
  const c = core(r.hex);
  c.run(2000);
  assert.strictEqual(c.mem.read(0x99), 25, 'SPBRG');
  assert.strictEqual((c.mem.read(0x98) >> 2) & 1, 1, 'BRGH');
  const r2 = build('Baud2.c', 'void main() {\n\tUART1_Init(115200);\n\twhile (1) { }\n}\n', 4000000, 'eelab');
  assert.strictEqual(r2.mc.find(m => m.key === 'baud').text, 'Generated baud rate is 125000 bps (error = 8.51 percent)');
});

const CONV = [
  ['LongToStr(-12345, a);', 12, '     -12345'],
  ['ByteToHex(2, a);', 3, '02'],
  ['WordToHex(0x457, a);', 5, '0457'],
  ['IntToStrWithZeros(-42, a);', 7, '-00042'],
  ['ByteToStrWithZeros(7, a);', 4, '007'],
  ['LongWordToStr(4000000000UL, a);', 11, '4000000000'],
  ['LongToStr(2147483647, a);', 12, ' 2147483647'],
  ['ShortToHex(-1, a);', 3, 'FF'],
  ['IntToHex(-16657, a);', 5, 'BEEF'],
  ['WordToStrWithZeros(437, a);', 6, '00437'],
  ['ShortToStrWithZeros(-24, a);', 5, '-024'],   // UNVERIFIED: işaret ilk sütunda (IntToStrWithZeros(-42) ile aynı kural)
  ['IntToStrWithZeros(42, a);', 7, '000042'],    // UNVERIFIED: pozitifte işaret sütunu da sıfır
  ['IntToStr(-4220, a);', 7, ' -4220'],
  ['WordToStr(437, a);', 6, '  437'],
];
test('G-CONV: LongToStr, …Hex, …WithZeros (eelab ve mikroc kipleri)', () => {
  for (const [lm, part] of ['eelab', 'mikroc'].flatMap(lm => [0, 1, 2, 3].map(p => [lm, p]))) {
    const list = CONV.map((x, i) => [x, i]).filter(([, i]) => i % 4 === part);
    const decl = list.map(([x, i]) => 'char s' + i + '[' + x[1] + '];').join('\n');
    const body = list.map(([x, i]) => '\t' + x[0].replace(', a)', ', s' + i + ')')).join('\n');
    const code = decl + '\nunsigned char done = 0;\nvoid main() {\n' + body + '\n\tdone = 1;\n\twhile (1) { }\n}\n';
    const r = build('Conv.c', code, 4000000, lm), c = core(r.hex);
    assert(!(r.messages || []).some(m => /warning/.test(m)), 'uyarı: ' + r.messages);
    const sym = n => { const v = r.debug.symbols.find(s => s.name === n && s.kind === 'var'); assert(v, n + ' sembolü'); return v.addr; };
    const done = sym('done');
    let k = 0;
    while (!c.mem.read(done) && k++ < 400) c.run(c.P.cyc + 10000);
    assert(c.mem.read(done), lm + ': program bitmedi');
    list.forEach(([x, i]) => {
      const a = sym('s' + i);
      let t = '';
      for (let j = 0; j < x[1]; j++) { const b = c.mem.read(a + j); if (!b) break; t += String.fromCharCode(b); }
      assert.strictEqual(t, x[2], lm + ' ' + x[0]);
    });
  }
});

console.log('\nshim_timing_test: %d geçti, %d başarısız', passed, failed);
process.exit(failed ? 1 : 0);
