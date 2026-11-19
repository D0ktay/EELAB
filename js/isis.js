(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const I = {
    select: '<path d="M4 2l9 7-4 .6 2.6 4.6-1.8 1-2.6-4.6L4 13z" fill="#fff" stroke="#111" stroke-width="1"/>',
    component: '<path d="M4 4h8v8H4z" fill="#f4f0c8" stroke="#8b1a1a"/><path d="M2 6h2M2 10h2M12 6h2M12 10h2" stroke="#8b1a1a"/>',
    junction: '<path d="M1 8h14M8 2v12" stroke="#1b6f1b" stroke-width="1.3"/><circle cx="8" cy="8" r="2.4" fill="#1b6f1b"/>',
    label: '<path d="M1 11h14" stroke="#1b6f1b" stroke-width="1.3"/><text x="2.5" y="9" font-size="7" font-family="Arial" font-weight="bold" fill="#123">LBL</text>',
    script: '<path d="M3 2h8l2 2v10H3z" fill="#fff" stroke="#333"/><path d="M5 6h6M5 8h6M5 10h4" stroke="#333"/>',
    bus: '<path d="M2 8h12" stroke="#2048c8" stroke-width="3"/><path d="M5 8v5M10 8V3" stroke="#1b6f1b"/>',
    subckt: '<path d="M3 3h10v10H3z" fill="#e8f0ff" stroke="#2048c8"/><path d="M1 6h2M1 10h2M13 8h2" stroke="#2048c8"/>',
    terminal: '<path d="M2 8l3-3h9v6H5z" fill="#fff" stroke="#8b1a1a"/><path d="M0 8h2" stroke="#1b6f1b"/>',
    devpin: '<path d="M2 8h9" stroke="#8b1a1a" stroke-width="1.3"/><path d="M11 5v6" stroke="#333"/><text x="11" y="5" font-size="5" font-family="Arial" fill="#333">1</text>',
    graph: '<path d="M2 2h12v12H2z" fill="#fff" stroke="#333"/><path d="M3 11l3-5 3 3 4-6" fill="none" stroke="#c00"/>',
    popup: '<path d="M2 3h12v10H2z" fill="#fff" stroke="#333" stroke-dasharray="2 1"/><path d="M5 6h6v4H5z" fill="#ffe680" stroke="#333"/>',
    gen: '<circle cx="8" cy="8" r="6" fill="#fff" stroke="#333"/><path d="M4 8c1.3-3 2.7-3 4 0s2.7 3 4 0" fill="none" stroke="#c00"/>',
    probe: '<path d="M3 13l6-6" stroke="#333" stroke-width="1.4"/><path d="M8 3h5v5h-5z" fill="#3b70e0" stroke="#123"/><text x="8.8" y="7.3" font-size="5" font-family="Arial" fill="#fff">V</text>',
    instrument: '<path d="M2 3h12v9H2z" fill="#333" stroke="#111"/><path d="M3 9l2-3 2 2 2-4 2 3 2-1" fill="none" stroke="#f5e536"/><path d="M5 14h6" stroke="#333" stroke-width="1.5"/>',
    line: '<path d="M2 13L14 3" stroke="#2048c8" stroke-width="1.3"/>',
    box: '<path d="M3 4h10v8H3z" fill="none" stroke="#2048c8" stroke-width="1.3"/>',
    circle: '<circle cx="8" cy="8" r="5" fill="none" stroke="#2048c8" stroke-width="1.3"/>',
    arc: '<path d="M3 12A7 7 0 0 1 13 4" fill="none" stroke="#2048c8" stroke-width="1.3"/>',
    path: '<path d="M2 12l3-8 4 5 3-6 2 9z" fill="none" stroke="#2048c8" stroke-width="1.2"/>',
    text: '<text x="3" y="13" font-size="13" font-family="Times New Roman,serif" font-weight="bold" fill="#2048c8">A</text>',
    symbol: '<path d="M3 3h10v10H3z" fill="none" stroke="#2048c8"/><text x="5" y="11.5" font-size="8" font-family="Arial" font-weight="bold" fill="#2048c8">S</text>',
    marker: '<path d="M8 2v12M2 8h12" stroke="#2048c8"/><circle cx="8" cy="8" r="2.5" fill="none" stroke="#2048c8"/>'
  };
  const T = {
    imp: '<path d="M2 3h5l1 2h6v8H2z" fill="#f2c94c" stroke="#9a7614"/><path d="M8 7v5M6 10l2 2 2-2" fill="none" stroke="#0040da" stroke-width="1.4"/>',
    save: '<path d="M2 2h10l2 2v10H2z" fill="#3b6fc7" stroke="#1d3f7a"/><path d="M4 2h7v4H4z" fill="#fff"/><path d="M4 9h8v5H4z" fill="#dfe8f7"/>',
    def: '<path d="M2 8l6-5 6 5v6H2z" fill="#f4f0c8" stroke="#8b1a1a"/><path d="M6 14v-4h4v4" fill="#8b1a1a"/>',
    grid: '<g fill="#555"><circle cx="3" cy="3" r="1"/><circle cx="8" cy="3" r="1"/><circle cx="13" cy="3" r="1"/><circle cx="3" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="13" cy="8" r="1"/><circle cx="3" cy="13" r="1"/><circle cx="8" cy="13" r="1"/><circle cx="13" cy="13" r="1"/></g>',
    zin: '<circle cx="7" cy="7" r="4.5" fill="#fff" stroke="#333" stroke-width="1.3"/><path d="M10.5 10.5L14 14" stroke="#333" stroke-width="2"/><path d="M5 7h4M7 5v4" stroke="#0040da" stroke-width="1.4"/>',
    zout: '<circle cx="7" cy="7" r="4.5" fill="#fff" stroke="#333" stroke-width="1.3"/><path d="M10.5 10.5L14 14" stroke="#333" stroke-width="2"/><path d="M5 7h4" stroke="#0040da" stroke-width="1.4"/>',
    zall: '<path d="M2 2h12v12H2z" fill="#fff" stroke="#333"/><path d="M5 5h6v6H5z" fill="none" stroke="#0040da" stroke-width="1.3"/><path d="M2 2l3 3M14 2l-3 3M2 14l3-3M14 14l-3-3" stroke="#0040da"/>',
    undo: '<path d="M5 4L2 7l3 3" fill="none" stroke="#0040da" stroke-width="1.6"/><path d="M2 7h7a4 4 0 0 1 0 8H7" fill="none" stroke="#0040da" stroke-width="1.6"/>',
    redo: '<path d="M11 4l3 3-3 3" fill="none" stroke="#0040da" stroke-width="1.6"/><path d="M14 7H7a4 4 0 0 0 0 8h2" fill="none" stroke="#0040da" stroke-width="1.6"/>',
    cut: '<circle cx="4.5" cy="12" r="2.2" fill="none" stroke="#333" stroke-width="1.2"/><circle cx="11.5" cy="12" r="2.2" fill="none" stroke="#333" stroke-width="1.2"/><path d="M6 10.5L12 2M10 10.5L4 2" stroke="#555" stroke-width="1.2"/>',
    copy: '<path d="M2 2h7v9H2z" fill="#fff" stroke="#333"/><path d="M6 5h8v9H6z" fill="#fff" stroke="#333"/><path d="M8 8h4M8 10h4" stroke="#999"/>',
    paste: '<path d="M3 3h10v11H3z" fill="#c8a165" stroke="#7a5a25"/><path d="M6 2h4v2H6z" fill="#ddd" stroke="#555"/><path d="M6 7h7v8H6z" fill="#fff" stroke="#333"/>',
    del: '<path d="M3 3l10 10M13 3L3 13" stroke="#d01818" stroke-width="2.2"/>',
    wire: '<path d="M2 12h5V4h7" fill="none" stroke="#1b6f1b" stroke-width="1.6"/><circle cx="2" cy="12" r="1.5" fill="#1b6f1b"/><path d="M11 13l3-3" stroke="#d6a400" stroke-width="2.4"/><path d="M10 14l1-1" stroke="#333" stroke-width="1.4"/>',
    pick: '<path d="M2 3h9v10H2z" fill="#f4f0c8" stroke="#8b1a1a"/><circle cx="10.5" cy="10.5" r="3" fill="#fff" stroke="#0040da" stroke-width="1.3"/><path d="M12.5 12.5l2 2" stroke="#0040da" stroke-width="1.8"/>',
    hex: '<path d="M2 2h12v12H2z" fill="#fff" stroke="#333"/><text x="2.6" y="10.5" font-size="6" font-family="Arial" font-weight="bold" fill="#8b1a1a">HEX</text>',
    rotc: '<path d="M4 9a5 5 0 1 1 5 5" fill="none" stroke="#0040da" stroke-width="1.5"/><path d="M1 7l3 3 3-3" fill="none" stroke="#0040da" stroke-width="1.5"/>',
    rota: '<path d="M12 9a5 5 0 1 0-5 5" fill="none" stroke="#0040da" stroke-width="1.5"/><path d="M9 7l3 3 3-3" fill="none" stroke="#0040da" stroke-width="1.5"/>',
    mx: '<path d="M8 1v14" stroke="#888" stroke-dasharray="2 1"/><path d="M6 4L2 8l4 4zM10 4l4 4-4 4z" fill="#0040da"/>',
    my: '<path d="M1 8h14" stroke="#888" stroke-dasharray="2 1"/><path d="M4 6l4-4 4 4zM4 10l4 4 4-4z" fill="#0040da"/>',
    play: '<path d="M4 2l10 6-10 6z" fill="#0040da"/>',
    step: '<path d="M2 2l8 6-8 6z" fill="#0040da"/><path d="M11 2h3v12h-3z" fill="#0040da"/>',
    pause: '<path d="M3 2h4v12H3zM9 2h4v12H9z" fill="#0040da"/>',
    stop: '<path d="M3 3h10v10H3z" fill="#0040da"/>'
  };
  const icon = (d, n) => '<svg viewBox="0 0 16 16" width="' + (n || 16) + '" height="' + (n || 16) + '" aria-hidden="true">' + d + '</svg>';
  const MODES = [
    ['select', 'Selection Mode'], ['component', 'Component Mode'], ['junction', 'Junction Dot Mode', 'Junction dots are placed automatically wherever wires join.'],
    ['label', 'Wire Label Mode'], ['script', 'Text Script Mode'], ['bus', 'Buses Mode'], ['subckt', 'Subcircuit Mode'], null,
    ['terminal', 'Terminals Mode'], ['devpin', 'Device Pins Mode'], ['graph', 'Graph Mode', 'Use the OSCILLOSCOPE / LOGIC ANALYSER instruments (or double-click a wire while simulating) instead of graphs.'],
    ['popup', 'Active Popup Mode'], ['gen', 'Generator Mode', 'Use LOGICSTATE, BUTTON or SWITCH (Component Mode) as digital sources.'], ['probe', 'Probe Mode'], ['instrument', 'Virtual Instruments Mode'], null,
    ['line', '2D Graphics Line Mode'], ['box', '2D Graphics Box Mode'], ['circle', '2D Graphics Circle Mode'], ['arc', '2D Graphics Arc Mode'],
    ['path', '2D Graphics Closed Path Mode'], ['text', '2D Graphics Text Mode'], ['symbol', '2D Graphics Symbols Mode'], ['marker', '2D Graphics Markers Mode']
  ];
  const LIVE = { select: 1, component: 1, label: 1, terminal: 1, probe: 1, instrument: 1 };
  const hasModel = t => ['CRYSTAL', 'CAP', 'CAP-ELEC', 'TERMINAL'].indexOf(t) < 0;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const STEP_OUT_KEY = 'Ctrl+F11';
  const DEBUG_ITEMS = [['Start VSM Debugging', 'Ctrl+F12', 'start'], ['Pause Animation', 'Pause', 'pause'], ['Stop VSM Debugging', 'Shift+Break', 'stop'], ['Step Over', 'F10', 'stepOver'],
    ['Step Into', 'F11', 'stepInto'], ['Step Out', STEP_OUT_KEY, 'stepOut'], null, ['PIC CPU Registers - %', '', 'popup:regs'], ['PIC CPU Data Memory - %', '', 'popup:data'],
    ['PIC CPU Program Memory - %', '', 'popup:prog'], ['PIC CPU EPROM Memory - %', '', 'popup:eeprom'], ['PIC CPU Source Code - %', '', 'popup:source'], ['Watch Window', '', 'popup:watch'], null,
    ['Reset Persistent Model Data', '', 'resetPersistent']];
  const VIEW_ITEMS = [['Toggle Grid', 'G'], null, ['Zoom In', 'F6'], ['Zoom Out', 'F7'], ['Zoom All', 'F8'], ['Centre At Cursor', 'F5']];
  const lab = (it, ref) => it ? (it[0].replace('%', ref || 'U1') + (it[1] ? '  ' + it[1] : '')) : null;
  const MENU_LABELS = { View: VIEW_ITEMS.map(it => lab(it)), Debug: DEBUG_ITEMS.map(it => lab(it)) };
  const LEGACY_DEBUG = { start: 'run', pause: 'pause', stop: 'stop', stepOver: 'step', stepInto: 'step' };
  function menuDefs(o, ED, h) {
    h = h || {};
    const picRef = () => { const p = ED.parts && ED.parts().find(q => q.type === 'PIC16F628A'); return p ? p.id : 'U1'; };
    const dbg = name => o.debugCmd ? () => o.debugCmd(name) : (LEGACY_DEBUG[name] && o[LEGACY_DEBUG[name]]) || null;
    return [
      ['File', () => {
        const circs = (o.circuits && o.circuits()) || [];
        return [['Import Proteus Project (.pdsprj)…', '', o.importPds], null,
          ['Open Design', '', null, circs.map(n => [n, '', () => o.openDesign(n)])],
          ['Save Design', '', o.saveDesign], ['Reload Default Design (lab3)', '', o.defaultDesign], null,
          ['Export Graphics ▸ PNG Bitmap (2x)', '', () => o.exportAs('png')], ['Export Graphics ▸ SVG File', '', () => o.exportAs('svg')], ['Print Design…', '', () => o.exportAs('print')], null,
          ['Load Program File (HEX)…', '', o.loadHex]];
      }],
      ['Edit', () => [['Undo', 'Ctrl+Z', () => ED.undo()], ['Redo', 'Ctrl+Shift+Z', () => ED.redo()], null, ['Cut To Clipboard', 'Ctrl+X', () => ED.cut()], ['Copy To Clipboard', 'Ctrl+C', () => ED.copy()],
        ['Paste From Clipboard', 'Ctrl+V', () => ED.paste(null, true)], ['Duplicate', 'Ctrl+D', () => ED.duplicate()], null, ['Select All Objects', 'Ctrl+A', () => ED.selectAll()],
        ['Delete Selected', 'Del', () => ED.del()], ['Edit Properties…', 'Ctrl+E', () => { if (!ED.editProps()) o.toast('Select a component first.'); }], ['Find and Edit Component…', 'E', () => ED.findAndEdit && ED.findAndEdit()],
        ['Rotate Clockwise', 'R', () => ED.rotate(1)], ['Rotate Anti-Clockwise', 'Num +', () => ED.rotate(3)]]],
      ['View', () => VIEW_ITEMS.map(it => !it ? null : it[0] === 'Toggle Grid' ? [it[0], it[1], h.grid || (() => ED.setGrid())] :
        [it[0], it[1], () => ED.zoomKey(it[0] === 'Zoom In' ? 'in' : it[0] === 'Zoom Out' ? 'out' : it[0] === 'Zoom All' ? 'all' : 'centre')])],
      ['Tool', () => [['Wire Mode (draw wires)', 'W', () => ED.setTool(h.wireOn && h.wireOn() ? 'select' : 'wire')], ['Wire Autorouter', '', null]]],
      ['Design', () => [['Pick Devices…', 'P', h.openPick], null, ['Design Explorer', '', null], ['New Sheet', '', null]]],
      ['Graph', () => [['Add Graph Trace…', '', null], ['Simulate Graph', '', null]]],
      ['Debug', () => DEBUG_ITEMS.map(it => !it ? null : [lab(it, picRef()).replace(/  .*$/, '') , it[1], dbg(it[2])])],
      ['Library', () => [['Pick Parts…', 'P', h.openPick], ['Library Manager…', '', null]]],
      ['Template', () => [['Set Design Colours…', '', null], ['Set Graphics Styles…', '', null], ['Set Text Styles…', '', null]]],
      ['System', () => [['Set Animation Options…', '', o.animOptions || null], ['Set Simulator Options…', '', null]]],
      ['Help', () => [['Schematic Capture Shortcuts', '', o.shortcuts], ['About EELAB…', '', o.about]]]
    ];
  }

  function create(o) {
    const $ = id => document.getElementById(id);
    const ED = o.editor, LIB = o.lib;
    let active = 'select', running = false;

    for (const [id, ic] of Object.entries(o.icons || {})) { const b = $(id); if (b && T[ic]) b.insertAdjacentHTML('afterbegin', icon(T[ic])); }

    for (const [id, n] of [['trot', 3], ['trotc', 1]]) { const b = $(id); if (b && b.addEventListener) b.addEventListener('contextmenu', e => { e.preventDefault(); ED.rotate(n); }); }

    const modes = $(o.modes);
    for (const m of MODES) {
      if (!m) { const s = document.createElement('i'); s.className = 'msep'; modes.appendChild(s); continue; }
      const b = document.createElement('button');
      b.className = 'mbtn' + (LIVE[m[0]] ? '' : ' na');
      b.dataset.m = m[0]; b.title = m[1] + (LIVE[m[0]] ? '' : ' (not available in EELAB)');
      b.innerHTML = icon(I[m[0]], 16);
      b.onclick = () => pickMode(m[0], m);
      modes.appendChild(b);
    }
    function hl() { for (const b of modes.querySelectorAll('.mbtn')) b.classList.toggle('on', b.dataset.m === active); }
    function pickMode(k, m) {
      if (running) { o.toast('Stop the simulation (■) to edit the design.'); return; }
      if (!LIVE[k]) { o.toast(m[1] + ' is not available in EELAB.' + (m[2] ? ' ' + m[2] : '')); return; }
      if (k === 'select') { ED.setTool('select'); active = 'select'; }
      else if (k === 'label') { ED.setSelector('terminal', true); ED.setTool('place', 'TERMINAL'); active = 'label'; }
      else { ED.setSelector(k); active = k; }
      hl();
    }
    function onTool(tool, inf) {
      inf = inf || {};
      if (tool === 'select') { if (!(active in { component: 1, terminal: 1, probe: 1, instrument: 1 })) active = 'select'; }
      else if (tool === 'place') active = inf.type === 'TERMINAL' && active === 'label' ? 'label' : inf.mode;
      else active = '';
      hl();
      const a = $(o.angle); if (a) a.textContent = String(tool === 'place' ? inf.rot || 0 : 0);
      for (const id of o.wireBtns || []) { const b = $(id); if (b) b.classList.toggle('on', tool === 'wire'); }
    }
    function escSelect() { active = 'select'; hl(); }

    const ov = $(o.overview);
    ov.innerHTML = '<svg class="ovs" preserveAspectRatio="xMidYMid meet"><rect class="ovpaper" x="0" y="0" width="1" height="1"/><use href="#ed-content"/><rect class="ovview" x="0" y="0" width="1" height="1"/></svg>';
    const ovs = ov.querySelector('svg'), ovp = ovs.querySelector('.ovpaper'), ovr = ovs.querySelector('.ovview');
    let ovBox = null, ovDrag = false;
    function onView(v) {
      const s = v.sheet, m = Math.max(s.w, s.h) * 0.04;
      const x0 = Math.min(s.x, v.x) - m, y0 = Math.min(s.y, v.y) - m, x1 = Math.max(s.x + s.w, v.x + v.w) + m, y1 = Math.max(s.y + s.h, v.y + v.h) + m;
      ovBox = [x0, y0, x1 - x0, y1 - y0];
      ovs.setAttribute('viewBox', ovBox.join(' '));
      for (const [k, val] of [['x', x0], ['y', y0], ['width', x1 - x0], ['height', y1 - y0]]) ovp.setAttribute(k, val);
      for (const [k, val] of [['x', v.x], ['y', v.y], ['width', v.w], ['height', v.h]]) ovr.setAttribute(k, val);
      ovr.setAttribute('stroke-width', Math.max(1, (x1 - x0) / 120));
    }
    function ovAt(e) {
      const m = ovs.getScreenCTM(); if (!m) return;
      const q = ovs.createSVGPoint(); q.x = e.clientX; q.y = e.clientY; const r = q.matrixTransform(m.inverse());
      ED.centerOn(r.x, r.y);
    }
    ovs.addEventListener('pointerdown', e => { ovDrag = true; ovs.setPointerCapture(e.pointerId); ovAt(e); });
    ovs.addEventListener('pointermove', e => { if (ovDrag) ovAt(e); });
    ovs.addEventListener('pointerup', () => { ovDrag = false; });
    ovs.addEventListener('wheel', e => { e.preventDefault(); ED.zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15); }, { passive: false });

    const menuBar = $(o.menubar);
    let openM = null;
    const MENUS = menuDefs(o, ED, { openPick, wireOn: () => wireOn(), grid: () => { const b = $(o.gridBtn); if (b) b.click(); else ED.setGrid(); } });
    function wireOn() { const b = $((o.wireBtns || [])[0]); return b && b.classList.contains('on'); }
    for (const [name, fn] of MENUS) {
      const b = document.createElement('button');
      b.className = 'mi'; b.textContent = name;
      b.onpointerdown = e => { e.stopPropagation(); if (openM && openM.name === name) closeMenus(); else showMenu(b, name, fn()); };
      b.onpointerenter = () => { if (openM && openM.name !== name) showMenu(b, name, fn()); };
      menuBar.appendChild(b);
    }
    function closeMenus() { if (openM) { openM.el.remove(); openM.btn.classList.remove('on'); openM = null; } }
    function buildList(items) {
      const box = document.createElement('div');
      box.className = 'ctxm dd';
      for (const it of items) {
        const d = document.createElement('div');
        if (!it) { d.className = 'sep'; box.appendChild(d); continue; }
        const sub = it[3];
        d.className = 'it' + (it[2] || (sub && sub.length) ? '' : ' off') + (sub ? ' sub' : '');
        d.innerHTML = '<span>' + esc(it[0]) + '</span><kbd>' + esc(it[1] || (sub ? '▸' : '')) + '</kbd>';
        if (it[2]) d.onclick = () => { closeMenus(); it[2](); };
        else if (!sub) d.title = 'Not available in EELAB';
        if (sub && sub.length) {
          const sb = buildList(sub); sb.classList.add('subm');
          d.appendChild(sb);
        }
        box.appendChild(d);
      }
      return box;
    }
    function showMenu(btn, name, items) {
      closeMenus();
      const box = buildList(items), r = btn.getBoundingClientRect();
      box.style.position = 'fixed'; box.style.left = r.left + 'px'; box.style.top = r.bottom + 'px';
      box.addEventListener('pointerdown', e => e.stopPropagation());
      document.body.appendChild(box);
      btn.classList.add('on');
      openM = { name, el: box, btn };
    }
    document.addEventListener('pointerdown', closeMenus);
    addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenus(); closePick(); } }, true);
    addEventListener('blur', closeMenus);

    let pick = null;
    function closePick() { if (pick) { pick.remove(); pick = null; } }
    function openPick() {
      if (running) { o.toast('Stop the simulation (■) to place parts.'); return; }
      closePick(); closeMenus();
      pick = document.createElement('div');
      pick.className = 'pickbg';
      const cats = LIB.categories || [];
      pick.innerHTML = '<div class="pick" role="dialog" aria-label="Pick Devices"><div class="pdlg-t"><span>Pick Devices</span><button data-a="x" title="Close">✕</button></div>' +
        '<div class="pick-b"><div class="pick-l"><label>Keywords:</label><input data-a="q" type="search" placeholder="e.g. 7seg, lcd, direnç">' +
        '<label class="cb"><input type="checkbox" data-a="whole"> Match whole words?</label><label class="cb"><input type="checkbox" data-a="models"> Show only parts with models?</label>' +
        '<label>Category:</label><div class="pick-cat" data-a="cat"><div data-c="" class="s">(All Categories)</div>' + cats.map(c => '<div data-c="' + esc(c.name) + '">' + esc(c.name) + '</div>').join('') + '</div>' +
        '<label>Sub-category:</label><div class="pick-cat sm"><div class="s">(All Sub-categories)</div></div>' +
        '<label>Manufacturer:</label><div class="pick-cat sm"><div class="s">(All Manufacturers)</div></div></div>' +
        '<div class="pick-m"><label data-a="n">Results:</label><div class="pick-res"><table><thead><tr><th>Device</th><th>Library</th><th>Description</th></tr></thead><tbody data-a="res"></tbody></table></div></div>' +
        '<div class="pick-r"><label data-a="pvn">Preview:</label><div class="pick-pv" data-a="pv"></div><div class="pick-model" data-a="model"></div></div></div>' +
        '<div class="pdlg-f"><button data-a="ok" class="def">OK</button> <button data-a="cancel">Cancel</button></div></div>';
      document.body.appendChild(pick);
      const q = s => pick.querySelector('[data-a=' + s + ']');
      let cat = '', sel = null, list = [];
      const all = LIB.order.slice();
      function run() {
        const raw = q('q').value.trim(), whole = q('whole').checked, models = q('models').checked;
        const words = raw.toLocaleLowerCase('tr').split(/\s+/).filter(Boolean);
        const catTr = {};
        for (const c of cats) for (const t of c.types) catTr[t] = (c.name || '') + ' ' + (c.tr || '');
        list = all.filter(t => {
          const ty = LIB.types[t];
          if (cat && ty.cat !== cat) return false;
          if (models && !hasModel(t)) return false;
          if (!words.length) return true;
          const h = (t + ' ' + (ty.label || '') + ' ' + (ty.kw || '') + ' ' + (ty.kwEn || '') + ' ' + (ty.desc || '') + ' ' + catTr[t]).toLocaleLowerCase('tr');
          return words.every(w => whole ? h.split(/[\s,()\/-]+/).indexOf(w) >= 0 || h.split(/[\s,()\/]+/).indexOf(w) >= 0 : h.indexOf(w) >= 0 || h.toLowerCase().indexOf(w.toLowerCase()) >= 0);
        });
        q('n').textContent = 'Results (' + list.length + '):';
        q('res').innerHTML = list.map(t => '<tr data-t="' + esc(t) + '"' + (t === sel ? ' class="s"' : '') + '><td>' + esc(t) + '</td><td>' + esc(LIB.types[t].lib || 'EELAB') + '</td><td>' + esc(LIB.types[t].desc || '') + '</td></tr>').join('');
        if (list.indexOf(sel) < 0) choose(list[0] || null);
      }
      function choose(t) {
        sel = t;
        for (const tr of q('res').querySelectorAll('tr')) tr.classList.toggle('s', tr.dataset.t === t);
        const pv = q('pv');
        if (!t) { pv.innerHTML = ''; q('model').textContent = ''; return; }
        const ty = LIB.types[t], part = { id: (ty.prefix || 'U') + '?', type: t, x: 0, y: 0, rot: 0, value: ty.defaultValue || '' };
        try { pv.innerHTML = o.toSVG({ parts: [part], wires: [] }).replace(/^<\?xml[^>]*>\s*/, ''); } catch (e) { pv.textContent = t; }
        q('model').textContent = !hasModel(t) ? 'No Simulator Model' : ty.mode === 'instrument' ? 'Virtual Instrument [EELAB]' : t === 'PIC16F628A' ? 'EELAB Model [PIC16]' : 'EELAB Digital Model [' + (ty.lib || 'EELAB') + ']';
        const tr = q('res').querySelector('tr.s'); if (tr && tr.scrollIntoView) tr.scrollIntoView({ block: 'nearest' });
      }
      function ok() { if (!sel) return; const t = sel; closePick(); ED.setTool('place', t); active = LIB.types[t].mode || 'component'; hl(); }
      q('q').oninput = run; q('whole').onchange = run; q('models').onchange = run;
      q('cat').onclick = e => { const d = e.target.closest('[data-c]'); if (!d) return; cat = d.dataset.c; for (const x of q('cat').children) x.classList.toggle('s', x === d); run(); };
      q('res').onclick = e => { const tr = e.target.closest('tr'); if (tr) choose(tr.dataset.t); };
      q('res').ondblclick = e => { const tr = e.target.closest('tr'); if (tr) { choose(tr.dataset.t); ok(); } };
      q('ok').onclick = ok; q('cancel').onclick = closePick; q('x').onclick = closePick;
      pick.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); ok(); }
        else if (e.key === 'Escape') closePick();
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const i = list.indexOf(sel) + (e.key === 'ArrowDown' ? 1 : -1); if (list[i]) choose(list[i]); }
      });
      pick.addEventListener('pointerdown', e => { if (e.target === pick) closePick(); });
      run();
      q('q').focus();
    }

    function onSelect(n) { const r = $(o.rotBox); if (r) r.classList.toggle('tag', n > 0); }
    function setRun(v) { running = !!v; modes.classList.toggle('off', running); if (running) closePick(); }
    hl();
    return { onTool, onView, onSelect, openPick, setRun, escSelect, closeMenus };
  }

  const ISIS = { create, icon, icons: T, menuDefs, MENU_LABELS, STEP_OUT_KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = ISIS;
  if (root) root.ISIS = ISIS;
})(typeof window !== 'undefined' ? window : null);
