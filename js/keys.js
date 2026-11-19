(function (root) {
  'use strict';
  // key: asıl kısayol, alias: eski/ek kısayollar, c: yalnızca gerçek Ctrl (⌘ değil; tarayıcıyla çakışır)
  const IDE = [
    { id: 'build', key: 'Ctrl+F9', alias: ['Ctrl+B'] },
    { id: 'buildAll', key: 'Shift+F9' },
    { id: 'startDebug', key: 'F9' },
    { id: 'stopDebug', key: 'Ctrl+F2', alias: ['Ctrl+.'] },
    { id: 'runPause', key: 'F6' },
    { id: 'stepInto', key: 'F7' },
    { id: 'stepOver', key: 'F8' },
    { id: 'stepOut', key: 'Ctrl+F8', alias: ['Shift+F8'] },
    { id: 'runToCursor', key: 'F4' },
    { id: 'toggleBp', key: 'F5' },
    { id: 'jumpToInterrupt', key: 'F2' },
    { id: 'viewBps', key: 'Shift+F4' },
    { id: 'clearBps', key: 'Ctrl+Shift+F5' },
    { id: 'watch', key: 'Shift+F5' },
    { id: 'addWatch', key: 'Ctrl+F5' },
    { id: 'disasm', key: 'Alt+D' },
    { id: 'editProject', key: 'Ctrl+Shift+E' },
    { id: 'codeAssist', key: 'Ctrl+Space', c: 1 },
    { id: 'paramAssist', key: 'Ctrl+Shift+Space', c: 1 },
    { id: 'template', key: 'Ctrl+J', c: 1 },
    { id: 'gotoLine', key: 'Ctrl+G', c: 1 },
    { id: 'routineList', key: 'Ctrl+L', c: 1 },
    { id: 'findDecl', key: 'Ctrl+D', c: 1 },
    { id: 'find', key: 'Ctrl+F' },
    { id: 'findNext', key: 'F3' },
    { id: 'findPrev', key: 'Shift+F3' },
    { id: 'replace', key: 'Ctrl+R', c: 1 },
    { id: 'deleteLine', key: 'Ctrl+Y', c: 1 },
    { id: 'redo', key: 'Ctrl+Shift+Z' },
    { id: 'comment', key: 'Ctrl+Shift+.', alias: ['Ctrl+/'] },
    { id: 'uncomment', key: 'Ctrl+Shift+,' },
    { id: 'bookmarkSet', key: 'Ctrl+Shift+0..9', c: 1 },
    { id: 'bookmarkGo', key: 'Ctrl+0..9', c: 1 },
    { id: 'indent', key: 'Ctrl+Shift+I' },
    { id: 'unindent', key: 'Ctrl+Shift+U' },
    { id: 'save', key: 'Ctrl+S' },
    { id: 'options', key: 'F12' }
  ];
  const ISIS = [
    { id: 'zoomIn', key: 'F6' },
    { id: 'zoomOut', key: 'F7' },
    { id: 'zoomAll', key: 'F8' },
    { id: 'centre', key: 'F5' },
    { id: 'startDebug', key: 'Ctrl+F12' },
    { id: 'pause', key: 'Pause' },
    { id: 'stop', key: 'Shift+Pause', alias: ['Shift+Escape'] },
    { id: 'stepOver', key: 'F10' },
    { id: 'stepInto', key: 'F11' },
    { id: 'stepOut', key: 'Ctrl+F11' },
    { id: 'toggleBp', key: 'F9' },
    { id: 'edit', key: 'Ctrl+E' },
    { id: 'find', key: 'E' },
    { id: 'rotateCCW', key: 'NumpadAdd' },
    { id: 'rotateCW', key: 'NumpadSubtract' }
  ];
  const table = { ide: IDE, isis: ISIS };

  const CODE = { Period: '.', Comma: ',', Slash: '/', Space: 'Space', NumpadAdd: 'NumpadAdd', NumpadSubtract: 'NumpadSubtract', Pause: 'Pause', Escape: 'Escape' };
  const norm = k => (k === ' ' ? 'Space' : k.length === 1 ? k.toUpperCase() : k === 'Break' ? 'Pause' : k);
  function names(e) {
    const s = [];
    if (e.key != null && e.key !== 'Dead') s.push(norm(String(e.key)));
    const c = e.code;
    if (c) {
      let m;
      if ((m = /^Key([A-Z])$/.exec(c)) || (m = /^Digit(\d)$/.exec(c))) s.push(m[1]);
      else if (/^F\d+$/.test(c)) s.push(c);
      else if (CODE[c]) s.push(CODE[c]);
    }
    return s;
  }
  function parse(combo) {
    const p = String(combo).split('+');
    const key = p.pop();
    const mods = new Set(p.map(x => (x === '⌘' || x === 'Cmd' || x === 'Meta' ? 'Ctrl' : x)));
    return { ctrl: mods.has('Ctrl'), shift: mods.has('Shift'), alt: mods.has('Alt'), key };
  }
  function match(e, combo, strict) {
    if (!e) return false;
    const c = parse(combo), real = !!(e.ctrlKey || e.metaKey);
    if (real !== c.ctrl || !!e.shiftKey !== c.shift || !!e.altKey !== c.alt) return false;
    if (strict && c.ctrl && (!e.ctrlKey || e.metaKey)) return false;
    const n = names(e);
    if (c.key === '0..9') { const d = n.find(x => /^\d$/.test(x)); return d !== undefined; }
    return n.some(x => x.toLowerCase() === c.key.toLowerCase());
  }
  function digit(e) { const d = names(e).find(x => /^\d$/.test(x)); return d === undefined ? null : +d; }
  function combos(en) { return [en.key].concat(en.alias || []); }
  function find(e, scope) {
    for (const en of table[scope || 'ide'] || [])
      for (const k of combos(en)) if (match(e, k, en.c)) return { id: en.id, key: k, arg: /0\.\.9/.test(k) ? digit(e) : null };
    return null;
  }
  function action(e, scope) { const f = find(e, scope); return f ? f.id : null; }
  function entry(id, scope) { return (table[scope || 'ide'] || []).find(x => x.id === id) || null; }
  function label(id, scope) { const en = entry(id, scope); return en ? en.key.replace('0..9', '0–9') : ''; }

  const KEYS = { table, match, find, action, entry, label, digit, parse };
  root.KEYS = KEYS;
  if (typeof module !== 'undefined' && module.exports) module.exports = KEYS;
})(typeof window !== 'undefined' ? window : globalThis);
