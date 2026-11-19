const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const PIC = require('../js/pic.js');
const TC = path.join(ROOT, 'toolchain');

let failed = 0, passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e.message || e).toString().split('\n').slice(0, 24).join('\n     ')); }
}

const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'ee321_ct_'));
const b = cp.spawnSync('python3', [path.join(__dirname, 'build_test.py'), '--out', OUT], { encoding: 'utf8' });
if (b.status !== 0) { console.log(b.stdout + b.stderr); console.log('FAIL derleme (build_test.py)'); process.exit(1); }
const hexOf = n => fs.readFileSync(path.join(OUT, n + '.hex'), 'utf8');

function asm(src) {
  const f = path.join(OUT, 'probe' + (asm.n = (asm.n || 0) + 1));
  fs.writeFileSync(f + '.asm', src);
  const r = cp.spawnSync(path.join(TC, 'bin', 'gpasm'), ['-p', 'p16f628a', '-I', path.join(TC, 'gpheader'), '-o', f + '.hex', f + '.asm'],
    { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', GPUTILS_HEADER_PATH: path.join(TC, 'gpheader') } });
  if (r.status !== 0) throw new Error('gpasm: ' + r.stdout + r.stderr);
  return fs.readFileSync(f + '.hex', 'utf8');
}
const HDR = ' list p=16f628a\n #include <p16f628a.inc>\n __config _INTOSC_OSC_NOCLKOUT & _WDT_OFF & _MCLRE_OFF & _LVP_OFF\n';

function mk(hex, opts, fosc) {
  opts = opts || {};
  const c = PIC.create(opts);
  c.load(PIC.parseHex(hex));
  if (fosc) c.P.fosc = fosc;
  c.reset();
  return c;
}
const runTo = (c, cyc) => c.run(cyc);

function lcdBus(get) {
  let e = 0, nibs = [];
  return {
    sample() { const s = get(); if (e && !s.e) nibs.push([s.rs, s.d]); e = s.e; },
    bytes() {
      const out = [];
      for (let i = 4; i + 1 < nibs.length; i += 2) out.push([nibs[i][0], (nibs[i][1] << 4) | nibs[i + 1][1]]);
      return { init: nibs.slice(0, 4).map(n => n[1]), out };
    }
  };
}

for (const [f, ref] of [['Task1', { pc: 46, w: 245, latA: 6, latB: 0, H: 529368702, N: 73 }], ['Task2', { pc: 42, w: 246, latA: 0, latB: 6, H: 558530002, N: 587 }]]) {
  test(f + '.hex: eski çekirdekle aynı çevrim/port dizisi', () => {
    let H = 0, N = 0, c;
    const hook = () => { H = (H * 31 + c.P.latA * 7 + c.P.latB * 131 + c.P.cyc) % 1000000007; N++; };
    c = mk(fs.readFileSync(path.join(ROOT, 'projeler', f + '.hex'), 'utf8'), { onPort: () => hook() });
    hook();
    const at = x => { while (c.P.cyc < x) c.step(); };
    at(300000); c.P.inA = 0x20; at(350000); c.P.inA = 0; at(2350000); c.P.inA = 0x40; at(2400000); c.P.inA = 0; at(3000000);
    assert.deepStrictEqual({ pc: c.P.pc, w: c.P.w, latA: c.P.latA, latB: c.P.latB, H, N }, ref);
    assert.strictEqual(c.P.cyc, 3000000);
  });
}

test('Lab2.asm: tek sayı adedi PORTB = 4', () => {
  const c = mk(hexOf('Lab2'));
  runTo(c, 5000);
  assert.strictEqual(c.P.ram[0x86], 0, 'TRISB');
  assert.strictEqual(c.pinsB(), 4);
  assert.strictEqual(c.P.ram[0x35], 4);
});

test('Timer0_Interrupt: TMR0 kesmesi 2048 çevrimde bir, RB0 244 kesmede bir', () => {
  let c, last = { b0: 0, b1: 0 }, t0 = [], t1 = [];
  c = mk(hexOf('Timer0_Interrupt'), { onPort: () => {
    const l = c.P.latB;
    if (((l >> 1) & 1) !== last.b1) { last.b1 = (l >> 1) & 1; t1.push(c.P.cyc); }
    if ((l & 1) !== last.b0) { last.b0 = l & 1; t0.push(c.P.cyc); }
  } });
  runTo(c, 1600000);
  const d1 = t1.slice(1).map((t, i) => t - t1[i]);
  assert(d1.length > 500, 'kesme sayısı ' + d1.length);
  assert(d1.every(x => Math.abs(x - 2048) <= 3), 'RB1 aralıkları: ' + [...new Set(d1)].join(','));
  assert(Math.abs((t1[t1.length - 1] - t1[0]) / d1.length - 2048) < 0.01, 'ortalama periyot');
  const d0 = t0.slice(1).map((t, i) => t - t0[i]);
  assert(d0.length >= 2 && d0.every(x => Math.abs(x - 244 * 2048) <= 3), 'RB0 aralıkları: ' + d0.join(','));
});

test('Uart_Demo: metin 9600 baud (104 çevrim/bit) ile gider, yankı çalışır', () => {
  const tx = [];
  let c, low = 0;
  c = mk(hexOf('Uart_Demo'), { onUartTx: (b, t) => tx.push([b, t]), onPort: () => { if (!(c.drive()[3] & 4)) low++; } });
  runTo(c, 300000);
  assert.strictEqual(String.fromCharCode(...tx.map(x => x[0])), 'EE321 UART\r\n');
  const d = tx.slice(1).map((x, i) => x[1] - tx[i][1]);
  assert(d.every(x => x === 1040), 'bayt aralıkları ' + [...new Set(d)].join(','));
  assert.strictEqual(c.P.ram[0x99], 25, 'SPBRG');
  assert(c.P.ram[0x98] & 4, 'BRGH');
  assert(low > 0, 'TX hattı (RB2) start bitinde 0 olmalı');
  const n = tx.length;
  c.rxPush(0x41); c.rxPush(0x42);
  runTo(c, c.P.cyc + 5000);
  assert.strictEqual(String.fromCharCode(...tx.slice(n).map(x => x[0])), 'AB');
});

test('UART: RCREG FIFO 2 bayt, üçüncüde OERR', () => {
  const c = mk(asm(HDR + ' org 0\n bsf STATUS,RP0\n movlw .25\n movwf SPBRG\n movlw 0x24\n movwf TXSTA\n bcf STATUS,RP0\n movlw 0x90\n movwf RCSTA\nl goto l\n end\n'));
  runTo(c, 100);
  c.rxPush(1); c.rxPush(2); c.rxPush(3);
  runTo(c, 100 + 3 * 1040 + 50);
  assert(c.P.ram[0x0C] & 0x20, 'RCIF');
  assert(c.P.ram[0x18] & 2, 'OERR');
});

test('Eeprom_Demo: yazma/okuma, kalıcılık ve açılış sayacı', () => {
  let c, seen = [];
  c = mk(hexOf('Eeprom_Demo'), { onPort: () => { const v = c.P.latB; if (seen[seen.length - 1] !== v) seen.push(v); } });
  runTo(c, 2200000);
  assert.strictEqual(c.P.ee[0], 0);
  for (let i = 1; i <= 8; i++) assert.strictEqual(c.P.ee[i], 1 << (i - 1), 'ee[' + i + ']');
  assert(seen.join(',').includes('1,2,4,8,16,32,64,128,0'), 'PORTB dizisi ' + seen.join(','));
  c.P.eeInit = c.P.ee.slice();
  c.reset(); runTo(c, 300000);
  assert.strictEqual(c.P.ee[0], 1);
});

test('EEPROM: 55h/AAh dizisi olmadan yazmaz; dizi ile ~4 ms sonra EEIF', () => {
  const c = mk(asm(HDR + ' org 0\n bsf STATUS,RP0\n movlw 5\n movwf EEADR\n movlw 0x42\n movwf EEDATA\n bsf EECON1,WREN\n bsf EECON1,WR\n nop\n nop\n movlw 0x55\n movwf EECON2\n movlw 0xAA\n movwf EECON2\n bsf EECON1,WR\nl goto l\n end\n'), { props: { eeWriteDelay: 0.004 } });
  runTo(c, 12);
  assert.strictEqual(c.P.ee[5], 255, 'dizisiz yazmamalı');
  assert.strictEqual(c.P.ram[0x9C] & 2, 0);
  runTo(c, 30);
  assert(c.P.ram[0x9C] & 2, 'WR yazma sürerken 1');
  runTo(c, 3900);
  assert.strictEqual(c.P.ee[5], 255);
  runTo(c, 4100);
  assert.strictEqual(c.P.ee[5], 0x42);
  assert(c.P.ram[0x0C] & 0x80, 'EEIF');
  assert.strictEqual(c.P.ram[0x9C] & 2, 0);
});

test('Lcd_Demo: RS/E/D4..D7 dizisi (4-bit init + HELLO EE321)', () => {
  let c;
  const bus = lcdBus(() => { const l = c.drive()[3]; return { e: (l >> 5) & 1, rs: (l >> 4) & 1, d: l & 15 }; });
  c = mk(hexOf('Lcd_Demo'), { onPort: () => bus.sample() });
  runTo(c, 120000);
  const { init, out } = bus.bytes();
  assert.deepStrictEqual(init, [3, 3, 3, 2]);
  const cmds = out.filter(x => !x[0]).map(x => x[1]);
  assert.deepStrictEqual(cmds.slice(0, 8), [0x28, 0x08, 0x01, 0x06, 0x0F, 0x01, 0x0C, 0x80]);
  const text = out.map(x => x[0] ? String.fromCharCode(x[1]) : '|' + x[1].toString(16) + '|').join('');
  assert(text.includes('|80|HELLO EE321|c0|Sayac:     0'), text);
});

test('Keypad_Demo: tuş 5 (satır B, sütun 2) LCD\'ye yazılır', () => {
  let c, key = null;
  const bus = lcdBus(() => { const a = c.drive()[1]; return { e: (a >> 7) & 1, rs: (a >> 6) & 1, d: a & 15 }; });
  const pad = () => {
    const d = c.drive(), outB = ~d[2] & d[3] & 255;
    let inB = 0;
    if (key && (outB >> (4 + key[0])) & 1) inB |= 1 << key[1];
    c.P.inB = inB;
  };
  c = mk(hexOf('Keypad_Demo'), { onPort: () => { pad(); bus.sample(); } });
  runTo(c, 150000);
  key = [1, 1]; pad(); runTo(c, c.P.cyc + 60000);
  key = null; pad(); runTo(c, c.P.cyc + 60000);
  key = [3, 3]; pad(); runTo(c, c.P.cyc + 60000);
  key = null; pad(); runTo(c, c.P.cyc + 60000);
  const data = bus.bytes().out.filter(x => x[0]).map(x => String.fromCharCode(x[1])).join('');
  assert(data.startsWith('Tus:55++'), data);
});

test('Pwm_Demo: 5 kHz (200 çevrim), %25 sonra %50 görev', () => {
  let c, lv = 0, ev = [];
  c = mk(hexOf('Pwm_Demo'), { onPort: () => { const v = (c.drive()[3] >> 3) & 1; if (v !== lv) { lv = v; ev.push([v, c.P.cyc]); } } });
  runTo(c, 300000);
  const per = (from) => {
    const r = ev.filter(e => e[1] > from);
    const ups = r.filter(e => e[0]).map(e => e[1]).slice(0, 400), hi = [];
    for (const u of ups) { const d = r.find(e => !e[0] && e[1] > u); if (d) hi.push(d[1] - u); }
    const p = ups.slice(1).map((u, i) => u - ups[i]);
    return { avg: (ups[ups.length - 1] - ups[0]) / p.length, jit: Math.max(...p.map(x => Math.abs(x - 200))), hi: hi.reduce((a, x) => a + x, 0) / hi.length, hj: Math.max(...hi) - Math.min(...hi) };
  };
  let r = per(100000);
  assert(r.avg === 200 && r.jit <= 1 && Math.abs(r.hi - 50) < 1 && r.hj <= 2, JSON.stringify(r));
  runTo(c, 800000);
  r = per(600000);
  assert(r.avg === 200 && r.jit <= 1 && Math.abs(r.hi - 100) < 1 && r.hj <= 2, JSON.stringify(r));
});

test('Mux4_Demo: 4 hane tarama, ~1 sn sonra sayı ≈ 10', () => {
  const SEG = [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F];
  const c = mk(hexOf('Mux4_Demo'));
  runTo(c, 1050000);
  const dig = [];
  for (let k = 0; k < 4; k++) {
    let guard = 0;
    while (guard++ < 30000) { c.step(); const a = c.drive()[1] & 15; if (a !== 15 && a === (~(1 << k) & 15)) break; }
    dig.push(SEG.indexOf(c.drive()[3] & 0x7F));
  }
  const n = +dig.join('');
  assert(dig.every(x => x >= 0) && n >= 9 && n <= 11, dig.join(''));
});

test('Lab1_LedSwitch (8 MHz): RA0 basılıyken LED 200 ms\'de bir kayar', () => {
  let c, t = [];
  c = mk(hexOf('Lab1_LedSwitch'), { onPort: () => { const v = c.P.latB; if (v && (v & (v - 1)) === 0 && t.length < 6 && (!t.length || t[t.length - 1][0] !== v)) t.push([v, c.P.cyc]); } }, 8e6);
  assert.strictEqual(PIC.decodeConfig(c.P.cfg).osc, 'HS');
  runTo(c, 100000);
  c.P.inA = 1;
  runTo(c, 100000 + 2e6 * 1.1);
  const d = t.slice(1).map((x, i) => x[1] - t[i][1]);
  assert(d.length >= 4 && d.every(x => Math.abs(x - 400000) < 1000), d.join(','));
  assert.deepStrictEqual(t.slice(0, 4).map(x => x[0]), [1, 2, 4, 8]);
});

test('RB0/INT kenarı SLEEP\'ten uyandırır, RETFIE GIE\'yi geri açar', () => {
  const c = mk(asm(HDR + ' org 0\n goto start\n org 4\n bcf INTCON,INTF\n incf 0x70,f\n retfie\nstart\n clrf 0x70\n bsf INTCON,INTE\n bsf INTCON,GIE\nl sleep\n incf 0x71,f\n goto l\n end\n'));
  runTo(c, 1000);
  assert(c.P.sleep, 'uyumalı');
  c.P.inB = 1; runTo(c, 1100);
  assert.strictEqual(c.P.ram[0x70], 1); assert.strictEqual(c.P.ram[0x71], 1);
  assert(c.P.ram[0x0B] & 0x80, 'GIE');
  c.P.inB = 0; runTo(c, 1200);
  assert.strictEqual(c.P.ram[0x70], 1, 'düşen kenar sayılmamalı (INTEDG=1)');
  c.P.inB = 1; runTo(c, 1300);
  assert.strictEqual(c.P.ram[0x70], 2);
  assert.strictEqual(c.P.ram[3] & 0x18, 0x10, 'SLEEP sonrası TO=1, PD=0');
});

test('RB4..7 değişim kesmesi (RBIF) ve PORTB okuması uyuşmazlığı kaldırır', () => {
  const c = mk(asm(HDR + ' org 0\n goto start\n org 4\n movf PORTB,w\n bcf INTCON,RBIF\n incf 0x70,f\n retfie\nstart\n movf PORTB,w\n bsf INTCON,RBIE\n bsf INTCON,GIE\nl goto l\n end\n'));
  runTo(c, 100);
  c.P.inB = 0x20; runTo(c, 200);
  assert.strictEqual(c.P.ram[0x70], 1);
  runTo(c, 1000);
  assert.strictEqual(c.P.ram[0x70], 1, 'tek kesme');
  c.P.inB = 0; runTo(c, 1100);
  assert.strictEqual(c.P.ram[0x70], 2);
});

test('TMR1 ve TMR2/PR2 çevresel kesmeleri (PEIE)', () => {
  const c = mk(asm(HDR + ' org 0\n goto start\n org 4\n btfss PIR1,TMR2IF\n goto t1\n bcf PIR1,TMR2IF\n incf 0x70,f\nt1 btfss PIR1,TMR1IF\n goto e\n bcf PIR1,TMR1IF\n incf 0x71,f\ne retfie\nstart\n bsf STATUS,RP0\n movlw .99\n movwf PR2\n bsf PIE1,TMR2IE\n bsf PIE1,TMR1IE\n bcf STATUS,RP0\n movlw 0x04\n movwf T2CON\n movlw 0x01\n movwf T1CON\n bsf INTCON,PEIE\n bsf INTCON,GIE\nl goto l\n end\n'));
  runTo(c, 131200);
  assert([30, 31, 32].includes(c.P.ram[0x70]), 'TMR2 kesme sayısı (mod 256) ' + c.P.ram[0x70]);
  assert.strictEqual(c.P.ram[0x71], 2, 'TMR1 taşma sayısı');
});

test('TMR0 prescaler: TMR0 yazımı 2 çevrim sayımı durdurur', () => {
  const c = mk(asm(HDR + ' org 0\n bsf STATUS,RP0\n movlw 0x88\n movwf OPTION_REG\n bcf STATUS,RP0\n clrf TMR0\n nop\n nop\n nop\n movf TMR0,w\n movwf 0x70\nl goto l\n end\n'));
  runTo(c, 20);
  assert.strictEqual(c.P.ram[0x70], 1);
});

test('WDT zaman aşımı reset yapar (TO=0)', () => {
  const c = mk(asm(' list p=16f628a\n #include <p16f628a.inc>\n __config _INTOSC_OSC_NOCLKOUT & _WDT_ON & _MCLRE_OFF & _LVP_OFF\n org 0\n btfss STATUS,NOT_TO\n incf 0x70,f\n bsf STATUS,RP0\n movlw 0x08\n movwf OPTION_REG\n bcf STATUS,RP0\nl goto l\n end\n'));
  runTo(c, 17000);
  assert.strictEqual(c.P.ram[0x70], 0);
  runTo(c, 19000);
  assert.strictEqual(c.P.ram[0x70], 1);
  assert.strictEqual(c.P.ram[3] & 0x10, 0);
});

test('DC/C bayrakları, PCLATH ile hesaplanmış goto, 8 seviye yığın', () => {
  const c = mk(asm(HDR + ' org 0\n movlw 0x0F\n addlw 1\n movf STATUS,w\n movwf 0x70\n movlw 0x10\n sublw 0x20\n movf STATUS,w\n movwf 0x71\n movlw 0x01\n sublw 0x10\n movf STATUS,w\n movwf 0x72\n movlw high tbl\n movwf PCLATH\n movlw 2\n call tbl\n movwf 0x73\n call d1\n movwf 0x74\nl goto l\n org 0x123\ntbl addwf PCL,f\n retlw 0xA0\n retlw 0xA1\n retlw 0xA2\nd1 call d2\n return\nd2 call d3\n return\nd3 call d4\n return\nd4 call d5\n return\nd5 call d6\n return\nd6 call d7\n return\nd7 retlw 0x77\n end\n'));
  runTo(c, 200);
  assert.strictEqual(c.P.ram[0x70] & 3, 2, 'addlw: DC=1 C=0');
  assert.strictEqual(c.P.ram[0x71] & 3, 3, 'sublw 0x20-0x10: DC=1 C=1');
  assert.strictEqual(c.P.ram[0x72] & 3, 1, 'sublw 0x10-0x01: DC=0 C=1');
  assert.strictEqual(c.P.ram[0x73], 0xA2);
  assert.strictEqual(c.P.ram[0x74], 0x77);
});

test('Bank yansımaları: STATUS/FSR/PCLATH/INTCON tüm banklarda, 0x70-0x7F ortak', () => {
  const c = mk(asm(HDR + ' org 0\n movlw 0x55\n movwf 0x70\n bsf STATUS,RP0\n bsf STATUS,RP1\n movf 0x70,w\n movwf 0x71\n movlw 0x0A\n movwf PCLATH\n bsf INTCON,T0IE\n bcf STATUS,RP0\n movlw 0x33\n movwf 0x106\n bcf STATUS,RP1\nl goto l\n end\n'));
  runTo(c, 40);
  assert.strictEqual(c.P.ram[0x71], 0x55);
  assert.strictEqual(c.P.ram[0x0A], 0x0A);
  assert(c.P.ram[0x0B] & 0x20);
  assert.strictEqual(c.P.latB, 0x33);
});

test('RBPU zayıf pull-up: boşta giriş 1 okunur', () => {
  const c = mk(asm(HDR + ' org 0\n bsf STATUS,RP0\n bcf OPTION_REG,NOT_RBPU\n bcf STATUS,RP0\nl goto l\n end\n'));
  c.P.flB = 0xF0;
  runTo(c, 20);
  assert.strictEqual(c.pinsB(), 0xF0);
});

const libPath = path.join(ROOT, 'js/library.js'), simPath = path.join(ROOT, 'js/sim.js');
const circ = n => path.join(ROOT, 'circuits', n + '.json');
if (fs.existsSync(libPath) && fs.existsSync(simPath)) {
  const SIM = require(simPath), LIB = require(libPath);
  const attach = (hex, name, fosc) => {
    const m = SIM.compile(JSON.parse(fs.readFileSync(circ(name), 'utf8')), LIB), run = new SIM.Runner(m);
    if (run.setClock) run.setClock(fosc || 4e6);
    let c;
    const sync = r => { if (r) { c.P.inA = r.inA; c.P.inB = r.inB; c.P.flB = r.flB || 0; } };
    const portChg = () => {
      const d = c.drive();
      if (run.setPullups) run.setPullups((c.P.ram[0x81] & 0x80) ? 0 : 0xFF, c.P.cyc);
      sync(run.port(d[0], d[1], d[2], d[3], c.P.cyc));
    };
    c = mk(hex, { onPort: portChg, onUartTx: (b, t) => run.uartTx && run.uartTx(b, t) }, fosc);
    portChg();
    const part = t => m.pic && JSON.parse(fs.readFileSync(circ(name), 'utf8')).parts.find(p => p.type === t);
    return { c, run, m, part, press: (id, v) => sync(run.press(id, v, c.P.cyc)) };
  };
  if (fs.existsSync(circ('lcd_demo'))) test('entegrasyon: Lcd_Demo + circuits/lcd_demo.json → LM016L "HELLO EE321"', () => {
    const s = attach(hexOf('Lcd_Demo'), 'lcd_demo');
    s.c.run(800000);
    const st = s.run.state(s.part('LM016L'), s.run.frame(s.c.P.cyc));
    assert(st.lcd && /^HELLO EE321/.test(st.lcd.lines[0]), JSON.stringify(st.lcd));
    assert(/^Sayac:\s+\d+/.test(st.lcd.lines[1]), JSON.stringify(st.lcd));
  });
  if (fs.existsSync(circ('uart_demo'))) test('entegrasyon: Uart_Demo + VIRTUAL-TERMINAL', () => {
    const s = attach(hexOf('Uart_Demo'), 'uart_demo');
    s.c.run(300000);
    const vt = s.part('VIRTUAL-TERMINAL');
    s.run.termKey(vt.id, 'x');
    for (let b; (b = s.run.uartRx()) != null;) s.c.rxPush(b);
    s.c.run(320000);
    const st = s.run.state(vt, s.run.frame(s.c.P.cyc));
    assert(/EE321 UART\n?x/.test(st.text), JSON.stringify(st.text));
  });
  if (fs.existsSync(circ('keypad_demo'))) test('entegrasyon: Keypad_Demo + KEYPAD-SMALLCALC tuş "5"', () => {
    const s = attach(hexOf('Keypad_Demo'), 'keypad_demo');
    s.c.run(200000);
    const kp = s.part('KEYPAD-SMALLCALC');
    s.press(kp.id + ':5', true); s.c.run(s.c.P.cyc + 60000);
    s.press(kp.id + ':5', false); s.c.run(s.c.P.cyc + 60000);
    const st = s.run.state(s.part('LM016L'), s.run.frame(s.c.P.cyc));
    assert(st.lcd && /^Tus: 5/.test(st.lcd.lines[0]) && /^5/.test(st.lcd.lines[1]), JSON.stringify(st.lcd));
  });
}

// ---- S7: karşılaştırıcı (CMCON), gerilim referansı (VRCON), CMIF ----
// PIC16F628A veri sayfası (DS40044) Şekil 10-1: CM2:CM0 → C1 (VIN-, VIN+), C2 (VIN-, VIN+); 'R' = dahili VREF; null = kapalı (okuma 0).
const CMTAB = {
  0: { c1: null, c2: null, an: 0x0F },
  1: { c1: cis => [cis ? 3 : 0, 2], c2: () => [1, 2], an: 0x0F },
  2: { c1: cis => [cis ? 3 : 0, 'R'], c2: cis => [cis ? 2 : 1, 'R'], an: 0x0F },
  3: { c1: () => [0, 2], c2: () => [1, 2], an: 0x07 },
  4: { c1: () => [0, 3], c2: () => [1, 2], an: 0x0F },
  5: { c1: null, c2: () => [1, 2], an: 0x06 },
  6: { c1: () => [0, 2], c2: () => [1, 2], an: 0x07 },
  7: { c1: null, c2: null, an: 0x00 }
};
const vrefFormula = vr => !(vr & 0x80) ? 0 : (vr & 0x20) ? (vr & 15) / 24 * 5 : 5 / 4 + (vr & 15) / 32 * 5;
function cmpCore(src) {
  const c = mk(asm(HDR + ' org 0\n' + (src || 'l goto l\n') + ' end\n'));
  const V = [0, 0, 0, 0];
  c.setAnalog(b => V[b]);
  return { c, V, set(a) { for (let i = 0; i < 4; i++) V[i] = a[i]; c.analogChanged(); } };
}

test('S7 reset: CMCON = 0x00 (karşılaştırıcılar reset, RA0..RA3 analog → 0 okunur), VRCON = 0x00', () => {
  const c = mk(asm(HDR + ' org 0\n bsf STATUS,RP0\n movlw 0xFF\n movwf TRISA\n bcf STATUS,RP0\n movf PORTA,w\n movwf 0x20\n movlw 7\n movwf CMCON\n movf PORTA,w\n movwf 0x21\nl goto l\n end\n'));
  assert.strictEqual(c.mem.read(0x1F), 0x00); assert.strictEqual(c.mem.read(0x9F), 0x00);
  c.P.inA = 0x3F; c.run(40);
  assert.strictEqual(c.P.ram[0x20], 0x30, 'CMCON yazılmadan RA0..RA3 = 0 (gerçek çip), RA4/RA5 dijital');
  assert.strictEqual(c.P.ram[0x21], 0x3F, 'CMCON = 7 → RA0..RA3 dijital');
  assert.strictEqual(c.peek().pa & 0x0F, 0x0F, 'pin durumu (hata ayıklayıcı/şema) fiziksel kalır');
});

test('S7 CMCON: 8 modun tümü — analog pin maskesi ve C1OUT/C2OUT (CIS, C1INV/C2INV, VREF)', () => {
  const { c, set } = cmpCore();
  c.mem.write(0x9F, 0xAC);
  const vr = vrefFormula(0xAC);
  const sets = [[1.0, 2.0, 3.0, 4.0], [4.0, 3.0, 2.0, 1.0], [2.0, 4.5, 0.5, 3.5], [3.2, 1.1, 2.4, 0.3]];
  let n = 0;
  for (let cm = 0; cm < 8; cm++) for (const cis of [0, 8]) for (const inv of [0, 0x10, 0x20, 0x30]) for (const V of sets) {
    c.mem.write(0x1F, cm | cis | inv); set(V);
    const t = CMTAB[cm], val = k => k === 'R' ? vr : V[k];
    const out = (f, invb) => { if (!f) return 0; const [m, p] = f(cis); return ((val(p) > val(m)) ? 1 : 0) ^ (invb ? 1 : 0); };
    const want = (out(t.c1, inv & 0x10) << 6) | (out(t.c2, inv & 0x20) << 7);
    const got = c.mem.read(0x1F);
    assert.strictEqual(got & 0xC0, want, 'CM=' + cm + ' CIS=' + (cis >> 3) + ' INV=' + (inv >> 4) + ' V=' + V + ' → ' + got.toString(16));
    assert.strictEqual(got & 0x3F, cm | cis | inv, 'kontrol bitleri korunur');
    assert.strictEqual(c.peek().analogA, t.an, 'analog maske CM=' + cm);
    c.P.inA = 0xFF; c.step();
    assert.strictEqual(c.mem.read(5) & 0x0F, ~t.an & 0x0F, 'PORTA okuması CM=' + cm);
    n++;
  }
  assert.strictEqual(n, 8 * 2 * 4 * 4);
});

test('S7 VRCON: 32 VREF değeri = veri sayfası formülü; mod 010 eşiği VREF\'te', () => {
  const { c, set } = cmpCore();
  for (const vrr of [0, 0x20]) for (let k = 0; k < 16; k++) {
    const vr = 0x80 | vrr | k, want = vrr ? k / 24 * 5 : 5 / 4 + k / 32 * 5;
    c.mem.write(0x9F, vr);
    assert(Math.abs(c.vref() - want) < 1e-9, 'VRCON=' + vr.toString(16) + ' → ' + c.vref() + ' / ' + want);
    assert.strictEqual(c.mem.read(0x9F), vr);
    c.mem.write(0x1F, 0x02);
    set([want - 0.01, 0, 0, 0]); assert.strictEqual(c.mem.read(0x1F) & 0x40, 0x40, 'RA0 < VREF → C1OUT = 1 (' + vr.toString(16) + ')');
    set([want + 0.01, 0, 0, 0]); assert.strictEqual(c.mem.read(0x1F) & 0x40, 0, 'RA0 > VREF → C1OUT = 0');
  }
  c.mem.write(0x9F, 0x2F); assert.strictEqual(c.vref(), 0, 'VREN = 0 → VREF kapalı (0 V)');
  c.mem.write(0x9F, 0xFF); assert.strictEqual(c.mem.read(0x9F), 0xEF, 'bit 4 uygulanmamış');
});

test('S7 CMIF: çıkış değişince kesme; CMCON okunmadan silinirse uyuşmazlık sürer; mod değişimi yanlış kesme verebilir', () => {
  const { c, set } = cmpCore(' goto start\n org 4\n movf CMCON,w\n movwf 0x71\n bcf PIR1,CMIF\n incf 0x70,f\n retfie\nstart\n clrf 0x70\n movlw 0xAC\n bsf STATUS,RP0\n movwf VRCON\n bcf STATUS,RP0\n movlw 0x12\n movwf CMCON\n movf CMCON,w\n bcf PIR1,CMIF\n bsf STATUS,RP0\n bsf PIE1,CMIE\n bcf STATUS,RP0\n bsf INTCON,PEIE\n bsf INTCON,GIE\nl goto l\n');
  set([1, 0, 0, 0]); c.run(200);
  assert.strictEqual(c.P.ram[0x70], 0, 'başlangıçta kesme yok');
  set([4, 0, 0, 0]); c.run(c.P.cyc + 100);
  assert.strictEqual(c.P.ram[0x70], 1, 'RA0 VREF\'i geçti → 1 kesme'); assert.strictEqual(c.P.ram[0x71] & 0x40, 0x40, 'ISR C1OUT = 1 okudu');
  set([3, 0, 0, 0]); c.run(c.P.cyc + 100); assert.strictEqual(c.P.ram[0x70], 1, 'çıkış değişmedi → kesme yok');
  set([1, 0, 0, 0]); c.run(c.P.cyc + 100); assert.strictEqual(c.P.ram[0x70], 2); assert.strictEqual(c.P.ram[0x71] & 0x40, 0);
  const d = cmpCore();
  d.c.mem.write(0x1F, 0x04); d.c.mem.read(0x1F); d.c.mem.write(0x0C, 0);
  d.set([1, 0, 0, 2]); assert.strictEqual(d.c.mem.read(0x0C) & 0x40, 0x40, 'CMIF kuruldu');
  d.c.mem.write(0x0C, 0); assert.strictEqual(d.c.mem.read(0x0C) & 0x40, 0x40, 'CMCON okunmadan CMIF silinemez (uyuşmazlık)');
  d.c.P.pc = 0; d.c.P.prog[0] = 0x081F; d.c.step();
  d.c.mem.write(0x0C, 0); assert.strictEqual(d.c.mem.read(0x0C) & 0x40, 0, 'movf CMCON,w uyuşmazlığı bitirir');
  d.c.mem.write(0x1F, 0x14); assert.strictEqual(d.c.mem.read(0x0C) & 0x40, 0x40, 'C1INV değişimi çıkışı çevirir → CMIF (veri sayfası: mod değişiminde kesmeyi kapatın)');
});

test('S7 mod 110: C1OUT → RA3, C2OUT → RA4 (açık-akaçlı), TRIS = 0 iken', () => {
  const ports = [];
  const c = mk(asm(HDR + ' org 0\n bsf STATUS,RP0\n movlw 0xE7\n movwf TRISA\n bcf STATUS,RP0\n clrf PORTA\n movlw 0x06\n movwf CMCON\nl goto l\n end\n'), { onPort: () => ports.push(c.drive()[1]) });
  const V = [1, 4, 2.5, 0];
  c.setAnalog(b => V[b]);
  c.run(40);
  assert.strictEqual(c.mem.read(0x1F) & 0xC0, 0x40, 'C1: RA2 > RA0 → 1, C2: RA2 < RA1 → 0');
  assert.strictEqual(c.drive()[1] & 0x18, 0x08, 'RA3 = C1OUT');
  assert.strictEqual(c.pinsA() & 0x18, 0x08, 'RA4 = 0 sürülür');
  V[0] = 4; V[1] = 1; c.analogChanged();
  assert.strictEqual(c.drive()[1] & 0x18, 0x10); assert.strictEqual(c.pinsA() & 0x10, c.P.inA & 0x10, 'RA4 = 1 → açık-akaç, sürülmez');
  assert(ports.length >= 2, 'çıkış değişimi onPort çağırır');
  c.mem.write(0x1F, 0x07); assert.strictEqual(c.drive()[1] & 0x18, 0, 'CM = 111 → RA3/RA4 yine PORTA mandalı');
});

test('S7 VROE: VREF RA2\'ye verilir (runner.setVref), runner bağlanınca/değişince yeniden bildirilir', () => {
  const calls = [];
  const rn = { aver: 0, picAnalog: b => [0, 0, 0, 0][b], setVref: v => calls.push(v) };
  const c = mk(asm(HDR + ' org 0\n movlw 0xE5\n bsf STATUS,RP0\n movwf VRCON\n bcf STATUS,RP0\nl goto l\n end\n'));
  c.attachRunner(() => rn);
  c.run(20);
  assert(Math.abs(calls[calls.length - 1] - 5 * 5 / 24) < 1e-9, 'VROE=1 → setVref(1.0417): ' + calls);
  c.mem.write(0x9F, 0xA5); assert.strictEqual(calls[calls.length - 1], null, 'VROE=0 → null');
  c.mem.write(0x9F, 0xC8); c.step(); assert(Math.abs(calls[calls.length - 1] - (1.25 + 8 * 5 / 32)) < 1e-9);
  const rn2 = Object.assign({}, rn, { setVref: v => calls.push(['rn2', v]) });
  c.attachRunner(() => rn2); c.step();
  assert.deepStrictEqual(calls[calls.length - 1], ['rn2', 2.5], 'yeni runner bildirim alır');
});

test('S7 performans: CMCON = 7 iken çevrim/port dizisi aynı, analog kaynak hiç sorgulanmaz', () => {
  let q = 0;
  const c = mk(fs.readFileSync(path.join(ROOT, 'projeler', 'Task1.hex'), 'utf8'));
  c.attachRunner(() => ({ aver: 0, picAnalog: () => { q++; return 0; }, setVref() { q++; } }));
  c.run(500000);
  assert.strictEqual(q, 0);
});

fs.rmSync(OUT, { recursive: true, force: true });
console.log('\n' + passed + ' geçti, ' + failed + ' başarısız');
process.exit(failed ? 1 : 0);
