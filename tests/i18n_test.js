const assert = require('assert');
const I18N = require('../js/i18n.js');

let failed = 0, passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e.stack || e.message || e).toString().split('\n').slice(0, 8).join('\n     ')); }
}

// Global ortamı (localStorage / window / location / fetch) geçici olarak değiştirir ve geri yükler.
function withGlobals(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) {
    saved[k] = { had: Object.prototype.hasOwnProperty.call(globalThis, k), val: globalThis[k] };
    globalThis[k] = vars[k];
  }
  try { return fn(); }
  finally {
    for (const k of Object.keys(saved)) {
      if (saved[k].had) globalThis[k] = saved[k].val; else delete globalThis[k];
    }
  }
}

function memStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    _map: m,
  };
}

const KF5 = {
  // K-F5 anahtarları ve G-MSG (plan §2.3) EN metinleri: args ile doldurulmuş hali birebir aynı olmalı.
  avail: [[224, 2048], 'Available RAM: 224 [bytes], Available ROM: 2048 [bytes]'],
  compStart: [[], 'Compilation Started'],
  compOk: [[], 'Compiled Successfully'],
  allComp: [[412], 'All files Compiled in 412 ms'],
  usedRam: [[22, 1, 202, 99], 'Used RAM (bytes): 22 (1%)  Free RAM (bytes): 202 (99%)'],
  usedRom: [[430, 21, 1618, 79], 'Used ROM (program words): 430 (21%)  Free ROM (program words): 1618 (79%)'],
  linked: [[], 'Project Linked Successfully'],
  linkedIn: [[37], 'Linked in 37 ms'],
  completed: [['Task1.mcppi', 512], "Project 'Task1.mcppi' completed: 512 ms"],
  finishedOk: [[new Date(2025, 5, 26, 10, 31, 51)], 'Finished successfully: 26 Jun 2025, 10:31:51'],
  finishedErr: [[new Date(2025, 5, 26, 10, 31, 51)], 'Finished (with errors): 26 Jun 2025, 10:31:51'],
  baud: [[9615, '0.16'], 'Generated baud rate is 9615 bps (error = 0.16 percent)'],
  undeclared: [['x1'], "Undeclared identifier 'x1' in expression"],
  expected: [['x1'], "; expected, but 'x1' found"],
  raw: [['SDCC: some text'], 'SDCC: some text'],
};

const KEY_RE = /^[a-zA-Z][A-Za-z0-9]*(\.[a-zA-Z][A-Za-z0-9]*)*$/;
const ph = s => (s.match(/\{\d+\}/g) || []).slice().sort();

// ── Golden assertions (plan §4.3 tests) ──────────────────────────────────
test("golden: t('usedRom', [430,21,1618,79], 'en')", () => {
  assert.strictEqual(I18N.t('usedRom', [430, 21, 1618, 79], 'en'),
    'Used ROM (program words): 430 (21%)  Free ROM (program words): 1618 (79%)');
});

test("golden: t('finishedOk', [new Date(2025,5,26,10,31,51)], 'en')", () => {
  assert.strictEqual(I18N.t('finishedOk', [new Date(2025, 5, 26, 10, 31, 51)], 'en'),
    'Finished successfully: 26 Jun 2025, 10:31:51');
});

test('TR tarih biçimi: 2025-10-15 12:23:41 → 15 Eki 2025, 12:23:41', () => {
  assert.strictEqual(I18N.t('finishedErr', [new Date(2025, 9, 15, 12, 23, 41)], 'tr'),
    'Hatalarla bitti: 15 Eki 2025, 12:23:41');
  assert.strictEqual(I18N.t('finishedOk', [new Date(2025, 9, 15, 12, 23, 41)], 'tr'),
    'Başarıyla bitti: 15 Eki 2025, 12:23:41');
});

test('tüm K-F5 EN şablonları G-MSG/G-ERR metniyle birebir', () => {
  for (const [key, [args, expected]] of Object.entries(KF5)) {
    assert.strictEqual(I18N.t(key, args, 'en'), expected, 'anahtar: ' + key);
  }
});

test('K-F5 anahtarlarının tamamı tr ve en sözlüklerinde var', () => {
  for (const key of Object.keys(KF5)) {
    assert(I18N.has(key, 'tr'), 'tr eksik: ' + key);
    assert(I18N.has(key, 'en'), 'en eksik: ' + key);
  }
  assert.strictEqual(Object.keys(KF5).length, 15);
});

test('K-F5 TR şablonları doldurulur (yer tutucu kalmaz)', () => {
  for (const [key, [args]] of Object.entries(KF5)) {
    const s = I18N.t(key, args, 'tr');
    assert(!/\{\d+\}/.test(s), key + ' → ' + s);
    assert(s.trim().length > 0, key);
  }
  assert.strictEqual(I18N.t('usedRom', [430, 21, 1618, 79], 'tr'),
    'Kullanılan ROM (program word): 430 (%21)  Boş ROM (program word): 1618 (%79)');
});

// ── Sözlük bütünlüğü ─────────────────────────────────────────────────────
test('her anahtar tr ve en sözlüklerinde var (eşit küme)', () => {
  const tr = Object.keys(I18N.dict.tr).sort(), en = Object.keys(I18N.dict.en).sort();
  assert.deepStrictEqual(tr.filter(k => !en.includes(k)), [], 'yalnız tr');
  assert.deepStrictEqual(en.filter(k => !tr.includes(k)), [], 'yalnız en');
  assert(tr.length > 100, 'beklenenden az anahtar: ' + tr.length);
});

test('boş değer yok (tr ve en)', () => {
  for (const L of ['tr', 'en']) {
    for (const [k, v] of Object.entries(I18N.dict[L])) {
      assert.strictEqual(typeof v, 'string', L + '.' + k);
      assert(v.trim().length > 0, 'boş: ' + L + '.' + k);
    }
  }
});

test('anahtar adları kararlı biçimde (camelCase, noktalı önek)', () => {
  for (const k of Object.keys(I18N.dict.en)) assert(KEY_RE.test(k), 'geçersiz anahtar: ' + k);
});

test('yer tutucu sayısı ve indeksleri tr/en arasında eşit', () => {
  for (const k of Object.keys(I18N.dict.en)) {
    const a = ph(I18N.dict.tr[k]), b = ph(I18N.dict.en[k]);
    assert.strictEqual(a.length, b.length, 'sayı farkı: ' + k + ' tr=' + a + ' en=' + b);
    assert.deepStrictEqual(a, b, 'indeks farkı: ' + k);
  }
});

// ── t() davranışı ────────────────────────────────────────────────────────
test('bilinmeyen anahtar kendisini döndürür; EN yedeği; eksik argüman yer tutucuyu korur', () => {
  assert.strictEqual(I18N.t('yokBoylesiBirAnahtar', [], 'tr'), 'yokBoylesiBirAnahtar');
  assert.strictEqual(I18N.t('usedRam', [1, 2], 'en'), 'Used RAM (bytes): 1 (2%)  Free RAM (bytes): {2} ({3}%)');
});

test("t() args verilmezse / tek değer verilirse çalışır", () => {
  assert.strictEqual(I18N.t('compOk', undefined, 'en'), 'Compiled Successfully');
  assert.strictEqual(I18N.t('raw', 'hello', 'en'), 'hello');
});

test("t() geçersiz dili lang() ile çözer", () => {
  withGlobals({ localStorage: undefined }, () => {
    I18N.setLang('en');
    assert.strictEqual(I18N.t('compOk', [], 'de'), 'Compiled Successfully');
    I18N.setLang('tr');
    assert.strictEqual(I18N.t('compOk', [], 'de'), 'Başarıyla Derlendi');
  });
});

test('has(key) iki dilde de arar; has(key, lang) tek dilde', () => {
  assert(I18N.has('finishedOk'));
  assert(I18N.has('finishedOk', 'en'));
  assert(!I18N.has('yokBoylesiBirAnahtar'));
  assert(!I18N.has('yokBoylesiBirAnahtar', 'en'));
});

// ── lang() / setLang() DOM olmadan ───────────────────────────────────────
test('lang() DOM ve localStorage olmadan varsayılan tr; setLang bellekte tutar', () => {
  withGlobals({ localStorage: undefined, window: undefined }, () => {
    I18N.setLang('tr');
    assert.strictEqual(I18N.lang(), 'tr');
    assert.strictEqual(I18N.setLang('en'), true);
    assert.strictEqual(I18N.lang(), 'en');
    assert.strictEqual(I18N.setLang('de'), false, 'geçersiz dil reddedilmeli');
    assert.strictEqual(I18N.lang(), 'en', 'geçersiz dil durumu değiştirmemeli');
    I18N.setLang('tr');
    assert.strictEqual(I18N.lang(), 'tr');
  });
});

test("localStorage 'eelab.ui.lang' anahtarını kullanır", () => {
  const ls = memStorage();
  withGlobals({ localStorage: ls, window: undefined }, () => {
    I18N.setLang('en');
    assert.strictEqual(ls._map.get('eelab.ui.lang'), 'en');
    ls._map.set('eelab.ui.lang', 'tr');
    assert.strictEqual(I18N.lang(), 'tr');
    ls._map.set('eelab.ui.lang', 'bozuk');
    assert.strictEqual(I18N.lang(), 'tr', 'bozuk değer varsayılana düşmeli');
  });
});

test('localStorage fırlatırsa lang()/setLang() yine çalışır ve fırlatmaz', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  withGlobals({ localStorage: bad, window: undefined }, () => {
    assert.doesNotThrow(() => I18N.setLang('en'));
    assert.strictEqual(I18N.lang(), 'en');
    I18N.setLang('tr');
  });
});

test("setLang window'da 'eelab-lang' olayı yollar", () => {
  const got = [];
  const fakeWin = { dispatchEvent(e) { got.push({ type: e.type, lang: e.detail && e.detail.lang }); return true; } };
  withGlobals({ localStorage: undefined, window: fakeWin }, () => {
    I18N.setLang('en');
    I18N.setLang('tr');
  });
  assert.deepStrictEqual(got, [{ type: 'eelab-lang', lang: 'en' }, { type: 'eelab-lang', lang: 'tr' }]);
});

test("setLang tarayıcıda /api/settings {ui:{lang}} POST eder (en iyi çaba)", () => {
  const calls = [];
  const fakeWin = { dispatchEvent() { return true; } };
  const fakeFetch = (url, opts) => { calls.push({ url, opts }); return Promise.resolve({ ok: true }); };
  withGlobals({ localStorage: undefined, window: fakeWin, location: { protocol: 'http:' }, fetch: fakeFetch }, () => {
    I18N.setLang('en');
  });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, '/api/settings');
  assert.strictEqual(calls[0].opts.method, 'POST');
  assert.deepStrictEqual(JSON.parse(calls[0].opts.body), { ui: { lang: 'en' } });
});

test('setLang sunucu hatasında ya da fetch fırlatmasında asla fırlatmaz', () => {
  const fakeWin = { dispatchEvent() { return true; } };
  const throwing = () => { throw new TypeError('boom'); };
  const rejecting = () => Promise.reject(new Error('down'));
  withGlobals({ localStorage: undefined, window: fakeWin, location: { protocol: 'http:' }, fetch: throwing }, () => {
    assert.doesNotThrow(() => I18N.setLang('en'));
  });
  withGlobals({ localStorage: undefined, window: fakeWin, location: { protocol: 'http:' }, fetch: rejecting }, () => {
    assert.doesNotThrow(() => I18N.setLang('tr'));
  });
  I18N.setLang('tr');
});

test('Node ortamında (window yok) setLang fetch yapmaz', () => {
  let called = false;
  withGlobals({ localStorage: undefined, window: undefined, location: undefined, fetch: () => { called = true; return Promise.resolve(); } }, () => {
    I18N.setLang('en');
    I18N.setLang('tr');
  });
  assert.strictEqual(called, false);
});

console.log('\n' + passed + ' geçti, ' + failed + ' başarısız');
process.exit(failed ? 1 : 0);
