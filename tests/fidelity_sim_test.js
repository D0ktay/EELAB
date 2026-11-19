const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const LIB = require('../js/library.js'), SIM = require('../js/sim.js');
const hasUart = fs.existsSync(path.join(ROOT, 'js/uart.js'));
const UART = hasUart ? require('../js/uart.js') : null;

let failed = 0, passed = 0, skipped = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e.stack || e).toString().split('\n').slice(0, 4).join('\n     ')); }
}
const skip = (name, why) => { skipped++; console.log('skip ' + name + ' (' + why + ')'); };
const Q = (id, type, value, extra) => Object.assign({ id, type, x: 0, y: 0, rot: 0, value: value == null ? LIB.types[type].defaultValue || '' : value }, extra || {});
function mk(parts, nets) {
  SIM.layout(parts, LIB, 1400);
  const r = SIM.route({ parts, nets }, LIB);
  assert.deepStrictEqual(r.warnings, [], 'yönlendirme');
  return { version: 1, parts, wires: r.wires };
}
const loadC = n => JSON.parse(fs.readFileSync(path.join(ROOT, 'circuits', n + '.json'), 'utf8'));
const TERM = (run, id) => run.term[id || 'VT1'];

test('Terminal varsayılanları = [DSN] ROOT.DSN (9600 8N1, XON/XOFF 0, normal polarite) ve kısmi alanlar normalize edilir', () => {
  assert.deepStrictEqual(LIB.termCfg({}), { baud: 9600, dataBits: 8, parity: 'NONE', stopBits: 1, xonxoff: 0, sigPol: 0, ctlPol: 0 });
  assert.deepStrictEqual(LIB.termCfg({ baud: '19200', dataBits: 7, parity: 'even', stopBits: 2, xonxoff: 1, sigPol: 1 }),
    { baud: 19200, dataBits: 7, parity: 'EVEN', stopBits: 2, xonxoff: 1, sigPol: 1, ctlPol: 0 });
  assert.deepStrictEqual(LIB.termCfg({ dataBits: 9, parity: 'MARK', stopBits: 3 }).parity, 'NONE');
  const m = SIM.compile(loadC('uart_demo'), LIB);
  assert.strictEqual(m.term[0].cfg.baud, 9600);
});

test('termPut: CR = yeni satır, LF ve diğer kontrol kodları (<0x20) yok sayılır, BS siler, BEL yanıp söner', () => {
  const run = new SIM.Runner(SIM.compile(loadC('uart_demo'), LIB)), s = TERM(run);
  for (const ch of 'A\nB\r') run.termPut(s, ch.charCodeAt(0));
  assert.strictEqual(s.text, 'AB\n', 'AB + yeni satır; LF görünmez');
  for (const b of [10, 9, 12, 0, 27, 31]) run.termPut(s, b);
  assert.strictEqual(s.text, 'AB\n', 'TAB/FF/ESC… yok sayılır');
  run.termPut(s, 67); run.termPut(s, 8); assert.strictEqual(s.text, 'AB\n', 'BS son harfi siler');
  run.termPut(s, 8); assert.strictEqual(s.text, 'AB\n', 'satır başında BS bir şey silmez');
  assert.strictEqual(s.bell, 0); run.termPut(s, 7); assert.strictEqual(s.bell, 1);
  assert.strictEqual(run.state(loadC('uart_demo').parts.find(p => p.id === 'VT1'), run.res).bell, 1);
});

test('Terminal sağ-tık menüsü komutları: Clear Screen, Pause (tutulan baytlar sürdürünce yazılır), Hex Display Mode, Echo Typed Characters, Paste', () => {
  const c = loadC('uart_demo'), run = new SIM.Runner(SIM.compile(c, LIB)), s = TERM(run), vt = c.parts.find(p => p.id === 'VT1');
  for (const ch of 'Hi') run.termPut(s, ch.charCodeAt(0));
  assert.deepStrictEqual(run.termInfo('VT1'), { paused: false, hex: false, echo: false });
  run.termCmd('VT1', 'hex');
  assert.strictEqual(run.state(vt, run.res).text, '48 69 ', 'Hex Display Mode: 41 gibi');
  assert.strictEqual(run.termText('VT1'), '48 69 ');
  run.termCmd('VT1', 'hex');
  run.termCmd('VT1', 'pause'); run.termPut(s, 33);
  assert.strictEqual(s.text, 'Hi', 'duraklatılmışken görünmez'); run.termCmd('VT1', 'pause');
  assert.strictEqual(s.text, 'Hi!', 'sürdürünce tutulan baytlar yazılır');
  run.termCmd('VT1', 'clear'); assert.strictEqual(s.text, '');
  run.termKey('VT1', 'a'); assert.strictEqual(s.text, '', 'varsayılan: yazılan karakterler yankılanmaz');
  run.termCmd('VT1', 'echo'); run.termKey('VT1', 'b'); assert.strictEqual(s.text, 'b');
  assert.strictEqual(run.termPaste('VT1', 'xy\r\nz'), 4, 'CRLF tek satır sonu olarak yapıştırılır');
  s.q.length = 0; run.termPaste('VT1', 'q\n'); assert.deepStrictEqual(s.q, [113, 13], 'LF → CR');
});

if (UART) {
  const fr = (bitCyc, dataBits) => ({ bitCyc, dataBits: dataBits || 8 });
  test('uartTx(frame): eşleşen baud (PIC 9615 ≈ terminal 9600) bayt aynen; uyuşmazlık (PIC 19200, terminal 9600) çöp üretir, orijinal bayt değil', () => {
    const c = loadC('uart_demo'), mkRun = () => { const r = new SIM.Runner(SIM.compile(c, LIB)); r.setClock(4e6); return r; };
    const ok = mkRun(); for (const ch of 'EE321') ok.uartTx(ch.charCodeAt(0), 0, fr(104));
    assert.strictEqual(TERM(ok).text, 'EE321', 'G-UART-PPM: 104 çevrim ↔ 104,1667');
    const bad = mkRun();
    assert.strictEqual(bad.uartTx(0x41, 0, fr(52)), true, 'terminale bağlı');
    const want = UART.transfer(0x41, { bitCyc: 52, dataBits: 8 }, { bitCyc: 4e6 / 4 / 9600, dataBits: 8, parity: 'NONE', stopBits: 1, invert: false });
    const exp = mkRun(); for (const r of want) exp.termPut(TERM(exp), r.byte);
    assert.strictEqual(TERM(bad).text, TERM(exp).text, 'UART.transfer sonucu ile aynı');
    assert.notStrictEqual(TERM(bad).text, 'A');
    const old = mkRun(); old.uartTx(0x41, 0); assert.strictEqual(TERM(old).text, 'A', '2 argümanlı eski yol bayt aynen');
  });
  test('uartTx(frame): terminalin baud/parite/veri biti/ters polarite ayarları sonucu belirler', () => {
    const base = loadC('uart_demo'), run = (props, bit, byte) => {
      const c = JSON.parse(JSON.stringify(base)); Object.assign(c.parts.find(p => p.id === 'VT1'), props);
      const r = new SIM.Runner(SIM.compile(c, LIB)); r.setClock(4e6); r.uartTx(byte || 0x55, 0, fr(bit)); return TERM(r).text;
    };
    assert.strictEqual(run({ baud: 19200 }, 52), 'U', 'terminal 19200 ↔ PIC 19231');
    assert.notStrictEqual(run({ baud: 19200 }, 104), 'U', 'terminal 19200, PIC 9600');
    assert.strictEqual(run({ baud: 4800 }, 208), 'U');
    assert.notStrictEqual(run({ sigPol: 1 }, 104, 0x41), 'A', 'ters polarite');
    assert.strictEqual(run({ stopBits: 2 }, 104), 'U');
    assert.strictEqual(run({ parity: 'EVEN' }, 104), 'U', 'PIC 8N1 → terminal 8E1: veri baytı aynen (parite hatası yalnız bayrak)');
  });
  test('uartRx(picCfg): {byte, ferr}; eski uartRx() çıplak sayı; terminal 8E1 → PIC 8N1 çerçeve hatası; uyuşmazlık ≠ orijinal', () => {
    const base = loadC('uart_demo');
    const mkRun = props => { const c = JSON.parse(JSON.stringify(base)); Object.assign(c.parts.find(p => p.id === 'VT1'), props || {}); const r = new SIM.Runner(SIM.compile(c, LIB)); r.setClock(4e6); return r; };
    const r0 = mkRun(); r0.termKey('VT1', 'a'); r0.termKey('VT1', 'b');
    assert.deepStrictEqual(r0.uartRx(), 97, 'eski çağrı: çıplak sayı'); assert.strictEqual(r0.uartRx({ bitCyc: 104 }) && 0, 0);
    const r1 = mkRun(); r1.termKey('VT1', 'A');
    assert.deepStrictEqual(r1.uartRx({ bitCyc: 104, dataBits: 8 }), { byte: 65, ferr: 0 });
    assert.strictEqual(r1.uartRx({ bitCyc: 104 }), null, 'kuyruk boş');
    const r2 = mkRun({ parity: 'EVEN' }); r2.termKey('VT1', 'A');
    assert.deepStrictEqual(r2.uartRx({ bitCyc: 104, dataBits: 8 }), { byte: 65, ferr: 1 }, '0x41 çift parite biti 0 → PIC onu duruş biti gibi okur: 0 → FERR');
  });
  test('uartRx(picCfg): terminal 9600, PIC 19200 → bayt bozulur ya da düşer', () => {
    const c = loadC('uart_demo'), r = new SIM.Runner(SIM.compile(c, LIB)); r.setClock(4e6);
    r.termKey('VT1', 'A');
    const got = r.uartRx({ bitCyc: 52, dataBits: 8 });
    assert(got === null || got.byte !== 65 || got.ferr === 1, JSON.stringify(got));
  });
} else skip('UART biçim/baud testleri', 'js/uart.js yok');

test('pinLevel(id, pin): MCLR (U1 pin 4) boşta 2, LOGICSTATE ile 1/0', () => {
  const c = mk([Q('U1', 'PIC16F628A'), Q('L1', 'LOGICSTATE')], [['U1.4', 'L1.1']]);
  const run = new SIM.Runner(SIM.compile(c, LIB));
  assert.strictEqual(run.pinLevel('U1', 4), 0, 'LOGICSTATE 0');
  run.press('L1', true); assert.strictEqual(run.pinLevel('U1', 4), 1);
  const c2 = mk([Q('U1', 'PIC16F628A')], []);
  assert.strictEqual(new SIM.Runner(SIM.compile(c2, LIB)).pinLevel('U1', 4), 2, 'bağlantısız → boşta');
  assert.strictEqual(run.pinLevel('U9', 4), 2);
});

// LCD busy: lcd_demo (RS=RB4 EN=RB5 D4..D7=RB0..RB3)
function lcdRig(props, fosc) {
  const c = loadC('lcd_demo'); Object.assign(c.parts.find(p => p.id === 'LCD1'), props || {});
  const run = new SIM.Runner(SIM.compile(c, LIB)); if (fosc) run.setClock(fosc);
  const put = (cyc, rs, byte) => {
    for (const [k, n] of [[0, byte >> 4], [3, byte & 15]]) { const b = (rs ? 0x10 : 0) | n; run.port(0xFF, 0, 0, b, cyc + k); run.port(0xFF, 0, 0, b | 0x20, cyc + k + 1); run.port(0xFF, 0, 0, b, cyc + k + 2); }
    return cyc + 5;
  };
  const init = () => { let t = 100000; for (const n of [3, 3, 3, 2]) { for (const e of [0, 0x20, 0]) run.port(0xFF, 0, 0, n | e, t += 3); t += 20000; } for (const b of [0x28, 0x0C, 0x06]) { put(t, 0, b); t += 20000; } run.warnings(); return t; };
  return { run, put, init };
}
test('LCD meşgul (C18): 4 MHz\'de iki komut 20 µs arayla → 1 uyarı, 50 µs arayla → 0; yine de çalıştırılır', () => {
  const r = lcdRig(); let t = r.init();
  r.put(t, 0, 0x80); r.put(t + 20, 0, 0xC0);
  const w = r.run.warnings();
  assert.strictEqual(w.length, 1);
  assert.deepStrictEqual([w[0].mod, w[0].id, w[0].text], ['LM016L', 'LCD1', 'Controller received command whilst busy.']);
  assert(w[0].cyc >= t + 20, 'cyc');
  assert.deepStrictEqual(r.run.warnings(), [], 'warnings() boşaltır');
  t += 20000; r.put(t, 0, 0x80); r.put(t + 50, 0, 0xC0);
  assert.deepStrictEqual(r.run.warnings(), []);
  t += 20000; r.put(t, 1, 65); r.put(t + 20, 1, 66);
  assert.strictEqual(r.run.warnings()[0].text, 'Controller received data whilst busy.');
  const lp = loadC('lcd_demo').parts.find(p => p.id === 'LCD1');
  t += 20000; r.put(t, 0, 0x01); r.put(t + 60, 0, 0x80); r.run.warnings();
  r.put(t + 100, 1, 90);
  assert.strictEqual(r.run.state(lp, r.run.frame(t + 200)).lcd.lines[0].indexOf('Z') >= 0, true, 'meşgulken gelen veri yine de yazılır (demolar bozulmasın)');
});
test('LCD meşgul: Clear/Home 1,64 ms (4 MHz\'de 1640 çevrim); 8 MHz ve LCD CLOCK özelliği zamanı ölçekler', () => {
  let r = lcdRig(), t = r.init();
  r.put(t, 0, 0x01); r.put(t + 1500, 0, 0x80);
  assert.strictEqual(r.run.warnings().length, 1, '1500 çevrim < 1640');
  t += 20000; r.put(t, 0, 0x02); r.put(t + 1700, 0, 0x80);
  assert.strictEqual(r.run.warnings().length, 0, '1700 çevrim > 1640');
  r = lcdRig({}, 8e6); t = r.init();
  r.put(t, 0, 0x80); r.put(t + 60, 0, 0x80);
  assert.strictEqual(r.run.warnings().length, 1, '8 MHz: 40 µs = 80 çevrim; 60 < 80');
  r = lcdRig({}, 8e6); t = r.init(); r.put(t, 0, 0x80); r.put(t + 100, 0, 0x80);
  assert.strictEqual(r.run.warnings().length, 0);
  r = lcdRig({ clock: '125kHz' }); t = r.init();
  r.put(t, 0, 0x80); r.put(t + 60, 0, 0x80);
  assert.strictEqual(r.run.warnings().length, 1, 'CLOCK=125kHz → 80 µs');
  r = lcdRig({ clock: '125kHz' }); t = r.init(); r.put(t, 0, 0x80); r.put(t + 100, 0, 0x80);
  assert.strictEqual(r.run.warnings().length, 0);
});

// 7-seg / LED minimum trigger time
function ledRig(props) {
  const c = mk([Q('U1', 'PIC16F628A'), Q('D1', 'LED-RED', '', props), Q('G', 'GROUND')], [['U1.17', 'D1.A'], ['D1.K', 'G.1']]);
  const run = new SIM.Runner(SIM.compile(c, LIB));
  return { run, led: on => on ? 1 : 0, set: (on, cyc) => run.port(0xFE, on ? 1 : 0, 0xFF, 0, cyc), lit: cyc => run.frame(cyc).lit.D1.ON };
}
test('TTRIGMIN (C17): 0,5 ms parazit yanmaz, 2 ms darbe yanar; mux4_demo 4 hane görünür', () => {
  const r = ledRig();
  r.set(false, 100000);
  r.set(true, 200000); r.set(false, 200500);
  assert.strictEqual(r.lit(200800), false, '0,5 ms parazit');
  r.set(true, 300000);
  assert.strictEqual(r.lit(300300), false, 'darbe sürerken ama < 1 ms');
  r.set(false, 300000 + 2000);
  assert.strictEqual(r.lit(303000), true, '2 ms darbe');
  r.set(true, 400000);
  assert.strictEqual(r.lit(400100), false); assert.strictEqual(r.lit(400100), true, 'sim ilerlemezken (duraklatma/adım) mevcut durum gösterilir');
  assert.strictEqual(r.lit(401500), true, '1,5 ms sürekli yanık');
  r.set(false, 500000);
  const s = ledRig({ ttrigmin: '200u' });
  s.set(false, 100000); s.set(true, 200000); s.set(false, 200500);
  assert.strictEqual(s.lit(200800), true, 'ttrigmin=200u → 0,5 ms yeterli');
  const f = ledRig(); f.set(true, 0);
  assert.strictEqual(f.lit(100), true, 'simülasyon başında (t < TTRIGMIN) süzme yok');
  const c = loadC('mux4_demo'), m = SIM.compile(c, LIB);
  assert.strictEqual(m.tt.DS1, 0.001);
});

test('LIB.editFields: PIC/Terminal/LCD/7SEG alanları, doğrulama ve varsayılan temizliği', () => {
  const pic = { id: 'U1', type: 'PIC16F628A' }, f = LIB.editFields(pic, { projectClockHz: 8e6 });
  assert.deepStrictEqual(f.map(x => x.key), ['clock', 'cfgword', 'wdtPeriod', 'eeDelay', 'eeBin', 'randDmem', 'startDelay']);
  assert.strictEqual(f[0].value, '8MHz', 'yeni PIC parçası proje saatini alır (D4)');
  assert.strictEqual(LIB.editFields(Object.assign({ clock: '4MHz' }, pic), { projectClockHz: 8e6 })[0].value, '4MHz', 'parça özelliği kazanır');
  for (const [raw, ok] of [['4MHz', 1], ['32.768kHz', 1], ['20MHz', 1], ['31kHz', 0], ['21MHz', 0], ['abc', 0], ['', 0]]) assert.strictEqual(!!f[0].validate(raw).ok, !!ok, raw);
  assert.strictEqual(f[0].validate('32768').value, '32.768kHz');
  assert.strictEqual(f[1].validate('3f6b').ok, false, 'onaltılık için 0x gerekir'); assert.strictEqual(f[1].validate('0x3f6b').value, '0x3F6B'); assert.strictEqual(f[1].validate('').value, '');
  assert.strictEqual(f[1].validate('0x4000').ok, false);
  assert.strictEqual(f[2].validate('33m').value, '33m'); assert.strictEqual(f[3].validate('4m').value, '4m');
  const part = Object.assign({}, pic);
  LIB.applyField(part, f[0], '4MHz'); assert.strictEqual(part.clock, '4MHz');
  LIB.applyField(part, f[2], '18m'); assert.strictEqual(part.wdtPeriod, undefined, 'varsayılan değer saklanmaz');
  LIB.applyField(part, f[2], '33m'); LIB.applyField(part, f[3], '4m');
  assert.deepStrictEqual(LIB.picProps(part), { clockHz: 4e6, clockSet: true, cfgword: null, wdtPeriod: 0.033, eeWriteDelay: 0.004, eeBin: null });
  assert.deepStrictEqual(LIB.picProps({}, 8e6), { clockHz: 8e6, clockSet: false, cfgword: null, wdtPeriod: 0.018, eeWriteDelay: 0.01, eeBin: null }, 'Proteus varsayılanları');
  assert.deepStrictEqual(Array.from(LIB.picProps({ eeBinB64: Buffer.from([1, 2, 255]).toString('base64') }).eeBin), [1, 2, 255]);
  const vt = { id: 'VT1', type: 'VIRTUAL-TERMINAL' }, g = LIB.editFields(vt);
  assert.deepStrictEqual(g.map(x => x.label), ['Baud Rate:', 'Data Bits:', 'Parity:', 'Stop Bits:', 'Send XON/XOFF:', 'RX/TX Polarity:', 'RTS/CTS Polarity:']);
  assert.deepStrictEqual(g[0].combo, ['110', '300', '1200', '2400', '4800', '9600', '19200', '38400', '57600']);
  assert.strictEqual(g.filter(x => x.advanced).length, 2);
  LIB.applyField(vt, g[0], '19200'); LIB.applyField(vt, g[2], 'ODD'); LIB.applyField(vt, g[5], '1');
  assert.deepStrictEqual([vt.baud, vt.parity, vt.sigPol], [19200, 'ODD', 1]);
  assert.strictEqual(LIB.applyField(vt, g[0], 'fast').ok, false);
  LIB.applyField(vt, g[0], '9600'); assert.strictEqual('baud' in vt, false, 'varsayılana dönünce alan silinir');
  assert.deepStrictEqual(LIB.editFields({ type: 'LM016L' }).map(x => x.value), ['250kHz']);
  assert.deepStrictEqual(LIB.editFields({ type: '7SEG-MPX4-CC' }).map(x => x.value), ['1ms']);
  assert.deepStrictEqual(LIB.editFields({ type: 'RES' }), []);
});

console.log('\n' + passed + ' geçti, ' + failed + ' başarısız' + (skipped ? ', ' + skipped + ' atlandı' : ''));
process.exit(failed ? 1 : 0);
