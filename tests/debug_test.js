const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const PIC = require('../js/pic.js');
const IDE = require('../js/ide.js');
const TC = path.join(ROOT, 'toolchain');

let failed = 0, passed = 0, skipped = 0;
function test(name, fn) {
  try { const r = fn(); if (r === 'skip') { skipped++; console.log('skip ' + name); return; } passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e.stack || e.message || e).toString().split('\n').slice(0, 12).join('\n     ')); }
}

const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'eelab_dt_'));
const HELPER = `
import json, os, re, shutil, subprocess, sys, tempfile
sys.path.insert(0, ${JSON.stringify(ROOT)})
import server
name = sys.argv[1]
src = os.path.join(${JSON.stringify(ROOT)}, "projeler", name)
work = tempfile.mkdtemp(prefix="eelab_dbg_")
server.PROJ = work
server.SETTINGS = os.path.join(work, ".ayarlar.json")
for k in ("WORK", "CURRENT"):
    if hasattr(server, k):
        try: setattr(server, k, work)
        except Exception: pass
code = open(src).read()
try:
    r = server.build(name, code)
except TypeError:
    r = server.build(name, code, None)
out = {"ok": bool(r.get("ok")), "hex": r.get("hex", ""), "debug": r.get("debug"), "messages": r.get("messages", [])}
if out["ok"]:
    base, ext = name.rsplit(".", 1)
    tmp = tempfile.mkdtemp(prefix="eelab_dbgf_")
    syms, lines = [], []
    if ext == "c":
        server.build_c(base, code, 4000000, tmp)
        for m in re.finditer(r"^\\s*(_\\w+)\\s+0x([0-9a-fA-F]+)\\s+data", open(os.path.join(tmp, base + ".map")).read(), re.M):
            syms.append({"name": m.group(1)[1:], "raw": m.group(1), "addr": int(m.group(2), 16), "size": 2, "kind": "var"})
    else:
        open(os.path.join(tmp, name), "w").write(code)
        subprocess.run([os.path.join(server.TC, "bin", "gpasm"), "-p", "p16f628a", "-I", os.path.join(server.TC, "gpheader"), "-o", base + ".hex", name],
                       cwd=tmp, env=server.tool_env(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        lst = open(os.path.join(tmp, base + ".lst")).read()
        top = lst.split("SYMBOL TABLE")[0]
        seen = set()
        depth = 0
        for l in top.splitlines():
            m = re.match(r"^([0-9A-F]{4})   [0-9A-F]{4} +(\\d{5}) ", l)
            if m and int(m.group(1), 16) < 0x2000 and int(m.group(1), 16) not in seen:
                seen.add(int(m.group(1), 16)); lines.append([int(m.group(1), 16), int(m.group(2))])
        for m in re.finditer(r"^(\\w+)\\s+ADDRESS\\s+([0-9A-F]+)", lst, re.M):
            syms.append({"name": m.group(1), "raw": m.group(1), "addr": int(m.group(2), 16), "size": 0, "kind": "label"})
    shutil.rmtree(tmp, ignore_errors=True)
    out["fb"] = {"lang": ext, "file": name, "lines": lines or None, "symbols": syms, "fallback": True}
shutil.rmtree(work, ignore_errors=True)
print(json.dumps(out))
`;
fs.writeFileSync(path.join(OUT, 'dbg_helper.py'), HELPER);
function buildDbg(name) {
  const r = cp.spawnSync('python3', [path.join(OUT, 'dbg_helper.py'), name], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error('derleme yardımcısı: ' + r.stdout + r.stderr);
  const o = JSON.parse(r.stdout.trim().split('\n').pop());
  if (!o.ok) throw new Error(name + ' derlenemedi: ' + o.messages.join('\n'));
  return o;
}
function pickDebug(o, need) {
  if (o.debug && need(o.debug)) return o.debug;
  console.log('     (sunucunun debug bilgisi bu test için eksik' + (o.debug ? '' : ' / yok') + '; .map/.lst yedeği kullanıldı)');
  return o.fb;
}

function asm(src) {
  const f = path.join(OUT, 'probe' + (asm.n = (asm.n || 0) + 1));
  fs.writeFileSync(f + '.asm', src);
  const r = cp.spawnSync(path.join(TC, 'bin', 'gpasm'), ['-p', 'p16f628a', '-I', path.join(TC, 'gpheader'), '-o', f + '.hex', f + '.asm'],
    { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', GPUTILS_HEADER_PATH: path.join(TC, 'gpheader') } });
  if (r.status !== 0) throw new Error('gpasm: ' + r.stdout + r.stderr);
  return fs.readFileSync(f + '.hex', 'utf8');
}
const HDR = ' list p=16f628a\n #include <p16f628a.inc>\n __config _INTOSC_OSC_NOCLKOUT & _WDT_OFF & _MCLRE_OFF & _LVP_OFF\n';
function mk(hex, opts) { const c = PIC.create(opts || {}); c.load(PIC.parseHex(hex)); c.reset(); return c; }
const addrOf = (c, op, from) => { for (let a = from || 0; a < 2048; a++) if (c.P.prog[a] === op) return a; return -1; };

const NEST = asm(HDR + ' org 0\n goto start\n org 4\n incf 0x70,f\n bcf INTCON,T0IF\n retfie\n' +
  'start\n clrf 0x71\nloop\n call s1\n incf 0x71,f\n goto loop\n' +
  's1\n nop\n call s2\n nop\n return\n' +
  's2\n movlw 5\n movwf 0x72\n return\n end\n');
const L = { start: 7, loop: 8, s1: 11, s2: 15 };

test('core.bp: breakpoint adresinde durur, devam edince tekrar durur, temizlenince çalışır', () => {
  const c = mk(NEST);
  assert.deepStrictEqual(c.bp.list(), []);
  c.bp.set(L.s2);
  assert(c.bp.has(L.s2));
  let r = c.runDbg(10000);
  assert.deepStrictEqual([r.stop, r.pc, r.done], ['bp', L.s2, false]);
  const c1 = c.P.cyc;
  r = c.runDbg(10000);
  assert.deepStrictEqual([r.stop, r.pc], ['bp', L.s2]);
  assert.strictEqual(c.P.cyc - c1, 15, "bir döngü 15 çevrim");
  c.bp.clear(L.s2);
  assert.deepStrictEqual(c.bp.list(), []);
  r = c.runDbg(10000);
  assert.deepStrictEqual([r.stop, r.done], [null, true]);
  assert(c.P.cyc >= 10000);
  c.bp.set(1); c.bp.set(2); c.bp.clearAll();
  assert.deepStrictEqual(c.bp.list(), []);
});

test('core.runDbg breakpoint yokken run() ile birebir aynı (Task1/Task2 dondurulmuş HEX)', () => {
  for (const f of ['Task1', 'Task2']) {
    const hex = fs.readFileSync(path.join(ROOT, 'projeler', f + '.hex'), 'utf8');
    const hashes = [];
    for (const dbg of [false, true]) {
      let H = 0, c;
      c = mk(hex, { onPort: () => { H = (H * 31 + c.P.latA * 7 + c.P.latB * 131 + c.P.cyc) % 1000000007; } });
      const go = e => dbg ? c.runDbg(e) : c.run(e);
      go(300000); c.P.inA = 0x20; go(350000); c.P.inA = 0; go(2350000); c.P.inA = 0x40; go(2400000); c.P.inA = 0; go(3000000);
      hashes.push([H, c.P.pc, c.P.w, c.P.cyc]);
    }
    assert.deepStrictEqual(hashes[1], hashes[0], f);
  }
});

test('core.runDbg breakpoint varken de aynı çevrim dizisi (yalnız durur)', () => {
  const hex = fs.readFileSync(path.join(ROOT, 'projeler', 'Task2.hex'), 'utf8');
  const a = mk(hex), b = mk(hex);
  a.run(400000);
  b.bp.set(0x7FF);
  const r = b.runDbg(400000);
  assert.strictEqual(r.done, true);
  assert.deepStrictEqual([b.P.cyc, b.P.pc, b.P.w, b.P.latA, b.P.latB], [a.P.cyc, a.P.pc, a.P.w, a.P.latA, a.P.latB]);
  assert.deepStrictEqual(Array.from(b.P.ram), Array.from(a.P.ram));
});

test('core.stepOver: call üzerinden geçer, yığın derinliği korunur', () => {
  const c = mk(NEST);
  c.bp.set(L.loop); c.runDbg(1000); c.bp.clearAll();
  assert.strictEqual(c.P.pc, L.loop);
  const d = c.depth(), c0 = c.P.cyc;
  const r = c.stepOver();
  assert.deepStrictEqual([r.stop, r.pc, c.depth()], ['step', L.loop + 1, d]);
  assert.strictEqual(c.P.cyc - c0, 12, "call s1 alt ağacı çevrimi");
  assert.strictEqual(c.P.ram[0x72], 5);
  const r2 = c.stepOver();
  assert.deepStrictEqual([r2.stop, r2.pc], ['step', L.loop + 2]);
});

test('core.stepOver: alt programdaki breakpoint\'te durur', () => {
  const c = mk(NEST);
  c.bp.set(L.loop); c.runDbg(1000);
  c.bp.set(L.s2);
  const r = c.stepOver();
  assert.deepStrictEqual([r.stop, r.pc], ['bp', L.s2]);
});

test('core.stepOut: iç içe çağrıdan çağırana döner', () => {
  const c = mk(NEST);
  c.bp.set(L.s2); c.runDbg(1000); c.bp.clearAll();
  assert.strictEqual(c.depth(), 2);
  assert.deepStrictEqual(c.stack(), [L.s1 + 2, L.loop + 1]);
  let r = c.stepOut();
  assert.deepStrictEqual([r.stop, r.pc, c.depth()], ['step', L.s1 + 2, 1]);
  r = c.stepOut();
  assert.deepStrictEqual([r.stop, r.pc, c.depth()], ['step', L.loop + 1, 0]);
  assert.strictEqual(c.stepOut().stop, 'none');
});

const IRQ = asm(HDR + ' org 0\n goto start\n org 4\n incf 0x70,f\n bcf INTCON,T0IF\n retfie\n' +
  'start\n bsf STATUS,RP0\n movlw 0x08\n movwf OPTION_REG\n bcf STATUS,RP0\n clrf 0x70\n bsf INTCON,T0IE\n bsf INTCON,GIE\n' +
  'loop\n call sub\n incf 0x71,f\n goto loop\nsub\n nop\n nop\n nop\n nop\n return\n end\n');

test('core.stepOver/stepOut kesme sırasında: ISR çalışır, adım tamamlanır', () => {
  const c = mk(IRQ);
  const loop = addrOf(c, 0x2000 | (addrOf(c, 0x0008) - 4));
  assert(loop > 0);
  let seen = 0;
  for (let i = 0; i < 400; i++) {
    const pc0 = c.P.pc, d0 = c.depth(), k0 = c.P.ram[0x70];
    const r = c.stepOver();
    assert.strictEqual(c.depth(), d0, 'derinlik');
    assert.notStrictEqual(r.pc, 4, 'stepOver ISR içinde durmamalı');
    if (c.P.ram[0x70] !== k0) { seen++; assert.notStrictEqual(r.pc, pc0, 'kesmeden sonra komut da yürütülmeli'); }
  }
  assert(seen >= 2, 'kesme sayısı ' + seen);
  c.bp.set(4); c.runDbg(c.P.cyc + 5000); c.bp.clearAll();
  assert.strictEqual(c.P.pc, 4);
  const ret = c.stack()[0];
  const r = c.stepOut();
  assert.deepStrictEqual([r.stop, r.pc], ['step', ret]);
  assert(c.P.ram[0x0B] & 0x80, 'RETFIE GIE');
});

test('core.stepIn: SLEEP\'te uyanana kadar ilerler', () => {
  const c = mk(asm(HDR + ' org 0\n goto start\n org 4\n bcf INTCON,INTF\n retfie\nstart\n bsf INTCON,INTE\n sleep\n incf 0x71,f\nl goto l\n end\n'));
  c.run(50);
  assert(c.P.sleep);
  const r = c.stepIn(5000);
  assert.strictEqual(r.stop, 'limit');
  c.P.inB = 1;
  const r2 = c.stepIn(5000);
  assert.strictEqual(r2.stop, 'step');
  assert(!c.P.sleep);
});

test('core.stepLine: satır başı adreslerinde durur; over alt programı atlar', () => {
  const c = mk(NEST);
  const stops = new Uint8Array(2048);
  for (const a of [L.start, L.loop, L.loop + 1, L.loop + 2, L.s1, L.s1 + 1, L.s1 + 2, L.s1 + 3]) stops[a] = 1;
  c.bp.set(L.loop); c.runDbg(1000); c.bp.clearAll();
  let r = c.stepLine(stops, false);
  assert.deepStrictEqual([r.stop, r.pc], ['step', L.s1]);
  r = c.stepLine(stops, false);
  assert.strictEqual(r.pc, L.s1 + 1);
  r = c.stepLine(stops, false);
  assert.strictEqual(r.pc, L.s1 + 2, 's2 içinde satır yok → s2 bitince durur');
  c.reset(); c.bp.set(L.loop); c.runDbg(1000); c.bp.clearAll();
  r = c.stepLine(stops, true);
  assert.deepStrictEqual([r.stop, r.pc], ['step', L.loop + 1]);
});

test('core.mem: banka çözümlü okuma/yazma, PORTB yazımı latch + onPort', () => {
  let ports = 0;
  const c = mk(NEST, { onPort: () => ports++ });
  ports = 0;
  c.mem.write(0x86, 0x00);
  c.mem.write(0x06, 0x5A);
  assert.strictEqual(c.P.latB, 0x5A);
  assert(ports >= 2, 'onPort çağrıları ' + ports);
  assert.strictEqual(c.mem.read(0x06), 0x5A);
  assert.strictEqual(c.mem.read(0x106), 0x5A, 'bank 2 yansıması');
  assert.strictEqual(c.mem.read(0x86), 0, 'TRISB');
  c.mem.write(0x120, 0x33);
  assert.strictEqual(c.P.ram[0x120], 0x33);
  assert.strictEqual(c.mem.read(0x120), 0x33);
  c.mem.write(0x75, 0x44);
  assert.strictEqual(c.mem.read(0xF5), 0x44, '0x70-0x7F ortak');
  assert.strictEqual(c.mem.read(0x1F5), 0x44);
  assert.strictEqual(c.mem.valid(0x07), false);
  c.mem.write(0x04, 0x120);
  c.mem.write(0x04, 0x20); c.mem.write(0x00, 0x99);
  assert.strictEqual(c.P.ram[0x20], 0x99, 'INDF üzerinden');
  c.mem.write(0x03, 0x20);
  assert.strictEqual(c.P.ram[3], 0x20);
  c.mem.write(0x03, 0x18);
  c.mem.write(0x0A, 0); c.mem.write(0x02, 0x08);
  assert.strictEqual(c.P.pc, 8);
  assert.strictEqual(c.ee.length, 128);
  assert.strictEqual(c.ee, c.P.ee);
});

test('PIC.disasm', () => {
  const D = (op, a, o) => PIC.disasm(op, a, o);
  assert.strictEqual(D(0x3007), 'movlw 0x07');
  assert.strictEqual(D(0x0086), 'movwf PORTB');
  assert.strictEqual(D(0x0086, 0, { bank: 1 }), 'movwf TRISB');
  assert.strictEqual(D(0x1683), 'bsf STATUS, RP0');
  assert.strictEqual(D(0x1D0B), 'btfss INTCON, T0IF');
  assert.strictEqual(D(0x0AB0), 'incf 0x30, f');
  assert.strictEqual(D(0x0AB0, 0, { bank: 2, names: { 0x130: 'ones' } }), 'incf ones, f');
  assert.strictEqual(D(0x0830), 'movf 0x30, w');
  assert.strictEqual(D(0x2804), 'goto 0x004');
  assert.strictEqual(D(0x2004, 0, { labels: { 4: 'isr' } }), 'call isr');
  assert.strictEqual(D(0x0008), 'return');
  assert.strictEqual(D(0x0009), 'retfie');
  assert.strictEqual(D(0x0063), 'sleep');
  assert.strictEqual(D(0x0103), 'clrw');
  assert.strictEqual(D(0x0185), 'clrf PORTA');
  assert.strictEqual(D(0x3C10), 'sublw 0x10');
  assert.strictEqual(D(0x3E01), 'addlw 0x01');
  assert.strictEqual(D(0x3400), 'retlw 0x00');
  assert.strictEqual(D(0x0000), 'nop');
  assert(PIC.SFR.some(s => s[0] === 'OPTION_REG' && s[1] === 0x81));
});

test('Task1.c: ones++ satırına breakpoint → kronometre 100 605 çevrim (100,605 ms @ 4 MHz)', () => {
  const o = buildDbg('Task1.c');
  const c = mk(o.hex);
  const src0 = fs.readFileSync(path.join(ROOT, 'projeler', 'Task1.c'), 'utf8').split('\n');
  const ln0 = src0.findIndex(l => /^\s*ones\+\+;/.test(l)) + 1;
  const dbg = pickDebug(o, d => d.lines && IDE.map.lineAddrs(d, ln0).length && d.symbols && d.symbols.some(s => s.name === 'ones'));
  const src = fs.readFileSync(path.join(ROOT, 'projeler', 'Task1.c'), 'utf8').split('\n');
  const line = src.findIndex(l => /^\s*ones\+\+;/.test(l)) + 1;
  let bp;
  if (dbg.lines && !dbg.fallback) {
    const as = IDE.map.lineAddrs(dbg, line);
    assert(as.length, 'ones++ satırı (' + line + ') debug.lines içinde yok');
    bp = as[0];
    const v = dbg.symbols.find(s => s.name === 'ones');
    assert(v && v.size === 2, 'ones sembolü');
  } else {
    const v = dbg.symbols.find(s => s.name === 'ones');
    bp = addrOf(c, 0x0A80 | (v.addr & 0x7F));
    assert(bp > 0);
  }
  c.bp.set(bp);
  c.runDbg(200000);
  c.P.inA = 0x20; c.runDbg(260000); c.P.inA = 0;
  const hits = [];
  for (let i = 0; i < 4; i++) { const r = c.runDbg(c.P.cyc + 1e6); assert.strictEqual(r.stop, 'bp'); assert.strictEqual(r.pc, bp); hits.push(c.P.cyc); }
  const d = hits.slice(1).map((x, i) => x - hits[i]);
  assert.deepStrictEqual(d, [100605, 100605, 100605]);
  assert.strictEqual((d[0] * 4 / 4e6 * 1000).toFixed(3), '100.605');
  if (dbg.symbols) {
    const v = dbg.symbols.find(s => s.name === 'ones');
    const val = c.mem.read(v.addr) | (c.mem.read(v.addr + 1) << 8);
    assert.strictEqual(val, 3, 'ones izleme değeri');
  }
});

test('Lab2.asm: etiket breakpoint\'i ve tek adım', () => {
  const o = buildDbg('Lab2.asm');
  const c = mk(o.hex);
  const dbg = pickDebug(o, d => d.lines && d.lines.length > 20 && d.symbols && d.symbols.some(s => s.name === 'loopTop'));
  const top = dbg.symbols.find(s => s.name === 'loopTop');
  assert(top, 'loopTop sembolü');
  assert.strictEqual(top.addr, 0x1C);
  c.bp.set(top.addr);
  let r = c.runDbg(5000);
  assert.deepStrictEqual([r.stop, r.pc], ['bp', 0x1C]);
  assert.strictEqual(c.mem.read(0x36), 10, 'ii');
  r = c.stepIn();
  assert.strictEqual(r.pc, 0x1D);
  assert.strictEqual(c.P.w, 1);
  if (dbg.lines) {
    const ln = IDE.map.addrLine(dbg, 0x1D);
    const text = fs.readFileSync(path.join(ROOT, 'projeler', 'Lab2.asm'), 'utf8').split('\n')[ln - 1];
    assert(/andwf\s+INDF/.test(text), 'satır ' + ln + ': ' + text);
  }
  let n = 0;
  while ((r = c.runDbg(c.P.cyc + 5000)).stop === 'bp') n++;
  assert.strictEqual(n, 9, 'kalan döngü sayısı');
  assert.strictEqual(c.pinsB(), 4);
});

test('hız: breakpoint\'siz runDbg, run() hızının %5 içinde', () => {
  const hex = fs.readFileSync(path.join(ROOT, 'projeler', 'Task2.hex'), 'utf8');
  const c = mk(hex, { onPort() {} });
  const once = fn => { c.reset(); const t = process.hrtime.bigint(); fn(); return Number(process.hrtime.bigint() - t) / 1e6; };
  once(() => c.run(3e6));
  let a = 1e9, b = 1e9;
  for (let k = 0; k < 7; k++) { a = Math.min(a, once(() => c.run(6e6))); b = Math.min(b, once(() => c.runDbg(6e6))); }
  c.bp.set(0x7FF);
  let d = 1e9;
  for (let k = 0; k < 3; k++) d = Math.min(d, once(() => c.runDbg(6e6)));
  console.log('     run ' + a.toFixed(1) + ' ms, runDbg(0 bp) ' + b.toFixed(1) + ' ms, runDbg(1 bp) ' + d.toFixed(1) + ' ms / 6M çevrim');
  assert(b <= a * 1.05 + 2, 'runDbg ' + b + ' > run ' + a);
});

const DEBUG = require('../js/debug.js');
const CFG_HELPER = `
import json, os, shutil, sys, tempfile
sys.path.insert(0, ${JSON.stringify(ROOT)})
import server
name, cfg, fosc = sys.argv[1], sys.argv[2], int(sys.argv[3])
work = tempfile.mkdtemp(prefix="eelab_cfg_")
server.set_workspace(work)
src = name if os.path.isabs(name) else os.path.join(${JSON.stringify(ROOT)}, "projeler", name)
name = os.path.basename(name)
server.update_settings(name, {"fosc": fosc, "config": None if cfg == "-" else int(cfg, 0)})
r = server.build(name, open(src).read())
shutil.rmtree(work, ignore_errors=True)
print(json.dumps({"ok": bool(r.get("ok")), "hex": r.get("hex", ""), "debug": r.get("debug"), "src": r.get("configSource"), "messages": r.get("messages", [])}))
`;
fs.writeFileSync(path.join(OUT, 'cfg_helper.py'), CFG_HELPER);
function buildCfg(name, cfg, fosc) {
  const r = cp.spawnSync('python3', [path.join(OUT, 'cfg_helper.py'), name, cfg == null ? '-' : String(cfg), String(fosc || 4000000)], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error('derleme yardımcısı: ' + r.stdout + r.stderr);
  const o = JSON.parse(r.stdout.trim().split('\n').pop());
  if (!o.ok) throw new Error(name + ' derlenemedi: ' + o.messages.join('\n'));
  return o;
}

test('İstatistik: .map bölümlerinden fonksiyon başına word; toplam = ROM; veri bölümleri birleşir', () => {
  const d = { lang: 'c', rom: 100, ram: 12, config: 0x3F10, symbols: [{ name: 'sayac', addr: 0x20, size: 2, kind: 'var' }, { name: 'x', addr: 0x22, size: 1, kind: 'var', scope: 'main' }],
    code: [{ name: 'STARTUP', sec: 'STARTUP', addr: 0, words: 2, kind: 'sys' }, { name: 'main', sec: 'S_T__main', addr: 2, words: 60, kind: 'user' },
      { name: 'mc_delay_ms', sec: 'S_T__mc_delay_ms', addr: 62, words: 24, kind: 'lib' }, { name: 'IDD_T_0_i', sec: 'IDD_T_0_i', addr: 86, words: 2, kind: 'data' },
      { name: '.cinit', sec: '.cinit', addr: 88, words: 12, kind: 'data' }] };
  const st = DEBUG.stats(d, null);
  assert.deepStrictEqual(st.rows.map(r => [r.name, r.kind, r.words]), [['main', 'user', 60], ['mc_delay_ms', 'lib', 24], ['Sabit / ilk değer verisi', 'data', 14], ['Reset vektörü (STARTUP)', 'sys', 2]]);
  assert.deepStrictEqual(st.byKind, { user: 60, lib: 24, sys: 2, data: 14 });
  assert.strictEqual(st.rows.reduce((a, r) => a + r.words, 0), st.rom);
  assert.deepStrictEqual([st.rom, st.romMax, st.ram, st.ramMax, st.config], [100, 2048, 12, 224, 0x3F10]);
  assert.deepStrictEqual(st.vars.map(v => v.name), ['sayac', 'x']);
  assert.strictEqual(DEBUG.stats(null), null);
});

test('İstatistik: assembly — etiketler arası dolu word sayısı (HEX\'ten)', () => {
  const prog = new Uint16Array(2048).fill(0x3FFF);
  for (let a = 0; a < 3; a++) prog[a] = 0x2800;
  for (let a = 5; a < 15; a++) prog[a] = 0x0000;
  for (let a = 20; a < 24; a++) prog[a] = 0x0008;
  const d = { lang: 'asm', rom: 0, ram: 2, symbols: [{ name: 'basla', addr: 5, kind: 'label' }, { name: 'dongu', addr: 8, kind: 'label' }, { name: 'alt', addr: 20, kind: 'label' }, { name: 'sayac', addr: 0x20, size: 1, kind: 'var' }] };
  const st = DEBUG.stats(d, prog);
  assert.strictEqual(st.rom, 17);
  assert.deepStrictEqual(st.rows.map(r => [r.name, r.words]), [['dongu', 7], ['alt', 4], ['(ilk etiketten önce)', 3], ['basla', 3]]);
  assert.strictEqual(st.rows.reduce((a, r) => a + r.words, 0), 17);
});

test('İstatistik: gerçek derleme (Task1.c, Timer0_Interrupt.c) — bölüm toplamı = HEX ROM, main/interrupt kullanıcı kodu', () => {
  for (const n of ['Task1.c', 'Timer0_Interrupt.c']) {
    const o = buildDbg(n), d = o.debug;
    if (!d || !d.code) return 'skip';
    const st = DEBUG.stats(d, null);
    let rom = 0;
    for (const l of o.hex.split(/\r?\n/)) if (l.startsWith(':') && l.slice(7, 9) === '00' && parseInt(l.slice(3, 7), 16) < 0x1000) rom += parseInt(l.slice(1, 3), 16) / 2;
    assert.strictEqual(st.rom, rom, n);
    assert.strictEqual(st.rows.reduce((a, r) => a + r.words, 0), rom, n + ' toplam');
    assert(st.rows.some(r => r.name === 'main' && r.kind === 'user' && r.words > 20), n);
    if (n === 'Timer0_Interrupt.c') assert(st.rows.some(r => r.name === 'interrupt' && r.kind === 'user'));
    const main = st.rows.find(r => r.name === 'main');
    assert(IDE.map.addrLine(d, main.addr) == null || IDE.map.addrLine(d, main.addr) > 0);
  }
});

test('Config bitleri: varsayılan ve açıkça aynı değer Ek B md5\'ini korur; WDT açık → 0x3F14 HEX\'e yazılır ve çekirdek WDT reset\'i yapar', () => {
  const crypto = require('crypto'), md5 = s => crypto.createHash('md5').update(s).digest('hex');
  const gold = '99437e695fd25fb340041117b14fee2c';
  const a = buildCfg('Task1.c', null), b = buildCfg('Task1.c', 0x3F10), w = buildCfg('Task1.c', 0x3F14);
  assert.strictEqual(md5(a.hex), gold);
  assert.strictEqual(md5(b.hex), gold);
  assert.deepStrictEqual([a.src, b.src, w.src], ['default', 'settings', 'settings']);
  assert.strictEqual(PIC.parseHex(w.hex).cfg, 0x3F14);
  assert.strictEqual(w.debug.config, 0x3F14);
  const wsrc = path.join(OUT, 'Wdt_Sayac.c');
  fs.writeFileSync(wsrc, 'unsigned char n = 0;\nvoid main() {\n\tCMCON = 7;\n\tOPTION_REG = 0x08;\n\tTRISB = 0;\n\tPORTB = 0;\n\twhile(1) {\n\t\tDelay_ms(5);\n\t\tn++;\n\t\tPORTB = n;\n\t}\n}\n');
  const run = hex => { const c = mk(hex, { onPort() {} }); let maxB = 0, wdt = 0; for (let t = 0; t < 40; t++) { c.run(c.P.cyc + 10000, 1e4); maxB = Math.max(maxB, c.mem.read(6)); if (!(c.mem.read(3) & 0x10)) wdt++; } return { maxB, wdt, cyc: c.P.cyc }; };
  const off = run(buildCfg(wsrc, null).hex), on = run(buildCfg(wsrc, 0x3F14).hex);
  assert(off.maxB >= 50 && off.wdt === 0, 'WDT kapalı: sayaç ilerler ' + JSON.stringify(off));
  assert(on.maxB > 0 && on.maxB <= 5 && on.wdt > 0, 'WDT açık: ~18 ms\'de reset, sayaç 5 ms × 4\'ü geçemez ' + JSON.stringify(on));
  const h8 = buildCfg('Task1.c', null, 8000000);
  assert.strictEqual(PIC.parseHex(h8.hex).cfg, 0x3F02, '8 MHz varsayılan HS');
  const asmw = buildCfg('Lab2.asm', 0x3F14);
  assert.strictEqual(PIC.parseHex(asmw.hex).cfg, 0x3F14, 'assembly: ayar HEX\'teki config word\'ü değiştirir');
  assert.strictEqual(asmw.src, 'settings');
  assert.strictEqual(buildCfg('Lab2.asm', null).src, 'source');
});

test('Watch biçimleri: float/işaretli/ikili, parseVal, popup.regs üst satırı = PC\'deki komutun ayrıştırması', () => {
  assert.strictEqual(DEBUG.fmtVal(0x40490FDB, 'float', 4), '3.141593');
  assert.strictEqual(DEBUG.fmtVal(0xFFFE, 'sdec', 2), '-2');
  assert.strictEqual(DEBUG.fmtVal(0xFE, 'bin', 1), '1111 1110');
  assert.strictEqual(DEBUG.parseVal('3.5', 'float'), 0x40600000);
  assert.strictEqual(DEBUG.parseVal('1111 0000', 'bin'), 0xF0);
  assert.strictEqual(DEBUG.parseVal('ff', 'hex'), 255);
  assert(Number.isNaN(DEBUG.parseVal('abc', 'dec')));
  const hex = fs.readFileSync(path.join(ROOT, 'projeler', 'Task2.hex'), 'utf8');
  const c = mk(hex);
  c.step(); c.step();
  const r = DEBUG.popup.regs(c, PIC, null);
  assert.strictEqual(r.top, PIC.disasm(c.P.prog[c.P.pc & 2047], c.P.pc & 0x1FFF, { bank: (c.mem.read(3) >> 5) & 3, names: {}, labels: {} }));
  assert.deepStrictEqual(r.rows.map(x => x[0]), ['W', 'STATUS', 'PCL', 'PCLATH', 'FSR', 'INTCON', 'OPTION', 'TRISA', 'TRISB', 'PORTA', 'PORTB']);
  assert.strictEqual(DEBUG.popup.data(c).length, 32);
  assert.strictEqual(DEBUG.popup.eeprom(c).length, 8);
  const pg = DEBUG.popup.prog(c, PIC, null, 0, 8);
  assert.strictEqual(pg.length, 8); assert.strictEqual(pg[0].addr, 0);
});

test('.lst: Task2 derlemesi — 0x0000 satırı mikroC biçiminde (SDCC reset vektörü NOP, hemen ardından GOTO); satır açıklamaları', () => {
  const o = buildDbg('Task2.c');
  const c = mk(o.hex);
  const src = fs.readFileSync(path.join(ROOT, 'projeler', 'Task2.c'), 'utf8');
  const dbg = pickDebug(o, d => d.lines && d.lines.length);
  const lst = IDE.outputs.lstText({ PIC, prog: c.P.prog, debug: dbg, src, file: 'Task2.c' }).split('\n');
  const rows = lst.filter(l => /^0x/.test(l));
  // plan: ilk satır /^0x0000\t0x[0-9A-F]{4}\s+\tGOTO\s+\d+$/; SDCC çıktısında 0x0000 NOP'tur, GOTO 0x0001'de başlar
  assert(/^0x0000\t0x[0-9A-F]{4}\s+\t(?:GOTO\s+\d+|NOP\s*)$/.test(rows[0]), rows[0]);
  assert(rows.slice(0, 2).some(r => /^0x000[01]\t0x[0-9A-F]{4}\s+\tGOTO\s+\d+$/.test(r)), 'ilk iki satırda GOTO yok');
  assert(lst.some(l => /^;Task2\.c,\d+ :: /.test(l)), 'kaynak satır açıklaması yok');
  assert(rows.every(l => /^0x[0-9A-F]{4}\t0x[0-9A-F]{4} +\t[A-Z]+/.test(l)), 'biçim');
});

fs.rmSync(OUT, { recursive: true, force: true });
console.log('\n' + passed + ' geçti, ' + failed + ' başarısız' + (skipped ? ', ' + skipped + ' atlandı' : ''));
process.exit(failed ? 1 : 0);
