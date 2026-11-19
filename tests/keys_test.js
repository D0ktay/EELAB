const assert = require('assert');
const KEYS = require('../js/keys.js');

let failed = 0, passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e.stack || e.message || e).toString().split('\n').slice(0, 8).join('\n     ')); }
}
const ev = (key, m, code) => Object.assign({ key, code }, { ctrlKey: /C/.test(m || ''), metaKey: /M/.test(m || ''), shiftKey: /S/.test(m || ''), altKey: /A/.test(m || '') });

// plan §4.3 M1 tablosu: eylem → tuş (olay biçimi)
const M1 = [
  ['build', 'F9', 'C'], ['buildAll', 'F9', 'S'], ['startDebug', 'F9', ''], ['stopDebug', 'F2', 'C'], ['runPause', 'F6', ''],
  ['stepInto', 'F7', ''], ['stepOver', 'F8', ''], ['stepOut', 'F8', 'C'], ['runToCursor', 'F4', ''], ['toggleBp', 'F5', ''],
  ['jumpToInterrupt', 'F2', ''], ['viewBps', 'F4', 'S'], ['clearBps', 'F5', 'CS'], ['watch', 'F5', 'S'], ['addWatch', 'F5', 'C'],
  ['disasm', 'd', 'A', 'KeyD'], ['editProject', 'E', 'CS'], ['codeAssist', ' ', 'C', 'Space'], ['paramAssist', ' ', 'CS', 'Space'],
  ['template', 'j', 'C'], ['gotoLine', 'g', 'C'], ['routineList', 'l', 'C'], ['findDecl', 'd', 'C'], ['find', 'f', 'C'],
  ['findNext', 'F3', ''], ['findPrev', 'F3', 'S'], ['replace', 'r', 'C'], ['deleteLine', 'y', 'C'], ['redo', 'Z', 'CS'],
  ['comment', '>', 'CS', 'Period'], ['uncomment', '<', 'CS', 'Comma'], ['indent', 'I', 'CS'], ['unindent', 'U', 'CS'],
  ['save', 's', 'C'], ['options', 'F12', '']
];

test('KEYS.table.ide: M1\'deki her eylem var', () => {
  const ids = KEYS.table.ide.map(x => x.id);
  for (const [id] of M1) assert(ids.includes(id), id + ' yok');
  for (const id of ['bookmarkSet', 'bookmarkGo']) assert(ids.includes(id), id);
  assert.strictEqual(new Set(ids).size, ids.length, 'yinelenen eylem');
});

test('KEYS.match: Ctrl ile eşleşir ve her Ctrl+ girişi ⌘ ile de (yalnız-Ctrl olanlar hariç)', () => {
  for (const [id, key, m, code] of M1) {
    const en = KEYS.entry(id);
    assert(KEYS.match(ev(key, m, code), en.key), id + ' ← ' + en.key);
    assert.strictEqual(KEYS.action(ev(key, m, code)), id, id + ' eylem çözümü');
    if (m.includes('C') && !en.c) assert.strictEqual(KEYS.action(ev(key, m.replace('C', 'M'), code)), id, id + ' ⌘ ile');
  }
});

test('KEYS.match: ⌘ ve Ctrl eşdeğer; değiştirici fazlalığı eşleşmez', () => {
  assert(KEYS.match(ev('F9', 'C'), 'Ctrl+F9'));
  assert(KEYS.match(ev('F9', 'M'), 'Ctrl+F9'));
  assert(!KEYS.match(ev('F9', 'CS'), 'Ctrl+F9'));
  assert(!KEYS.match(ev('F9', ''), 'Ctrl+F9'));
  assert(KEYS.match(ev('F9', ''), 'F9'));
  assert(!KEYS.match(ev('F9', 'S'), 'F9'));
  assert(!KEYS.match(ev('F9', 'A'), 'F9'));
});

test('eski takma adlar çözülür: ⌘B derle, ⇧F8 dışarı, ⌘/ yorum, ⌘. durdur, ⌘S kaydet', () => {
  assert.strictEqual(KEYS.action(ev('b', 'M')), 'build');
  assert.strictEqual(KEYS.action(ev('B', 'C')), 'build');
  assert.strictEqual(KEYS.action(ev('F8', 'S')), 'stepOut');
  assert.strictEqual(KEYS.action(ev('F8', '')), 'stepOver');
  assert.strictEqual(KEYS.action(ev('/', 'M', 'Slash')), 'comment');
  assert.strictEqual(KEYS.action(ev('.', 'M', 'Period')), 'stopDebug');
  assert.strictEqual(KEYS.action(ev('s', 'M')), 'save');
  assert.strictEqual(KEYS.action(ev('e', 'MS')), 'editProject');
});

test('Ctrl+R ve Ctrl+Y yalnız gerçek Ctrl (⌘R yeniden yükleme, ⌘Y geçmiş)', () => {
  assert.strictEqual(KEYS.action(ev('r', 'C')), 'replace');
  assert.strictEqual(KEYS.action(ev('r', 'M')), null);
  assert.strictEqual(KEYS.action(ev('y', 'C')), 'deleteLine');
  assert.strictEqual(KEYS.action(ev('y', 'M')), null);
  assert.strictEqual(KEYS.action(ev(' ', 'M', 'Space')), null, '⌘Space Spotlight');
});

test('yer imleri: Ctrl+0..9 git, Ctrl+Shift+0..9 koy; rakam döner', () => {
  for (let d = 0; d <= 9; d++) {
    const g = KEYS.find(ev(String(d), 'C', 'Digit' + d)), s = KEYS.find(ev('!', 'CS', 'Digit' + d));
    assert.deepStrictEqual([g.id, g.arg], ['bookmarkGo', d]);
    assert.deepStrictEqual([s.id, s.arg], ['bookmarkSet', d]);
  }
  assert.strictEqual(KEYS.action(ev('5', '', 'Digit5')), null);
});

test('Mac: Option+D, Shift ile noktalama (e.code) çözülür', () => {
  assert.strictEqual(KEYS.action(ev('∂', 'A', 'KeyD')), 'disasm');
  assert.strictEqual(KEYS.action(ev('>', 'CS', 'Period')), 'comment');
  assert.strictEqual(KEYS.action(ev('<', 'CS', 'Comma')), 'uncomment');
  assert.strictEqual(KEYS.action(ev('Z', 'CS', 'KeyZ')), 'redo');
});

test('isis tablosu: F5–F8 görünüm, F10/F11, Ctrl+F12, Pause, Shift+Break, Ctrl+E, E, tuş takımı ±', () => {
  const want = { zoomIn: 'F6', zoomOut: 'F7', zoomAll: 'F8', centre: 'F5', startDebug: 'Ctrl+F12', pause: 'Pause', stop: 'Shift+Pause', stepOver: 'F10', stepInto: 'F11', toggleBp: 'F9', edit: 'Ctrl+E', find: 'E' };
  for (const id in want) assert.strictEqual(KEYS.entry(id, 'isis').key, want[id], id);
  assert.strictEqual(KEYS.action(ev('F6', ''), 'isis'), 'zoomIn');
  assert.strictEqual(KEYS.action(ev('F8', ''), 'isis'), 'zoomAll');
  assert.strictEqual(KEYS.action(ev('F12', 'M'), 'isis'), 'startDebug');
  assert.strictEqual(KEYS.action(ev('Pause', 'S'), 'isis'), 'stop');
  assert.strictEqual(KEYS.action(ev('Escape', 'S'), 'isis'), 'stop');
  assert.strictEqual(KEYS.action(ev('e', 'M'), 'isis'), 'edit');
  assert.strictEqual(KEYS.action(ev('e', ''), 'isis'), 'find');
  assert.strictEqual(KEYS.action(ev('+', '', 'NumpadAdd'), 'isis'), 'rotateCCW');
  assert.strictEqual(KEYS.action(ev('-', '', 'NumpadSubtract'), 'isis'), 'rotateCW');
  assert.strictEqual(KEYS.action(ev('F6', ''), 'ide'), 'runPause', 'ide ve isis tabloları ayrı');
});

test('KEYS.label: menü etiketleri', () => {
  assert.strictEqual(KEYS.label('build'), 'Ctrl+F9');
  assert.strictEqual(KEYS.label('stepOut'), 'Ctrl+F8');
  assert.strictEqual(KEYS.label('bookmarkGo'), 'Ctrl+0–9');
  assert.strictEqual(KEYS.label('yok'), '');
});

console.log('\n' + passed + ' geçti, ' + failed + ' başarısız');
process.exit(failed ? 1 : 0);
