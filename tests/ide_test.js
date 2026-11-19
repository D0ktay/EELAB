const assert = require('assert');
const IDE = require('../js/ide.js');

let failed = 0, passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e.stack || e.message || e).toString().split('\n').slice(0, 8).join('\n     ')); }
}
const toks = (l, lang, st) => IDE.tokenize(l, lang, st).tokens.filter(t => t.t).map(t => t.t + ':' + t.s.trim());

test('C belirteçleri: anahtar kelime, tip, SFR, sayı, dizgi, yorum, ön işlemci, kütüphane', () => {
  assert.deepStrictEqual(toks('unsigned int x = 0x1F; // sayaç', 'c'), ['type:unsigned', 'type:int', 'num:0x1F', 'com:// sayaç']);
  assert.deepStrictEqual(toks('while(1) { PORTB = ones; }', 'c'), ['kw:while', 'num:1', 'sfr:PORTB']);
  assert.deepStrictEqual(toks('if(RA5_bit == 1) INTCON.GIE = 1;', 'c'), ['kw:if', 'sfr:RA5_bit', 'num:1', 'sfr:INTCON', 'sfr:GIE', 'num:1']);
  assert.deepStrictEqual(toks('PORTA.B3 = 0;', 'c'), ['sfr:PORTA', 'sfr:B3', 'num:0']);
  assert.deepStrictEqual(toks('Lcd_Out(1, 1, "a\\"b");', 'c'), ['fn:Lcd_Out', 'num:1', 'num:1', 'str:"a\\"b"']);
  assert.deepStrictEqual(toks('#include <built_in.h> // x', 'c'), ['pp:#include <built_in.h>', 'com:// x']);
  assert.deepStrictEqual(toks("sbit LCD_RS at RB4_bit; char c = 'x';", 'c'), ['kw:sbit', 'kw:at', 'sfr:RB4_bit', 'type:char', "str:'x'"]);
  assert.deepStrictEqual(toks('delay_ms(10);', 'c'), ['fn:delay_ms', 'num:10']);
  assert.deepStrictEqual(toks('x = 1.5e3f + 0b1010;', 'c'), ['num:1.5e3f', 'num:0b1010']);
});

test('C çok satırlı yorum durumu', () => {
  let r = IDE.tokenize('a = 1; /* başla', 'c', 0);
  assert.strictEqual(r.state, 1);
  assert.deepStrictEqual(r.tokens.filter(t => t.t).map(t => t.t), ['num', 'com']);
  r = IDE.tokenize('  hâlâ yorum', 'c', 1);
  assert.deepStrictEqual([r.state, r.tokens.length, r.tokens[0].t], [1, 1, 'com']);
  r = IDE.tokenize('bitti */ int y;', 'c', 1);
  assert.strictEqual(r.state, 0);
  assert.deepStrictEqual(r.tokens.filter(t => t.t).map(t => t.t + ':' + t.s.trim()), ['com:bitti */', 'type:int']);
  const st = IDE.lineStates(['int a;', '/* x', 'y', '*/', 'int b; // /* değil'], 'c');
  assert.deepStrictEqual(Array.from(st), [0, 0, 1, 1, 0, 0]);
  const s2 = IDE.lineStates(['char *s = "/*";', 'int z;'], 'c');
  assert.deepStrictEqual(Array.from(s2), [0, 0, 0]);
});

test('PIC asm belirteçleri: etiket, komut, yönerge, SFR, sayı biçimleri, yorum', () => {
  assert.deepStrictEqual(toks('loopTop:', 'asm'), ['lbl:loopTop:']);
  assert.deepStrictEqual(toks('progEnd: goto progEnd', 'asm'), ['lbl:progEnd:', 'ins:goto']);
  assert.deepStrictEqual(toks('\tmovlw\t0x0A\t; on', 'asm'), ['ins:movlw', 'num:0x0A', 'com:; on']);
  assert.deepStrictEqual(toks('movwf PORTB', 'asm'), ['ins:movwf', 'sfr:PORTB']);
  assert.deepStrictEqual(toks(' btfsc STATUS, Z', 'asm'), ['ins:btfsc', 'sfr:STATUS', 'sfr:Z']);
  assert.deepStrictEqual(toks(' movlw .200', 'asm'), ['ins:movlw', 'num:.200']);
  assert.deepStrictEqual(toks(" movlw b'1010'", 'asm'), ['ins:movlw', "num:b'1010'"]);
  assert.deepStrictEqual(toks(" movlw h'FF'", 'asm'), ['ins:movlw', "num:h'FF'"]);
  assert.deepStrictEqual(toks('num EQU 0x20', 'asm'), ['lbl:num', 'dir:EQU', 'num:0x20']);
  assert.deepStrictEqual(toks('#include <p16F628A.inc>', 'asm'), ['dir:#include']);
  assert.deepStrictEqual(toks('__CONFIG _INTRC_OSC_NOCLKOUT & _WDT_OFF', 'asm'), ['dir:__CONFIG', 'sfr:_INTRC_OSC_NOCLKOUT', 'sfr:_WDT_OFF']);
  assert.deepStrictEqual(toks('\tbanksel\tTRISB', 'asm'), ['dir:banksel', 'sfr:TRISB']);
  assert.deepStrictEqual(toks('movf cnt, w', 'asm'), ['ins:movf']);
});

test('lineHtml: HTML kaçışı ve bulma işaretleri', () => {
  const h = IDE.lineHtml('if(a<b && c>d) x = "<p>";', 'c', 0);
  assert(!/<p>/.test(h) && /&lt;p&gt;/.test(h) && /a&lt;b &amp;&amp; c&gt;d/.test(h), h);
  const m = IDE.lineHtml('ones = ones + 1;', 'c', 0, [[0, 4], [7, 11]]);
  assert.strictEqual((m.match(/<mark>ones<\/mark>/g) || []).length, 2, m);
  const t = IDE.lineHtml('int ones;', 'c', 0, [[2, 6]]);
  assert(t.includes('<span class="t-type">in<mark>t</mark></span><mark> on</mark>es;'), t);
});

const DBG = {
  lang: 'c', file: 'T.c',
  lines: [[0x10, 5], [0x13, 6], [0x18, 8], [0x1A, 6], [0x1C, 9], [0x40, 20]],
  symbols: [{ name: 'main', raw: '_main', addr: 0x10, size: 0, kind: 'func' }, { name: 'Delay_ms', raw: '_Delay_ms', addr: 0x30, kind: 'func' },
    { name: 'f', raw: '_f', addr: 0x40, kind: 'func' }, { name: 'ones', raw: '_ones', addr: 0x130, size: 2, kind: 'var' }]
};
test('satır↔adres: lineAddrs, addrLine, codeLines, nearestCodeLine, stopSet, symbol', () => {
  const M = IDE.map;
  assert.deepStrictEqual(M.lineAddrs(DBG, 6), [0x13, 0x1A]);
  assert.deepStrictEqual(M.lineAddrs(DBG, 7), []);
  assert.strictEqual(M.addrLine(DBG, 0x10), 5);
  assert.strictEqual(M.addrLine(DBG, 0x12), 5);
  assert.strictEqual(M.addrLine(DBG, 0x13), 6);
  assert.strictEqual(M.addrLine(DBG, 0x19), 8);
  assert.strictEqual(M.addrLine(DBG, 0x1B), 6);
  assert.strictEqual(M.addrLine(DBG, 0x1F), 9);
  assert.strictEqual(M.addrLine(DBG, 0x30), null, 'kütüphane fonksiyonu kullanıcı satırı değil');
  assert.strictEqual(M.addrLine(DBG, 0x35), null);
  assert.strictEqual(M.addrLine(DBG, 0x41), 20);
  assert.strictEqual(M.addrLine(DBG, 0x05), null);
  assert.deepStrictEqual(M.codeLines(DBG), [5, 6, 8, 9, 20]);
  assert.strictEqual(M.hasCode(DBG, 8), true);
  assert.strictEqual(M.hasCode(DBG, 7), false);
  assert.strictEqual(M.nearestCodeLine(DBG, 7), 8);
  assert.strictEqual(M.nearestCodeLine(DBG, 10), 20);
  assert.strictEqual(M.nearestCodeLine(DBG, 10, 5), null);
  assert.strictEqual(M.nearestCodeLine(DBG, 21), null);
  const s = M.stopSet(DBG);
  assert.deepStrictEqual([s[0x10], s[0x11], s[0x13], s[0x1A], s[0x40]], [1, 0, 1, 1, 1]);
  assert.strictEqual(M.symbol(DBG, 'ones').addr, 0x130);
  assert.strictEqual(M.symbol(DBG, '_ones').addr, 0x130);
  assert.strictEqual(M.symbol(DBG, 'ONES').addr, 0x130);
  assert.strictEqual(M.symbol(DBG, 'yok'), null);
  assert.deepStrictEqual(M.lineAddrs(null, 1), []);
  assert.strictEqual(M.addrLine({ lines: null }, 3), null);
});

test('satır↔adres: debug.ranges varsa tam aralık kullanılır', () => {
  const d = { lines: [[0x10, 5], [0x14, 6], [0x30, 9]], ranges: [[0x10, 0x14, 5], [0x14, 0x18, 6], [0x30, 0x31, 9]], symbols: [] };
  const M = IDE.map;
  assert.deepStrictEqual([0x10, 0x13, 0x14, 0x17, 0x18, 0x2F, 0x30, 0x31].map(a => M.addrLine(d, a)), [5, 5, 6, 6, null, null, 9, null]);
});

test('şablon parçacıkları: her dil için, $0 imleci', () => {
  for (const lg of ['c', 'asm']) {
    assert(IDE.snippets[lg].length >= 5);
    for (const [n, t] of IDE.snippets[lg]) assert(n && t.includes('$0'), n);
  }
});

test('2 000 satır: durum + görünür 60 satır renklendirme < 16 ms', () => {
  const src = [];
  for (let i = 0; i < 2000; i++) src.push(i % 50 === 0 ? '/* blok' : i % 50 === 2 ? 'son */' : '\tif(PORTB.B' + (i % 8) + ' == 1) { ones++; delay_ms(10); } // satır ' + i);
  IDE.lineStates(src, 'c');
  let best = 1e9;
  for (let k = 0; k < 5; k++) {
    const t = process.hrtime.bigint();
    const st = IDE.lineStates(src, 'c');
    let h = '';
    for (let i = 1000; i < 1060; i++) h += IDE.lineHtml(src[i], 'c', st[i]);
    best = Math.min(best, Number(process.hrtime.bigint() - t) / 1e6);
  }
  console.log('     ' + best.toFixed(2) + ' ms');
  assert(best < 16, best + ' ms');
});

const LIBS = {
  functions: [
    { name: 'Lcd_Out', group: 'LCD', sig: 'void Lcd_Out(unsigned char row, unsigned char column, char *text)', desc: 'Metni yazar.', example: 'Lcd_Out(1, 1, "EELAB");', key: 'Lcd_Out', deps: ['LCD_GOTO'] },
    { name: 'Lcd_Out_Cp', group: 'LCD', sig: 'void Lcd_Out_Cp(char *text)', desc: 'İmlece yazar.', example: 'Lcd_Out_Cp(t);', key: 'Lcd_Out_Cp', deps: [] },
    { name: 'Lcd_Init', group: 'LCD', sig: 'void Lcd_Init(void)', desc: 'Başlatır.', example: 'Lcd_Init();', key: 'Lcd_Init', deps: [] },
    { name: 'Delay_ms', group: 'Gecikme', sig: 'void Delay_ms(const unsigned int ms)', desc: 'Bekler.', example: 'Delay_ms(500);', key: 'DELAY_MS', deps: [] },
    { name: 'UART1_Write_Text', group: 'UART', sig: 'void UART1_Write_Text(char *uart_text)', desc: 'Gönderir.', example: '', key: 'UART1_Write_Text', deps: [] },
    { name: 'IntToStr', group: 'Dönüşüm', sig: 'void IntToStr(int input, char *output)', desc: 'Çevirir.', example: '', key: 'IntToStr', deps: [] }
  ],
  constants: ['_LCD_CLEAR', '_LCD_CURSOR_OFF'],
  sfrs: ['INTCON', 'PORTA', 'PORTB', 'TRISB', 'OPTION_REG', 'PCON', 'TMR0'],
  bits: { INTCON: ['GIE', 'INTE', 'INTF', 'PEIE', 'RBIE', 'RBIF', 'T0IE', 'T0IF'], OPTION_REG: ['INTEDG', 'PS0', 'PSA', 'T0CS'] },
  sbits: ['RB0_bit', 'RB4_bit', 'TRISB4_bit'],
  keywords: ['sbit', 'at', 'sfr', 'bit', 'interrupt', 'iv', 'ics', 'asm']
};
const CI = IDE.complete;
const names = r => r.map(x => x.n);

test('tamamlama: önek eşleşmesi, büyük/küçük harf, sıralama (tam önek > harf duyarsız > parça > içerir)', () => {
  const ix = CI.index(LIBS);
  const r = names(CI.suggest(ix, { lang: 'c', prefix: 'Lcd_O' }));
  assert.deepStrictEqual(r.slice(0, 2), ['Lcd_Out', 'Lcd_Out_Cp']);
  assert.strictEqual(names(CI.suggest(ix, { lang: 'c', prefix: 'lcd_i' }))[0], 'Lcd_Init');
  const d = names(CI.suggest(ix, { lang: 'c', prefix: 'de' }));
  assert.strictEqual(d[0], 'default', 'tam önek (harf duyarlı) önce: ' + d.join(','));
  assert(d.indexOf('Delay_ms') > 0 && d.indexOf('Delay_ms') < 3, d.join(','));
  const w = names(CI.suggest(ix, { lang: 'c', prefix: 'Text' }));
  assert(w.slice(0, 2).includes('UART1_Write_Text') && w.every(n => /Text/.test(n)), 'kelime parçası eşleşmesi: ' + w);
  const s = names(CI.suggest(ix, { lang: 'c', prefix: 'TRIS' }));
  assert.deepStrictEqual(s.slice(0, 2), ['TRISB', 'TRISB4_bit']);
  assert(!names(CI.suggest(ix, { lang: 'c', prefix: 'zzq' })).length);
  const pb = CI.suggest(ix, { lang: 'c', prefix: 'PO' });
  assert.deepStrictEqual(names(pb).slice(0, 2), ['PORTA', 'PORTB']);
  assert.strictEqual(pb[0].k, 'sfr');
  assert(names(CI.suggest(ix, { lang: 'c', prefix: '_LCD' })).includes('_LCD_CLEAR'));
});

test('tamamlama: INTCON. / OPTION_REG. / değişken. → bit adları (adlı bitler önce, sonra B0..B7)', () => {
  const ix = CI.index(LIBS);
  const all = names(CI.suggest(ix, { lang: 'c', prefix: '', member: 'INTCON' }));
  assert.deepStrictEqual(all.slice(0, 8), LIBS.bits.INTCON);
  assert.deepStrictEqual(all.slice(8), ['B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7']);
  assert.deepStrictEqual(names(CI.suggest(ix, { lang: 'c', prefix: 'G', member: 'INTCON' })), ['GIE']);
  assert.deepStrictEqual(names(CI.suggest(ix, { lang: 'c', prefix: 't0', member: 'INTCON' })), ['T0IE', 'T0IF']);
  assert.deepStrictEqual(names(CI.suggest(ix, { lang: 'c', prefix: 'B', member: 'sayac' })), ['B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7']);
});

test('tamamlama: dosyadaki kullanıcı adları (yorum/dizgi hariç), fonksiyon türü, yazılan sözcük kendini önermez', () => {
  const src = 'int sayac = 0;\n// yorumdaki_ad\nchar *s = "dizgideki_ad";\nvoid goster(int deger) { PORTB = deger; }\nvoid main() { sayac++; goster(sayac); say }\n';
  const ids = CI.userIds(src, 'c');
  assert(ids.has('sayac') && ids.get('sayac').c === 3 && ids.get('sayac').k === 'var');
  assert.strictEqual(ids.get('goster').k, 'ufn');
  assert(!ids.has('yorumdaki_ad') && !ids.has('dizgideki_ad'));
  const ix = CI.index(LIBS);
  const r = CI.suggest(ix, { lang: 'c', prefix: 'say', ids });
  assert.strictEqual(r[0].n, 'sayac');
  assert(!names(r).includes('say'), 'yazılmakta olan sözcük önerilmez');
  const ids2 = CI.userIds('int sayac;\nvoid main() { sayLcd_Init(); }', 'c');
  assert(!names(CI.suggest(ix, { lang: 'c', prefix: 'say', word: 'sayLcd_Init', ids: ids2 })).includes('sayLcd_Init'), 'imlecin içinde olduğu sözcük önerilmez');
  assert.strictEqual(CI.suggest(ix, { lang: 'c', prefix: 'gos', ids })[0].k, 'ufn');
  assert.strictEqual(names(CI.suggest(ix, { lang: 'c', prefix: 'PORT', ids })).filter(n => n === 'PORTB').length, 1, 'tekrar yok');
});

test('tamamlama: assembly — komutlar, yönergeler, SFR, bit adları, etiketler', () => {
  const ix = CI.index(LIBS);
  const src = '\tlist p=16f628A\nbasla:\n\tmovlw 0x07\n\tgoto basla\nbekle\n\tdecfsz sayac, f\n\treturn\n';
  const ids = CI.userIds(src, 'asm');
  assert.strictEqual(ids.get('basla').k, 'lbl');
  assert.strictEqual(ids.get('bekle').k, 'lbl');
  assert(!ids.has('movlw') && !ids.has('x07'));
  assert.deepStrictEqual(names(CI.suggest(ix, { lang: 'asm', prefix: 'mov', ids })).slice(0, 3).sort(), ['movf', 'movlw', 'movwf']);
  assert.strictEqual(names(CI.suggest(ix, { lang: 'asm', prefix: 'bas', ids }))[0], 'basla');
  assert(names(CI.suggest(ix, { lang: 'asm', prefix: 'GI', ids })).includes('GIE'));
  assert(names(CI.suggest(ix, { lang: 'asm', prefix: 'ban', ids })).includes('banksel'));
  assert.strictEqual(CI.suggest(ix, { lang: 'asm', prefix: 'INTC', ids })[0].n, 'INTCON');
});

test('tamamlama: /api/libs yokken yerleşik listeyle çalışır', () => {
  const ix = CI.index(null);
  assert(names(CI.suggest(ix, { lang: 'c', prefix: 'Lcd_' })).includes('Lcd_Out'));
  assert(names(CI.suggest(ix, { lang: 'c', prefix: 'POR' })).includes('PORTB'));
  assert(names(CI.suggest(ix, { lang: 'c', prefix: 'whi' })).includes('while'));
});

test('tamamlama: 2 000 satırlık dosyada kimlik taraması + öneri < 30 ms', () => {
  const src = [];
  for (let i = 0; i < 2000; i++) src.push(i % 40 === 0 ? 'void fonk' + i + '(int a) { /* blok */ }' : '\tif(PORTB.B' + (i % 8) + ' == 1) { degisken' + (i % 300) + '++; Delay_ms(10); } // satır ' + i);
  const text = src.join('\n'), ix = CI.index(LIBS);
  let best = 1e9;
  for (let k = 0; k < 5; k++) {
    const t = process.hrtime.bigint();
    const ids = CI.userIds(text, 'c');
    for (const p of ['de', 'deg', 'degi', 'fo', 'PO', 'Lc']) CI.suggest(ix, { lang: 'c', prefix: p, ids });
    best = Math.min(best, Number(process.hrtime.bigint() - t) / 1e6);
  }
  const ids = CI.userIds(text, 'c');
  assert.strictEqual(ids.size >= 300, true);
  assert.strictEqual(ids.get('fonk40').k, 'ufn');
  console.log('     ' + best.toFixed(2) + ' ms');
  assert(best < 30, best + ' ms');
});

test('config word: kodla/çöz, varsayılanlar Ek B ile aynı (0x3F10 INTOSC, 0x3F02 HS), uyarılar', () => {
  const C = IDE.config;
  assert.strictEqual(C.defaultWord(4000000), 0x3F10);
  assert.strictEqual(C.defaultWord(8000000), 0x3F02);
  assert.strictEqual(C.defaultWord(20000000), 0x3F02);
  assert.deepStrictEqual(C.decode(0x3F10), { osc: 4, wdt: false, pwrt: true, mclr: false, boren: false, lvp: false, cpd: false, cp: false });
  for (let w = 0; w < 0x4000; w++) if ((w & 0x1E00) === 0x1E00) assert.strictEqual(C.encode(C.decode(w)), w, C.hex(w));
  assert.strictEqual(C.encode(Object.assign(C.decode(0x3F10), { wdt: true })), 0x3F14);
  assert.strictEqual(C.encode(Object.assign(C.decode(0x3F10), { mclr: true, boren: true })), 0x3F70);
  assert.strictEqual(C.encode(Object.assign(C.decode(0x3F10), { cp: true, cpd: true })), 0x1E10);
  assert.strictEqual(C.encode(Object.assign(C.decode(0x3F10), { osc: 5 })), 0x3F11);
  assert.strictEqual(C.encode(Object.assign(C.decode(0x3F10), { osc: 1, pwrt: false })), 0x3F09);
  assert.strictEqual(C.hex(0x3F10), '0x3F10');
  assert.strictEqual(C.OSC.length, 8);
  assert.deepStrictEqual(C.OSC.map(o => o[0]).sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
  const PIC = require('../js/pic.js');
  for (const [v] of C.OSC) { const d = PIC.decodeConfig(C.encode(Object.assign(C.decode(0x3F10), { osc: v }))); assert.strictEqual(d.fosc, v); }
  const d = PIC.decodeConfig(0x3F74);
  assert(d.wdt && d.mclr && d.boren && d.pwrt);
  assert(C.warnings(C.decode(0x3F10), 8000000).some(t => /INTOSC/.test(t)));
  assert.deepStrictEqual(C.warnings(C.decode(0x3F10), 4000000), []);
  assert(C.warnings(C.decode(0x3F14), 4000000).some(t => /WDT/.test(t)));
});

test('rutin listesi ve bildirim bulma (C ve asm)', () => {
  const c = 'int ones;\nvoid interrupt() {\n  ones++;\n}\nunsigned int f(unsigned char a)\n{\n  return a;\n}\nvoid main() {\n  while (1) { f(1); }\n}\n';
  assert.deepStrictEqual(IDE.routines(c, 'c'), [{ name: 'interrupt', line: 2 }, { name: 'f', line: 5 }, { name: 'main', line: 9 }]);
  assert.strictEqual(IDE.declOf(c, 'c', 'ones'), 1);
  assert.strictEqual(IDE.declOf(c, 'c', 'f'), 5);
  assert.strictEqual(IDE.declOf(c, 'c', 'yok'), 0);
  const a = 'num EQU 0x20\n org 0\nloopTop:\n movf num,w\n goto loopTop\nprogEnd goto progEnd\n';
  assert.deepStrictEqual(IDE.routines(a, 'asm').map(r => r.name), ['loopTop', 'progEnd']);
  assert.strictEqual(IDE.declOf(a, 'asm', 'num'), 1);
});

test('IDE.ui: I18N yokken Türkçe sözlük, anahtar bulunamazsa anahtarın kendisi, {n} yerleştirme', () => {
  assert.strictEqual(IDE.ui.t('d.bmSet', [3], 'tr'), 'Yer imi 3 ayarlandı');
  assert.strictEqual(IDE.ui.t('d.bmSet', [3], 'en'), 'Bookmark 3 set');
  assert.strictEqual(IDE.ui.t('yok.anahtar', [], 'en'), 'yok.anahtar');
  assert.deepStrictEqual(IDE.ui.missing(), []);
});

test('IDE.ui + I18N: I18N anahtarı önce gelir; mc mesajları EN G-MSG ve .log metni', () => {
  global.I18N = require('../js/i18n.js');
  try {
    assert.strictEqual(IDE.ui.t('item.build', [], 'en'), 'Build');
    const mc = [{ type: 'hint', line: 0, no: 1139, key: 'avail', args: [224, 2048] }, { type: 'warning', line: 3, no: 1509, key: 'baud', args: [9615, '0.16'] },
      { type: 'diagnostics', line: 0, no: 103, key: 'finishedOk', args: [], unit: 'T.mcppi', when: new Date(2025, 5, 26, 10, 31, 51) }, { type: 'error', line: 5, no: 0, key: 'raw', args: ['x y'] }];
    assert.strictEqual(IDE.outputs.mcText(mc[0], 'en'), 'Available RAM: 224 [bytes], Available ROM: 2048 [bytes]');
    assert.strictEqual(IDE.outputs.mcText(mc[1], 'en'), 'Generated baud rate is 9615 bps (error = 0.16 percent)');
    assert.strictEqual(IDE.outputs.mcText(mc[2], 'en'), 'Finished successfully: 26 Jun 2025, 10:31:51');
    assert.strictEqual(IDE.outputs.mcText(mc[3], 'en'), 'x y');
    const log = IDE.outputs.logText(mc, 'en').split('\n');
    assert.strictEqual(log[0], 'hint: 0 1139 Available RAM: 224 [bytes], Available ROM: 2048 [bytes]');
    assert.strictEqual(log[1], 'warning: 3 1509 Generated baud rate is 9615 bps (error = 0.16 percent)');
    assert(/^diagnostics: 0 103 Finished successfully: .+ {2}T\.mcppi$/.test(log[2]));
    assert.strictEqual(log[3], 'error: 5 0 x y');
  } finally { delete global.I18N; }
});

test('.lst / .asm üreticisi: mikroC başlığı, adres·opkod·ASM sütunları, satır açıklamaları', () => {
  const PIC = require('../js/pic.js');
  const prog = new Uint16Array(2048).fill(0x3FFF);
  prog[0] = 0x2903; prog[1] = 0x3021; prog[0x103] = 0x0008;
  const dbg = { lines: [[0, 1], [1, 2]] };
  const lst = IDE.outputs.lstText({ PIC, prog, debug: dbg, src: 'void main(){\n  x = 33;\n}', file: 'a.c', date: new Date(2025, 5, 26, 10, 31, 51) }).split('\n');
  assert.strictEqual(lst[0], ';  LST file generated by mikroListExporter - v.2.0');
  assert(/^; Date\/Time: 2025-06-26 10:31:51$/.test(lst[1]));
  assert(lst.includes(';Address Opcode \tASM'));
  const rows = lst.filter(l => /^0x/.test(l));
  assert.strictEqual(rows[0], '0x0000\t0x2903      \tGOTO       259');
  assert.strictEqual(rows[1], '0x0001\t0x3021      \tMOVLW      33');
  assert.strictEqual(lst[lst.indexOf(rows[0]) - 1], ';a.c,1 :: void main(){');
  assert.strictEqual(lst[lst.indexOf(rows[1]) - 1], ';a.c,2 :: x = 33;');
  assert(/^0x0103\t0x0008 +\tRETURN/.test(rows[2]));
  const asm = IDE.outputs.asmText({ PIC, prog, debug: dbg, src: 'a\nb', file: 'a.c' }).split('\n');
  assert(asm.includes('\tGOTO       259') && !asm.some(l => /^0x/.test(l)));
});

console.log('\n' + passed + ' geçti, ' + failed + ' başarısız');
process.exit(failed ? 1 : 0);
