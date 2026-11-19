(function (root) {
  'use strict';
  const h2 = v => v.toString(16).toUpperCase().padStart(2, '0');
  const h3 = v => v.toString(16).toUpperCase().padStart(3, '0');
  const b8 = v => v.toString(2).padStart(8, '0');
  const GPR = [[0x20, 0x80], [0xA0, 0xF0], [0x120, 0x150]];
  const FMTS = ['dec', 'sdec', 'hex', 'bin', 'chr', 'float'];

  function parseNum(s) {
    s = String(s).trim();
    let m;
    if ((m = /^-?(\d+)$/.exec(s))) return parseInt(s, 10);
    if ((m = /^(?:0x|\$)([0-9a-f]+)$/i.exec(s)) || (m = /^([0-9a-f]+)h$/i.exec(s))) return parseInt(m[1], 16);
    if ((m = /^(?:0b|%)([01]+)$/i.exec(s))) return parseInt(m[1], 2);
    if ((m = /^'(.)'$/.exec(s))) return m[1].charCodeAt(0);
    return NaN;
  }
  function f32(v) {
    const dv = new DataView(new ArrayBuffer(4));
    dv.setUint32(0, v >>> 0);
    return dv.getFloat32(0);
  }
  function f32bits(x) {
    const dv = new DataView(new ArrayBuffer(4));
    dv.setFloat32(0, x);
    return dv.getUint32(0);
  }
  function fmtVal(v, fmt, size) {
    const bits = size * 8;
    v = size === 4 ? v >>> 0 : v & (size === 2 ? 0xFFFF : 0xFF);
    if (fmt === 'float' && size === 4) { const x = f32(v); return isFinite(x) ? String(+x.toPrecision(7)) : String(x); }
    if (fmt === 'hex') return '0x' + v.toString(16).toUpperCase().padStart(size * 2, '0');
    if (fmt === 'bin') return v.toString(2).padStart(bits, '0').replace(/(\d{4})(?=\d)/g, '$1 ');
    if (fmt === 'chr') return size === 1 && v >= 32 && v < 127 ? "'" + String.fromCharCode(v) + "'" : '·';
    if (fmt === 'sdec') return String(size === 4 ? v | 0 : v & (1 << (bits - 1)) ? v - (1 << bits) : v);
    return String(v);
  }
  function parseVal(text, fmt) {
    text = String(text).trim();
    if (fmt === 'float') { const x = parseFloat(text.replace(',', '.')); return isNaN(x) ? NaN : f32bits(x); }
    if (fmt === 'bin' && /^[01 ]+$/.test(text)) return parseInt(text.replace(/ /g, ''), 2);
    if (fmt === 'hex' && /^[0-9a-f]+$/i.test(text)) return parseInt(text, 16);
    return parseNum(text);
  }

  const ROM_MAX = 2048, RAM_MAX = 224;
  const KIND_TR = { user: 'Kullanıcı', lib: 'Kütüphane', sys: 'Sistem', data: 'Veri' };
  const SL = { 'proj.resetVector': 'Reset vektörü (STARTUP)', 'proj.cInit': 'C başlangıç kodu (gsinit)', 'proj.sdccHelpers': 'SDCC işaretçi yardımcıları (.code)', 'proj.sysRuntime': 'SDCC çalışma zamanı', 'dbg.dataLabel': 'Sabit / ilk değer verisi', 'proj.noLocalLabels': '(ilk etiketten önce)' };
  const tx = (T, k) => (T ? T(k) : SL[k]);
  const kindName = (k, T) => (T ? T('proj.kind' + k[0].toUpperCase() + k.slice(1)) : KIND_TR[k] || k);
  function secLabel(c, T) {
    if (c.kind === 'user' || c.kind === 'lib') return c.name;
    if (c.sec === 'STARTUP') return tx(T, 'proj.resetVector');
    if (/gsinit/.test(c.sec)) return tx(T, 'proj.cInit');
    if (c.sec === '.code') return tx(T, 'proj.sdccHelpers');
    if (c.kind === 'sys') return c.name + ' (' + tx(T, 'proj.sysRuntime') + ')';
    return c.name;
  }
  function stats(d, prog, T) {
    if (!d) return null;
    let rom = d.rom || 0;
    if (!rom && prog) for (let a = 0; a < ROM_MAX; a++) if (prog[a] !== 0x3FFF) rom++;
    let rows = [];
    if (Array.isArray(d.code) && d.code.length) {
      const data = { name: tx(T, 'dbg.dataLabel'), kind: 'data', addr: null, words: 0, secs: [] };
      for (const c of d.code) {
        if (c.kind === 'data') { data.words += c.words; data.secs.push(c.sec || c.name); if (data.addr == null || c.addr < data.addr) data.addr = c.addr; continue; }
        rows.push({ name: secLabel(c, T), kind: c.kind, addr: c.addr, words: c.words, func: c.kind === 'user' || c.kind === 'lib' ? c.name : null });
      }
      if (data.words) rows.push(data);
    } else {
      const pts = [];
      const seen = new Set();
      for (const s of d.symbols || []) if ((s.kind === 'func' || s.kind === 'label') && s.addr < ROM_MAX && !seen.has(s.addr)) { seen.add(s.addr); pts.push(s); }
      pts.sort((a, b) => a.addr - b.addr);
      const cnt = (a, b) => { if (!prog) return b - a; let n = 0; for (let i = a; i < b; i++) if (prog[i] !== 0x3FFF) n++; return n; };
      if (pts.length && pts[0].addr > 0) { const w = cnt(0, pts[0].addr); if (w) rows.push({ name: tx(T, 'proj.noLocalLabels'), kind: 'sys', addr: 0, words: w, func: null }); }
      pts.forEach((s, i) => {
        const end = i + 1 < pts.length ? pts[i + 1].addr : ROM_MAX;
        const w = prog ? cnt(s.addr, end) : (i + 1 < pts.length ? end - s.addr : 0);
        if (w) rows.push({ name: s.name, kind: s.kind === 'func' && s.lib ? 'lib' : 'user', addr: s.addr, words: w, func: s.name });
      });
    }
    rows.sort((a, b) => b.words - a.words || (a.addr || 0) - (b.addr || 0));
    const byKind = { user: 0, lib: 0, sys: 0, data: 0 };
    for (const r of rows) byKind[r.kind] = (byKind[r.kind] || 0) + r.words;
    const vars = (d.symbols || []).filter(s => s.kind === 'var').map(s => ({ name: s.name, addr: s.addr, size: s.size || 1, scope: s.scope || '' })).sort((a, b) => b.size - a.size || a.addr - b.addr);
    return { rom, romMax: ROM_MAX, ram: d.ram || 0, ramMax: RAM_MAX, rows, byKind, vars, config: d.config == null ? null : d.config, lang: d.lang || '' };
  }

  function create(o) {
    const mount = o.mount, core = o.core, PIC = o.PIC || root.PIC, IDE = root.IDE;
    const T = (k, a) => (o.t ? o.t(k, a) : IDE && IDE.ui ? IDE.ui.t(k, a) : k);
    const el = (t, cls, txt, p) => { const e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; if (p) p.appendChild(e); return e; };
    const getDebug = () => (o.getDebug && o.getDebug()) || null;
    const canWrite = () => !o.canWrite || o.canWrite();
    const toast = m => { if (o.toast) o.toast(m); };
    let visible = true, cur = 'regs';
    let snapPrev = null, snapLast = null;
    let watches = [];
    let swZero = 0, stops = [], clockOv = 0, selW = -1;
    let disTop = null, follow = true, showLst = false;

    const root_ = el('div', 'dbg', null, mount);
    const PANE_IDS = ['regs', 'ram', 'watch', 'stack', 'dis', 'stats'];
    const PANE_KEYS = { regs: 'tab.registers', ram: 'tab.ram', watch: 'tab.watch', stack: 'tab.stack', dis: 'tab.disasm', stats: 'tab.stats' };
    const sw = el('div', 'dbg-sw', null, root_);
    const panes = {};
    for (const id of PANE_IDS) { panes[id] = el('div', 'dbg-pane', null, root_); panes[id].dataset.p = id; }
    const swv = {};

    function snap() {
      const s = new Uint8Array(512);
      for (let a = 0; a < 512; a++) s[a] = core.mem.valid(a) ? core.mem.read(a) : 0;
      return { m: s, w: core.P.w, ee: core.ee.slice() };
    }

    function editCell(td, cur0, commit) {
      if (!canWrite()) { toast(T('dbg.writeNeedsPause')); return; }
      if (td.querySelector('input')) return;
      const inp = document.createElement('input');
      inp.className = 'dbg-in';
      inp.value = cur0;
      td.textContent = '';
      td.appendChild(inp);
      inp.focus(); inp.select();
      let done = false;
      const fin = ok => {
        if (done) return; done = true;
        if (ok) {
          const v = parseNum(inp.value);
          if (isNaN(v)) toast(T('dbg.invalidNumber', [inp.value]));
          else { commit(v); if (o.onChange) o.onChange('mem'); }
        }
        refresh(true);
      };
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); });
      inp.addEventListener('blur', () => fin(true));
    }

    const swHz = () => (clockOv ? clockOv * 1e6 : 0) || (o.getFosc && o.getFosc()) || core.P.fosc || 4e6;
    function buildSw() {
      sw.textContent = '';
      for (const [k, key] of [['cyc', 'sw.cycles'], ['time', 'sw.time'], ['delta', 'sw.delta']]) {
        const c = el('span', 'kv', null, sw);
        el('b', '', T(key) + ':', c);
        swv[k] = el('span', 'v', '', c);
      }
      const lab = el('label', 'kv', null, sw);
      el('b', '', T('sw.clock') + ':', lab);
      const inp = el('input', 'dbg-in', null, lab);
      inp.size = 7; inp.title = T('sw.clockTitle');
      inp.value = (swHz() / 1e6).toFixed(6);
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); });
      inp.addEventListener('change', () => {
        const x = parseFloat(String(inp.value).replace(',', '.'));
        clockOv = x >= 0.032 && x <= 20 ? x : 0;
        if (!clockOv) inp.value = ((o.getFosc && o.getFosc() || 4e6) / 1e6).toFixed(6);
        refresh(true);
      });
      swv.clk = inp;
      const rb = el('button', '', T('btn.reset'), sw);
      rb.title = T('sw.resetTitle');
      rb.onclick = () => { swZero = core.P.cyc; stops = []; refresh(true); };
    }

    const regs = {};
    function buildRegs() {
      const p = panes.regs;
      p.textContent = '';
      const top = el('div', 'dbg-core', null, p);
      for (const [k, label] of [['W', 'W'], ['PC', 'PC'], ['STATUS', 'STATUS'], ['bank', T('d.bank')], ['depth', T('d.depth')], ['cyc', T('sw.cycles')]]) {
        const c = el('span', 'kv', null, top);
        el('b', '', label, c);
        regs[k] = el('span', 'v', '', c);
      }
      regs.W.classList.add('dbg-e'); regs.PC.classList.add('dbg-e');
      regs.W.title = T('dbg.clickToEdit'); regs.PC.title = T('dbg.clickToEdit');
      regs.W.onclick = () => editCell(regs.W, '0x' + h2(core.P.w), v => { core.P.w = v & 255; });
      regs.PC.onclick = () => editCell(regs.PC, '0x' + h3(core.P.pc), v => { core.P.pc = v & 0x1FFF; });
      regs.flags = el('div', 'dbg-flags', null, p);
      const t = el('table', 'dbg-t', null, p);
      const hr = el('tr', '', null, el('thead', '', null, t));
      for (const k of [T('col.name'), T('col.address'), T('col.hex'), T('col.binary'), T('col.decimal')]) el('th', '', k, hr);
      const tb = el('tbody', '', null, t);
      regs.rows = [];
      for (const [name, addr] of PIC.SFR) {
        const tr = el('tr', '', null, tb);
        el('td', 'n', name, tr);
        el('td', 'a', h3(addr), tr);
        const hx = el('td', 'dbg-e', '', tr), bi = el('td', 'bits', '', tr), de = el('td', '', '', tr);
        const bn = PIC.BITNAMES[addr];
        if (bn) tr.title = bn.slice().reverse().map(x => x || '-').join(' ');
        hx.onclick = () => editCell(hx, '0x' + h2(core.mem.read(addr)), v => core.mem.write(addr, v));
        bi.onclick = e => {
          const r = bi.getBoundingClientRect(), k = Math.floor((e.clientX - r.left) / (r.width / 8));
          if (k < 0 || k > 7) return;
          if (!canWrite()) { toast(T('dbg.writeNeedsPause')); return; }
          core.mem.write(addr, core.mem.read(addr) ^ (0x80 >> k));
          if (o.onChange) o.onChange('mem');
          refresh(true);
        };
        bi.title = T('dbg.clickToFlip');
        regs.rows.push({ addr, hx, bi, de, tr });
      }
    }

    const ram = { cells: [] };
    function buildRam() {
      const p = panes.ram;
      p.textContent = '';
      ram.cells = [];
      const t = el('table', 'dbg-g', null, p);
      const hr = el('tr', '', null, t);
      el('th', '', '', hr);
      for (let i = 0; i < 16; i++) el('th', '', i.toString(16).toUpperCase(), hr);
      for (const [a0, a1] of GPR) {
        for (let r = a0; r < a1; r += 16) {
          const tr = el('tr', '', null, t);
          el('th', '', h3(r), tr);
          for (let i = 0; i < 16; i++) {
            const a = r + i, td = el('td', 'dbg-e', '', tr);
            td.onclick = () => editCell(td, '0x' + h2(core.mem.read(a)), v => core.mem.write(a, v));
            ram.cells.push({ a, td });
          }
        }
      }
      el('div', 'dbg-note', T('dbg.sharedNote'), p);
    }

    const wt = {};
    function buildWatch() {
      const p = panes.watch;
      p.textContent = '';
      const bar = el('div', 'dbg-wbar', null, p);
      el('span', 'dbg-lbl', T('watch.selectVar') + ':', bar);
      wt.sel = el('select', 'dbg-wsel', null, bar);
      const add1 = el('button', '', T('btn.add'), bar);
      add1.onclick = () => { if (wt.sel.value) addWatch(wt.sel.value); };
      const bar2 = el('div', 'dbg-wbar', null, p);
      el('span', 'dbg-lbl', T('watch.searchAsm') + ':', bar2);
      const inp = el('input', '', null, bar2);
      inp.placeholder = T('watch.placeholder');
      inp.setAttribute('list', 'dbg-syms');
      wt.dl = el('datalist', '', null, bar2);
      wt.dl.id = 'dbg-syms';
      const add2 = el('button', '', T('btn.add'), bar2);
      const go = () => { const n = inp.value.trim(); if (n) { addWatch(n); inp.value = ''; } };
      add2.onclick = go;
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(); });
      const bar3 = el('div', 'dbg-wbar', null, p);
      const rm = el('button', '', T('btn.remove'), bar3), aa = el('button', '', T('btn.addAll'), bar3), ra = el('button', '', T('btn.removeAll'), bar3);
      rm.onclick = () => { if (selW >= 0 && selW < watches.length) { watches.splice(selW, 1); selW = Math.min(selW, watches.length - 1); buildWatchRows(); saveWatches(); refresh(true); } };
      aa.onclick = () => { const d = getDebug(); let n = 0; for (const s of (d && d.symbols) || []) if (s.kind === 'var' && s.addr < 512 && !watches.some(w => w.name === s.name)) { watches.push({ name: s.name, fmt: 'dec', size: s.size || 1 }); n++; } if (n) { buildWatchRows(); saveWatches(); refresh(true); } };
      ra.onclick = () => { watches = []; selW = -1; buildWatchRows(); saveWatches(); refresh(true); };
      const t = el('table', 'dbg-t', null, p);
      const hr = el('tr', '', null, el('thead', '', null, t));
      for (const k of [T('col.name'), T('col.value'), T('col.address')]) el('th', '', k, hr);
      wt.body = el('tbody', '', null, t);
      wt.note = el('div', 'dbg-note', '', p);
      buildWatchRows();
    }
    function resolve(w) {
      const d = getDebug();
      const s = IDE && d ? IDE.map.symbol(d, w.name) : null;
      if (s && s.kind === 'var' && s.addr < 512) return { addr: s.addr, size: w.size || s.size || 1 };
      if (s && (s.kind === 'label' || s.kind === 'func')) return { addr: s.addr, label: true };
      const sf = PIC.SFR.find(x => x[0] === String(w.name).toUpperCase());
      if (sf) return { addr: sf[1], size: w.size || 1 };
      if (/^w$/i.test(w.name)) return { w: true, size: 1 };
      const n = parseNum(w.name);
      if (!isNaN(n) && n >= 0 && n < 512) return { addr: n, size: w.size || 1 };
      if (s && s.addr < 512) return { addr: s.addr, size: w.size || s.size || 1 };
      return null;
    }
    function addWatch(name, fmt, size) {
      if (watches.some(w => w.name === name)) return;
      const w = { name, fmt: fmt || 'dec', size: size || 0 };
      const r = resolve(w);
      if (!r && getDebug()) toast(T('dbg.notFound', [name]));
      if (r && !w.size) w.size = r.size || 1;
      watches.push(w);
      buildWatchRows();
      saveWatches();
      refresh(true);
    }
    const saveWatches = () => { if (o.onWatches) o.onWatches(watches.map(w => ({ name: w.name, fmt: w.fmt, size: w.size }))); };
    function readW(r, w) {
      if (r.w) return core.P.w;
      const sz = w.size || r.size || 1;
      let v = 0;
      for (let i = sz - 1; i >= 0; i--) v = v * 256 + core.mem.read(r.addr + i);
      return v;
    }
    function writeW(r, w, v) {
      if (r.w) { core.P.w = v & 255; return; }
      const sz = w.size || r.size || 1;
      for (let i = 0; i < sz; i++) core.mem.write(r.addr + i, (v >>> (8 * i)) & 255);
    }
    let dlg = null;
    function editValue(w) {
      const r = resolve(w);
      if (!r || r.label) return;
      if (!dlg) {
        dlg = el('div', 'pickbg', null, document.body); dlg.hidden = true;
        dlg.addEventListener('mousedown', e => { if (e.target === dlg) dlg.hidden = true; });
      }
      dlg.textContent = ''; dlg.hidden = false;
      const box = el('div', 'pdlg', null, dlg), tt = el('div', 'pdlg-t', null, box);
      el('span', '', T('watch.editValue') + ' — ' + w.name, tt);
      const x = el('button', '', '✕', tt); x.onclick = () => { dlg.hidden = true; };
      const b = el('div', 'pdlg-b', null, box);
      const row = (label, ctl) => { const l = el('label', '', null, b); el('span', '', label, l); l.appendChild(ctl); return ctl; };
      const sz0 = w.size || r.size || 1;
      const vi = row(T('col.value'), el('input')), fs = row(T('col.format'), el('select')), ss = row(T('col.bytes'), el('select'));
      for (const f of ['dec', 'hex', 'bin', 'chr', 'float']) el('option', '', T('fmt.' + f), fs).value = f;
      for (const s of [1, 2, 4]) el('option', '', String(s), ss).value = String(s);
      const sg = el('input'); sg.type = 'checkbox';
      const sl = el('label', 'cb', null, b); sl.appendChild(sg); el('span', '', T('watch.signed'), sl);
      fs.value = w.fmt === 'sdec' ? 'dec' : w.fmt; sg.checked = w.fmt === 'sdec'; ss.value = String(sz0);
      const cur0 = () => readW(r, { size: +ss.value });
      const show = () => { const f = fs.value === 'dec' && sg.checked ? 'sdec' : fs.value; vi.value = fmtVal(cur0(), f, +ss.value); sg.disabled = fs.value !== 'dec'; };
      let shown = '';
      const upd = () => { show(); shown = vi.value; };
      fs.onchange = ss.onchange = sg.onchange = upd; upd();
      const ft = el('div', 'pdlg-f', null, box);
      const ok = el('button', 'def', T('btn.ok'), ft), cn = el('button', '', T('btn.cancel'), ft);
      const apply = () => {
        const fmt = fs.value === 'dec' && sg.checked ? 'sdec' : fs.value, size = +ss.value;
        w.fmt = fmt; w.size = size;
        if (vi.value !== shown) {
          if (!canWrite()) toast(T('dbg.writeNeedsPause'));
          else {
            const v = parseVal(vi.value, fmt);
            if (isNaN(v)) toast(T('dbg.invalidNumber', [vi.value]));
            else { writeW(r, w, v); if (o.onChange) o.onChange('mem'); }
          }
        }
        dlg.hidden = true; saveWatches(); buildWatchRows(); refresh(true);
      };
      ok.onclick = apply; cn.onclick = () => { dlg.hidden = true; };
      vi.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') apply(); if (e.key === 'Escape') dlg.hidden = true; });
      vi.focus(); vi.select();
    }
    function buildWatchRows() {
      if (!wt.body) return;
      wt.body.textContent = '';
      wt.rows = watches.map((w, i) => {
        const tr = el('tr', i === selW ? 'sel' : '', null, wt.body);
        const n = el('td', 'n', w.name, tr), val = el('td', 'dbg-e v', '', tr), ad = el('td', 'a', '', tr);
        tr.onclick = () => { selW = i; for (const r of wt.rows) r.tr.classList.toggle('sel', r.tr === tr); };
        tr.ondblclick = () => editValue(w);
        val.title = T('watch.dblTitle');
        return { tr, ad, val, n };
      });
    }
    function symList() {
      const d = getDebug();
      if (!wt.dl) return;
      wt.dl.textContent = '';
      wt.sel.textContent = '';
      const names = new Set();
      el('option', '', '—', wt.sel).value = '';
      if (d && d.symbols) for (const s of d.symbols) {
        if (s.kind === 'var') el('option', '', s.name, wt.sel).value = s.name;
        if (s.kind !== 'func') names.add(s.name);
      }
      for (const [n] of PIC.SFR) names.add(n);
      for (const n of names) el('option', '', null, wt.dl).value = n;
      wt.note.textContent = d ? (d.symbols && d.symbols.length ? T('d.symOk') : T('d.symNone')) : T('d.symBuild');
    }

    const st = {};
    function buildStack() {
      const p = panes.stack;
      p.textContent = '';
      el('div', 'dbg-h', T('d.hwStack'), p);
      st.list = el('ol', 'dbg-stack', null, p);
      el('div', 'dbg-h', T('d.eeprom'), p);
      const t = el('table', 'dbg-g', null, p);
      const hr = el('tr', '', null, t);
      el('th', '', '', hr);
      for (let i = 0; i < 16; i++) el('th', '', i.toString(16).toUpperCase(), hr);
      st.ee = [];
      for (let r = 0; r < 128; r += 16) {
        const tr = el('tr', '', null, t);
        el('th', '', h2(r), tr);
        for (let i = 0; i < 16; i++) {
          const a = r + i, td = el('td', 'dbg-e', '', tr);
          td.onclick = () => editCell(td, '0x' + h2(core.ee[a]), v => { core.ee[a] = v & 255; });
          st.ee.push(td);
        }
      }
    }

    const ds = {};
    function buildDis() {
      const p = panes.dis;
      p.textContent = '';
      const bar = el('div', 'dbg-wbar', null, p);
      const up = el('button', '', '▲', bar), dn = el('button', '', '▼', bar), pcb = el('button', '', 'PC', bar);
      up.title = T('d.up'); dn.title = T('d.down'); pcb.title = T('d.gotoPc');
      const adr = el('input', '', null, bar);
      adr.placeholder = T('d.addrPh');
      adr.size = 14;
      const lst = el('button', '', 'Listing', bar);
      lst.title = T('d.lstTitle');
      el('span', 'dbg-note', T('d.dotNote'), bar);
      up.onclick = () => { follow = false; disTop = Math.max(0, (disTop || 0) - 16); refresh(true); };
      dn.onclick = () => { follow = false; disTop = Math.min(2048 - 32, (disTop || 0) + 16); refresh(true); };
      pcb.onclick = () => { follow = true; refresh(true); };
      adr.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key !== 'Enter') return;
        let a = parseNum(adr.value);
        if (isNaN(a)) { const d = getDebug(), s = IDE && d && IDE.map.symbol(d, adr.value.trim()); a = s && s.addr < 2048 ? s.addr : NaN; }
        if (isNaN(a)) { toast(T('d.addrNone')); return; }
        follow = false; disTop = Math.max(0, Math.min(2048 - 32, a - 4)); refresh(true);
      });
      lst.onclick = () => { showLst = !showLst; lst.classList.toggle('on', showLst); refresh(true); };
      ds.t = el('table', 'dbg-t dis', null, p);
      ds.body = el('tbody', '', null, ds.t);
      ds.rows = [];
      for (let i = 0; i < 32; i++) {
        const tr = el('tr', '', null, ds.body);
        const b = el('td', 'bpc', '', tr), a = el('td', 'a', '', tr), op = el('td', 'op', '', tr), m = el('td', 'm', '', tr), ln = el('td', 'ln', '', tr);
        const row = { tr, b, a, op, m, ln, addr: 0 };
        b.onclick = () => { if (o.onAddrBp) o.onAddrBp(row.addr); refresh(true); };
        ln.onclick = () => { if (row.line && o.onGotoLine) o.onGotoLine(row.line); };
        ds.rows.push(row);
      }
      ds.lst = el('pre', 'dbg-lst', '', p);
    }

    const stp = { key: null };
    function drawStats(force) {
      const d = getDebug(), p = panes.stats;
      if (!force && stp.key === d) return;
      stp.key = d;
      p.textContent = '';
      const stt = stats(d, core.P.loaded ? core.P.prog : null, T);
      if (!stt) { el('div', 'dbg-note', T('d.statsBuild'), p); return; }
      const bar = (label, used, max, unit) => {
        const r = el('div', 'st-row', null, p);
        el('b', '', label, r);
        const b = el('span', 'st-bar', null, r), f = el('i', '', null, b), pc = max ? used / max * 100 : 0;
        f.style.width = Math.min(100, pc) + '%';
        if (pc > 90) f.className = 'hi'; else if (pc > 70) f.className = 'mid';
        el('span', 'st-v', used + ' / ' + max + ' ' + unit + ' (%' + Math.round(pc) + ')', r);
      };
      bar('ROM', stt.rom, stt.romMax, T('d.word'));
      bar('RAM', stt.ram, stt.ramMax, T('d.byte'));
      const kinds = el('div', 'st-kinds', null, p);
      for (const k of ['user', 'lib', 'sys', 'data']) if (stt.byKind[k]) { const s = el('span', 'st-k k-' + k, null, kinds); el('i', '', null, s); s.appendChild(document.createTextNode(kindName(k, T) + ' ' + stt.byKind[k] + ' ' + T('d.word'))); }
      if (stt.config != null) el('span', 'st-cfg', 'Config word 0x' + stt.config.toString(16).toUpperCase().padStart(4, '0'), kinds);
      el('div', 'dbg-h', stt.lang === 'asm' ? T('d.perLabel') : T('d.perFunc'), p);
      const t = el('table', 'dbg-t st-t', null, p), hr = el('tr', '', null, el('thead', '', null, t));
      for (const h of [T('d.colName'), T('d.colKind'), T('col.address'), 'Word', '%', '']) el('th', '', h, hr);
      const tb = el('tbody', '', null, t), mx = stt.rows.length ? stt.rows[0].words : 1;
      for (const r of stt.rows) {
        const tr = el('tr', 'k-' + r.kind, null, tb);
        const n = el('td', 'n', r.name, tr);
        if (r.secs) n.title = r.secs.join(', ');
        const ln = r.func && IDE && d ? (IDE.map.addrLine(d, r.addr) || null) : null;
        if (ln && o.onGotoLine) { n.classList.add('dbg-e'); n.title = T('d.gotoLineTitle', [ln]); n.onclick = () => o.onGotoLine(ln); }
        el('td', 'a', kindName(r.kind, T), tr);
        el('td', 'a', r.addr == null ? '' : '0x' + h3(r.addr), tr);
        el('td', '', String(r.words), tr);
        el('td', 'a', stt.rom ? (r.words / stt.rom * 100).toFixed(1) : '', tr);
        const bt = el('td', 'st-w', null, tr), bi = el('i', '', null, bt);
        bi.style.width = Math.max(1, r.words / mx * 100) + '%';
      }
      if (stt.vars.length) {
        el('div', 'dbg-h', T('d.vars'), p);
        const vt = el('table', 'dbg-t st-t', null, p), vh = el('tr', '', null, el('thead', '', null, vt));
        for (const h of [T('d.colName'), T('col.address'), T('col.bytes'), T('d.scope')]) el('th', '', h, vh);
        const vb = el('tbody', '', null, vt);
        for (const v of stt.vars) { const tr = el('tr', '', null, vb); el('td', 'n', v.name, tr); el('td', 'a', '0x' + h3(v.addr), tr); el('td', '', String(v.size), tr); el('td', 'a', v.scope ? v.scope + '()' : 'global', tr); }
      }
      el('div', 'dbg-note', stt.lang === 'c' ? T('d.srcMap') : T('d.srcHex'), p);
    }

    function names() {
      const d = getDebug(), fileN = {}, lbl = {};
      if (d && d.symbols) for (const s of d.symbols) {
        if (s.kind === 'var' && s.addr < 512 && fileN[s.addr] == null) fileN[s.addr] = s.name;
        if ((s.kind === 'label' || s.kind === 'func') && s.addr < 2048 && lbl[s.addr] == null) lbl[s.addr] = s.name;
      }
      return { fileN, lbl };
    }

    function refresh(force) {
      if (!visible && !force) return;
      const P = core.P, fosc = swHz();
      const dc = P.cyc - swZero, last = stops.length ? stops[stops.length - 1] : null, prev = stops.length > 1 ? stops[stops.length - 2] : null;
      const us = c => (c * 4e6 / fosc);
      const ft = c => { const u = us(c); return u >= 1e6 ? (u / 1e6).toFixed(6) + ' s' : u >= 1000 ? (u / 1000).toFixed(3) + ' ms' : u.toFixed(0) + ' µs'; };
      if (swv.cyc) {
        swv.cyc.textContent = String(dc);
        swv.time.textContent = ft(dc);
        swv.delta.textContent = last != null && prev != null ? (last - prev) + ' = ' + ft(last - prev) : '—';
        swv.cyc.title = T('d.total', [P.cyc]);
        if (document.activeElement !== swv.clk) swv.clk.value = (fosc / 1e6).toFixed(6);
      }
      if (!visible) return;
      const cmp = snapLast;
      const mark = (e, a, v) => e.classList.toggle('chg', !!(cmp && cmp.m[a] !== v));
      if (cur === 'regs') {
        regs.W.textContent = '0x' + h2(P.w); regs.W.classList.toggle('chg', !!(cmp && cmp.w !== P.w));
        regs.PC.textContent = '0x' + h3(P.pc);
        const s = core.mem.read(3);
        regs.STATUS.textContent = '0x' + h2(s);
        regs.bank.textContent = String((s >> 5) & 3);
        regs.depth.textContent = String(core.depth());
        regs.cyc.textContent = String(P.cyc);
        regs.flags.textContent = '';
        const add = (n, on) => el('span', on ? 'f on' : 'f', n, regs.flags);
        add('Z', s & 4); add('DC', s & 2); add('C', s & 1);
        const ic = core.mem.read(0x0B);
        add('GIE', ic & 0x80); add('T0IF', ic & 4); add('INTF', ic & 2); add('RBIF', ic & 1);
        if (P.sleep) add('SLEEP', 1);
        for (const r of regs.rows) {
          const v = core.mem.read(r.addr);
          r.hx.textContent = h2(v); r.bi.textContent = b8(v); r.de.textContent = String(v);
          mark(r.tr, r.addr, v);
        }
      } else if (cur === 'ram') {
        for (const c of ram.cells) { const v = core.mem.read(c.a); c.td.textContent = h2(v); mark(c.td, c.a, v); }
      } else if (cur === 'watch') {
        if (!wt.rows || wt.rows.length !== watches.length) buildWatchRows();
        watches.forEach((w, i) => {
          const row = wt.rows[i], r = resolve(w);
          if (!r) { row.ad.textContent = '?'; row.val.textContent = T('d.notFoundShort'); row.tr.classList.remove('chg'); return; }
          if (r.label) { row.ad.textContent = '0x' + h3(r.addr); row.val.textContent = T('d.labelVal'); return; }
          row.ad.textContent = r.w ? 'W' : '0x' + h3(r.addr);
          const v = readW(r, w), sz = w.size || r.size || 1;
          row.val.textContent = fmtVal(v, w.fmt, sz);
          let ch = false;
          if (cmp) {
            if (r.w) ch = cmp.w !== P.w;
            else for (let k = 0; k < sz; k++) if (cmp.m[(r.addr + k) & 511] !== core.mem.read(r.addr + k)) ch = true;
          }
          row.tr.classList.toggle('chg', ch);
        });
      } else if (cur === 'stack') {
        const s = core.stack(), d = getDebug(), lb = names().lbl;
        st.list.textContent = '';
        if (!s.length) el('li', 'dbg-note', T('d.empty'), st.list);
        s.forEach(a => {
          const ln = IDE && d ? IDE.map.addrLine(d, a) : null;
          let fn = '';
          for (let k = a; k >= 0 && k > a - 2048; k--) if (lb[k] != null) { fn = lb[k]; break; }
          el('li', '', '0x' + h3(a) + (fn ? '  ' + fn : '') + (ln ? '  (' + T('col.line').toLowerCase() + ' ' + ln + ')' : ''), st.list);
        });
        for (let a = 0; a < 128; a++) { const v = core.ee[a]; st.ee[a].textContent = h2(v); st.ee[a].classList.toggle('chg', !!(cmp && cmp.ee[a] !== v)); }
      } else if (cur === 'stats') {
        drawStats(false);
      } else if (cur === 'dis') {
        const d = getDebug();
        ds.t.style.display = showLst ? 'none' : '';
        ds.lst.style.display = showLst ? '' : 'none';
        if (showLst) { const t = d && d.lst ? d.lst : T('d.noLst'); if (ds.lst.textContent !== t) ds.lst.textContent = t; return; }
        const pc = P.pc & 2047;
        if (follow || disTop == null) { if (disTop == null || pc < disTop + 3 || pc > disTop + 26) disTop = Math.max(0, Math.min(2048 - 32, pc - 6)); }
        const { fileN, lbl } = names();
        const bank = (core.mem.read(3) >> 5) & 3;
        ds.rows.forEach((r, i) => {
          const a = disTop + i, op = P.prog[a];
          r.addr = a;
          r.a.textContent = h3(a) + (lbl[a] != null ? ' ' + lbl[a] + ':' : '');
          r.op.textContent = op.toString(16).toUpperCase().padStart(4, '0');
          const blank = op === 0x3FFF;
          r.m.textContent = blank ? T('d.blank') : PIC.disasm(op, a, { bank, names: fileN, labels: lbl });
          r.line = IDE && d && !blank ? IDE.map.addrLine(d, a) : null;
          r.ln.textContent = r.line ? T('col.line').toLowerCase() + ' ' + r.line : '';
          r.b.textContent = core.bp.has(a) ? '●' : '';
          r.tr.classList.toggle('pc', a === pc);
        });
      }
    }

    function buildAll() {
      buildSw(); buildRegs(); buildRam(); buildWatch(); buildStack(); buildDis();
      stp.key = undefined;
      symList();
    }
    buildAll();

    const api = {
      panes: PANE_IDS.map(id => ({ id, get title() { return T(PANE_KEYS[id]); }, el: panes[id] })),
      show(id) {
        cur = id;
        for (const k in panes) panes[k].style.display = k === id ? '' : 'none';
        if (id === 'watch') symList();
        if (id === 'stats') drawStats(true);
        refresh(true);
      },
      current: () => cur,
      relabel() { const c = cur; buildAll(); api.show(c); },
      refresh,
      setVisible(b) { visible = !!b; root_.style.display = b ? '' : 'none'; if (b) refresh(true); },
      markStop() { snapPrev = snapLast; snapLast = snap(); stops.push(core.P.cyc); if (stops.length > 20) stops.shift(); refresh(true); },
      markRun() { if (!snapLast) snapLast = snap(); },
      reset() { snapPrev = snapLast = null; stops = []; swZero = 0; disTop = null; follow = true; refresh(true); },
      resetStopwatch() { swZero = core.P.cyc; stops = []; refresh(true); },
      stopwatch: () => ({ zero: swZero, stops: stops.slice(), cyc: core.P.cyc - swZero, clockMHz: swHz() / 1e6 }),
      setStopwatchClock(mhz) { clockOv = mhz >= 0.032 && mhz <= 20 ? +mhz : 0; refresh(true); },
      setWatches(list) { watches = (list || []).filter(w => w && w.name).map(w => ({ name: String(w.name), fmt: FMTS.includes(w.fmt) ? w.fmt : 'dec', size: w.size === 4 ? 4 : w.size === 2 ? 2 : w.size === 1 ? 1 : 0 })); selW = -1; buildWatchRows(); refresh(true); },
      getWatches: () => watches.map(w => ({ name: w.name, fmt: w.fmt, size: w.size })),
      watchRows: () => watches.map(w => { const r = resolve(w); return { name: w.name, addr: r && !r.w ? r.addr : null, value: r && !r.label ? fmtVal(readW(r, w), w.fmt, w.size || r.size || 1) : null }; }),
      addWatch,
      editValue(name) { const w = watches.find(x => x.name === name); if (w) editValue(w); },
      symbolsChanged() { symList(); disTop = null; stp.key = undefined; refresh(true); }
    };
    api.show('regs');
    return api;
  }

  /* Proteus panelindeki duraklatma pencereleri için saf veri üreticiler */
  const popup = {
    regs(core, PIC, info) {
      const P = core.P, pc = P.pc & 0x1FFF, op = P.prog[pc & 2047], bank = (core.mem.read(3) >> 5) & 3;
      const names = {}, lbl = {};
      if (info && info.symbols) for (const s of info.symbols) {
        if (s.kind === 'var' && s.addr < 512 && names[s.addr] == null) names[s.addr] = s.name;
        if ((s.kind === 'label' || s.kind === 'func') && s.addr < 2048 && lbl[s.addr] == null) lbl[s.addr] = s.name;
      }
      const top = op === 0x3FFF ? '(blank)' : PIC.disasm(op, pc, { bank, names, labels: lbl });
      const rd = a => core.mem.read(a);
      const rows = [['W', P.w], ['STATUS', rd(3)], ['PCL', rd(2)], ['PCLATH', rd(0x0A)], ['FSR', rd(4)], ['INTCON', rd(0x0B)], ['OPTION', rd(0x81)], ['TRISA', rd(0x85)], ['TRISB', rd(0x86)], ['PORTA', rd(5)], ['PORTB', rd(6)]];
      return { top, pc, rows: rows.map(([n, v]) => [n, v & 255]) };
    },
    data(core) {
      const rows = [];
      for (let r = 0; r < 512; r += 16) {
        const cells = [];
        for (let i = 0; i < 16; i++) cells.push(core.mem.valid(r + i) ? core.mem.read(r + i) : null);
        rows.push({ addr: r, cells });
      }
      return rows;
    },
    prog(core, PIC, info, from, count) {
      const P = core.P, out = [], pc = P.pc & 2047, n = count || 32;
      const lbl = {}, names = {};
      if (info && info.symbols) for (const s of info.symbols) {
        if (s.kind === 'var' && s.addr < 512 && names[s.addr] == null) names[s.addr] = s.name;
        if ((s.kind === 'label' || s.kind === 'func') && s.addr < 2048 && lbl[s.addr] == null) lbl[s.addr] = s.name;
      }
      const a0 = from == null ? Math.max(0, Math.min(2048 - n, pc - 6)) : from;
      for (let a = a0; a < a0 + n && a < 2048; a++) {
        const op = P.prog[a];
        out.push({ addr: a, op, label: lbl[a] || '', text: op === 0x3FFF ? '' : PIC.disasm(op, a, { names, labels: lbl }), pc: a === pc });
      }
      return out;
    },
    eeprom(core) {
      const rows = [];
      for (let r = 0; r < 128; r += 16) rows.push({ addr: r, cells: Array.from(core.ee.slice(r, r + 16)) });
      return rows;
    }
  };

  const DEBUG = { create, fmtVal, parseNum, parseVal, stats, popup };
  root.DEBUG = DEBUG;
  if (typeof module !== 'undefined' && module.exports) module.exports = DEBUG;
})(typeof window !== 'undefined' ? window : globalThis);
