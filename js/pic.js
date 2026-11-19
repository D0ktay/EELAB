(function (root) {
  'use strict';
  const MAP = new Int16Array(512);
  for (let a = 0; a < 512; a++) {
    const bank = a >> 7, lo = a & 0x7F;
    let m = -1;
    if (lo >= 0x70) m = lo;
    else if (lo === 0 || lo === 2 || lo === 3 || lo === 4 || lo === 0x0A || lo === 0x0B) m = lo;
    else if (bank < 2) m = a;
    else if (bank === 2) m = lo === 1 ? 1 : lo === 6 ? 6 : lo >= 0x20 && lo < 0x50 ? a : -1;
    else m = lo === 1 ? 0x81 : lo === 6 ? 0x86 : -1;
    MAP[a] = m;
  }
  for (const x of [7, 8, 9, 0x0D, 0x13, 0x14, 0x1B, 0x1C, 0x1D, 0x1E, 0x87, 0x88, 0x89, 0x8D, 0x8F, 0x90, 0x91, 0x93, 0x94, 0x95, 0x96, 0x97, 0x9E]) MAP[x] = -1;
  const SR = new Uint8Array(512);
  for (const x of [0, 2, 5, 6, 0x1A, 0x1F, 0x9D]) SR[x] = 1;
  const SW = new Uint8Array(512);
  for (const x of [0, 1, 2, 3, 5, 6, 0x0B, 0x0C, 0x0E, 0x0F, 0x11, 0x12, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1F, 0x81, 0x85, 0x86, 0x98, 0x99, 0x9C, 0x9D, 0x9F]) SW[x] = 1;
  const KEEP = [1, 4, 0x0E, 0x0F, 0x10, 0x15, 0x16, 0x9A, 0x9B];
  const PROPS = { wdtPeriod: 0.018, eeWriteDelay: 0.010, cfgDefault: 0x3F6B, eePersist: true, warnUnimpl: false };
  const hx = (v, n) => '0x' + v.toString(16).toUpperCase().padStart(n, '0');
  const T2DIV = [1, 4, 16, 16];
  const VDD = 5;
  const AMASK = [0x0F, 0x0F, 0x0F, 0x07, 0x0F, 0x06, 0x07, 0x00];
  const vrefOf = vr => !(vr & 0x80) ? 0 : (vr & 0x20) ? (vr & 15) * VDD / 24 : VDD / 4 + (vr & 15) * VDD / 32;
  const OSC = ['LP', 'XT', 'HS', 'EC', 'INTOSC', 'INTOSC (CLKOUT)', 'ER', 'ER (CLKOUT)'];

  function parseHex(t) {
    const prog = new Uint16Array(2048).fill(0x3FFF), ee = new Uint8Array(128).fill(255);
    let base = 0, n = 0, cfg = null, eeN = 0;
    for (const line of String(t).split(/\r?\n|\r/)) {
      if (line[0] !== ':') continue;
      const len = parseInt(line.substr(1, 2), 16), addr = parseInt(line.substr(3, 4), 16), typ = parseInt(line.substr(7, 2), 16);
      if (typ === 4) { base = parseInt(line.substr(9, 4), 16) * 65536; continue; }
      if (typ !== 0) continue;
      for (let i = 0; i + 1 < len; i += 2) {
        const w = parseInt(line.substr(9 + 2 * i, 2), 16) | (parseInt(line.substr(11 + 2 * i, 2), 16) << 8), wa = (base + addr + i) >> 1;
        if (wa < 2048) { prog[wa] = w & 0x3FFF; n++; }
        else if (wa === 0x2007) cfg = w & 0x3FFF;
        else if (wa >= 0x2100 && wa < 0x2180) { ee[wa - 0x2100] = w & 255; eeN++; }
      }
    }
    return { prog, n, cfg, ee, eeN };
  }

  function decodeConfig(cfg) {
    if (cfg == null) return null;
    const f = (cfg & 3) | ((cfg >> 2) & 4);
    return { word: cfg, fosc: f, osc: OSC[f], intosc: f === 4 || f === 5, wdt: !!(cfg & 4), pwrt: !(cfg & 8), mclr: !!(cfg & 0x20), boren: !!(cfg & 0x40), lvp: !!(cfg & 0x80), cpd: !(cfg & 0x100), cp: !(cfg & 0x2000) };
  }

  function create(opts) {
    opts = opts || {};
    const P = {
      prog: new Uint16Array(2048).fill(0x3FFF), ram: new Uint8Array(512), pc: 0, w: 0, cyc: 0,
      stack: new Uint16Array(8), sp: 0, latA: 0, latB: 0, inA: 0, inB: 0, flB: 0, loaded: false,
      cfg: null, ee: new Uint8Array(128).fill(255), eeInit: new Uint8Array(128).fill(255), sleep: false, fosc: 4000000, inReset: false
    };
    const R = P.ram;
    const props = Object.assign({}, PROPS, opts.props || {});
    const warned = new Set();
    function warn(mod, text) {
      const pc = (P.pc - 1) & 0x1FFF, key = pc + ' ' + text;
      if (warned.has(key)) return;
      warned.add(key);
      if (opts.onWarn) opts.onWarn({ mod, pc, cyc: P.cyc, text });
    }
    let held = false, mclrLv = 1;
    let t0ps = 0, t0inh = 0, t1ps = 0, t1rst = 0, t2ps = 0, t2post = 0;
    let ccpOut = 0, pwmFall = Infinity, capCnt = 0;
    let txBusy = 0, txFull = 0, txReg = 0, txData = 0, tx9 = 0, txBits = 10, txBc = 1, txStart = 0, txLine = 1;
    let rxBusy = 0, rxData = 0, rxEnd = 0, rxErr = 0;
    const rxQ = [], rxF = [], rxQE = [], rxFE = [];
    let eeSeq = 0, eeBusy = 0, eeEnd = 0, eeAddr = 0, eeData = 0;
    let wdtStart = 0, skipInt = 0, rbLatch = 0, prevPA = 0, prevPB = 0, iA = -1, iB = -1, fB = -1, pdirty = 1;
    let depth = 0, bpN = 0;
    let cmOn = false, cmLatch = 0, cmRaw = 0, anaFn = null, anaRun = null, anaRn = null, anaVer = -1, vrefSent, vrefRn = null, anaPoll = false;
    const bpA = new Uint8Array(2048);

    const ccpMode = () => R[0x17] & 15;
    const ccpDrives = () => { const m = R[0x17] & 15; return m === 8 || m === 9 || m >= 12; };
    const spen = () => R[0x18] & 0x80;
    function trisBe() { let t = R[0x86]; if (R[0x18] & 0x80) t = (t | 2) & ~4; return t & 255; }
    function latBe() {
      let l = P.latB;
      if (R[0x18] & 0x80) l = (l & ~4) | (txLine << 2);
      if (ccpDrives()) l = (l & ~8) | (ccpOut << 3);
      return l & 255;
    }
    function latAe() {
      let l = P.latA;
      if ((R[0x1F] & 7) === 6) l = (l & ~0x18) | ((R[0x1F] >> 3) & 8) | ((R[0x1F] >> 3) & 0x10);
      return l & 255;
    }
    function pinsA() { const l = latAe(); let d = ~R[0x85] & 0xDF & 255; if (l & 0x10) d &= ~0x10; return ((l & d) | (P.inA & ~d)) & 255; }
    const anaMask = () => AMASK[R[0x1F] & 7];
    function vin(b) {
      if (anaRun) { const rn = anaRun(); if (rn && rn.picAnalog) { const v = rn.picAnalog(b); return v == null ? NaN : v; } }
      if (anaFn) { const v = anaFn(b); return v == null ? NaN : v; }
      return (pinsA() >> b) & 1 ? VDD : 0;
    }
    function vrefPush() {
      const vr = R[0x9F], v = (vr & 0xC0) === 0xC0 ? vrefOf(vr) : null;
      if (!anaRun) { vrefSent = v; anaUpd(); return; }
      const rn = anaRun();
      if (rn && rn.setVref && (rn !== vrefRn ? v != null : v !== vrefSent)) rn.setVref(v);
      vrefSent = v; vrefRn = rn;
    }
    const anaUpd = () => { anaPoll = !!anaRun && (cmOn || vrefSent != null); };
    function cmpEval() {
      const cm = R[0x1F] & 7, cis = R[0x1F] & 8;
      let o = 0;
      if (cm && cm !== 7) {
        const vr = vrefOf(R[0x9F]);
        let a = null, b = null;
        switch (cm) {
          case 1: a = [vin(2), vin(cis ? 3 : 0)]; b = [vin(2), vin(1)]; break;
          case 2: a = [vr, vin(cis ? 3 : 0)]; b = [vr, vin(cis ? 2 : 1)]; break;
          case 3: case 6: { const p = vin(2); a = [p, vin(0)]; b = [p, vin(1)]; break; }
          case 4: a = [vin(3), vin(0)]; b = [vin(2), vin(1)]; break;
          case 5: b = [vin(2), vin(1)]; break;
        }
        if (a && a[0] === a[0] && a[1] === a[1]) cmRaw = (cmRaw & ~1) | (a[0] > a[1] ? 1 : 0);
        if (b && b[0] === b[0] && b[1] === b[1]) cmRaw = (cmRaw & ~2) | (b[0] > b[1] ? 2 : 0);
        if (a) o |= ((cmRaw & 1) ^ ((R[0x1F] >> 4) & 1)) << 6;
        if (b) o |= (((cmRaw >> 1) & 1) ^ ((R[0x1F] >> 5) & 1)) << 7;
      }
      const old = R[0x1F] & 0xC0;
      R[0x1F] = (R[0x1F] & 0x3F) | o;
      if (o !== cmLatch) R[0x0C] |= 0x40;
      if (o !== old && cm === 6) portChanged();
    }
    function cmpPoll() {
      const rn = anaRun();
      if (rn !== anaRn || (rn && rn.aver !== anaVer)) {
        if (rn !== anaRn) vrefPush();
        anaRn = rn; anaVer = rn ? rn.aver : -1;
        if (cmOn) cmpEval();
      }
    }
    function cmSync() {
      const cm = R[0x1F] & 7;
      cmOn = cm !== 0 && cm !== 7;
      cmpEval(); vrefPush(); anaUpd();
    }
    function pinsB() {
      const t = trisBe(), pu = (R[0x81] & 0x80) ? 0 : (P.flB & t);
      return ((latBe() & ~t) | (P.inB & t) | pu) & 255;
    }
    function drive() { return [R[0x85], latAe(), trisBe(), latBe()]; }
    function portChanged() { pdirty = 1; if (opts.onPort) opts.onPort(); }
    const cfgWord = () => P.cfg == null ? props.cfgDefault : P.cfg;
    let wdtE = false;
    const wdtPeriod = () => Math.max(1, Math.round(props.wdtPeriod * P.fosc / 4)) * ((R[0x81] & 8) ? (1 << (R[0x81] & 7)) : 1);
    const bitCyc = () => ((R[0x98] & 4) ? 4 : 16) * (R[0x99] + 1);

    function resetBy(cause) {
      const por = cause === 'por', s = R[3], pcon = R[0x8E], rbif = R[0x0B] & 1, wrerr = eeBusy ? 8 : R[0x9C] & 8;
      const kv = por ? null : KEEP.map(a => R[a]);
      for (let a = 0; a < 0x20; a++) R[a] = 0;
      for (let a = 0x80; a < 0xA0; a++) R[a] = 0;
      R[0x81] = 0xFF; R[0x85] = 0xFF; R[0x86] = 0xFF; R[0x92] = 0xFF; R[0x98] = 0x02; R[0x8E] = 0x08;
      if (por) R[3] = 0x18;
      else {
        for (let i = 0; i < KEEP.length; i++) R[KEEP[i]] = kv[i];
        R[0x0B] = rbif; R[0x9C] = wrerr;
        R[0x8E] = 0x08 | (pcon & (cause === 'bor' ? 2 : 3));
        R[3] = cause === 'wdt' ? s & 0x0F : cause === 'mclrSleep' ? 0x10 | (s & 7) : cause === 'bor' ? 0x18 | (s & 7) : s & 0x1F;
        P.latA &= 0xE0;
      }
      P.pc = 0; P.sp = 0; P.sleep = false;
      t0ps = t0inh = t1ps = t1rst = t2ps = t2post = 0; ccpOut = 0; pwmFall = Infinity; capCnt = 0;
      txBusy = txFull = 0; txLine = 1; rxBusy = 0; rxQ.length = 0; rxF.length = 0; rxQE.length = 0; rxFE.length = 0;
      eeSeq = 0; eeBusy = 0; wdtStart = P.cyc; skipInt = 0; depth = 0;
      cmLatch = 0; cmRaw = 0; cmSync();
      if (!por) portChanged();
    }
    function cfgSync() { const c = cfgWord(); wdtE = (c & 4) !== 0; held = P.inReset = !mclrLv && (c & 0x20) !== 0; }
    function reset() {
      R.fill(0); P.w = 0; P.cyc = 0; P.latA = 0; P.latB = 0; P.stack.fill(0);
      if (!props.eePersist) P.ee.set(P.eeInit);
      warned.clear();
      cfgSync();
      resetBy('por');
      prevPA = pinsA(); prevPB = pinsB(); rbLatch = prevPB; iA = P.inA; iB = P.inB; fB = P.flB; pdirty = 1;
    }
    const same = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
    function load(h) {
      const ee = h.ee || new Uint8Array(128).fill(255), fresh = !P.loaded || !same(P.prog, h.prog) || !same(P.eeInit, ee) || P.cfg !== (h.cfg == null ? null : h.cfg);
      P.prog = h.prog; P.cfg = h.cfg == null ? null : h.cfg; P.eeInit = ee; P.loaded = true;
      if (fresh) P.ee.set(ee);
      cfgSync();
      return h;
    }
    function resetPersistent() { P.ee.set(P.eeInit); }
    function setProps(p) { if (p) for (const k in p) if (p[k] != null && k in PROPS) props[k] = p[k]; cfgSync(); }
    function setMclr(lv) {
      lv = lv ? 1 : 0;
      if (lv === mclrLv) return;
      mclrLv = lv;
      if (!(cfgWord() & 0x20)) return;
      if (!lv) { resetBy(P.sleep ? 'mclrSleep' : 'mclr'); held = P.inReset = true; }
      else { held = P.inReset = false; wdtStart = P.cyc; pdirty = 1; }
    }

    function setCcp(v) { if (ccpOut !== v) { ccpOut = v; if (ccpDrives()) portChanged(); } }
    function t0inc(m) { const v = R[1] + m; if (v > 255) R[0x0B] |= 4; R[1] = v & 255; }
    function t0ext() {
      if (R[0x81] & 8) t0inc(1);
      else { t0ps++; if (t0ps >= (2 << (R[0x81] & 7))) { t0ps = 0; t0inc(1); } }
    }
    function t1inc() {
      let v = t1rst ? 0 : ((R[0x0F] << 8) | R[0x0E]) + 1;
      t1rst = 0;
      if (v > 0xFFFF) { v = 0; R[0x0C] |= 1; }
      R[0x0E] = v & 255; R[0x0F] = v >> 8;
      const m = R[0x17] & 15;
      if (m >= 8 && m <= 11 && v === ((R[0x16] << 8) | R[0x15])) {
        R[0x0C] |= 4;
        if (m === 8) setCcp(1); else if (m === 9) setCcp(0); else if (m === 11) t1rst = 1;
      }
    }
    function t1ext() { t1ps++; if (t1ps >= (1 << ((R[0x10] >> 4) & 3))) { t1ps = 0; t1inc(); } }
    function pwmPeriod(t) {
      const div = T2DIV[R[0x12] & 3], duty = (R[0x15] << 2) | ((R[0x17] >> 4) & 3), period = (R[0x92] + 1) * div;
      R[0x16] = R[0x15];
      if (!duty) { pwmFall = Infinity; setCcp(0); return; }
      const fall = duty * div / 4;
      pwmFall = fall >= period ? Infinity : t + Math.ceil(fall);
      setCcp(1);
    }
    function t2inc(t) {
      if (R[0x11] === R[0x92]) {
        R[0x11] = 0;
        if (++t2post > ((R[0x12] >> 3) & 15)) { t2post = 0; R[0x0C] |= 2; }
        if ((R[0x17] & 15) >= 12) pwmPeriod(t);
      } else R[0x11] = (R[0x11] + 1) & 255;
    }
    function txLoad() {
      if (!txFull || txBusy || !(R[0x98] & 0x20) || !(R[0x18] & 0x80)) return;
      txBusy = 1; txData = txReg; tx9 = R[0x98] & 1; txBits = (R[0x98] & 0x40) ? 11 : 10; txBc = bitCyc();
      txStart = P.cyc + 1; txFull = 0; R[0x0C] |= 0x10; R[0x98] &= ~2;
    }
    function txTick() {
      const e = P.cyc - txStart;
      if (e < 0) return;
      const idx = (e / txBc) | 0;
      if (idx >= txBits) {
        const endT = txStart + txBits * txBc;
        txBusy = 0; R[0x98] |= 2;
        if (txLine !== 1) { txLine = 1; if (spen()) portChanged(); }
        if (opts.onUartTx) opts.onUartTx(txData, endT, { bitCyc: txBc, dataBits: txBits === 11 ? 9 : 8, ninth: tx9 });
        if (txFull) { txLoad(); txStart = endT; txTick(); }
        return;
      }
      const lv = idx === 0 ? 0 : idx <= 8 ? (txData >> (idx - 1)) & 1 : (idx === 9 && txBits === 11) ? tx9 : 1;
      if (lv !== txLine) { txLine = lv; if (spen()) portChanged(); }
    }
    function rxTick() {
      if ((R[0x18] & 0x90) !== 0x90) { rxQ.length = 0; rxQE.length = 0; rxBusy = 0; return; }
      if (rxBusy && P.cyc >= rxEnd) {
        rxBusy = 0;
        if (rxF.length < 2) { rxF.push(rxData); rxFE.push(rxErr); if (rxF.length === 1) ferrSync(); R[0x0C] |= 0x20; } else R[0x18] |= 2;
      }
      if (!rxBusy && rxQ.length && !(R[0x18] & 2)) { rxData = rxQ.shift(); rxErr = rxQE.shift(); rxBusy = 1; rxEnd = P.cyc + 10 * bitCyc(); }
    }
    function ferrSync() { R[0x18] = (R[0x18] & ~4) | (rxFE.length && rxFE[0] ? 4 : 0); }
    function wdtTimeout() {
      if (P.sleep) { P.sleep = false; R[3] &= ~0x18; wdtStart = P.cyc; return; }
      warn('PIC16', 'Processor has been reset by watchdog timer expiring at time ' + ((wdtStart + wdtPeriod()) * 4 / P.fosc).toFixed(6) + '.');
      resetBy('wdt');
    }
    function tick(n) {
      if (!P.sleep) {
        const opt = R[0x81];
        if (!(opt & 0x20)) {
          let m = n;
          if (t0inh) { const k = t0inh < m ? t0inh : m; t0inh -= k; m -= k; }
          if (m) {
            if (opt & 8) t0inc(m);
            else { t0ps += m; const div = 2 << (opt & 7); if (t0ps >= div) { t0inc((t0ps / div) | 0); t0ps %= div; } }
          }
        }
        const t1 = R[0x10];
        if ((t1 & 3) === 1) { t1ps += n; const div = 1 << ((t1 >> 4) & 3); while (t1ps >= div) { t1ps -= div; t1inc(); } }
        if (R[0x12] & 4) { t2ps += n; const div = T2DIV[R[0x12] & 3]; while (t2ps >= div) { t2ps -= div; t2inc(P.cyc - t2ps); } }
        if (P.cyc >= pwmFall) { pwmFall = Infinity; setCcp(0); }
        if (txBusy) txTick();
        if (rxBusy || rxQ.length) rxTick();
      }
      if (eeBusy && P.cyc >= eeEnd) { P.ee[eeAddr] = eeData; eeBusy = 0; R[0x9C] &= ~2; R[0x0C] |= 0x80; }
      if (wdtE && P.cyc - wdtStart >= wdtPeriod()) wdtTimeout();
    }
    function checkRB() { if ((prevPB ^ rbLatch) & R[0x86] & 0xF0) R[0x0B] |= 1; }
    function inputs() {
      iA = P.inA; iB = P.inB; fB = P.flB; pdirty = 0;
      const pa = pinsA(), pb = pinsB(), ca = pa ^ prevPA, cb = pb ^ prevPB;
      prevPA = pa; prevPB = pb;
      const opt = R[0x81];
      if ((cb & 1) && ((pb & 1) === ((opt >> 6) & 1))) R[0x0B] |= 2;
      if ((ca & 0x10) && (opt & 0x20) && (((pa >> 4) & 1) !== ((opt >> 4) & 1))) t0ext();
      if ((cb & 0x40) && (R[0x10] & 3) === 3 && (pb & 0x40)) t1ext();
      if (cb & 8) {
        const m = R[0x17] & 15, up = (pb >> 3) & 1;
        if (m >= 4 && m <= 7 && (m === 4 ? !up : up)) {
          const need = m === 6 ? 4 : m === 7 ? 16 : 1;
          if (++capCnt >= need) { capCnt = 0; R[0x15] = R[0x0E]; R[0x16] = R[0x0F]; R[0x0C] |= 4; }
        }
      }
      checkRB();
      if (cmOn && !anaRun) cmpEval();
    }

    function ea(f) { return MAP[f === 0 ? (R[4] | ((R[3] & 0x80) << 1)) : ((((R[3] >> 5) & 3) << 7) | f)]; }
    function rd(f) {
      const c = ea(f);
      if (c < 0) return 0;
      if (!SR[c]) return R[c];
      switch (c) {
        case 0: return 0;
        case 2: return P.pc & 255;
        case 5: return pinsA() & ~anaMask() & 255;
        case 6: { const v = pinsB(); rbLatch = v; prevPB = v; return v; }
        case 0x1F: if (cmOn) { if (anaRun) cmpPoll(); else cmpEval(); } cmLatch = R[0x1F] & 0xC0; return R[0x1F];
        case 0x1A: { const v = rxF.length ? rxF.shift() : R[0x1A]; rxFE.shift(); R[0x1A] = v; ferrSync(); if (!rxF.length) R[0x0C] &= ~0x20; return v; }
        default: return 0;
      }
    }
    function wr(f, v) {
      v &= 255;
      const c = ea(f);
      if (c < 0) { if (props.warnUnimpl) warn('PIC16 MEMORY', 'Attempt to write unimplemented memory location ' + hx(f === 0 ? R[4] | ((R[3] & 0x80) << 1) : (((R[3] >> 5) & 3) << 7) | f, 4) + ' with ' + hx(v, 2) + ' ignored.'); return; }
      if (!SW[c]) { R[c] = v; return; }
      switch (c) {
        case 0: return;
        case 1: R[1] = v; t0inh = 3; if (!(R[0x81] & 8)) t0ps = 0; return;
        case 0x0E: case 0x0F: R[c] = v; t1ps = (R[0x10] & 3) === 1 ? -1 : 0; return;
        case 2: R[2] = v; P.pc = ((R[0x0A] & 0x1F) << 8) | v; P.cyc++; return;
        case 3: R[3] = (R[3] & 0x18) | (v & 0xE7); return;
        case 5: P.latA = v; portChanged(); return;
        case 6: P.latB = v; portChanged(); return;
        case 0x0B: R[0x0B] = v; checkRB(); return;
        case 0x0C: R[0x0C] = (v & ~0x30) | (R[0x0C] & 0x30); if ((R[0x1F] & 0xC0) !== cmLatch) R[0x0C] |= 0x40; return;
        case 0x11: R[0x11] = v; t2ps = 0; t2post = 0; return;
        case 0x12: R[0x12] = v & 0x7F; t2ps = 0; t2post = 0; return;
        case 0x15: case 0x16: R[c] = v; return;
        case 0x17: {
          const om = R[0x17] & 15, d0 = ccpDrives();
          R[0x17] = v & 0x3F;
          const m = v & 15;
          if (m !== om) {
            capCnt = 0; pwmFall = Infinity;
            if (m === 8) ccpOut = 0; else if (m === 9) ccpOut = 1; else if (m < 12) ccpOut = 0;
            if (d0 || ccpDrives()) portChanged();
          }
          return;
        }
        case 0x18: {
          const o = R[0x18];
          R[0x18] = (v & ~6) | (o & 6);
          if (!(v & 0x10)) R[0x18] &= ~2;
          if ((o ^ v) & 0x80) { if (!(v & 0x80)) { txBusy = 0; R[0x98] |= 2; txLine = 1; } portChanged(); txLoad(); }
          return;
        }
        case 0x19: R[0x19] = v; txReg = v; txFull = 1; R[0x0C] &= ~0x10; txLoad(); return;
        case 0x1A: return;
        case 0x1F: { const o6 = (R[0x1F] & 7) === 6; cmLatch = R[0x1F] & 0xC0; R[0x1F] = cmLatch | (v & 0x3F); cmSync(); if (o6 || (R[0x1F] & 7) === 6) portChanged(); return; }
        case 0x9F: R[0x9F] = v & 0xEF; cmSync(); return;
        case 0x81: { const o = R[0x81]; R[0x81] = v; pdirty = 1; if ((o ^ v) & 0x80) portChanged(); return; }
        case 0x85: case 0x86: R[c] = v; portChanged(); return;
        case 0x98: {
          const o = R[0x98];
          R[0x98] = (v & ~2) | (o & 2);
          if ((v & 0x20) && !(o & 0x20)) { if (!txFull) R[0x0C] |= 0x10; txLoad(); }
          if (!(v & 0x20) && (o & 0x20)) { if (txBusy) { txBusy = 0; R[0x98] |= 2; if (txLine !== 1) { txLine = 1; if (spen()) portChanged(); } } }
          return;
        }
        case 0x99: R[0x99] = v; return;
        case 0x9C: {
          const o = R[0x9C];
          let nv = (v & 0x0D) | (o & 2);
          if (v & 1) { R[0x9A] = P.ee[R[0x9B] & 0x7F]; nv &= ~1; }
          if ((v & 2) && !(o & 2)) {
            if (eeSeq !== 2) warn('PIC16 EEPROM', 'Attempt to set EECON1<WR> without 0x55/0xAA sequence to EECON2 has been ignored.');
            else if (!(o & 4)) warn('PIC16 EEPROM', 'Cannot set EECON1<WR> without first setting EECON1<WREN> in a previous instruction.');
            else if (nv & 4) { nv |= 2; eeBusy = 1; eeAddr = R[0x9B] & 0x7F; eeData = R[0x9A]; eeEnd = P.cyc + Math.max(1, Math.round(props.eeWriteDelay * P.fosc / 4)); }
          }
          eeSeq = 0; R[0x9C] = nv & 0x0F;
          return;
        }
        case 0x9D: eeSeq = v === 0x55 ? 1 : (v === 0xAA && eeSeq === 1) ? 2 : 0; return;
      }
    }
    const push = (v, k) => { P.stack[P.sp] = v; P.sp = (P.sp + 1) & 7; if (++depth > 8 && k) warn('PIC16', 'Stack overflow executing ' + k + ' instruction.'); };
    const pop = k => { if (depth <= 0) warn('PIC16', 'Stack underflow executing ' + k + ' instruction.'); P.sp = (P.sp - 1) & 7; depth--; return P.stack[P.sp]; };
    const setZ = v => { if (v & 255) R[3] &= ~4; else R[3] |= 4; };
    const setC = c => { if (c) R[3] |= 1; else R[3] &= ~1; };
    const setDC = c => { if (c) R[3] |= 2; else R[3] &= ~2; };
    const wake = () => { const ic = R[0x0B]; return (ic & (ic >> 3) & 7) || ((ic & 0x40) && (R[0x0C] & R[0x8C])); };

    function exec(op) {
      const f = op & 0x7F, d = op & 0x80, b = (op >> 7) & 7, k = op & 255;
      let r, v;
      switch (op >> 8) {
        case 0x00:
          if (d) { wr(f, P.w); return; }
          switch (op) {
            case 0x0000: case 0x0020: case 0x0040: case 0x0060: return;
            case 0x0008: P.pc = pop('RETURN'); P.cyc++; return;
            case 0x0009: P.pc = pop('RETFIE'); P.cyc++; R[0x0B] |= 0x80; return;
            case 0x0062: { const o = R[0x81]; R[0x81] = P.w; pdirty = 1; if ((o ^ P.w) & 0x80) portChanged(); return; }
            case 0x0063: if (wake()) return; R[3] = (R[3] & ~0x08) | 0x10; wdtStart = P.cyc; P.sleep = true; return;
            case 0x0064: R[3] |= 0x18; wdtStart = P.cyc; return;
            case 0x0065: case 0x0066: R[op === 0x0065 ? 0x85 : 0x86] = P.w; portChanged(); return;
            case 0x0067: return;
          }
          break;
        case 0x01:
          if (d) { wr(f, 0); setZ(0); } else { P.w = 0; setZ(0); }
          return;
        case 0x02: { v = rd(f); const w0 = P.w; r = (v - w0) & 255; if (d) wr(f, r); else P.w = r; setC(v >= w0); setDC((v & 15) >= (w0 & 15)); setZ(r); return; }
        case 0x03: r = (rd(f) - 1) & 255; if (d) wr(f, r); else P.w = r; setZ(r); return;
        case 0x04: r = rd(f) | P.w; if (d) wr(f, r); else P.w = r; setZ(r); return;
        case 0x05: r = rd(f) & P.w; if (d) wr(f, r); else P.w = r; setZ(r); return;
        case 0x06: r = rd(f) ^ P.w; if (d) wr(f, r); else P.w = r; setZ(r); return;
        case 0x07: { v = rd(f); const w0 = P.w; r = v + w0; if (d) wr(f, r & 255); else P.w = r & 255; setC(r > 255); setDC((v & 15) + (w0 & 15) > 15); setZ(r); return; }
        case 0x08: r = rd(f); if (d) wr(f, r); else P.w = r; setZ(r); return;
        case 0x09: r = (~rd(f)) & 255; if (d) wr(f, r); else P.w = r; setZ(r); return;
        case 0x0A: r = (rd(f) + 1) & 255; if (d) wr(f, r); else P.w = r; setZ(r); return;
        case 0x0B: r = (rd(f) - 1) & 255; if (d) wr(f, r); else P.w = r; if (!r) { P.pc = (P.pc + 1) & 0x1FFF; P.cyc++; } return;
        case 0x0C: { v = rd(f); r = (v >> 1) | ((R[3] & 1) << 7); if (d) wr(f, r); else P.w = r; setC(v & 1); return; }
        case 0x0D: { v = rd(f); r = ((v << 1) | (R[3] & 1)) & 255; if (d) wr(f, r); else P.w = r; setC(v & 0x80); return; }
        case 0x0E: v = rd(f); r = ((v << 4) | (v >> 4)) & 255; if (d) wr(f, r); else P.w = r; return;
        case 0x0F: r = (rd(f) + 1) & 255; if (d) wr(f, r); else P.w = r; if (!r) { P.pc = (P.pc + 1) & 0x1FFF; P.cyc++; } return;
        case 0x10: case 0x11: case 0x12: case 0x13: wr(f, rd(f) & ~(1 << b)); return;
        case 0x14: case 0x15: case 0x16: case 0x17: wr(f, rd(f) | (1 << b)); return;
        case 0x18: case 0x19: case 0x1A: case 0x1B: if (!((rd(f) >> b) & 1)) { P.pc = (P.pc + 1) & 0x1FFF; P.cyc++; } return;
        case 0x1C: case 0x1D: case 0x1E: case 0x1F: if ((rd(f) >> b) & 1) { P.pc = (P.pc + 1) & 0x1FFF; P.cyc++; } return;
        case 0x20: case 0x21: case 0x22: case 0x23: case 0x24: case 0x25: case 0x26: case 0x27:
          push(P.pc, 'CALL'); P.pc = ((R[0x0A] & 0x18) << 8) | (op & 0x7FF); P.cyc++; return;
        case 0x28: case 0x29: case 0x2A: case 0x2B: case 0x2C: case 0x2D: case 0x2E: case 0x2F:
          P.pc = ((R[0x0A] & 0x18) << 8) | (op & 0x7FF); P.cyc++; return;
        case 0x30: case 0x31: case 0x32: case 0x33: P.w = k; return;
        case 0x34: case 0x35: case 0x36: case 0x37: P.w = k; P.pc = pop('RETLW'); P.cyc++; return;
        case 0x38: P.w |= k; setZ(P.w); return;
        case 0x39: P.w &= k; setZ(P.w); return;
        case 0x3A: P.w ^= k; setZ(P.w); return;
        case 0x3C: case 0x3D: { const w0 = P.w; r = (k - w0) & 255; P.w = r; setC(k >= w0); setDC((k & 15) >= (w0 & 15)); setZ(r); return; }
        case 0x3E: case 0x3F: { const w0 = P.w; r = w0 + k; P.w = r & 255; setC(r > 255); setDC((w0 & 15) + (k & 15) > 15); setZ(r); return; }
      }
      warn('PIC16', 'Attempt to execute illegal opcode (' + hx(op, 4) + ') - NOP executed.');
    }

    function step() { step1(); if (anaPoll) cmpPoll(); }
    function step1() {
      const c0 = P.cyc;
      if (held) { P.cyc++; return; }
      if (P.sleep) {
        P.cyc++; tick(1);
        if (P.inA !== iA || P.inB !== iB || P.flB !== fB || pdirty) inputs();
        if (P.sleep && wake()) { P.sleep = false; skipInt = 1; }
        return;
      }
      const ic = R[0x0B];
      if ((ic & 0x80) && !skipInt && ((ic & (ic >> 3) & 7) || ((ic & 0x40) && (R[0x0C] & R[0x8C])))) {
        push(P.pc); P.pc = 4; R[0x0B] = ic & 0x7F; P.cyc += 2; tick(2);
        if (P.inA !== iA || P.inB !== iB || P.flB !== fB || pdirty) inputs();
        return;
      }
      skipInt = 0;
      const op = P.prog[P.pc & 2047];
      P.pc = (P.pc + 1) & 0x1FFF; P.cyc++;
      exec(op);
      tick(P.cyc - c0);
      if (P.inA !== iA || P.inB !== iB || P.flB !== fB || pdirty) inputs();
    }
    const now = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();
    function run(end, budgetMs) {
      const t0 = budgetMs ? now() : 0;
      let k = 0;
      while (P.cyc < end) {
        if (held) { P.cyc = end; break; }
        if (P.sleep && !rxBusy && P.inA === iA && P.inB === iB && P.flB === fB && !pdirty) {
          let to = end;
          if (eeBusy && eeEnd < to) to = eeEnd;
          if (wdtE) { const w = wdtStart + wdtPeriod(); if (w < to) to = w; }
          if (to - 1 > P.cyc) P.cyc = to - 1;
        }
        step();
        if (budgetMs && (++k & 8191) === 0 && now() - t0 > budgetMs) return false;
      }
      return true;
    }
    function rxPush(b, fl) { rxQ.push(b & 255); rxQE.push(fl && fl.ferr ? 1 : 0); }
    function sleepJump(end) {
      if (held) { if (end - 1 > P.cyc) P.cyc = end - 1; return; }
      if (P.sleep && !rxBusy && P.inA === iA && P.inB === iB && P.flB === fB && !pdirty) {
        let to = end;
        if (eeBusy && eeEnd < to) to = eeEnd;
        if (wdtE) { const w = wdtStart + wdtPeriod(); if (w < to) to = w; }
        if (to - 1 > P.cyc) P.cyc = to - 1;
      }
    }
    const atBp = () => bpA[P.pc & 2047] && !P.sleep;
    function runDbg(end, budgetMs) {
      if (!bpN) { const done = run(end, budgetMs); return { done, stop: done ? null : 'budget', pc: P.pc }; }
      const t0 = budgetMs ? now() : 0;
      let k = 0;
      while (P.cyc < end) {
        sleepJump(end);
        step();
        if (bpA[P.pc & 2047] && !P.sleep) return { done: false, stop: 'bp', pc: P.pc };
        if (budgetMs && (++k & 8191) === 0 && now() - t0 > budgetMs) return { done: false, stop: 'budget', pc: P.pc };
      }
      return { done: true, stop: null, pc: P.pc };
    }
    function until(cond, lim) {
      while (!cond()) {
        if (P.cyc >= lim) return 'limit';
        sleepJump(lim);
        step();
        if (atBp()) return cond() ? 'step' : 'bp';
      }
      return 'step';
    }
    function wakeUp(lim) {
      while (P.sleep && P.cyc < lim) { sleepJump(lim); step(); }
      return P.sleep ? 'limit' : 'step';
    }
    function stepIn(maxCyc) {
      const lim = P.cyc + (maxCyc || 5e7);
      if (P.sleep) return { stop: wakeUp(lim), pc: P.pc };
      step();
      return { stop: 'step', pc: P.pc };
    }
    function stepOver(maxCyc) {
      const lim = P.cyc + (maxCyc || 5e7);
      if (P.sleep) return { stop: wakeUp(lim), pc: P.pc };
      const d0 = depth;
      for (let n = 0; n < 4; n++) {
        const pc0 = P.pc;
        step();
        if (depth <= d0) return { stop: 'step', pc: P.pc };
        const irq = P.stack[(P.sp - 1) & 7] === pc0 && P.pc === 4;
        const s = until(() => depth <= d0, lim);
        if (s !== 'step') return { stop: s, pc: P.pc };
        if (!irq || P.pc !== pc0) return { stop: 'step', pc: P.pc };
      }
      return { stop: 'step', pc: P.pc };
    }
    function stepOut(maxCyc) {
      const lim = P.cyc + (maxCyc || 5e7);
      if (depth <= 0) return { stop: 'none', pc: P.pc };
      const d0 = depth;
      const s = until(() => depth < d0, lim);
      return { stop: s, pc: P.pc };
    }
    function stepLine(stops, over, maxCyc) {
      const lim = P.cyc + (maxCyc || 5e7), d0 = depth;
      if (P.sleep) { const s = wakeUp(lim); if (s !== 'step') return { stop: s, pc: P.pc }; }
      step();
      const s = until(() => stops[P.pc & 2047] && !P.sleep && (!over || depth <= d0), lim);
      return { stop: s, pc: P.pc };
    }
    const bp = {
      set(a) { a &= 2047; if (!bpA[a]) { bpA[a] = 1; bpN++; } },
      clear(a) { a &= 2047; if (bpA[a]) { bpA[a] = 0; bpN--; } },
      clearAll() { bpA.fill(0); bpN = 0; },
      has(a) { return !!bpA[a & 2047]; },
      list() { const r = []; for (let a = 0; a < 2048; a++) if (bpA[a]) r.push(a); return r; }
    };
    const mem = {
      valid(a) { return MAP[a & 511] >= 0; },
      read(a) {
        const c = MAP[a & 511];
        if (c < 0) return 0;
        if (!SR[c]) return R[c];
        switch (c) {
          case 0: { const t = MAP[R[4] | ((R[3] & 0x80) << 1)]; return t > 0 && !SR[t] ? R[t] : 0; }
          case 2: return P.pc & 255;
          case 5: return pinsA() & ~anaMask() & 255;
          case 6: return pinsB();
          case 0x1A: return rxF.length ? rxF[0] : R[0x1A];
          default: return R[c];
        }
      },
      write(a, v) {
        const c = MAP[a & 511];
        v &= 255;
        if (c < 0) return;
        if (c === 0) { const t = R[4] | ((R[3] & 0x80) << 1); if (MAP[t] > 0) mem.write(t, v); return; }
        if (c === 2) { R[2] = v; P.pc = ((R[0x0A] & 0x1F) << 8) | v; return; }
        if (c === 3) { R[3] = v; return; }
        const s = R[3];
        R[3] = (s & 0x9F) | (((a >> 7) & 3) << 5);
        wr(a & 0x7F, v);
        R[3] = s;
        if (c === 0x0B || c === 0x0C || c === 0x8C) pdirty = 1;
      }
    };
    function stack() { const r = [], n = depth < 0 ? 0 : depth > 8 ? 8 : depth; for (let i = 1; i <= n; i++) r.push(P.stack[(P.sp - i) & 7]); return r; }
    function peek() {
      return { pa: pinsA(), pb: pinsB(), trisA: R[0x85], trisB: trisBe(), w: P.w, pc: P.pc, status: R[3], intcon: R[0x0B], option: R[0x81], sleep: P.sleep, inReset: held, txBusy: !!txBusy, ccpOut,
        cmcon: R[0x1F], vrcon: R[0x9F], analogA: anaMask(), vref: vrefOf(R[0x9F]) };
    }
    function setAnalog(fn) { anaFn = typeof fn === 'function' ? fn : null; cmSync(); }
    function attachRunner(get) { anaRun = typeof get === 'function' ? get : null; anaRn = null; anaVer = -1; vrefSent = undefined; vrefRn = null; cmSync(); }
    function analogChanged() { if (anaRun) { anaVer = -1; cmpPoll(); } else if (cmOn) cmpEval(); }
    reset();
    return {
      P, step, run, reset, load, drive, peek, rxPush, setProps, setMclr, resetPersistent, resetBy, get props() { return Object.assign({}, props); }, pinsA, pinsB, setAnalog, attachRunner, analogChanged, vref: () => vrefOf(R[0x9F]),
      bp, runDbg, stepIn, stepOver, stepOut, stepLine, mem, stack, depth: () => depth,
      get ee() { return P.ee; }
    };
  }

  const SFR = [
    ['INDF', 0x00], ['TMR0', 0x01], ['PCL', 0x02], ['STATUS', 0x03], ['FSR', 0x04], ['PORTA', 0x05], ['PORTB', 0x06],
    ['PCLATH', 0x0A], ['INTCON', 0x0B], ['PIR1', 0x0C], ['TMR1L', 0x0E], ['TMR1H', 0x0F], ['T1CON', 0x10], ['TMR2', 0x11],
    ['T2CON', 0x12], ['CCPR1L', 0x15], ['CCPR1H', 0x16], ['CCP1CON', 0x17], ['RCSTA', 0x18], ['TXREG', 0x19], ['RCREG', 0x1A],
    ['CMCON', 0x1F], ['OPTION_REG', 0x81], ['TRISA', 0x85], ['TRISB', 0x86], ['PIE1', 0x8C], ['PCON', 0x8E], ['PR2', 0x92],
    ['TXSTA', 0x98], ['SPBRG', 0x99], ['EEDATA', 0x9A], ['EEADR', 0x9B], ['EECON1', 0x9C], ['EECON2', 0x9D], ['VRCON', 0x9F]
  ];
  const SFRNAME = {};
  for (const [n, a] of SFR) SFRNAME[a] = n;
  const BITNAMES = {
    0x03: ['C', 'DC', 'Z', 'NOT_PD', 'NOT_TO', 'RP0', 'RP1', 'IRP'],
    0x0B: ['RBIF', 'INTF', 'T0IF', 'RBIE', 'INTE', 'T0IE', 'PEIE', 'GIE'],
    0x0C: ['TMR1IF', 'TMR2IF', 'CCP1IF', '', 'TXIF', 'RCIF', 'CMIF', 'EEIF'],
    0x8C: ['TMR1IE', 'TMR2IE', 'CCP1IE', '', 'TXIE', 'RCIE', 'CMIE', 'EEIE'],
    0x81: ['PS0', 'PS1', 'PS2', 'PSA', 'T0SE', 'T0CS', 'INTEDG', 'NOT_RBPU'],
    0x9C: ['RD', 'WR', 'WREN', 'WRERR', '', '', '', ''],
    0x98: ['TX9D', 'TRMT', 'BRGH', '', 'SYNC', 'TXEN', 'TX9', 'CSRC'],
    0x18: ['RX9D', 'OERR', 'FERR', 'ADEN', 'CREN', 'SREN', 'RX9', 'SPEN'],
    0x1F: ['CM0', 'CM1', 'CM2', 'CIS', 'C1INV', 'C2INV', 'C1OUT', 'C2OUT'],
    0x9F: ['VR0', 'VR1', 'VR2', 'VR3', '', 'VRR', 'VROE', 'VREN']
  };
  const h2 = v => '0x' + v.toString(16).toUpperCase().padStart(2, '0');
  const h3 = v => '0x' + v.toString(16).toUpperCase().padStart(3, '0');
  function fname(f, o) {
    const a = ((o.bank || 0) << 7) | f;
    if (o.names && o.names[a] != null) return o.names[a];
    const c = MAP[a];
    if (c >= 0 && SFRNAME[c] != null) return SFRNAME[c];
    return h2(f);
  }
  function fnameMc(f, o) {
    const a = ((o.bank || 0) << 7) | f;
    if (o.names && o.names[a] != null) return o.names[a];
    const c = MAP[a];
    if (c >= 0 && SFRNAME[c] != null) return SFRNAME[c];
    if (f >= 0x70) return 'R' + (f - 0x70);
    return String(a);
  }
  const MCB = ['', '', 'SUBWF', 'DECF', 'IORWF', 'ANDWF', 'XORWF', 'ADDWF', 'MOVF', 'COMF', 'INCF', 'DECFSZ', 'RRF', 'RLF', 'SWAPF', 'INCFSZ'];
  function disasmMc(op, addr, o) {
    const f = op & 0x7F, d = op & 0x80 ? 1 : 0, b = (op >> 7) & 7, k = op & 255, hi = op >> 8;
    const I = (m, a) => a == null ? m : m.padEnd(11) + a;
    const F = () => fnameMc(f, o);
    const lbl = t => (o.labels && o.labels[t] != null) ? o.labels[t] : String(t);
    if (hi === 0) {
      if (op & 0x80) return I('MOVWF', F());
      switch (op) {
        case 0x0000: case 0x0020: case 0x0040: case 0x0060: return 'NOP';
        case 0x0008: return 'RETURN';
        case 0x0009: return 'RETFIE';
        case 0x0062: return 'OPTION';
        case 0x0063: return 'SLEEP';
        case 0x0064: return 'CLRWDT';
        case 0x0065: return I('TRIS', '5');
        case 0x0066: return I('TRIS', '6');
      }
      return I('DW', hx(op, 4));
    }
    if (hi === 1) return op & 0x80 ? I('CLRF', F()) : 'CLRW';
    if (hi < 0x10) return I(MCB[hi], F() + ', ' + d);
    if (hi < 0x20) return I(['BCF', 'BSF', 'BTFSC', 'BTFSS'][(hi - 0x10) >> 2], F() + ', ' + b);
    if (hi < 0x28) return I('CALL', lbl(((addr || 0) & 0x1800) | (op & 0x7FF)));
    if (hi < 0x30) return I('GOTO', lbl(((addr || 0) & 0x1800) | (op & 0x7FF)));
    if (hi < 0x34) return I('MOVLW', String(k));
    if (hi < 0x38) return I('RETLW', String(k));
    if (hi === 0x38) return I('IORLW', String(k));
    if (hi === 0x39) return I('ANDLW', String(k));
    if (hi === 0x3A) return I('XORLW', String(k));
    if (hi === 0x3C || hi === 0x3D) return I('SUBLW', String(k));
    if (hi >= 0x3E) return I('ADDLW', String(k));
    return I('DW', hx(op, 4));
  }
  function disasm(op, addr, o) {
    o = o || {};
    op &= 0x3FFF;
    if (o.style === 'mikroc') return disasmMc(op, addr, o);
    const f = op & 0x7F, d = op & 0x80 ? 'f' : 'w', b = (op >> 7) & 7, k = op & 255, hi = op >> 8;
    const F = () => fname(f, o);
    const lbl = t => (o.labels && o.labels[t] != null) ? o.labels[t] : h3(t);
    const BYTE = ['', '', 'subwf', 'decf', 'iorwf', 'andwf', 'xorwf', 'addwf', 'movf', 'comf', 'incf', 'decfsz', 'rrf', 'rlf', 'swapf', 'incfsz'];
    if (hi === 0) {
      if (op & 0x80) return 'movwf ' + F();
      switch (op) {
        case 0x0000: case 0x0020: case 0x0040: case 0x0060: return 'nop';
        case 0x0008: return 'return';
        case 0x0009: return 'retfie';
        case 0x0062: return 'option';
        case 0x0063: return 'sleep';
        case 0x0064: return 'clrwdt';
        case 0x0065: return 'tris PORTA';
        case 0x0066: return 'tris PORTB';
      }
      return 'dw ' + '0x' + op.toString(16).toUpperCase().padStart(4, '0');
    }
    if (hi === 1) return op & 0x80 ? 'clrf ' + F() : 'clrw';
    if (hi < 0x10) return BYTE[hi] + ' ' + F() + ', ' + d;
    if (hi < 0x20) {
      const bn = BITNAMES[MAP[((o.bank || 0) << 7) | f]];
      const bs = bn && bn[b] ? bn[b] : String(b);
      return ['bcf', 'bsf', 'btfsc', 'btfss'][(hi - 0x10) >> 2] + ' ' + F() + ', ' + bs;
    }
    if (hi < 0x28) return 'call ' + lbl((((addr || 0) & 0x1800) | (op & 0x7FF)));
    if (hi < 0x30) return 'goto ' + lbl((((addr || 0) & 0x1800) | (op & 0x7FF)));
    if (hi < 0x34) return 'movlw ' + h2(k);
    if (hi < 0x38) return 'retlw ' + h2(k);
    if (hi === 0x38) return 'iorlw ' + h2(k);
    if (hi === 0x39) return 'andlw ' + h2(k);
    if (hi === 0x3A) return 'xorlw ' + h2(k);
    if (hi === 0x3C || hi === 0x3D) return 'sublw ' + h2(k);
    if (hi >= 0x3E) return 'addlw ' + h2(k);
    return 'dw ' + '0x' + op.toString(16).toUpperCase().padStart(4, '0');
  }

  const PIC = { create, parseHex, decodeConfig, disasm, MAP, SFR, BITNAMES, VDD, vrefOf, ANALOG_MASK: AMASK };
  root.PIC = PIC;
  if (typeof module !== 'undefined' && module.exports) module.exports = PIC;
})(typeof window !== 'undefined' ? window : globalThis);
