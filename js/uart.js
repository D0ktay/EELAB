(function (root) {
  'use strict';
  function cfg(o) {
    o = o || {};
    const c = { bitCyc: +o.bitCyc || 1, dataBits: o.dataBits == null ? 8 : +o.dataBits, parity: String(o.parity || 'NONE').toUpperCase(), stopBits: o.stopBits == null ? 1 : +o.stopBits,
      invert: !!o.invert, t0: +o.t0 || 0, gap: +o.gap || 0, until: o.until == null ? Infinity : +o.until, ninth: o.ninth ? 1 : 0 };
    if (c.parity !== 'EVEN' && c.parity !== 'ODD') c.parity = 'NONE';
    return c;
  }
  const ones = (v, n) => { let s = 0; for (let i = 0; i < n; i++) s += (v >> i) & 1; return s; };
  const parBit = (v, n, p) => (ones(v, n) & 1) ^ (p === 'ODD' ? 1 : 0);

  function encode(bytes, o) {
    const c = cfg(o), inv = c.invert ? 1 : 0, mask = (1 << c.dataBits) - 1, edges = [];
    let t = c.t0, lv = 1;
    const put = (at, v) => { if (v !== lv) { edges.push([at, v ^ inv]); lv = v; } };
    for (const raw of (typeof bytes === 'number' ? [bytes] : bytes)) {
      let v = Number(raw) & mask;
      if (c.dataBits === 9 && c.ninth && Number(raw) < 256) v |= 256;
      put(t, 0); t += c.bitCyc;
      for (let i = 0; i < c.dataBits; i++) { put(t, (v >> i) & 1); t += c.bitCyc; }
      if (c.parity !== 'NONE') { put(t, parBit(v, c.dataBits, c.parity)); t += c.bitCyc; }
      put(t, 1); t += c.bitCyc * c.stopBits + c.gap;
    }
    return { edges, end: t };
  }

  function decode(edges, o) {
    const c = cfg(o), inv = c.invert ? 1 : 0, out = [], n = edges.length;
    let i = 0, lv = 1;
    const level = t => { while (i < n && edges[i][0] <= t) { lv = edges[i][1] ^ inv; i++; } return lv; };
    const nextEdge = (t, want) => { level(t); if (lv === want) return t; for (let j = i; j < n; j++) if ((edges[j][1] ^ inv) === want) return edges[j][0]; return Infinity; };
    let t = -Infinity;
    for (;;) {
      const hi = nextEdge(t, 1);
      if (hi === Infinity) break;
      const s = nextEdge(hi, 0);
      if (s === Infinity || s >= c.until) break;
      const at = k => level(s + c.bitCyc * k + c.bitCyc / 2);
      if (at(0) !== 0) { t = s + c.bitCyc / 2; continue; }
      let v = 0, k = 1;
      for (let b = 0; b < c.dataBits; b++, k++) v |= at(k) << b;
      let perr = 0;
      if (c.parity !== 'NONE') { perr = at(k) !== parBit(v, c.dataBits, c.parity) ? 1 : 0; k++; }
      const ferr = at(k) ? 0 : 1;
      out.push({ byte: v, ferr, perr, t: s });
      t = s + c.bitCyc * k + c.bitCyc / 2;
    }
    return out;
  }

  function transfer(byte, tx, rx) {
    const e = encode([byte], Object.assign({}, tx, { t0: 0, gap: 0 }));
    return decode(e.edges, Object.assign({}, rx, { until: e.end })).map(r => ({ byte: r.byte, ferr: r.ferr, perr: r.perr }));
  }

  const UART = { encode, decode, transfer };
  root.UART = UART;
  if (typeof module !== 'undefined' && module.exports) module.exports = UART;
})(typeof window !== 'undefined' ? window : globalThis);
