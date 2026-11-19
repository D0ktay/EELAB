(function (root) {
  'use strict';
  const words = s => new Set(s.split(/\s+/).filter(Boolean));
  const C_KW = words('if else while for do switch case default break continue return goto sizeof typedef struct union enum static extern const volatile register auto asm at sfr sbit iv ics');
  const C_TYPE = words('void char short int long float double unsigned signed bit');
  const SFRS = words('INDF TMR0 PCL STATUS FSR PORTA PORTB PCLATH INTCON PIR1 TMR1L TMR1H T1CON TMR2 T2CON CCPR1L CCPR1H CCP1CON RCSTA TXREG RCREG CMCON OPTION_REG TRISA TRISB PIE1 PCON PR2 TXSTA SPBRG EEDATA EEADR EECON1 EECON2 VRCON W WREG ' +
    'GIE PEIE T0IE INTE RBIE T0IF INTF RBIF IRP RP0 RP1 Z DC C NOT_TO NOT_PD OSCF TMR1ON TMR2ON TXIF RCIF TMR1IF TMR2IF CCP1IF EEIF TXEN SPEN CREN BRGH RD WR WREN NOT_RBPU INTEDG T0CS T0SE PSA PS0 PS1 PS2');
  const SFR_RE = /^(?:R[AB][0-7](?:_bit)?|TRIS[AB][0-7](?:_bit)?|PORT[AB]_bits|[A-Z0-9_]+bits|_[A-Z_]+_OSC\w*|_\w+_(?:ON|OFF)|_LCD_\w+)$/;
  const C_FN = words('Delay_ms Delay_us Vdelay_ms Delay_Cyc Delay_1sec delay_ms delay_us Button Lcd_Init Lcd_Out Lcd_Out_Cp Lcd_Chr Lcd_Chr_Cp Lcd_Cmd Keypad_Init Keypad_Key_Press Keypad_Key_Click ' +
    'UART1_Init UART1_Write UART1_Read UART1_Data_Ready UART1_Tx_Idle UART1_Write_Text UART1_Read_Text UART_Init UART_Write UART_Read UART_Data_Ready ' +
    'PWM1_Init PWM1_Set_Duty PWM1_Start PWM1_Stop EEPROM_Read EEPROM_Write ByteToStr ShortToStr IntToStr WordToStr Bcd2Dec Dec2Bcd Lo Hi Sound_Init Sound_Play main interrupt');
  const ASM_INS = words('addwf andwf clrf clrw comf decf decfsz incf incfsz iorwf movf movwf nop rlf rrf subwf swapf xorwf bcf bsf btfsc btfss addlw andlw call clrwdt goto iorlw movlw retfie retlw return sleep sublw xorlw option tris');
  const ASM_DIR = words('list include #include #define #undefine #ifdef #ifndef #else #endif __config __CONFIG __idlocs org end equ set cblock endc banksel pagesel bankisel res db dw de dt data constant variable global extern udata udata_shr code processor radix errorlevel messg if else endif while endw macro endm local exitm noexpand expand nolist title subtitle space page fill');
  const NUM_C = /^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|\d+\.?\d*(?:[eE][+-]?\d+)?)[uUlLfF]*/;
  const NUM_A = /^(?:0[xX][0-9a-fA-F]+|[bBhHdDoOaA]'[^']*'|\.\d+|[0-9][0-9a-fA-F]*[hH]\b|\d+)/;
  const ID = /^[A-Za-z_][A-Za-z0-9_]*/;

  function push(out, t, s) {
    if (!s) return;
    const l = out[out.length - 1];
    if (l && l.t === t) l.s += s; else out.push({ t, s });
  }
  function tokC(line, state) {
    const out = [];
    let i = 0;
    const n = line.length;
    if (state === 1) {
      const e = line.indexOf('*/');
      if (e < 0) { push(out, 'com', line); return { tokens: out, state: 1 }; }
      push(out, 'com', line.slice(0, e + 2)); i = e + 2;
    }
    if (i === 0 && /^\s*#/.test(line)) {
      const c = line.search(/\/\/|\/\*/);
      const pp = c < 0 ? line : line.slice(0, c);
      push(out, 'pp', pp); i = pp.length;
    }
    while (i < n) {
      const ch = line[i], rest = line.slice(i);
      if (ch === '/' && line[i + 1] === '/') { push(out, 'com', rest); break; }
      if (ch === '/' && line[i + 1] === '*') {
        const e = line.indexOf('*/', i + 2);
        if (e < 0) { push(out, 'com', rest); return { tokens: out, state: 1 }; }
        push(out, 'com', line.slice(i, e + 2)); i = e + 2; continue;
      }
      if (ch === '"' || ch === "'") {
        let j = i + 1;
        while (j < n && line[j] !== ch) j += line[j] === '\\' ? 2 : 1;
        push(out, 'str', line.slice(i, Math.min(n, j + 1))); i = j + 1; continue;
      }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(line[i + 1] || ''))) {
        const m = NUM_C.exec(rest);
        if (m) { push(out, 'num', m[0]); i += m[0].length; continue; }
      }
      const m = ID.exec(rest);
      if (m) {
        const w = m[0];
        let t = '';
        if (C_TYPE.has(w)) t = 'type';
        else if (C_KW.has(w)) t = 'kw';
        else if (SFRS.has(w) || SFR_RE.test(w)) t = 'sfr';
        else if (C_FN.has(w)) t = 'fn';
        else if (/^[BF][0-7]$/.test(w) && line[i - 1] === '.') t = 'sfr';
        push(out, t, w); i += w.length; continue;
      }
      push(out, '', ch); i++;
    }
    return { tokens: out, state: 0 };
  }
  function tokA(line) {
    const out = [];
    let i = 0, first = true;
    const n = line.length;
    while (i < n) {
      const ch = line[i], rest = line.slice(i);
      if (ch === ';') { push(out, 'com', rest); break; }
      if (ch === '"') {
        let j = i + 1;
        while (j < n && line[j] !== '"') j += line[j] === '\\' ? 2 : 1;
        push(out, 'str', line.slice(i, Math.min(n, j + 1))); i = j + 1; first = false; continue;
      }
      if (ch === '#' || ch === '_' && i === 0 && /^__config/i.test(rest)) {
        const m = /^#?\w+/.exec(rest);
        if (m && (ASM_DIR.has(m[0].toLowerCase()) || ASM_DIR.has(m[0]))) { push(out, 'dir', m[0]); i += m[0].length; first = false; continue; }
      }
      const nm = /[0-9.]/.test(ch) || (/[bBhHdDoOaA]/.test(ch) && line[i + 1] === "'") ? NUM_A.exec(rest) : null;
      if (nm && !(i > 0 && /\w/.test(line[i - 1]))) { push(out, 'num', nm[0]); i += nm[0].length; first = false; continue; }
      const m = ID.exec(rest);
      if (m) {
        const w = m[0], lw = w.toLowerCase();
        let t = '';
        if (i === 0 && !ASM_INS.has(lw) && !ASM_DIR.has(lw)) t = 'lbl';
        else if (ASM_INS.has(lw)) t = 'ins';
        else if (ASM_DIR.has(lw)) t = 'dir';
        else if (SFRS.has(w) || SFR_RE.test(w)) t = 'sfr';
        else if (first && line[i + w.length] === ':') t = 'lbl';
        push(out, t, w); i += w.length; first = false;
        if (t === 'lbl' && line[i] === ':') { push(out, 'lbl', ':'); i++; }
        continue;
      }
      push(out, '', ch); i++;
    }
    return { tokens: out, state: 0 };
  }
  function tokenize(line, lang, state) { return lang === 'asm' ? tokA(line) : tokC(line, state || 0); }
  function lineStates(lines, lang) {
    const st = new Uint8Array(lines.length + 1);
    if (lang === 'asm') return st;
    let s = 0;
    for (let i = 0; i < lines.length; i++) {
      st[i] = s;
      const l = lines[i];
      if (s === 1 ? l.indexOf('*/') >= 0 : l.indexOf('/*') >= 0) s = tokC(l, s).state;
    }
    st[lines.length] = s;
    return st;
  }
  const esc = s => s.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
  function lineHtml(line, lang, state, mark) {
    const toks = tokenize(line, lang, state).tokens;
    let h = '';
    if (mark && mark.length) {
      let pos = 0;
      const marks = mark.slice();
      for (const tk of toks) {
        const a = pos, b = pos + tk.s.length;
        let seg = '', p = a;
        for (const [ms, me] of marks) {
          if (me <= p || ms >= b) continue;
          const s0 = Math.max(ms, p), e0 = Math.min(me, b);
          seg += esc(tk.s.slice(p - a, s0 - a)) + '<mark>' + esc(tk.s.slice(s0 - a, e0 - a)) + '</mark>';
          p = e0;
        }
        seg += esc(tk.s.slice(p - a));
        h += tk.t ? '<span class="t-' + tk.t + '">' + seg + '</span>' : seg;
        pos = b;
      }
      return h;
    }
    for (const tk of toks) h += tk.t ? '<span class="t-' + tk.t + '">' + esc(tk.s) + '</span>' : esc(tk.s);
    return h;
  }

  const cache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function prep(d) {
    if (!d || !d.lines) return null;
    if (cache && cache.has(d)) return cache.get(d);
    const ent = d.lines.filter(x => x && x[0] >= 0 && x[0] < 2048 && x[1] > 0).map(x => [x[0], x[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const byLine = new Map();
    for (const [a, l] of ent) { if (!byLine.has(l)) byLine.set(l, []); byLine.get(l).push(a); }
    const fn = (d.symbols || []).filter(s => s.kind === 'func' && s.addr < 2048).map(s => s.addr).sort((a, b) => a - b);
    const stops = new Uint8Array(2048);
    for (const [a] of ent) stops[a] = 1;
    const rng = Array.isArray(d.ranges) ? d.ranges.filter(r => r && r[1] > r[0] && r[2] > 0).slice().sort((a, b) => a[0] - b[0]) : null;
    const p = { ent, byLine, fn, stops, rng: rng && rng.length ? rng : null, lines: [...byLine.keys()].sort((a, b) => a - b) };
    if (cache) cache.set(d, p);
    return p;
  }
  const map = {
    lineAddrs(d, line) { const p = prep(d); return p && p.byLine.get(line) ? p.byLine.get(line).slice() : []; },
    addrLine(d, addr) {
      const p = prep(d);
      if (!p || !p.ent.length) return null;
      if (p.rng) {
        let lo = 0, hi = p.rng.length - 1, k = -1;
        while (lo <= hi) { const m = (lo + hi) >> 1; if (p.rng[m][0] <= addr) { k = m; lo = m + 1; } else hi = m - 1; }
        return k >= 0 && addr < p.rng[k][1] ? p.rng[k][2] : null;
      }
      let lo = 0, hi = p.ent.length - 1, k = -1;
      while (lo <= hi) { const m = (lo + hi) >> 1; if (p.ent[m][0] <= addr) { k = m; lo = m + 1; } else hi = m - 1; }
      if (k < 0) return null;
      const a0 = p.ent[k][0];
      if (a0 === addr) return p.ent[k][1];
      for (const f of p.fn) if (f > a0 && f <= addr) return null;
      if (k === p.ent.length - 1 && addr - a0 > 16) return null;
      return p.ent[k][1];
    },
    codeLines(d) { const p = prep(d); return p ? p.lines.slice() : []; },
    hasCode(d, line) { const p = prep(d); return !!(p && p.byLine.has(line)); },
    nearestCodeLine(d, line, span) {
      const p = prep(d);
      if (!p) return null;
      for (const l of p.lines) if (l >= line && l - line <= (span == null ? 50 : span)) return l;
      return null;
    },
    stopSet(d) { const p = prep(d); return p ? p.stops : null; },
    symbol(d, name) {
      if (!d || !d.symbols) return null;
      return d.symbols.find(s => s.name === name) || d.symbols.find(s => s.raw === name) || d.symbols.find(s => s.name.toLowerCase() === String(name).toLowerCase()) || null;
    }
  };

  const SNIPPETS = {
    c: [
      ['while(1) { }', 'while(1) {\n\t$0\n}'],
      ['for döngüsü', 'for(i = 0; i < 10; i++) {\n\t$0\n}'],
      ['if / else', 'if($0) {\n\t\n} else {\n\t\n}'],
      ['switch', 'switch($0) {\n\tcase 0:\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}'],
      ['main() iskeleti', 'void main() {\n\tCMCON = 0x07;\n\tTRISA = 0xFF;\n\tTRISB = 0x00;\n\tPORTB = 0;\n\twhile(1) {\n\t\t$0\n\t}\n}'],
      ['Kesme (interrupt) yordamı', 'void interrupt() {\n\tif(INTCON.T0IF) {\n\t\tINTCON.T0IF = 0;\n\t\t$0\n\t}\n}'],
      ['Timer0 kurulumu (1:256)', 'OPTION_REG = 0x87;\nTMR0 = 0;\nINTCON.T0IE = 1;\nINTCON.GIE = 1;$0'],
      ['RB0/INT kesmesi', 'OPTION_REG.INTEDG = 1;\nINTCON.INTE = 1;\nINTCON.GIE = 1;$0'],
      ['LCD pin tanımları (PORTB, 4-bit)', 'sbit LCD_RS at RB4_bit;\nsbit LCD_EN at RB5_bit;\nsbit LCD_D4 at RB0_bit;\nsbit LCD_D5 at RB1_bit;\nsbit LCD_D6 at RB2_bit;\nsbit LCD_D7 at RB3_bit;\nsbit LCD_RS_Direction at TRISB4_bit;\nsbit LCD_EN_Direction at TRISB5_bit;\nsbit LCD_D4_Direction at TRISB0_bit;\nsbit LCD_D5_Direction at TRISB1_bit;\nsbit LCD_D6_Direction at TRISB2_bit;\nsbit LCD_D7_Direction at TRISB3_bit;\n$0'],
      ['LCD başlat + yaz', 'Lcd_Init();\nLcd_Cmd(_LCD_CLEAR);\nLcd_Cmd(_LCD_CURSOR_OFF);\nLcd_Out(1, 1, "$0");'],
      ['Tuş takımı portu', 'char keypadPort at PORTB;\n$0'],
      ['UART 9600', 'UART1_Init(9600);\nDelay_ms(100);\nUART1_Write_Text("$0");'],
      ['PWM 5 kHz %50', 'PWM1_Init(5000);\nPWM1_Set_Duty(127);\nPWM1_Start();$0'],
      ['EEPROM yaz/oku', 'EEPROM_Write(0x00, $0);\nDelay_ms(20);\nx = EEPROM_Read(0x00);'],
      ['Buton (debounce)', 'if(Button(&PORTA, 0, 1, 1)) {\n\t$0\n}']
    ],
    asm: [
      ['Dosya başlığı', '\tlist\tp=16f628A\n#include <p16F628A.inc>\n\t__CONFIG _INTRC_OSC_NOCLKOUT & _WDT_OFF & _PWRTE_ON & _MCLRE_OFF & _LVP_OFF\n\n\torg\t0x0000\n\tgoto\tbasla\n\nbasla:\n\t$0\n\n\tend'],
      ['Değişken (EQU)', 'sayac\tEQU\t0x20$0'],
      ['cblock', '\tcblock\t0x20\n\tsayac\n\tgecici\n\tendc$0'],
      ['Gecikme döngüsü', 'gecikme:\n\tmovlw\t.250\n\tmovwf\t0x20\ngd1:\n\tnop\n\tdecfsz\t0x20, f\n\tgoto\tgd1\n\treturn$0'],
      ['Kesme vektörü', '\torg\t0x0004\n\tmovwf\tw_temp\n\tswapf\tSTATUS, w\n\tmovwf\tstatus_temp\n\t$0\n\tswapf\tstatus_temp, w\n\tmovwf\tSTATUS\n\tswapf\tw_temp, f\n\tswapf\tw_temp, w\n\tretfie'],
      ['Port kurulumu', '\tmovlw\t0x07\n\tmovwf\tCMCON\n\tbanksel\tTRISB\n\tclrf\tTRISB\n\tbanksel\tPORTB\n\tclrf\tPORTB$0'],
      ['Tablo (retlw)', 'tablo:\n\taddwf\tPCL, f\n\tretlw\t0x3F\n\tretlw\t0x06\n\tretlw\t0x5B$0']
    ]
  };

  const OSC_OPTS = [
    [4, 'INTOSC — RA6/RA7 G/Ç, CLKOUT yok'], [5, 'INTOSC — RA6 = CLKOUT'], [2, 'HS — yüksek hızlı kristal (> 4 MHz)'], [1, 'XT — kristal / rezonatör (≤ 4 MHz)'],
    [0, 'LP — düşük güçlü kristal (32 kHz)'], [3, 'EC — harici saat RA7/CLKIN, RA6 G/Ç'], [6, 'ER — harici direnç RA7, RA6 G/Ç'], [7, 'ER — harici direnç RA7, RA6 = CLKOUT']
  ];
  const CFG_FIELDS = [
    ['wdt', 'Watchdog Timer (WDTE)', 'Açık', 'Kapalı'],
    ['pwrt', 'Power-up Timer (PWRTE)', 'Açık', 'Kapalı'],
    ['mclr', 'RA5/MCLR pin işlevi (MCLRE)', 'MCLR — reset girişi', 'RA5 — dijital giriş'],
    ['boren', 'Brown-out Reset (BOREN)', 'Açık', 'Kapalı'],
    ['lvp', 'Düşük gerilim programlama (LVP)', 'Açık — RB4 = PGM', 'Kapalı — RB4 G/Ç'],
    ['cpd', 'Veri EEPROM koruması (CPD)', 'Açık', 'Kapalı'],
    ['cp', 'Program belleği koruması (CP)', 'Açık', 'Kapalı']
  ];
  const config = {
    OSC: OSC_OPTS, FIELDS: CFG_FIELDS,
    encode(c) {
      const f = (c.osc | 0) & 7;
      let w = 0x1E00 | (f & 3) | (f & 4 ? 0x10 : 0);
      if (c.wdt) w |= 4;
      if (!c.pwrt) w |= 8;
      if (c.mclr) w |= 0x20;
      if (c.boren) w |= 0x40;
      if (c.lvp) w |= 0x80;
      if (!c.cpd) w |= 0x100;
      if (!c.cp) w |= 0x2000;
      return w;
    },
    decode(w) { w &= 0x3FFF; return { osc: (w & 3) | ((w >> 2) & 4), wdt: !!(w & 4), pwrt: !(w & 8), mclr: !!(w & 0x20), boren: !!(w & 0x40), lvp: !!(w & 0x80), cpd: !(w & 0x100), cp: !(w & 0x2000) }; },
    defaultWord(fosc) { return (+fosc || 4000000) <= 4000000 ? 0x3F10 : 0x3F02; },
    hex(w) { return '0x' + (w & 0x3FFF).toString(16).toUpperCase().padStart(4, '0'); },
    warnings(c, fosc) {
      const out = [], mhz = (+fosc || 4e6) / 1e6;
      if ((c.osc === 4 || c.osc === 5) && mhz !== 4) out.push('INTOSC yalnızca 4 MHz verir; Fosc ' + mhz + ' MHz seçili. Kristal için HS seçin.');
      if (c.osc === 1 && mhz > 4) out.push('XT en çok 4 MHz içindir; ' + mhz + ' MHz için HS seçin.');
      if (c.osc === 2 && mhz < 4) out.push('HS 4 MHz üstü kristaller içindir.');
      if (c.osc === 0) out.push('LP kipi 32 kHz kristal içindir; Delay_ms seçili Fosc ile hesaplanır.');
      if (c.wdt) out.push('WDT açık: kod düzenli olarak CLRWDT çalıştırmazsa PIC resetlenir — simülatör bunu uygular. Süre ~18 ms × prescaler (OPTION_REG reset değerinde PSA = 1, 1:128 → ~2,3 s). C\'de: asm clrwdt;');
      if (c.mclr) out.push('MCLR açık: RA5 giriş olarak kullanılamaz; gerçek devrede MCLR\'ye pull-up gerekir.');
      if (c.lvp) out.push('LVP açık: RB4 programlama pini (PGM) olur, G/Ç olarak kullanılamaz.');
      if (c.cp || c.cpd) out.push('Kod koruması yalnızca gerçek çipte okumayı engeller; simülasyonu etkilemez.');
      return out;
    }
  };

  const C_KW_ALL = 'if else while for do switch case default break continue return goto sizeof typedef struct union enum static extern const volatile register auto void char short int long float double unsigned signed bit sbit at sfr iv ics asm';
  const KIND_ORDER = { var: 0, ufn: 1, fn: 2, sfr: 3, bit: 4, sbit: 5, const: 6, kw: 7, ins: 2, dir: 6, lbl: 0 };
  const KIND_TAG = { var: 'v', ufn: 'ƒ', fn: 'ƒ', sfr: 'R', bit: 'b', sbit: 'b', const: 'c', kw: 'k', ins: 'i', dir: 'd', lbl: 'L' };
  function compIndex(libs) {
    libs = libs || {};
    const c = [], a = [], seen = new Set(), add = (arr, n, k, d, doc) => { const key = arr === c ? 'c' + n : 'a' + n.toLowerCase(); if (!n || seen.has(key)) return; seen.add(key); arr.push({ n, k, d: d || '', doc: doc || null, l: n.toLowerCase() }); };
    const fns = Array.isArray(libs.functions) ? libs.functions : [];
    for (const f of fns) add(c, f.name, 'fn', f.sig ? f.sig.replace(/\s*\(.*$/, '').replace(new RegExp('\\s*' + f.name + '$'), '') : '', f);
    for (const f of C_FN) if (f !== 'main' && f !== 'interrupt' && f !== f.toLowerCase()) add(c, f, 'fn', '', null);
    const sfrs = Array.isArray(libs.sfrs) && libs.sfrs.length ? libs.sfrs : [...SFRS].filter(s => /^[A-Z][A-Z0-9_]{2,}$/.test(s) && !/^(?:GIE|PEIE|T0IE|INTE|RBIE|T0IF|INTF|RBIF|IRP|RP0|RP1|NOT_TO|NOT_PD|OSCF|TMR1ON|TMR2ON|TXIF|RCIF|TMR1IF|TMR2IF|CCP1IF|EEIF|TXEN|SPEN|CREN|BRGH|WREN|NOT_RBPU|INTEDG|T0CS|T0SE|PSA|PS0|PS1|PS2|WREG)$/.test(s));
    const bits = libs.bits && typeof libs.bits === 'object' ? libs.bits : {};
    for (const s of sfrs) { add(c, s, 'sfr', 'SFR'); add(a, s, 'sfr', 'SFR'); }
    for (const s of libs.sbits || []) add(c, s, 'sbit', 'sbit');
    for (const k of libs.constants || []) add(c, k, 'const', 'sabit');
    for (const w of C_KW_ALL.split(' ')) add(c, w, 'kw', C_TYPE.has(w) ? 'tip' : 'anahtar');
    for (const w of libs.keywords || []) add(c, w, 'kw', 'mikroC');
    for (const w of ASM_INS) add(a, w, 'ins', 'komut');
    for (const w of ASM_DIR) if (/^[#_a-z]/.test(w) && w !== '__CONFIG') add(a, w, 'dir', 'yönerge');
    for (const r of Object.keys(bits)) for (const b of bits[r]) add(a, b, 'bit', r);
    const members = {};
    for (const r of Object.keys(bits)) members[r] = bits[r].map(b => ({ n: b, k: 'bit', d: r, doc: null, l: b.toLowerCase() }));
    const fnDoc = {};
    for (const f of fns) fnDoc[f.name] = f;
    return { c, asm: a, members, fnDoc, bits };
  }
  const BN = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ n: 'B' + i, k: 'bit', d: 'bit ' + i, doc: null, l: 'b' + i }));
  function userIds(text, lang) {
    const s = lang === 'asm' ? text.replace(/;[^\n]*|"[^"\n]*"/g, ' ') : text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, ' ');
    const re = /[A-Za-z_]\w*/g, out = new Map();
    let m;
    while ((m = re.exec(s))) {
      const n = m[0], i = m.index, pc = i ? s[i - 1] : '\n';
      if (n.length < 2 || pc === '.' || /\w/.test(pc)) continue;
      let k = 'var';
      if (lang === 'asm') { if (pc === '\n') k = 'lbl'; }
      else { let j = re.lastIndex; while (s[j] === ' ' || s[j] === '\t') j++; if (s[j] === '(') k = 'ufn'; }
      const e = out.get(n);
      if (e) { e.c++; if (k !== 'var') e.k = k; } else out.set(n, { c: 1, k });
    }
    if (lang === 'asm') for (const w of ASM_INS) out.delete(w);
    return out;
  }
  function score(item, p, pl) {
    if (!p) return 0;
    if (item.n.startsWith(p)) return 0;
    if (item.l.startsWith(pl)) return 1;
    const parts = item.n.split(/_+|(?=[A-Z][a-z])/);
    let off = 0;
    for (const part of parts) { off = item.n.indexOf(part, off); if (off > 0 && part.toLowerCase().startsWith(pl)) return 2; off += part.length; }
    if (pl.length >= 2 && item.l.indexOf(pl) > 0) return 3;
    return -1;
  }
  function suggest(index, q) {
    const lang = q.lang === 'asm' ? 'asm' : 'c', p = q.prefix || '', pl = p.toLowerCase(), max = q.max || 200;
    let pool;
    if (q.member != null && lang === 'c') {
      const reg = index && index.members[q.member] ? index.members[q.member] : [];
      pool = reg.concat(BN);
    } else {
      pool = index ? (lang === 'asm' ? index.asm : index.c).slice() : [];
      if (q.ids) {
        const known = new Set(pool.map(x => lang === 'asm' ? x.l : x.n));
        for (const [n, e] of q.ids) {
          if ((n === p || n === q.word) && e.c <= 1) continue;
          if (known.has(lang === 'asm' ? n.toLowerCase() : n)) continue;
          pool.push({ n, k: e.k, d: e.k === 'ufn' ? 'fonksiyon' : e.k === 'lbl' ? 'etiket' : 'tanımlı', doc: null, l: n.toLowerCase() });
        }
      }
    }
    const res = [];
    for (let i = 0; i < pool.length; i++) {
      const it = pool[i], s = score(it, p, pl);
      if (s < 0 || (p && it.n === p && q.member == null && !q.explicit)) continue;
      res.push({ it, s, o: q.member != null ? (it.n.length === 2 && /^B\d$/.test(it.n) ? 1 : 0) : (KIND_ORDER[it.k] == null ? 9 : KIND_ORDER[it.k]), i });
    }
    res.sort((x, y) => x.s - y.s || x.o - y.o || (q.member != null ? x.i - y.i : 0) || x.it.n.length - y.it.n.length || (x.it.n < y.it.n ? -1 : x.it.n > y.it.n ? 1 : 0));
    return res.slice(0, max).map(r => r.it);
  }

  function libPanel(o) {
    const doc = o.mount.ownerDocument;
    const el = (t, cls, txt, p) => { const e = doc.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; if (p) p.appendChild(e); return e; };
    const root_ = el('div', 'lib', null, o.mount);
    const left = el('div', 'lib-l', null, root_), right = el('div', 'lib-r', null, root_);
    const q = el('input', '', null, left);
    q.type = 'search'; q.placeholder = 'Ara: Lcd, UART, INTCON…'; q.spellcheck = false;
    const tree = el('div', 'lib-tree', null, left);
    let libs = null, sel = null, closed = new Set(), used = new Set();
    const groups = () => {
      if (!libs) return [];
      const g = new Map();
      for (const f of libs.functions || []) { if (!g.has(f.group)) g.set(f.group, []); g.get(f.group).push({ t: 'fn', name: f.name, f }); }
      const out = [...g].map(([n, items]) => ({ n, items }));
      if ((libs.constants || []).length) out.push({ n: 'LCD sabitleri', items: libs.constants.map(c => ({ t: 'const', name: c })) });
      if ((libs.sfrs || []).length) out.push({ n: 'Kayıtlar (SFR)', items: libs.sfrs.map(s => ({ t: 'sfr', name: s, bits: (libs.bits || {})[s] || [] })) });
      return out;
    };
    function detail() {
      right.textContent = '';
      if (!sel) { el('div', 'lib-note', libs ? 'Soldan bir fonksiyon seç. ✓ = bu dosyada kullanılıyor. Kullanılmayan kütüphane kodu HEX\'e girmez.' : 'Kütüphane listesi sunucudan alınamadı.', right); return; }
      const h = el('div', 'lib-h', sel.name, right);
      if (used.has(sel.name)) el('span', 'lib-used', '✓ kullanılıyor', h);
      let ex = sel.name;
      if (sel.t === 'fn') {
        const f = sel.f;
        el('pre', 'lib-sig', f.sig, right);
        el('div', 'lib-desc', f.desc, right);
        if (f.example) { el('div', 'lib-k', 'Örnek', right); el('pre', 'lib-ex', f.example, right); ex = f.example; }
        if (f.deps && f.deps.length) el('div', 'lib-note', 'HEX\'e eklenen modüller: ' + [f.key].concat(f.deps).join(', '), right);
      } else if (sel.t === 'const') {
        el('div', 'lib-desc', 'Lcd_Cmd() ile kullanılan LCD komut sabiti.', right);
        ex = 'Lcd_Cmd(' + sel.name + ');';
        el('pre', 'lib-ex', ex, right);
      } else {
        el('div', 'lib-desc', 'Özel işlev kaydı (SFR). Bitlerine ' + sel.name + '.B0 … B7 ya da adıyla erişilir.', right);
        if (sel.bits.length) { el('div', 'lib-k', 'Bit adları', right); el('pre', 'lib-ex', sel.bits.map(b => sel.name + '.' + b).join('  '), right); }
      }
      const bar = el('div', 'lib-btns', null, right);
      const b1 = el('button', '', sel.t === 'sfr' ? 'Adı ekle' : 'Örneği ekle', bar);
      b1.onclick = () => o.onInsert && o.onInsert(sel.t === 'sfr' ? sel.name : ex);
      if (sel.t === 'fn') { const b2 = el('button', '', 'Adı ekle', bar); b2.onclick = () => o.onInsert && o.onInsert(sel.name + '($0)'); }
    }
    function draw() {
      tree.textContent = '';
      const f = q.value.trim().toLowerCase();
      let n = 0;
      for (const g of groups()) {
        const items = f ? g.items.filter(i => i.name.toLowerCase().includes(f) || (i.f && (i.f.desc || '').toLowerCase().includes(f)) || g.n.toLowerCase().includes(f)) : g.items;
        if (!items.length) continue;
        const open = f || !closed.has(g.n);
        const gh = el('div', 'lib-g' + (open ? ' open' : ''), null, tree);
        el('span', 'lib-tw', open ? '▾' : '▸', gh); el('span', '', g.n, gh); el('span', 'lib-n', String(items.length), gh);
        gh.onclick = () => { if (closed.has(g.n)) closed.delete(g.n); else closed.add(g.n); draw(); };
        if (!open) continue;
        for (const it of items) {
          const r = el('div', 'lib-i' + (sel && sel.name === it.name ? ' s' : ''), null, tree);
          el('span', 'lib-ck', used.has(it.name) ? '✓' : '', r); el('span', '', it.name, r);
          r.title = it.f ? it.f.sig : it.name;
          r.onclick = () => { sel = it; draw(); detail(); };
          r.ondblclick = () => { sel = it; detail(); right.querySelector('.lib-btns button').click(); };
          n++;
        }
      }
      if (!n) el('div', 'lib-note', libs ? 'Eşleşme yok.' : 'Yükleniyor…', tree);
    }
    q.addEventListener('input', draw);
    q.addEventListener('keydown', e => e.stopPropagation());
    function refresh() {
      const code = o.getCode ? o.getCode() : '';
      used = new Set();
      if (libs && code) {
        const s = code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ' ');
        const words = new Set(s.match(/[A-Za-z_]\w*/g) || []);
        for (const f of libs.functions || []) if (words.has(f.name)) used.add(f.name);
        for (const c of libs.constants || []) if (words.has(c)) used.add(c);
        for (const r of libs.sfrs || []) if (words.has(r)) used.add(r);
      }
      draw(); detail();
    }
    draw(); detail();
    return { el: root_, setLibs(l) { libs = l && typeof l === 'object' ? l : null; refresh(); }, refresh, select(name) { for (const g of groups()) for (const it of g.items) if (it.name === name) { sel = it; closed.delete(g.n); } draw(); detail(); } };
  }

  const C_TYPES = 'void|char|int|short|long|float|double|unsigned|signed|const|static|volatile|extern|bit|sbit|byte|word|uint8_t|uint16_t|int8_t|int16_t|uint32_t|int32_t';
  function routines(code, lang) {
    const out = [], ls = String(code).split('\n');
    if (lang === 'asm') {
      const NOT = /^(?:addwf|andwf|clrf|clrw|comf|decf|decfsz|incf|incfsz|iorwf|movf|movwf|nop|rlf|rrf|subwf|swapf|xorwf|bcf|bsf|btfsc|btfss|addlw|andlw|call|clrwdt|goto|iorlw|movlw|retfie|retlw|return|sleep|sublw|xorlw|list|include|org|end|cblock|endc|banksel|bankisel|pagesel|__config|processor|radix|errorlevel|equ|set|res|db|dw|de|variable|constant|if|else|endif|macro|endm|local|define|ifdef|ifndef)$/i;
      ls.forEach((l, i) => { const m = /^([A-Za-z_]\w*)(:?)/.exec(l); if (m && !NOT.test(m[1]) && !/^\s*\w+:?\s+(?:EQU|equ|=|set|SET)\b/.test(l)) out.push({ name: m[1], line: i + 1 }); });
      return out;
    }
    const re = new RegExp('^\\s*(?:(?:' + C_TYPES + ')\\s+)+\\**\\s*([A-Za-z_]\\w*)\\s*\\(([^;{}]*)\\)\\s*(?:\\{.*)?$');
    let depth = 0, com = false;
    ls.forEach((l, i) => {
      const t = l.replace(/\/\/.*$/, '').replace(/"(?:\\.|[^"\\])*"/g, '""');
      if (!com && depth === 0) {
        const m = re.exec(t);
        if (m && !/^(?:if|while|for|switch|return)$/.test(m[1]) && (/\{/.test(t) || /^\s*\{/.test(ls[i + 1] || ''))) out.push({ name: m[1], line: i + 1 });
        else if (/^\s*void\s+interrupt\s*\(/.test(t)) out.push({ name: 'interrupt', line: i + 1 });
      }
      for (const ch of t) { if (ch === '{') depth++; else if (ch === '}') depth = Math.max(0, depth - 1); }
    });
    return out;
  }
  function declOf(code, lang, name) {
    if (!name) return 0;
    const r = routines(code, lang).find(x => x.name === name);
    if (r) return r.line;
    const ls = String(code).split('\n'), q = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = lang === 'asm' ? new RegExp('^\\s*' + q + '(?::|\\s+(?:EQU|equ|=))') : new RegExp('\\b(?:' + C_TYPES + ')\\b[^;(){}]*?\\b' + q + '\\b\\s*(?:\\[[^\\]]*\\])?\\s*(?:=|;|,)');
    for (let i = 0; i < ls.length; i++) { const t = ls[i].replace(/\/\/.*$/, ''); if (re.test(t)) return i + 1; }
    return 0;
  }

  function create(o) {
    const ta = o.textarea, gut = o.gutter;
    const hl = o.highlight || ta.parentNode.insertBefore(document.createElement('div'), ta);
    let lang = o.lang || 'c', lines = [''], states = new Uint8Array(1), dirtyLines = true;
    let markers = new Map(), bps = new Map(), execLine = null, flashLine = null, bpCb = null;
    let find = { q: '', cs: false, re: null };
    const bms = new Map();
    const bmOf = n => { for (const [k, v] of bms) if (v === n) return k; return null; };
    const lh = () => o.lineHeight || 18, pad = () => o.pad == null ? 8 : o.pad;
    function parse() { if (!dirtyLines) return; lines = ta.value.split('\n'); states = lineStates(lines, lang); dirtyLines = false; }
    function findMarks(l) {
      if (!find.re) return null;
      const r = [];
      find.re.lastIndex = 0;
      let m;
      while ((m = find.re.exec(l))) { if (!m[0].length) { find.re.lastIndex++; continue; } r.push([m.index, m.index + m[0].length]); }
      return r;
    }
    let raf = 0;
    function render() {
      raf = 0;
      parse();
      const L = lh(), P = pad(), st = ta.scrollTop, h = ta.clientHeight || 400;
      const first = Math.max(0, Math.floor((st - P) / L) - 4), last = Math.min(lines.length, first + Math.ceil(h / L) + 9);
      let hh = '', gh = '';
      for (let i = first; i < last; i++) {
        const n = i + 1, mk = markers.get(n), bp = bps.get(n);
        let cls = 'l';
        if (n === execLine) cls += ' x';
        else if (mk) cls += mk.sev === 'error' ? ' le' : ' lw';
        if (bp) cls += ' lb';
        if (n === flashLine) cls += ' lf';
        hh += '<div class="' + cls + '">' + (lineHtml(lines[i], lang, states[i], findMarks(lines[i])) || ' ') + '</div>';
        const bm = bmOf(n);
        let g = '<div class="g' + (bp ? (bp.ok === false ? ' bpx' : ' bp') : '') + (n === execLine ? ' gx' : '') + (mk ? (mk.sev === 'error' ? ' ge' : ' gw') : '') + (bm != null ? ' bm' : '') + '"' + (mk ? ' title="' + esc(mk.text || '').replace(/"/g, '&quot;') + '"' : bm != null ? ' title="' + bm + '"' : '') + (bm != null ? ' data-bm="' + bm + '"' : '') + '>';
        g += '<i></i>' + n + '</div>';
        gh += g;
      }
      hl.innerHTML = hh;
      hl.style.transform = 'translate(' + (-ta.scrollLeft) + 'px,' + (P + first * L - st) + 'px)';
      gut.innerHTML = gh;
      gut.style.transform = 'translateY(' + (P + first * L - st) + 'px)';
    }
    const schedule = () => { if (!raf) raf = (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : setTimeout)(render); };
    function refresh(now) { dirtyLines = true; if (now) render(); else schedule(); }
    function lineOfPos(pos) { let n = 1; const v = ta.value; for (let i = v.indexOf('\n'); i >= 0 && i < pos; i = v.indexOf('\n', i + 1)) n++; return n; }
    function posOfLine(n) { const v = ta.value; let p = 0; for (let i = 1; i < n; i++) { const j = v.indexOf('\n', p); if (j < 0) return v.length; p = j + 1; } return p; }
    function cursor() { const p = ta.selectionStart, v = ta.value, ls = v.lastIndexOf('\n', p - 1) + 1; return { line: lineOfPos(p), col: p - ls + 1 }; }
    function reportCursor() { if (o.onCursor) o.onCursor(cursor()); }
    function scrollToLine(n, center) {
      const L = lh(), y = pad() + (n - 1) * L, h = ta.clientHeight;
      if (center || y < ta.scrollTop || y + L > ta.scrollTop + h) ta.scrollTop = Math.max(0, y - h / 2 + L);
      schedule();
    }
    function gotoLine(n, opt) {
      opt = opt || {};
      n = Math.max(1, Math.min(n | 0, ta.value.split('\n').length));
      const a = posOfLine(n), e = ta.value.indexOf('\n', a);
      ta.focus({ preventScroll: true });
      if (opt.select) ta.setSelectionRange(a, e < 0 ? ta.value.length : e); else ta.setSelectionRange(a, a);
      scrollToLine(n, true);
      if (opt.flash) { flashLine = n; clearTimeout(gotoLine.t); gotoLine.t = setTimeout(() => { flashLine = null; schedule(); }, 1200); }
      reportCursor();
    }
    function insert(text) {
      ta.focus({ preventScroll: true });
      if (!(typeof document !== 'undefined' && document.execCommand && document.execCommand('insertText', false, text))) {
        const a = ta.selectionStart, b = ta.selectionEnd;
        ta.value = ta.value.slice(0, a) + text + ta.value.slice(b);
        ta.selectionStart = ta.selectionEnd = a + text.length;
        ta.dispatchEvent(new Event('input'));
      }
    }
    function selLines() {
      const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
      const s = v.lastIndexOf('\n', a - 1) + 1;
      let e = v.indexOf('\n', b > a && v[b - 1] === '\n' ? b - 1 : b);
      if (e < 0) e = v.length;
      return { s, e, text: v.slice(s, e) };
    }
    function replaceLines(fn) {
      const r = selLines(), ls = r.text.split('\n'), nl = fn(ls), t = nl.join('\n');
      ta.setSelectionRange(r.s, r.e);
      insert(t);
      ta.setSelectionRange(r.s, r.s + t.length);
    }
    const cmt = () => lang === 'asm' ? ';' : '//';
    function toggleComment() {
      const c = cmt();
      replaceLines(ls => {
        const nonEmpty = ls.filter(l => l.trim());
        const all = nonEmpty.length && nonEmpty.every(l => l.trimStart().startsWith(c));
        return ls.map(l => {
          if (!l.trim()) return l;
          if (all) return l.replace(new RegExp('^(\\s*)' + c.replace(/\//g, '\\/') + ' ?'), '$1');
          return c + ' ' + l;
        });
      });
    }
    function insertSnippet(t) {
      const v = ta.value, a = ta.selectionStart, ls = v.lastIndexOf('\n', a - 1) + 1;
      const ind = /^[ \t]*/.exec(v.slice(ls, a))[0];
      const body = t.split('\n').map((l, i) => i ? ind + l : l).join('\n');
      const k = body.indexOf('$0');
      insert(body.replace('$0', ''));
      if (k >= 0) { const p = a + k; ta.setSelectionRange(p, p); }
    }

    function setComment(on) {
      const c = cmt(), re = new RegExp('^(\\s*)' + c.replace(/\//g, '\\/') + ' ?');
      replaceLines(ls => ls.map(l => !l.trim() ? l : on ? (l.trimStart().startsWith(c) ? l : c + ' ' + l) : l.replace(re, '$1')));
    }
    function setBookmark(d) {
      const ln = cursor().line;
      for (const [k, v] of bms) if (k === d && v === ln) { bms.delete(k); schedule(); return false; }
      bms.set(d, ln); schedule(); return true;
    }
    function gotoBookmark(d) { if (!bms.has(d)) return false; gotoLine(bms.get(d), { flash: true }); return true; }
    function deleteLine() {
      const v = ta.value, r = selLines();
      let s0 = r.s, e = r.e;
      if (e < v.length) e++; else if (s0 > 0) s0--;
      ta.setSelectionRange(s0, e);
      insert('');
      reportCursor();
    }
    function wordAt() {
      const v = ta.value;
      let a = ta.selectionStart, b = ta.selectionEnd;
      if (a !== b) { const s = v.slice(a, b).trim(); return /^[\w.]+$/.test(s) ? s : ''; }
      while (a > 0 && /\w/.test(v[a - 1])) a--;
      while (b < v.length && /\w/.test(v[b])) b++;
      return v.slice(a, b);
    }
    function tipHere() {
      const v = ta.value, a = ta.selectionStart;
      let depth = 0, i = a - 1;
      for (; i >= 0; i--) {
        const ch = v[i];
        if (ch === ')') depth++;
        else if (ch === '(') { if (!depth) break; depth--; }
        else if (ch === ';' || ch === '{' || ch === '}') return false;
      }
      let b = i; while (b > 0 && v[b - 1] === ' ') b--;
      let s = b; while (s > 0 && /\w/.test(v[s - 1])) s--;
      const name = i >= 0 ? v.slice(s, b) : wordAt();
      if (!cIndex.fnDoc[name]) return false;
      tipShow(name, i >= 0 ? i : a);
      return true;
    }
    function declLine(name) { return declOf(ta.value, lang, name || wordAt()); }
    function findDecl(name) { const n = declLine(name); if (!n) return false; gotoLine(n, { flash: true }); return true; }

    const fb = o.findHost ? document.createElement('div') : null;
    let fq, fr, fcs, fcnt;
    if (fb) {
      fb.className = 'findbar';
      fb.innerHTML = '<input class="fq" placeholder="Bul" spellcheck="false"><button class="fp" title="Önceki (⇧⌘G)">▲</button><button class="fn" title="Sonraki (⌘G)">▼</button>' +
        '<label title="Büyük/küçük harf duyarlı"><input type="checkbox" class="fcs">Aa</label><span class="fcnt"></span>' +
        '<input class="fr" placeholder="Değiştir" spellcheck="false"><button class="f1">Değiştir</button><button class="fa">Tümü</button>' +
        '<span class="fsp"></span><input class="fg" placeholder="Satır" title="Satıra git (⌃G)" size="4"><button class="fx" title="Kapat (Esc)">✕</button>';
      fb.style.display = 'none';
      o.findHost.appendChild(fb);
      const q = c => fb.querySelector(c);
      fq = q('.fq'); fr = q('.fr'); fcs = q('.fcs'); fcnt = q('.fcnt');
      const upd = () => { setFind(fq.value, fcs.checked); };
      fq.addEventListener('input', () => { upd(); findNext(1, true); });
      fcs.addEventListener('change', upd);
      fq.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findNext(e.shiftKey ? -1 : 1); } if (e.key === 'Escape') closeFind(); });
      fr.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); replaceOne(); } if (e.key === 'Escape') closeFind(); });
      q('.fp').onclick = () => findNext(-1); q('.fn').onclick = () => findNext(1);
      q('.f1').onclick = replaceOne; q('.fa').onclick = replaceAll; q('.fx').onclick = closeFind;
      const fg = q('.fg');
      fg.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const n = parseInt(fg.value, 10); if (n > 0) gotoLine(n, { flash: true }); } if (e.key === 'Escape') closeFind(); });
    }
    function setFind(qs, cs) {
      find.q = qs; find.cs = cs;
      find.re = qs ? new RegExp(qs.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), cs ? 'g' : 'gi') : null;
      if (fcnt) {
        let n = 0;
        if (find.re) { const m = ta.value.match(find.re); n = m ? m.length : 0; }
        fcnt.textContent = qs ? n + ' sonuç' : '';
      }
      schedule();
    }
    function findNext(dir, fromStart) {
      if (!find.re) return false;
      const v = ta.value, re = new RegExp(find.re.source, find.re.flags);
      const all = [];
      let m;
      while ((m = re.exec(v))) { if (!m[0].length) { re.lastIndex++; continue; } all.push([m.index, m.index + m[0].length]); }
      if (!all.length) return false;
      const a = fromStart ? ta.selectionStart : dir > 0 ? ta.selectionEnd : ta.selectionStart;
      let hit = dir > 0 ? all.find(x => x[0] >= a) || all[0] : [...all].reverse().find(x => x[0] < a) || all[all.length - 1];
      ta.setSelectionRange(hit[0], hit[1]);
      scrollToLine(lineOfPos(hit[0]));
      reportCursor();
      return true;
    }
    function replaceOne() {
      if (!find.re) return;
      const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      const same = find.cs ? sel === find.q : sel.toLowerCase() === find.q.toLowerCase();
      if (sel && same) { insert(fr.value); }
      findNext(1);
      setFind(find.q, find.cs);
    }
    function replaceAll() {
      if (!find.re) return;
      const v = ta.value, nv = v.replace(new RegExp(find.re.source, find.re.flags), () => fr.value);
      if (nv === v) return;
      ta.setSelectionRange(0, v.length);
      insert(nv);
      ta.setSelectionRange(0, 0);
      setFind(find.q, find.cs);
    }
    function openFind(withReplace) {
      if (!fb) return;
      fb.style.display = '';
      const s = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (s && s.indexOf('\n') < 0) fq.value = s;
      setFind(fq.value, fcs.checked);
      (withReplace ? fr : fq).focus(); (withReplace ? fr : fq).select();
    }
    function openGoto() { if (!fb) return; openFind(); const g = fb.querySelector('.fg'); g.value = ''; g.focus(); }
    function closeFind() { if (!fb) return; fb.style.display = 'none'; setFind('', false); ta.focus(); }

    let cIndex = compIndex(o.libs || null), idCache = { v: null, lang: '', ids: null };
    const ac = { open: false, items: [], sel: 0, start: 0, member: null, explicit: false, box: null, list: null, det: null, tip: null, tipAt: -1 };
    const host = o.popupHost || ta.parentNode;
    let cw = 0;
    function charW() {
      if (cw) return cw;
      const s = document.createElement('span');
      s.textContent = 'MMMMMMMMMMMMMMMMMMMM';
      s.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit';
      hl.appendChild(s); cw = s.getBoundingClientRect().width / 20 || 7.5; s.remove();
      return cw;
    }
    function caretXY(pos) {
      const v = ta.value, ls = v.lastIndexOf('\n', pos - 1) + 1, ln = lineOfPos(pos);
      let col = 0;
      for (let i = ls; i < pos; i++) col = v[i] === '\t' ? (Math.floor(col / 4) + 1) * 4 : col + 1;
      return { x: pad() + col * charW() - ta.scrollLeft, y: pad() + (ln - 1) * lh() - ta.scrollTop, ln };
    }
    function context(explicit) {
      const v = ta.value, a = ta.selectionStart;
      if (a !== ta.selectionEnd) return null;
      let s = a;
      while (s > 0 && /\w/.test(v[s - 1])) s--;
      const prefix = v.slice(s, a);
      if (/^\d/.test(prefix)) return null;
      let member = null;
      if (lang !== 'asm' && v[s - 1] === '.') {
        let b = s - 1;
        while (b > 0 && /\w/.test(v[b - 1])) b--;
        if (b < s - 1 && !/^\d/.test(v.slice(b, s - 1))) member = v.slice(b, s - 1); else return null;
      }
      parse();
      const ls = v.lastIndexOf('\n', s - 1) + 1, li = lineOfPos(ls) - 1;
      const toks = tokenize(v.slice(ls, s), lang, states[li] || 0).tokens, lt = toks[toks.length - 1];
      if (lt && (lt.t === 'com' || lt.t === 'str') && !(lt.t === 'str' && lt.s.length > 1 && lt.s[lt.s.length - 1] === lt.s[0] && lt.s[lt.s.length - 2] !== '\\')) return null;
      if (!explicit && member == null && prefix.length < 2) return null;
      let e = a;
      while (e < v.length && /\w/.test(v[e])) e++;
      return { start: s, prefix, member, word: v.slice(s, e) };
    }
    function ids() {
      const v = ta.value;
      if (idCache.v !== v || idCache.lang !== lang) idCache = { v, lang, ids: userIds(v, lang) };
      return idCache.ids;
    }
    function acEnsure() {
      if (ac.box) return;
      ac.box = document.createElement('div'); ac.box.className = 'ac'; ac.box.style.display = 'none';
      ac.list = document.createElement('div'); ac.list.className = 'ac-l';
      ac.det = document.createElement('div'); ac.det.className = 'ac-d';
      ac.box.appendChild(ac.list); ac.box.appendChild(ac.det);
      ac.box.addEventListener('mousedown', e => {
        e.preventDefault();
        const r = e.target.closest('.ac-i');
        if (r) { ac.sel = +r.dataset.i; acAccept(); }
      });
      host.appendChild(ac.box);
      ac.tip = document.createElement('div'); ac.tip.className = 'ctip'; ac.tip.style.display = 'none';
      host.appendChild(ac.tip);
    }
    function acDraw() {
      const it = ac.items, p = ta.value.slice(ac.start, ta.selectionStart);
      let h = '';
      const n = Math.min(it.length, 200);
      for (let i = 0; i < n; i++) {
        const x = it[i], k = x.n.toLowerCase().startsWith(p.toLowerCase()) ? p.length : 0;
        h += '<div class="ac-i' + (i === ac.sel ? ' s' : '') + '" data-i="' + i + '"><i class="ak-' + x.k + '">' + (KIND_TAG[x.k] || '·') + '</i><span class="an"><b>' + esc(x.n.slice(0, k)) + '</b>' + esc(x.n.slice(k)) + '</span><span class="at">' + esc(x.d || '') + '</span></div>';
      }
      ac.list.innerHTML = h;
      acDetail();
      const r = ac.list.children[ac.sel];
      if (r) { const t = r.offsetTop, b = t + r.offsetHeight; if (t < ac.list.scrollTop) ac.list.scrollTop = t; else if (b > ac.list.scrollTop + ac.list.clientHeight) ac.list.scrollTop = b - ac.list.clientHeight; }
    }
    function docOf(x) { return x && (x.doc || (x.k === 'fn' && cIndex.fnDoc[x.n]) || null); }
    function acDetail() {
      const x = ac.items[ac.sel], d = docOf(x);
      if (d) { ac.det.style.display = ''; ac.det.innerHTML = '<code>' + esc(d.sig || x.n) + '</code><div>' + esc(d.desc || '') + '</div>'; }
      else if (x && x.k === 'sfr' && cIndex.bits[x.n]) { ac.det.style.display = ''; ac.det.innerHTML = '<code>' + esc(x.n) + '</code><div>Bitler: ' + esc(cIndex.bits[x.n].join(', ')) + '</div>'; }
      else { ac.det.style.display = 'none'; ac.det.textContent = ''; }
    }
    function acPlace() {
      const c = caretXY(ac.start), W = host.clientWidth, H = host.clientHeight, L = lh();
      ac.box.style.display = '';
      const bw = ac.box.offsetWidth, bh = ac.box.offsetHeight;
      let x = Math.max(2, Math.min(c.x - 22, W - bw - 4)), y = c.y + L + 1;
      if (y + bh > H && c.y - bh - 1 > 0) y = c.y - bh - 1;
      ac.box.style.left = x + 'px'; ac.box.style.top = y + 'px';
    }
    function acOpen(explicit) {
      const c = context(explicit);
      if (!c) { acClose(); return false; }
      const items = suggest(cIndex, { lang, prefix: c.prefix, word: c.word, member: c.member, ids: c.member == null ? ids() : null, explicit });
      if (!items.length) { acClose(); return false; }
      acEnsure();
      if (!ac.open || ac.start !== c.start) ac.sel = 0;
      ac.open = true; ac.items = items; ac.start = c.start; ac.member = c.member; ac.explicit = !!explicit || ac.explicit;
      ac.sel = Math.min(ac.sel, items.length - 1);
      acDraw(); acPlace();
      return true;
    }
    function acClose() { if (!ac.open) return; ac.open = false; ac.explicit = false; if (ac.box) ac.box.style.display = 'none'; }
    function acAccept() {
      const x = ac.items[ac.sel];
      if (!x) { acClose(); return; }
      const a = ta.selectionStart, v = ta.value, d = docOf(x);
      const fn = x.k === 'fn' || x.k === 'ufn';
      const noArgs = d && /\(\s*(void)?\s*\)\s*$/.test(d.sig || '');
      const addParen = fn && lang !== 'asm' && v[a] !== '(';
      acClose();
      ta.setSelectionRange(ac.start, a);
      insert(x.n + (addParen ? '()' : ''));
      if (addParen && !noArgs) { const p = ta.selectionStart - 1; ta.setSelectionRange(p, p); if (d) tipShow(x.n, p); }
      reportCursor();
    }
    function tipShow(name, openPos) {
      const d = cIndex.fnDoc[name];
      if (!d) return;
      acEnsure();
      ac.tip.textContent = d.sig; ac.tipAt = openPos;
      const c = caretXY(openPos);
      ac.tip.style.display = '';
      ac.tip.style.left = Math.max(2, Math.min(c.x - 10, host.clientWidth - ac.tip.offsetWidth - 4)) + 'px';
      ac.tip.style.top = Math.max(0, c.y - ac.tip.offsetHeight - 2) + 'px';
    }
    function tipCheck() {
      if (ac.tipAt < 0) return;
      const v = ta.value, a = ta.selectionStart;
      let depth = 0, ok = a > ac.tipAt && v[ac.tipAt] === '(';
      if (ok) for (let i = ac.tipAt; i < a; i++) { const ch = v[i]; if (ch === '(') depth++; else if (ch === ')') { depth--; if (!depth) { ok = false; break; } } else if (ch === '\n' || ch === ';') { ok = false; break; } }
      if (!ok) { ac.tipAt = -1; if (ac.tip) ac.tip.style.display = 'none'; }
    }
    function tipHide() { ac.tipAt = -1; if (ac.tip) ac.tip.style.display = 'none'; }
    function onType(e) {
      tipCheck();
      const ch = e && e.inputType === 'insertText' && e.data && e.data.length === 1 ? e.data : null;
      if (ac.open) { if (ch && !/[\w.]/.test(ch)) acClose(); else acOpen(ac.explicit); }
      else if (ch && (/\w/.test(ch) || (ch === '.' && lang !== 'asm'))) acOpen(false);
      if (ch === '(' && lang !== 'asm') {
        const v = ta.value, a = ta.selectionStart - 1;
        let b = a; while (b > 0 && v[b - 1] === ' ') b--;
        let s = b; while (s > 0 && /\w/.test(v[s - 1])) s--;
        if (cIndex.fnDoc[v.slice(s, b)]) tipShow(v.slice(s, b), a);
      }
    }
    ta.addEventListener('blur', () => { acClose(); tipHide(); });
    ta.addEventListener('mousedown', () => { acClose(); });
    ta.addEventListener('input', e => { dirtyLines = true; schedule(); if (find.re) setFind(find.q, find.cs); if (o.onChange) o.onChange(); reportCursor(); onType(e); });
    ta.addEventListener('scroll', () => { schedule(); acClose(); tipHide(); });
    ta.addEventListener('keyup', () => { reportCursor(); tipCheck(); });
    ta.addEventListener('click', reportCursor);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(schedule).observe(ta);
    ta.addEventListener('keydown', e => {
      const mod = e.metaKey || e.ctrlKey, k = e.key;
      if (ac.open) {
        const n = ac.items.length;
        if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'PageDown' || k === 'PageUp') {
          e.preventDefault();
          const d = k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : k === 'PageDown' ? 8 : -8;
          ac.sel = Math.abs(d) === 1 ? (ac.sel + d + n) % n : Math.max(0, Math.min(n - 1, ac.sel + d));
          acDraw(); return;
        }
        if ((k === 'Enter' || k === 'Tab') && !mod && !e.altKey && !e.shiftKey) { e.preventDefault(); acAccept(); return; }
        if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); acClose(); return; }
        if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home' || k === 'End') acClose();
      }
      if (k === 'Escape' && ac.tipAt >= 0) { tipHide(); }
      if (e.ctrlKey && !e.metaKey && (e.code === 'Space' || k === ' ')) { e.preventDefault(); acOpen(true); return; }
      if (mod && !e.altKey && k.toLowerCase() === 'f') { e.preventDefault(); openFind(false); return; }
      if (mod && e.altKey && (k.toLowerCase() === 'f' || e.code === 'KeyF')) { e.preventDefault(); openFind(true); return; }
      if (mod && k.toLowerCase() === 'g' && e.metaKey) { e.preventDefault(); if (!find.re) openFind(); else findNext(e.shiftKey ? -1 : 1); return; }
      if (e.ctrlKey && !e.metaKey && k.toLowerCase() === 'g') { e.preventDefault(); openGoto(); return; }
      if (mod && (k === '/' || e.code === 'Slash')) { e.preventDefault(); toggleComment(); return; }
      if (e.ctrlKey && !e.metaKey && k.toLowerCase() === 'j') { e.preventDefault(); if (o.onSnippetKey) o.onSnippetKey(); return; }
      if (k === 'Escape' && fb && fb.style.display !== 'none') { closeFind(); return; }
      if (k === 'Tab' && !mod) {
        e.preventDefault();
        const multi = ta.value.slice(ta.selectionStart, ta.selectionEnd).indexOf('\n') >= 0;
        if (e.shiftKey) replaceLines(ls => ls.map(l => l.replace(/^(\t| {1,4})/, '')));
        else if (multi) replaceLines(ls => ls.map(l => l.trim() ? '\t' + l : l));
        else insert('\t');
        return;
      }
      if (k === 'Enter' && !mod && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        const v = ta.value, a = ta.selectionStart, ls = v.lastIndexOf('\n', a - 1) + 1;
        const cur = v.slice(ls, a), ind = /^[ \t]*/.exec(cur)[0];
        const open = lang !== 'asm' && /\{\s*$/.test(cur);
        const close = open && /^\s*\}/.test(v.slice(ta.selectionEnd, (v.indexOf('\n', a) + 1 || v.length + 1) - 1));
        if (close) { insert('\n' + ind + '\t\n' + ind); const p = a + 1 + ind.length + 1; ta.setSelectionRange(p, p); }
        else insert('\n' + ind + (open ? '\t' : ''));
        return;
      }
      if (k === '}' && lang !== 'asm' && !mod) {
        const v = ta.value, a = ta.selectionStart, ls = v.lastIndexOf('\n', a - 1) + 1, cur = v.slice(ls, a);
        if (cur.length && /^[ \t]+$/.test(cur) && ta.selectionEnd === a) {
          e.preventDefault();
          ta.setSelectionRange(ls, a);
          insert(cur.replace(/(\t| {1,4})$/, '') + '}');
        }
      }
    });
    gut.parentNode.addEventListener('mousedown', e => {
      if (!gut.parentNode.contains(e.target)) return;
      e.preventDefault();
      const r = gut.parentNode.getBoundingClientRect();
      const n = Math.floor((e.clientY - r.top + ta.scrollTop - pad()) / lh()) + 1;
      if (n >= 1 && n <= lines.length && bpCb) bpCb(n);
    });

    const api = {
      getValue: () => ta.value,
      setValue(v, lg) { if (lg) lang = lg; bms.clear(); ta.value = v; ta.scrollTop = 0; ta.scrollLeft = 0; ta.setSelectionRange(0, 0); refresh(true); reportCursor(); },
      setLang(lg) { lang = lg === 'asm' ? 'asm' : 'c'; refresh(); },
      getLang: () => lang,
      gotoLine,
      setMarkers(list) { markers = new Map(); for (const m of list || []) if (m && m.line > 0 && !(markers.get(m.line) && markers.get(m.line).sev === 'error')) markers.set(m.line, m); schedule(); },
      setBreakpoints(list) { bps = new Map(); for (const b of list || []) { const x = typeof b === 'number' ? { line: b } : b; bps.set(x.line, x); } schedule(); },
      onBreakpointToggle(cb) { bpCb = cb; },
      setExecLine(n, scroll) { execLine = n || null; if (n && scroll !== false) scrollToLine(n); schedule(); },
      cursor, focus: () => ta.focus(), refresh: () => refresh(true), openFind, openGoto, closeFind, toggleComment, insertSnippet,
      lineCount: () => { parse(); return lines.length; },
      setLibs(l) { cIndex = compIndex(l); },
      complete: () => acOpen(true), closeComplete: acClose, completing: () => ac.open,
      undo() { ta.focus({ preventScroll: true }); if (typeof document !== 'undefined') document.execCommand('undo'); },
      redo() { ta.focus({ preventScroll: true }); if (typeof document !== 'undefined') document.execCommand('redo'); },
      comment: () => setComment(true), uncomment: () => setComment(false),
      indent: () => replaceLines(ls => ls.map(l => l.trim() ? '\t' + l : l)),
      unindent: () => replaceLines(ls => ls.map(l => l.replace(/^(\t| {1,4})/, ''))),
      deleteLine, setBookmark, gotoBookmark, bookmarks: () => new Map(bms), clearBookmarks() { bms.clear(); schedule(); },
      findNext(dir) { if (!find.re) { openFind(false); return; } findNext(dir < 0 ? -1 : 1); },
      openReplace: () => openFind(true),
      routines: () => routines(ta.value, lang), findDecl, word: wordAt, paramAssist: tipHere,
      selection: () => ta.value.slice(ta.selectionStart, ta.selectionEnd)
    };
    refresh(true);
    return api;
  }

  /* ===== çıktı dosyaları (.lst / .asm / .log) ve arayüz dili ===== */
  const h4 = v => v.toString(16).toUpperCase().padStart(4, '0');
  const MC_PROBE = '0x2903';
  function mcMnemonic(PIC, op, addr) {
    if (PIC._mcNative === undefined) { try { PIC._mcNative = PIC.disasm(0x2903, 0, { style: 'mikroc' }) === 'GOTO       259'; } catch (e) { PIC._mcNative = false; } }
    if (PIC._mcNative) return PIC.disasm(op, addr, { style: 'mikroc' });
    const dec = new Proxy({}, { get: (_, k) => String(+k) });
    const std = PIC.disasm(op, addr, { labels: dec }), m = /^(\S+)(?:\s+(.*))?$/.exec(std);
    if (!m) return std;
    const ops = (m[2] || '').replace(/0x([0-9A-Fa-f]+)/g, (x, h) => String(parseInt(h, 16))).replace(/,\s*w\s*$/, ', 0').replace(/,\s*f\s*$/, ', 1');
    return m[1].toUpperCase().padEnd(11) + ops;
  }
  function stamp(d) { d = d || new Date(); const p2 = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()); }
  function listing(o, withAddr) {
    const PIC = o.PIC, prog = o.prog, d = o.debug, file = o.file || 'main.c', src = String(o.src || '').split('\n');
    const lineAt = new Map();
    if (d && Array.isArray(d.lines)) for (const x of d.lines) if (x && x[1] > 0 && !lineAt.has(x[0])) lineAt.set(x[0], x[1]);
    const L = withAddr
      ? [';  LST file generated by mikroListExporter - v.2.0', '; Date/Time: ' + stamp(o.date), ';----------------------------------------------', '', ';Address Opcode \tASM']
      : ['; ASM file generated by EELAB', '; Date/Time: ' + stamp(o.date), ';----------------------------------------------', ''];
    for (let a = 0; a < 2048; a++) {
      const op = prog[a];
      if (op === 0x3FFF || op == null) continue;
      if (lineAt.has(a)) { const n = lineAt.get(a); L.push(';' + file + ',' + n + ' :: ' + (src[n - 1] || '').trim()); }
      const mn = mcMnemonic(PIC, op, a);
      L.push(withAddr ? '0x' + h4(a) + '\t' + ('0x' + h4(op)).padEnd(12) + '\t' + mn : '\t' + mn);
    }
    return L.join('\n') + '\n';
  }
  const lstText = o => listing(o, true), asmText = o => listing(o, false);
  function mcText(m, lang) {
    let args = Array.isArray(m.args) ? m.args : [];
    if (m.key === 'finishedOk' || m.key === 'finishedErr') args = [m.when instanceof Date ? m.when : new Date()];
    if (m.key === 'raw') return String(args[0] != null ? args[0] : m.text || '');
    const r = ui.t(m.key, args, lang);
    return r === m.key && m.text ? m.text : r;
  }
  function logText(mc, lang) {
    return (mc || []).map(m => (m.type || 'hint') + ': ' + (m.line | 0) + ' ' + (m.no | 0) + ' ' + mcText(m, lang || 'en') + (m.unit ? '  ' + m.unit : '')).join('\n') + '\n';
  }

  const DICT = {};
  let nodeI18N;
  function i18n() {
    if (typeof I18N !== 'undefined' && I18N) return I18N;
    if (nodeI18N === undefined) { try { nodeI18N = typeof require === 'function' ? require('./i18n.js') : null; } catch (e) { nodeI18N = null; } }
    return nodeI18N;
  }
  const ui = {
    dict: DICT,
    lang() {
      if (typeof I18N !== 'undefined' && I18N && I18N.lang) return I18N.lang();
      try { return localStorage.getItem('eelab.ui.lang') === 'en' ? 'en' : 'tr'; } catch (e) { return 'tr'; }
    },
    setLang(l) {
      l = l === 'en' ? 'en' : 'tr';
      if (typeof I18N !== 'undefined' && I18N && I18N.setLang) I18N.setLang(l);
      else { try { localStorage.setItem('eelab.ui.lang', l); } catch (e) { /* depolama yok */ } }
      return l;
    },
    t(key, args, lang) {
      const I = i18n(), L = lang === 'en' || lang === 'tr' ? lang : ui.lang(), has = !!(I && I.has);
      if (has && I.has(key, L)) return I.t(key, args, L);
      const e = DICT[key];
      if (e) {
        const a = args == null ? [] : Array.isArray(args) ? args : [args];
        return String(e[L === 'en' && e[1] != null ? 1 : 0]).replace(/\{(\d+)\}/g, (m, i) => a[+i] === undefined ? m : String(a[+i]));
      }
      if (has) { const r = I.t(key, args, L); if (r !== key) return r; }
      return key;
    },
    missing() { return typeof I18N !== 'undefined' && I18N && I18N.has ? Object.keys(DICT).filter(k => !I18N.has(k)) : Object.keys(DICT); }
  };
  const outputs = { lstText, asmText, logText, mcText, mcMnemonic, stamp };

  const IDE = { create, tokenize, lineStates, lineHtml, map, snippets: SNIPPETS, config, complete: { index: compIndex, userIds, suggest }, libPanel, routines, declOf, outputs, ui };
  root.IDE = IDE;
  if (typeof module !== 'undefined' && module.exports) module.exports = IDE;
})(typeof window !== 'undefined' ? window : globalThis);
