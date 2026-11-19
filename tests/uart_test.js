const assert = require('assert');
const UART = require('../js/uart.js');

let failed = 0, passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e.message || e).toString().split('\n').slice(0, 24).join('\n     ')); }
}
const ALL = Array.from({ length: 256 }, (_, i) => i);

test('G-UART-ID: decode(encode(0..255)) aynı, ferr=0 (bitCyc 104, 8N1)', () => {
  const e = UART.encode(ALL, { bitCyc: 104 });
  assert.strictEqual(e.end, 256 * 1040);
  const d = UART.decode(e.edges, { bitCyc: 104 });
  assert.deepStrictEqual(d.map(x => x.byte), ALL);
  assert(d.every(x => x.ferr === 0 && x.perr === 0));
  assert.deepStrictEqual(d.slice(0, 3).map(x => x.t), [0, 1040, 2080]);
});

test('G-UART-PPM: 9615 bps (104) ↔ 9600 bps (104.1667) tüm baytlar geçer', () => {
  const r = 1e6 / 9600;
  for (const [a, b] of [[104, r], [r, 104]]) {
    for (const v of ALL) assert.deepStrictEqual(UART.transfer(v, { bitCyc: a }, { bitCyc: b }), [{ byte: v, ferr: 0, perr: 0 }], a + '→' + b + ' bayt ' + v);
    const d = UART.decode(UART.encode(ALL, { bitCyc: a }).edges, { bitCyc: b });
    assert.deepStrictEqual(d.map(x => x.byte), ALL, 'sürekli akış ' + a + '→' + b);
    assert(d.every(x => !x.ferr));
  }
});

test('G-UART-MIS: 0x41 hat şekli ve 104→52 çözümü = [0x06 ferr, 0xFE]', () => {
  const e = UART.encode([0x41], { bitCyc: 104 });
  assert.deepStrictEqual(e.edges, [[0, 0], [104, 1], [208, 0], [728, 1], [832, 0], [936, 1]]);
  assert.strictEqual(e.end, 1040);
  const d = UART.decode(e.edges, { bitCyc: 52 });
  assert.deepStrictEqual(d.map(({ byte, ferr }) => ({ byte, ferr })), [{ byte: 0x06, ferr: 1 }, { byte: 0xFE, ferr: 0 }]);
  assert.deepStrictEqual(d.map(x => x.t), [0, 832]);
  assert.deepStrictEqual(UART.transfer(0x41, { bitCyc: 104 }, { bitCyc: 52 }), [{ byte: 0x06, ferr: 1, perr: 0 }, { byte: 0xFE, ferr: 0, perr: 0 }]);
});

test('G-UART-PAR: 0x41 8E1 → 8E1 perr=0, 8O1 perr=1', () => {
  const e = UART.encode([0x41], { bitCyc: 104, parity: 'EVEN' });
  assert.strictEqual(e.end, 11 * 104);
  assert.deepStrictEqual(e.edges.slice(-2), [[832, 0], [1040, 1]], 'b7=0 ve eşlik=0, sonra dur biti');
  assert.deepStrictEqual(UART.decode(e.edges, { bitCyc: 104, parity: 'EVEN' }).map(({ byte, ferr, perr }) => ({ byte, ferr, perr })), [{ byte: 0x41, ferr: 0, perr: 0 }]);
  assert.deepStrictEqual(UART.decode(e.edges, { bitCyc: 104, parity: 'ODD' }).map(({ byte, ferr, perr }) => ({ byte, ferr, perr })), [{ byte: 0x41, ferr: 0, perr: 1 }]);
  for (const v of ALL) for (const p of ['EVEN', 'ODD']) assert.deepStrictEqual(UART.transfer(v, { bitCyc: 104, parity: p }, { bitCyc: 104, parity: p }), [{ byte: v, ferr: 0, perr: 0 }]);
});

test('Ek: 7 veri biti, 2 dur biti, ters kutup, t0/gap, 9 bit', () => {
  assert.deepStrictEqual(UART.transfer(0xC1, { bitCyc: 10, dataBits: 7 }, { bitCyc: 10, dataBits: 7 }), [{ byte: 0x41, ferr: 0, perr: 0 }]);
  const e2 = UART.encode([1, 2], { bitCyc: 10, stopBits: 2, t0: 5, gap: 3 });
  assert.strictEqual(e2.end, 5 + 2 * (110 + 3));
  assert.deepStrictEqual(UART.decode(e2.edges, { bitCyc: 10 }).map(x => [x.byte, x.t]), [[1, 5], [2, 118]]);
  const ei = UART.encode([0x41], { bitCyc: 10, invert: true });
  assert.deepStrictEqual(ei.edges[0], [0, 1], 'ters kutupta start biti 1');
  assert.deepStrictEqual(UART.decode(ei.edges, { bitCyc: 10, invert: true }).map(x => x.byte), [0x41]);
  assert.deepStrictEqual(UART.decode(ei.edges, { bitCyc: 10 }).map(x => [x.byte, x.ferr]), [[0x5F, 1]], 'kutup uyuşmazlığı bozar');
  assert.deepStrictEqual(UART.transfer(0x41, { bitCyc: 10, dataBits: 9, ninth: 1 }, { bitCyc: 10, dataBits: 9 }).map(x => x.byte), [0x141]);
  assert.deepStrictEqual(UART.transfer(0x41, { bitCyc: 10, dataBits: 9, ninth: 1 }, { bitCyc: 10, dataBits: 8 }), [{ byte: 0x41, ferr: 0, perr: 0 }], '9. bit=1 dur biti gibi okunur');
  assert.deepStrictEqual(UART.transfer(0x41, { bitCyc: 10, dataBits: 9 }, { bitCyc: 10, dataBits: 8 }), [{ byte: 0x41, ferr: 1, perr: 0 }], '9. bit=0 → FERR');
  assert.deepStrictEqual(UART.decode(UART.encode([0x41], { bitCyc: 104 }).edges, { bitCyc: 104, until: 0 }), []);
});

test('Ek: uyuşmaz baud (PIC 19200 → terminal 9600) özgün baytı vermez', () => {
  let same = 0;
  for (const v of ALL) { const r = UART.transfer(v, { bitCyc: 52 }, { bitCyc: 1e6 / 9600 }); if (r.length === 1 && r[0].byte === v && !r[0].ferr) same++; }
  assert(same < 8, 'doğru geçen ' + same);
});

console.log('\n' + passed + ' geçti, ' + failed + ' başarısız');
process.exit(failed ? 1 : 0);
