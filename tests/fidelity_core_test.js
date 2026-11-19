const assert = require('assert'), fs = require('fs'), path = require('path');
const PIC = require('../js/pic.js');
const UART = require('../js/uart.js');

let failed = 0, passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e.stack || e).toString().split('\n').slice(0, 12).join('\n     ')); }
}

const NOP = 0, CLRW = 0x0100, RETURN = 0x0008, RETFIE = 0x0009, SLEEP = 0x0063, CLRWDT = 0x0064;
const MOVLW = k => 0x3000 | k, ADDLW = k => 0x3E00 | k, SUBLW = k => 0x3C00 | k, RETLW = k => 0x3400 | k;
const MOVWF = f => 0x0080 | f, CLRF = f => 0x0180 | f;
const bo = h => (f, d) => (h << 8) | (d ? 0x80 : 0) | f;
const MOVF = bo(0x08), ADDWF = bo(0x07), DECFSZ = bo(0x0B), INCFSZ = bo(0x0F), RLF = bo(0x0D), INCF = bo(0x0A);
const bb = h => (f, b) => (h << 8) | (b << 7) | f;
const BCF = bb(0x10), BSF = bb(0x14), BTFSC = bb(0x18), BTFSS = bb(0x1C);
const GOTO = a => 0x2800 | a, CALL = a => 0x2000 | a;
const STATUS = 3, TMR0 = 1, PCL = 2, FSR = 4, PORTA = 5, PORTB = 6, PCLATH = 0x0A, INTCON = 0x0B, PIR1 = 0x0C, TMR1L = 0x0E, TMR1H = 0x0F, T1CON = 0x10,
  TMR2 = 0x11, T2CON = 0x12, CCPR1L = 0x15, CCPR1H = 0x16, CCP1CON = 0x17, RCSTA = 0x18, TXREG = 0x19, RCREG = 0x1A, CMCON = 0x1F;
const OPTION = 1, TRISA = 5, TRISB = 6, PIE1 = 0x0C, PCON = 0x0E, PR2 = 0x12, TXSTA = 0x18, SPBRG = 0x19, EEDATA = 0x1A, EEADR = 0x1B, EECON1 = 0x1C, EECON2 = 0x1D, VRCON = 0x1F;
const B1 = BSF(STATUS, 5), B0 = BCF(STATUS, 5);

function core(code, o) {
  o = o || {};
  const prog = new Uint16Array(2048).fill(0x3FFF);
  code.forEach((w, i) => { prog[i] = w; });
  for (const [a, ws] of (o.at || [])) ws.forEach((w, i) => { prog[a + i] = w; });
  const warns = [];
  const c = PIC.create(Object.assign({ onWarn: w => warns.push(w) }, o.opts || {}));
  c.load({ prog, cfg: o.cfg === undefined ? null : o.cfg, ee: o.ee });
  if (o.fosc) c.P.fosc = o.fosc;
  c.reset();
  c.warns = warns;
  c.prog = prog;
  return c;
}
const R = c => c.P.ram;
const steps = (c, n) => { for (let i = 0; i < n; i++) c.step(); };
const toPc = (c, pc, lim) => { lim = lim || 1e6; while (c.P.pc !== pc && lim--) c.step(); assert(lim > 0, 'PC ' + pc + ' erişilmedi'); };
const sled = (c, from) => { for (let a = from; a < 2048; a++) c.prog[a] = NOP; };
const runNop = (c, end, back) => { while (c.P.cyc < end) { if (c.P.pc >= 0x7F0) c.P.pc = back; c.step(); } };
function cyc1(code, setup, pre) {
  const c = core(code);
  if (setup) setup(c);
  steps(c, pre || 0);
  c.P.cyc = 0; c.step();
  return c.P.cyc;
}

test('G-CYC: komut başına çevrim', () => {
  const T = [
    ['NOP', [NOP], 1], ['MOVLW', [MOVLW(5)], 1], ['ADDLW', [ADDLW(5)], 1], ['MOVWF 0x20', [MOVWF(0x20)], 1], ['BSF 0x20,0', [BSF(0x20, 0)], 1],
    ['GOTO', [GOTO(5)], 2], ['CALL', [CALL(5)], 2],
    ['RETURN', [CALL(2), NOP, RETURN], 2, 1], ['RETLW', [CALL(2), NOP, RETLW(7)], 2, 1], ['RETFIE', [CALL(2), NOP, RETFIE], 2, 1],
    ['MOVWF PCL', [MOVLW(9), MOVWF(PCL)], 2, 1], ['ADDWF PCL,F', [MOVLW(3), ADDWF(PCL, 1)], 2, 1], ['BSF PCL,0', [NOP, NOP, BSF(PCL, 0)], 2, 2]
  ];
  for (const [n, code, want, pre] of T) assert.strictEqual(cyc1(code, null, pre), want, n);
  const sk = (op, v) => cyc1([op], c => { R(c)[0x20] = v; });
  assert.strictEqual(sk(DECFSZ(0x20, 1), 2), 1, 'DECFSZ ≠0'); assert.strictEqual(sk(DECFSZ(0x20, 1), 1), 2, 'DECFSZ =0');
  assert.strictEqual(sk(INCFSZ(0x20, 1), 5), 1, 'INCFSZ ≠0'); assert.strictEqual(sk(INCFSZ(0x20, 1), 255), 2, 'INCFSZ =0');
  assert.strictEqual(sk(BTFSC(0x20, 3), 8), 1, 'BTFSC bit=1'); assert.strictEqual(sk(BTFSC(0x20, 3), 0), 2, 'BTFSC bit=0');
  assert.strictEqual(sk(BTFSS(0x20, 3), 0), 1, 'BTFSS bit=0'); assert.strictEqual(sk(BTFSS(0x20, 3), 8), 2, 'BTFSS bit=1');
});

test('G-FLAG: durum bitleri', () => {
  let c = core([MOVLW(0xFF), ADDLW(1)]); steps(c, 2);
  assert.strictEqual(c.P.w, 0); assert.strictEqual(R(c)[3] & 7, 7, 'ADDLW C=1 DC=1 Z=1');
  c = core([MOVLW(5), SUBLW(5)]); steps(c, 2);
  assert.strictEqual(R(c)[3] & 5, 5, 'SUBLW 5-5: C=1 Z=1');
  c = core([MOVLW(6), SUBLW(5)]); steps(c, 2);
  assert.strictEqual(c.P.w, 0xFF); assert.strictEqual(R(c)[3] & 5, 0, 'SUBLW 5-6: C=0 Z=0');
  for (const z of [0, 4]) {
    c = core([BSF(STATUS, 0), RLF(0x20, 1)]); R(c)[0x20] = 0x80; c.step(); R(c)[3] = (R(c)[3] & ~4) | z; c.step();
    assert.strictEqual(R(c)[0x20], 0x01); assert.strictEqual(R(c)[3] & 1, 1, 'RLF C=1'); assert.strictEqual(R(c)[3] & 4, z, 'RLF Z değişmez');
  }
  c = core([MOVLW(3), CLRW]); steps(c, 2);
  assert.strictEqual(c.P.w, 0); assert(R(c)[3] & 4, 'CLRW Z=1');
  c = core([SLEEP]); R(c)[3] &= ~0x10; c.step();
  assert.strictEqual(R(c)[3] & 0x18, 0x10, 'SLEEP TO=1 PD=0');
  c = core([CLRWDT]); R(c)[3] &= ~0x18; c.step();
  assert.strictEqual(R(c)[3] & 0x18, 0x18, 'CLRWDT TO=1 PD=1');
});

test('G-T0: TMR0 yazımı 2 Tcy sayımı durdurur (PSA=1) → 0x10,0x10,0x10,0x11,0x12', () => {
  // UNVERIFIED (DS33023 Fig. 11-2 not checked): pins today's behaviour.
  const c = core([B1, MOVLW(0x08), MOVWF(OPTION), B0, MOVLW(0x10), MOVWF(TMR0), MOVF(TMR0, 0), MOVF(TMR0, 0), MOVF(TMR0, 0), MOVF(TMR0, 0), MOVF(TMR0, 0)]);
  steps(c, 6);
  const w = []; for (let i = 0; i < 5; i++) { c.step(); w.push(c.P.w); }
  assert.deepStrictEqual(w, [0x10, 0x10, 0x10, 0x11, 0x12]);
});

test('G-T0P: TMR0 yazımı ön bölücüyü siler (1:256), +255 → 0, +258 → 1', () => {
  const c = core([B1, MOVLW(0x07), MOVWF(OPTION), B0]);
  sled(c, 4); steps(c, 4 + 100);
  R(c)[0x20] = 0; c.prog[c.P.pc] = CLRF(TMR0); c.step();
  for (let i = 1; i <= 258; i++) {
    c.step();
    if (i === 255 || i === 257) assert.strictEqual(R(c)[1], 0, '+' + i);
    if (i === 258) assert.strictEqual(R(c)[1], 1, '+258');
  }
});

test('G-T1P: TMR1L yazımı TMR1 ön bölücüsünü siler (1:8)', () => {
  for (const reg of [TMR1L, TMR1H]) {
    const c = core([MOVLW(0x31), MOVWF(T1CON), NOP, NOP, NOP, NOP, NOP, CLRF(reg)]);
    sled(c, 8); steps(c, 8);
    assert.strictEqual(R(c)[TMR1L], 0);
    steps(c, 7); assert.strictEqual(R(c)[TMR1L], 0, '7 NOP sonra 0');
    c.step(); assert.strictEqual(R(c)[TMR1L], 1, '8. NOP sonra 1');
    steps(c, 8); assert.strictEqual(R(c)[TMR1L], 2);
  }
});

function pwmCore(duty, t2con) {
  const ev = [];
  let c, last = 0;
  c = core([B1, MOVLW(199), MOVWF(PR2), BCF(TRISB, 3), B0, MOVLW(duty), MOVWF(CCPR1L), MOVLW(0x0C), MOVWF(CCP1CON), MOVLW(t2con || 0x04), MOVWF(T2CON), GOTO(11)],
    { opts: { onPort: () => { const v = (c.pinsB() >> 3) & 1; if (v !== last) { last = v; ev.push([c.P.cyc, v]); } } } });
  return { c, ev };
}
test('G-PWM: PR2=199 1:1 → periyot 200 Tcy, CCPR1L=100 → 100 Tcy yüksek; kenar durumları', () => {
  let { c, ev } = pwmCore(100);
  c.run(5000);
  const rise = ev.filter(e => e[1]).map(e => e[0]), fall = ev.filter(e => !e[1]).map(e => e[0]);
  assert(rise.length >= 20);
  assert(rise.slice(1).every((t, i) => t - rise[i] === 200), 'periyot ' + [...new Set(rise.slice(1).map((t, i) => t - rise[i]))]);
  assert(rise.every((t, i) => fall[i] - t === 100), 'yüksek süre ' + [...new Set(rise.map((t, i) => fall[i] - t))]);
  ({ c, ev } = pwmCore(0)); c.run(5000);
  assert.strictEqual(ev.length, 0, 'duty 0 → RB3 hiç yükselmez');
  ({ c, ev } = pwmCore(250)); c.run(5000);
  assert.deepStrictEqual(ev.map(e => e[1]), [1], 'duty ≥ periyot → hiç düşmez');
  ({ c, ev } = pwmCore(100, 0x7C)); c.run(5000);
  const r2 = ev.filter(e => e[1]).map(e => e[0]);
  assert(r2.slice(1).every((t, i) => t - r2[i] === 200), 'son bölücü 1:16 PWM periyodunu değiştirmez');
  ({ c, ev } = pwmCore(100)); c.run(1000);
  const r0 = ev.filter(e => e[1]).pop()[0];
  c.run(r0 + 50); c.mem.write(0x15, 150); c.run(r0 + 1000);
  const hs = []; for (let i = 0; i < ev.length - 1; i++) if (ev[i][1] && ev[i][0] >= r0) hs.push(ev[i + 1][0] - ev[i][0]);
  assert.deepStrictEqual(hs.slice(0, 3), [100, 150, 150], 'görev değişimi bir sonraki periyotta');
});

test('G-UART-TX: SPBRG=25 BRGH=1 → 104 Tcy/bit, çerçeve 1040; onUartTx 3. argüman; hat UART.decode ile çözülür', () => {
  const tx = [], edges = [];
  let c, lv = 1;
  c = core([B1, MOVLW(25), MOVWF(SPBRG), MOVLW(0x24), MOVWF(TXSTA), B0, MOVLW(0x90), MOVWF(RCSTA), MOVLW(0x41), MOVWF(TXREG), MOVLW(0x5A), MOVWF(TXREG), GOTO(12)],
    { opts: { onUartTx: (b, t, f) => tx.push([b, t, f]), onPort: () => { const v = (c.drive()[3] >> 2) & 1; if (v !== lv) { lv = v; edges.push([c.P.cyc, v]); } } } });
  steps(c, 10);
  const w = c.P.cyc;
  c.run(5000);
  assert.deepStrictEqual(tx.map(x => x[0]), [0x41, 0x5A]);
  assert.strictEqual(tx[0][1] - w, 1041, 'TXREG yazımından sonraki çevrimde başlar + 1040');
  assert.strictEqual(tx[1][1] - tx[0][1], 1040);
  assert.deepStrictEqual(tx[0][2], { bitCyc: 104, dataBits: 8, ninth: 0 });
  assert.deepStrictEqual(UART.decode(edges, { bitCyc: 104 }).map(x => [x.byte, x.ferr]), [[0x41, 0], [0x5A, 0]]);
  assert.deepStrictEqual(UART.decode(edges, { bitCyc: 1e6 / 9600 }).map(x => x.byte), [0x41, 0x5A], 'terminal 9600');
});

test('K-F1 RX: rxPush(byte, {ferr}) RCSTA.FERR baytla birlikte tamponlanır', () => {
  const c = core([B1, MOVLW(25), MOVWF(SPBRG), MOVLW(0x24), MOVWF(TXSTA), B0, MOVLW(0x90), MOVWF(RCSTA), GOTO(8)], { at: [[0x30, [MOVF(RCREG, 0), GOTO(0x31)]]] });
  c.run(20);
  c.rxPush(0x41, { ferr: 1 }); c.rxPush(0x42);
  c.run(20 + 2 * 1040 + 40);
  assert(R(c)[PIR1] & 0x20, 'RCIF');
  assert.strictEqual(R(c)[RCSTA] & 4, 4, 'FERR (ilk bayt)');
  c.P.pc = 0x30; c.step();
  assert.strictEqual(c.P.w, 0x41);
  assert.strictEqual(R(c)[RCSTA] & 4, 0, 'okumadan sonra ikinci baytın FERR değeri');
  c.P.pc = 0x30; c.step();
  assert.strictEqual(c.P.w, 0x42);
  assert.strictEqual(R(c)[PIR1] & 0x20, 0);
});

test('G-INT: T0IF kurulduktan 2 çevrim sonra PC=0x0004 (3. Tcy ISR ilk komutu)', () => {
  // DS Fig. 14-15: flag cycle + 2 dummy cycles; measured value pinned: 2.
  const c = core([GOTO(0x10)], { at: [[4, [NOP, GOTO(5)]], [0x10, [B1, MOVLW(0x08), MOVWF(OPTION), B0, MOVLW(0xFD), MOVWF(TMR0), MOVLW(0xA0), MOVWF(INTCON)]]] });
  sled(c, 0x18);
  let tf = -1;
  while (c.P.pc !== 4) { c.step(); if (tf < 0 && (R(c)[INTCON] & 4)) tf = c.P.cyc; assert(c.P.cyc < 1000); }
  assert(tf > 0);
  assert.strictEqual(c.P.cyc - tf, 2);
  assert.strictEqual(R(c)[INTCON] & 0x80, 0, 'GIE silindi');
});

test('G-CMP: CMCON=0 iken BSF PORTA,0 + BSF PORTA,1 → mandal 0x02; CMCON=7 → 0x03', () => {
  let c = core([B1, CLRF(TRISA), B0, BSF(PORTA, 0), BSF(PORTA, 1)]); steps(c, 5);
  assert.strictEqual(c.P.latA, 0x02);
  c = core([MOVLW(7), MOVWF(CMCON), B1, CLRF(TRISA), B0, BSF(PORTA, 0), BSF(PORTA, 1)]); steps(c, 7);
  assert.strictEqual(c.P.latA, 0x03);
});

test('G-PORT: RA4 açık-akaçlı, RA5 yalnız giriş, RBPU pull-up yalnız girişlerde', () => {
  const c = core([MOVLW(7), MOVWF(CMCON), B1, CLRF(TRISA), CLRF(OPTION), B0, MOVLW(0x10), MOVWF(PORTA)]); steps(c, 8);
  c.P.inA = 0; c.step(); assert.strictEqual(c.pinsA() & 0x10, 0, 'RA4=1 sürülmez (dış 0)');
  c.P.inA = 0x10; c.step(); assert.strictEqual(c.pinsA() & 0x10, 0x10, 'RA4=1 dış seviyeyi okur');
  c.P.latA = 0x00; c.P.inA = 0x10; assert.strictEqual(c.pinsA() & 0x10, 0, 'RA4=0 sürülür');
  c.P.latA = 0x20; c.P.inA = 0; assert.strictEqual(c.pinsA() & 0x20, 0, 'RA5 TRIS=0 iken de giriş');
  c.P.inA = 0x20; assert.strictEqual(c.pinsA() & 0x20, 0x20);
  c.P.flB = 0xFF; c.P.inB = 0; assert.strictEqual(c.pinsB(), 0xFF, 'RBPU=0, TRISB=FF, boşta → FF');
  c.mem.write(0x86, 0x00); c.P.latB = 0x00; assert.strictEqual(c.pinsB(), 0x00, 'TRISB=0 → pull-up yok');
});

test('G-ILL: 0x3B00 → NOP + uyarı (1 çevrim), (metin, pc) reset başına bir kez', () => {
  const c = core([NOP, 0x3B00, GOTO(0)]);
  c.step(); c.P.cyc = 0; c.step();
  assert.strictEqual(c.P.cyc, 1); assert.strictEqual(c.P.pc, 2);
  assert.deepStrictEqual(c.warns, [{ mod: 'PIC16', pc: 1, cyc: 1, text: 'Attempt to execute illegal opcode (0x3B00) - NOP executed.' }]);
  c.run(1000); assert.strictEqual(c.warns.length, 1, 'tekrar yok');
  c.reset(); c.run(10); assert.strictEqual(c.warns.length, 2, 'reset sonrası yeniden');
});

test('G-STK: 9 iç içe CALL → bir kez taşma; derinlik 0 RETURN → alt taşma; dairesel yığın', () => {
  const code = []; for (let i = 0; i < 9; i++) code.push(CALL(i + 1)); code.push(GOTO(9));
  const c = core(code); c.run(100);
  assert.deepStrictEqual(c.warns.map(w => [w.mod, w.pc, w.text]), [['PIC16', 8, 'Stack overflow executing CALL instruction.']]);
  assert.strictEqual(c.P.sp, 1); assert.strictEqual(c.P.stack[0], 9, '9. dönüş adresi 1. yuvanın üstüne'); assert.strictEqual(c.depth(), 9);
  for (const [op, k] of [[RETURN, 'RETURN'], [RETLW(1), 'RETLW'], [RETFIE, 'RETFIE']]) {
    const d = core([op, GOTO(1)]); d.step();
    assert.deepStrictEqual(d.warns.map(w => [w.pc, w.text]), [[0, 'Stack underflow executing ' + k + ' instruction.']]);
    assert.strictEqual(d.P.sp, 7);
  }
  const ok = core([CALL(2), GOTO(1), RETURN]); ok.run(100);
  assert.strictEqual(ok.warns.length, 0);
});

const EEW = [B1, MOVLW(5), MOVWF(EEADR), MOVLW(0x42), MOVWF(EEDATA), BSF(EECON1, 2), MOVLW(0x55), MOVWF(EECON2), MOVLW(0xAA), MOVWF(EECON2), BSF(EECON1, 1)];
function eeStart(o) { const c = core(EEW, o); sled(c, EEW.length); steps(c, EEW.length); return c; }
test('G-EE: veri EEPROM yazımı varsayılan 10 ms (Proteus), 8 MHz → 20 000, 4 ms özelliği → 4 000', () => {
  for (const [fosc, props, n] of [[4e6, null, 10000], [8e6, null, 20000], [4e6, { eeWriteDelay: 0.004 }, 4000], [20e6, null, 50000]]) {
    const c = eeStart({ fosc, opts: props ? { props } : {} }), s = c.P.cyc;
    assert(R(c)[0x9C] & 2, 'WR=1');
    runNop(c, s + n - 1, 0x20);
    assert.strictEqual(c.P.cyc, s + n - 1);
    assert.strictEqual(c.P.ee[5], 255, fosc + ': ' + (n - 1) + ' çevrimde bitmemeli'); assert(R(c)[0x9C] & 2); assert.strictEqual(R(c)[PIR1] & 0x80, 0);
    c.step();
    assert.strictEqual(c.P.ee[5], 0x42, fosc + ': ' + n + ' çevrimde bitmeli'); assert.strictEqual(R(c)[0x9C] & 2, 0); assert(R(c)[PIR1] & 0x80, 'EEIF');
    assert.strictEqual(c.warns.length, 0);
  }
  const c = core(EEW); sled(c, EEW.length); c.setProps({ eeWriteDelay: 0.002 }); steps(c, EEW.length);
  const s = c.P.cyc; runNop(c, s + 1999, 0x20); assert.strictEqual(c.P.ee[5], 255); c.step(); assert.strictEqual(c.P.ee[5], 0x42, 'setProps eeWriteDelay');
});

test('G-EEW: 55/AA olmadan WR ve aynı komutta WREN+WR uyarıları; yazım yok sayılır', () => {
  let c = core([B1, BSF(EECON1, 2), BSF(EECON1, 1), GOTO(3)]); c.run(50);
  assert.deepStrictEqual(c.warns.map(w => [w.mod, w.pc, w.text]), [['PIC16 EEPROM', 2, 'Attempt to set EECON1<WR> without 0x55/0xAA sequence to EECON2 has been ignored.']]);
  assert.strictEqual(R(c)[0x9C] & 2, 0);
  c = core([B1, MOVLW(0x55), MOVWF(EECON2), MOVLW(0xAA), MOVWF(EECON2), MOVLW(0x06), MOVWF(EECON1), GOTO(7)]); c.run(50);
  assert.deepStrictEqual(c.warns.map(w => [w.mod, w.pc, w.text]), [['PIC16 EEPROM', 6, 'Cannot set EECON1<WR> without first setting EECON1<WREN> in a previous instruction.']]);
  assert.strictEqual(R(c)[0x9C] & 2, 0);
  c = core(EEW.concat([GOTO(EEW.length)])); c.run(50);
  assert.strictEqual(c.warns.length, 0, 'doğru dizi uyarısız');
});

test('D3: EEPROM içeriği reset() ile korunur; resetPersistent / yeni HEX / eePersist:false yeniden yükler', () => {
  const ee = new Uint8Array(128).fill(255); ee[9] = 0x33;
  const c = eeStart({ ee });
  runNop(c, c.P.cyc + 10001, 0x20);
  assert.strictEqual(c.P.ee[5], 0x42);
  c.reset(); assert.strictEqual(c.P.ee[5], 0x42, 'reset sonrası kalıcı'); assert.strictEqual(c.P.ee[9], 0x33);
  c.load({ prog: c.P.prog.slice(), cfg: null, ee: ee.slice() }); c.reset(); assert.strictEqual(c.P.ee[5], 0x42, 'aynı HEX yeniden yüklenince kalıcı');
  c.resetPersistent(); assert.strictEqual(c.P.ee[5], 255); assert.strictEqual(c.P.ee[9], 0x33, 'eeInit = HEX verisi');
  runNop(c, 10, 0x20); c.P.ee[5] = 0x77;
  const p2 = c.P.prog.slice(); p2[2000] = CLRW;
  c.load({ prog: p2, cfg: null, ee }); c.reset(); assert.strictEqual(c.P.ee[5], 255, 'yeni HEX → yeniden yükle');
  const eeRef = c.ee; assert.strictEqual(eeRef, c.P.ee);
  const d = eeStart({ opts: { props: { eePersist: false } } }); runNop(d, d.P.cyc + 10001, 0x20); assert.strictEqual(d.P.ee[5], 0x42);
  d.reset(); assert.strictEqual(d.P.ee[5], 255, 'eePersist:false → her reset');
  assert.strictEqual(PIC.create().P.ee[0], 255);
});

const WDT_CFG = 0x3F6F;
test('G-WDT: 18 ms (4 MHz 18 000 Tcy, 1 MHz 4 500), PSA=1 PS=111 → ×128; günlük satırı', () => {
  for (const [fosc, opt, n, t] of [[4e6, 0xC7, 18000, '0.018000'], [1e6, 0xC7, 4500, '0.018000'], [1e6, 0xCF, 576000, '2.304000'], [4e6, 0xC8, 18000, '0.018000']]) {
    const c = core([B1, MOVLW(opt), MOVWF(OPTION), B0, GOTO(4)], { cfg: WDT_CFG, fosc });
    let at = -1;
    while (at < 0 && c.P.cyc < n + 10) { c.step(); if (c.P.pc === 0) at = c.P.cyc; }
    assert(at >= n && at <= n + 1, fosc + '/' + opt.toString(16) + ': reset ' + at);
    assert.deepStrictEqual(c.warns.map(w => [w.mod, w.text]), [['PIC16', 'Processor has been reset by watchdog timer expiring at time ' + t + '.']]);
  }
  const c = core([B1, MOVLW(0xC7), MOVWF(OPTION), B0, GOTO(4)], { cfg: WDT_CFG, opts: { props: { wdtPeriod: 0.007 } } });
  c.run(6990); assert.strictEqual(c.warns.length, 0); c.run(7010); assert.strictEqual(c.warns.length, 1, 'props.wdtPeriod');
  c.setProps({ wdtPeriod: 0.002 }); c.run(7000 + 2000 + 10); assert.strictEqual(c.warns.length, 2, 'setProps');
  const off = core([GOTO(0)]); off.run(100000); assert.strictEqual(off.warns.length, 0, 'cfg yok → 0x3F6B (WDT kapalı)');
});

test('G-RESET: WDT reset tablosu (DS Tablo 14-6/14-7)', () => {
  const code = [MOVLW(0x55), MOVWF(FSR), MOVLW(0x5A), MOVWF(PORTB), MOVLW(0xE5), MOVWF(PORTA), MOVLW(0x12), MOVWF(TMR1L), MOVLW(0x34), MOVWF(TMR1H),
    MOVLW(0x30), MOVWF(T1CON), MOVLW(0x77), MOVWF(CCPR1L), MOVLW(0x88), MOVWF(CCPR1H), MOVLW(0x0A), MOVWF(CCP1CON), MOVLW(0x02), MOVWF(PCLATH),
    MOVLW(0x07), MOVWF(CMCON), MOVLW(0x05), MOVWF(T2CON),
    B1, MOVLW(0x3C), MOVWF(EEADR), MOVLW(0x99), MOVWF(EEDATA), CLRF(TRISB), CLRF(TRISA), MOVLW(0x0B), MOVWF(PCON), MOVLW(0xC7), MOVWF(OPTION),
    MOVLW(0x05), MOVWF(PIE1), MOVLW(0x80), MOVWF(PR2), MOVLW(0x24), MOVWF(TXSTA), MOVLW(0x10), MOVWF(SPBRG), MOVLW(0x80), MOVWF(VRCON), B0,
    MOVLW(0x90), MOVWF(RCSTA), MOVLW(0x59), MOVWF(INTCON), MOVLW(0x50), MOVWF(TMR0), BSF(STATUS, 0), MOVLW(0x3C)];
  const L = code.length; code.push(GOTO(L));
  const c = core(code, { cfg: WDT_CFG });
  let prev = null, pw = 0, pl = null;
  while (c.P.cyc < 20000) { prev = R(c).slice(); pw = c.P.w; pl = [c.P.latA, c.P.latB]; c.step(); if (c.P.pc === 0) break; }
  assert.strictEqual(c.P.pc, 0); assert(c.P.cyc >= 18000);
  const r = R(c), ps = prev[3];
  assert.strictEqual(ps & 0x08, 0x08, 'önceki PD=1'); assert.strictEqual(ps & 0x20, 0, 'bank 0');
  assert.strictEqual(r[3], ps & 0x0F, 'STATUS 0000 uuuu');
  assert.strictEqual(r[3] & 0x10, 0, 'TO=0');
  assert.strictEqual(r[0x8E], 0x0B, 'PCON ---- 1-uu');
  assert.strictEqual(c.P.w, pw, 'W u');
  for (const a of [1, 4, 0x0E, 0x0F, 0x10, 0x15, 0x16, 0x9A, 0x9B]) assert.strictEqual(r[a], prev[a], 'u: 0x' + a.toString(16));
  assert.strictEqual(c.P.latB, pl[1], 'PORTB mandalı u'); assert.strictEqual(c.P.latB, 0x5A);
  assert.strictEqual(c.P.latA, pl[0] & 0xE0, 'PORTA 7:5 u, 4:0 = 0');
  assert.strictEqual(r[0x0B], prev[0x0B] & 1, 'INTCON 0000 000u'); assert.strictEqual(r[0x0B], 1);
  const want = { 0x0C: 0, 0x8C: 0, 0x0A: 0, 0x11: 0, 0x12: 0, 0x17: 0, 0x18: 0, 0x98: 0x02, 0x99: 0, 0x1F: 0, 0x9F: 0, 0x81: 0xFF, 0x85: 0xFF, 0x86: 0xFF, 0x92: 0xFF, 0x9C: 0 };
  for (const a in want) assert.strictEqual(r[a], want[a], 'reset değeri 0x' + (+a).toString(16));
  assert.deepStrictEqual([r[0x10], r[0x15], r[0x16], r[0x9A], r[0x9B], r[4]], [0x30, 0x77, 0x88, 0x99, 0x3C, 0x55]);
  const por = core([]);
  assert.strictEqual(R(por)[3], 0x18); assert.strictEqual(R(por)[0x8E], 0x08); assert.strictEqual(por.P.w, 0);
  for (const a in want) assert.strictEqual(R(por)[a], want[a], 'POR 0x' + (+a).toString(16));
  for (const a of [1, 4, 0x0B, 0x0E, 0x0F, 0x10, 0x15, 0x16, 0x9A, 0x9B]) assert.strictEqual(R(por)[a], 0, 'POR x→0 0x' + a.toString(16));
  const bor = core([GOTO(0)]); R(bor)[0x8E] = 0x0B; R(bor)[3] = 0x05; bor.resetBy('bor');
  assert.strictEqual(R(bor)[3], 0x1D, 'BOR STATUS 0001 1uuu'); assert.strictEqual(R(bor)[0x8E], 0x0A, 'BOR PCON ---- 1-u0');
});

test('G-RESET: uyku hâlleri (WDT uyandırması, kesmeyle uyanma, bekleyen kesme → SLEEP=NOP, uykuda MCLR)', () => {
  let c = core([B1, CLRF(TRISB), MOVLW(0xC7), MOVWF(OPTION), B0, SLEEP, NOP, GOTO(7)], { cfg: WDT_CFG });
  steps(c, 6); assert(c.P.sleep);
  c.run(19000);
  assert(!c.P.sleep); assert.strictEqual(R(c)[3] & 0x18, 0, 'TO=0 PD=0'); assert.strictEqual(R(c)[0x86], 0, 'reset yok');
  assert([6, 7].includes(c.P.pc), 'SLEEP sonrası adres ' + c.P.pc); assert.strictEqual(c.warns.length, 0);
  c = core([GOTO(0x10)], { at: [[4, [MOVLW(0x99), GOTO(5)]], [0x10, [MOVLW(0x90), MOVWF(INTCON), SLEEP, MOVLW(0x11), GOTO(0x14)]]] });
  steps(c, 4); assert(c.P.sleep); c.run(c.P.cyc + 50); assert(c.P.sleep);
  const pcs = []; c.P.inB = 1;
  while (c.P.pc !== 4) { c.step(); pcs.push(c.P.pc); assert(pcs.length < 50); }
  assert.strictEqual(c.P.w, 0x11, 'SLEEP sonrası komut önce çalışır'); assert.deepStrictEqual(c.stack(), [0x14]);
  assert.strictEqual(R(c)[3] & 0x18, 0x10, 'uyanma: TO=1 PD=0');
  c = core([B1, MOVLW(0xC7), MOVWF(OPTION), B0, MOVLW(0x10), MOVWF(INTCON), BSF(INTCON, 1), SLEEP, GOTO(8)], { cfg: WDT_CFG });
  steps(c, 7); R(c)[3] &= ~0x10; const w0 = c.P.cyc; c.step();
  assert(!c.P.sleep, 'bekleyen INTF+INTE → SLEEP NOP'); assert.strictEqual(R(c)[3] & 0x18, 0x08, 'TO/PD değişmez (DS 14.8.1)');
  c.run(18010); assert.strictEqual(c.warns.length, 1, 'WDT silinmedi (SLEEP NOP) ' + w0);
  c = core([SLEEP]); c.step(); assert(c.P.sleep); R(c)[3] |= 0x07;
  c.setMclr(0); assert.strictEqual(R(c)[3], 0x17, 'uykuda MCLR: 0001 0uuu'); assert(!c.P.sleep);
  c.setMclr(1); assert.strictEqual(c.P.pc, 0); assert.strictEqual(R(c)[3], 0x17);
});

test('G-MCLR: MCLRE=1 iken setMclr(0) çalışmayı durdurur, yükselen kenar PC=0; MCLRE=0 yok sayar', () => {
  for (const cfg of [0x3F6B, null]) {
    const c = core([INCF(0x20, 1), B1, CLRF(TRISB), B0, GOTO(0)], { cfg });
    c.run(100); const n = R(c)[0x20]; assert(n > 10);
    R(c)[3] |= 0x05;
    c.setMclr(0);
    assert(c.P.inReset); assert(c.peek().inReset); assert.strictEqual(c.P.pc, 0); assert.strictEqual(R(c)[0x86], 0xFF, 'reset sırasında TRIS=FF');
    const cy = c.P.cyc; c.run(cy + 5000);
    assert.strictEqual(c.P.cyc, cy + 5000, 'çevrim ilerler'); assert.strictEqual(c.P.pc, 0); assert.strictEqual(R(c)[0x20], n, 'komut çalışmaz');
    c.step(); assert.strictEqual(c.P.cyc, cy + 5001); assert.strictEqual(c.P.pc, 0);
    c.setMclr(0);
    c.setMclr(1);
    assert(!c.P.inReset); assert.strictEqual(c.P.pc, 0); assert.strictEqual(R(c)[3], 0x1D, 'MCLR: 000u uuuu');
    c.run(c.P.cyc + 100); assert(R(c)[0x20] > n, 'yeniden çalışır');
    assert.deepStrictEqual(PIC.decodeConfig(c.P.cfg), cfg == null ? null : PIC.decodeConfig(cfg), 'decodeConfig gösterimi değişmez');
  }
  const c = core([MOVLW(7), MOVWF(CMCON), MOVF(PORTA, 0), GOTO(2)], { cfg: 0x3F4B });
  c.run(10); c.setMclr(0); assert(!c.P.inReset, 'MCLRE=0 → yok sayılır');
  c.P.inA = 0x20; c.run(30); assert.strictEqual(c.P.w & 0x20, 0x20, 'RA5 veri girişi');
  const d = core([GOTO(0)], { opts: { props: { cfgDefault: 0x3F4B } } }); d.setMclr(0); assert(!d.P.inReset, 'cfgDefault MCLRE=0');
  const e = core([GOTO(0)]); e.setMclr(0); e.reset(); assert(e.P.inReset, 'MCLR düşükken POR reset içinde kalır'); e.setMclr(1); assert(!e.P.inReset);
});

test('G-MCLR: EEPROM yazımı reset ile kesilirse WRERR=1', () => {
  const c = eeStart({ cfg: 0x3F6B });
  c.run(c.P.cyc + 100);
  c.setMclr(0); c.setMclr(1);
  assert.strictEqual(R(c)[0x9C], 0x08, 'EECON1 ---- 1000'); assert.strictEqual(c.P.ee[5], 255, 'yazım iptal');
  c.run(c.P.cyc + 9); assert.strictEqual(c.P.ee[5], 255);
});

test('Uygulanmamış bellek uyarısı varsayılan kapalı; warnUnimpl:true → PIC16 MEMORY', () => {
  const code = [B1, MOVLW(0x71), MOVWF(0x0F), B0, GOTO(4)];
  let c = core(code); c.run(20); assert.strictEqual(c.warns.length, 0);
  c = core(code, { opts: { props: { warnUnimpl: true } } }); c.run(20);
  assert.deepStrictEqual(c.warns.map(w => [w.mod, w.pc, w.text]), [['PIC16 MEMORY', 2, 'Attempt to write unimplemented memory location 0x008F with 0x71 ignored.']]);
  assert.strictEqual(c.props.warnUnimpl, true); assert.strictEqual(c.props.eeWriteDelay, 0.010); assert.strictEqual(c.props.cfgDefault, 0x3F6B);
});

test('PIC.disasm style:mikroc (.lst biçimi)', () => {
  const D = (op, a, o) => PIC.disasm(op, a, Object.assign({ style: 'mikroc' }, o));
  assert.strictEqual(D(0x2903, 0), 'GOTO       259');
  assert.strictEqual(D(0x3021, 3), 'MOVLW      33');
  assert.strictEqual(D(0x0000), 'NOP');
  assert.strictEqual(D(0x0008), 'RETURN');
  assert.strictEqual(D(0x00FC), 'MOVWF      R12');
  assert.strictEqual(D(0x0BFD), 'DECFSZ     R13, 1');
  assert.strictEqual(D(0x1683), 'BSF        STATUS, 5');
  assert.strictEqual(D(0x0186, 0, { bank: 1 }), 'CLRF       TRISB');
  assert.strictEqual(D(0x0830), 'MOVF       48, 0');
  assert.strictEqual(D(0x0AB0, 0, { bank: 2, names: { 0x130: '_ones' } }), 'INCF       _ones, 1');
  assert.strictEqual(D(0x2004, 0x800), 'CALL       2052');
  assert.strictEqual(D(0x0103), 'CLRW');
  assert.strictEqual(D(0x3400), 'RETLW      0');
  assert.strictEqual(D(0x3EFF), 'ADDLW      255');
  assert.strictEqual(PIC.disasm(0x3007), 'movlw 0x07', 'varsayılan biçim değişmez');
});

test('Hız: Task1.hex 10 M çevrim (bilgi)', () => {
  const hex = fs.readFileSync(path.join(__dirname, '..', 'projeler', 'Task1.hex'), 'utf8');
  const c = PIC.create({ onPort: () => {} }); c.load(PIC.parseHex(hex)); c.reset(); c.P.inA = 0x20;
  const t = process.hrtime.bigint(); c.run(10e6);
  console.log('     Task1 10M çevrim: ' + (Number(process.hrtime.bigint() - t) / 1e6).toFixed(0) + ' ms');
});

console.log('\n' + passed + ' geçti, ' + failed + ' başarısız');
process.exit(failed ? 1 : 0);
