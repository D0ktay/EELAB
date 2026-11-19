import io
import json
import os
import re
import struct
import zipfile
import xml.etree.ElementTree as ET

KNOWN_FILEVER = {'814'}
UNIT = 25400
GRID = 10

SEG = {s: s for s in 'ABCDEFG'}
SEG7_CC = dict(SEG, DP='DP', H='DP', **{'1': 'K', 'K': 'K', 'COM': 'K', 'CC': 'K'})
SEG7_CA = dict(SEG, DP='DP', H='DP', **{'1': 'COM', 'K': 'COM', 'COM': 'COM', 'CA': 'COM'})
SEG7_MPX4 = dict(SEG, DP='DP', H='DP', **{str(i): str(i) for i in range(1, 5)})
TWO = {'1': '1', '2': '2', 'A': '1', 'B': '2', '+': '1', '-': '2', 'P': '1', 'N': '2', 'COM': '1', 'NO': '2', 'NC': '2'}
LED = {'A': 'A', 'K': 'K', 'C': 'K', '1': 'A', '2': 'K', '+': 'A', '-': 'K'}
ONE = {'*': '1'}
BCD = {'1': '1', '2': '2', '4': '4', '8': '8', 'A': '1', 'B': '2', 'C': '4', 'D': '8'}
NPN = {'B': 'B', 'C': 'C', 'E': 'E', '1': 'C', '2': 'B', '3': 'E'}
KEYPAD = {k: k for k in 'ABCD1234'}
VT = {k: k for k in ('RXD', 'TXD', 'RTS', 'CTS')}
TRAFFIC = {'R': 'R', 'RED': 'R', 'A': 'A', 'AMBER': 'A', 'Y': 'A', 'YELLOW': 'A', 'G': 'G', 'GREEN': 'G'}
RELAY = {'1': '1', '2': '2', 'COM': 'COM', 'NC': 'NC', 'NO': 'NO', 'C': 'COM', '3': 'COM', '4': 'NC', '5': 'NO'}
BAR = dict({str(i): 'A%d' % i for i in range(1, 11)}, **{str(21 - i): 'K%d' % i for i in range(1, 11)})

DEVICE_MAP = {
    'PIC16F628A': ('PIC16F628A', 'num'),
    '7448': ('7448', 'num'), '74LS48': ('7448', 'num'), '74HC48': ('7448', 'num'), '74LS248': ('7448', 'num'),
    '7447': ('7447', 'num'), '74LS47': ('7447', 'num'), '74HC47': ('7447', 'num'), '74LS247': ('7447', 'num'),
    '7SEG-MPX1-CC': ('7SEG-MPX1-CC', SEG7_CC), '7SEG-COM-CATHODE': ('7SEG-MPX1-CC', SEG7_CC),
    '7SEG-COM-CAT-GRN': ('7SEG-MPX1-CC', SEG7_CC), '7SEG-COM-CAT-BLUE': ('7SEG-MPX1-CC', SEG7_CC),
    '7SEG-MPX1-CA': ('7SEG-MPX1-CA', SEG7_CA), '7SEG-COM-ANODE': ('7SEG-MPX1-CA', SEG7_CA),
    '7SEG-COM-AN-GRN': ('7SEG-MPX1-CA', SEG7_CA), '7SEG-COM-AN-BLUE': ('7SEG-MPX1-CA', SEG7_CA),
    '7SEG-MPX4-CC': ('7SEG-MPX4-CC', SEG7_MPX4), '7SEG-MPX4-CA': ('7SEG-MPX4-CA', SEG7_MPX4),
    '7SEG-BCD': ('7SEG-BCD', BCD), '7SEG-BCD-GRN': ('7SEG-BCD', BCD), '7SEG-BCD-BLUE': ('7SEG-BCD', BCD),
    'LED-RED': ('LED-RED', LED), 'LED-GREEN': ('LED-GREEN', LED), 'LED-YELLOW': ('LED-YELLOW', LED),
    'LED-BLUE': ('LED-BLUE', LED), 'LED-ORANGE': ('LED-YELLOW', LED), 'LED-WHITE': ('LED-BLUE', LED),
    'LED': ('LED-RED', LED), 'LED-BARGRAPH-RED': ('LED-BARGRAPH-RED', BAR), 'LED-BARGRAPH-GRN': ('LED-BARGRAPH-RED', BAR),
    'LM016L': ('LM016L', 'num'), 'LM044L': ('LM044L', 'num'),
    'BUTTON': ('BUTTON', TWO), 'SWITCH': ('SWITCH', TWO), 'SW-SPST': ('SWITCH', TWO), 'SW-SPST-MOM': ('BUTTON', TWO),
    'DIPSW_8': ('DIPSW_8', 'num'),
    'KEYPAD-PHONETYPE': ('KEYPAD-PHONETYPE', KEYPAD), 'KEYPAD-SMALLCALC': ('KEYPAD-SMALLCALC', KEYPAD),
    'LOGICSTATE': ('LOGICSTATE', ONE), 'LOGICTOGGLE': ('LOGICSTATE', ONE),
    'LOGICPROBE': ('LOGICPROBE', ONE), 'LOGICPROBE(BIG)': ('LOGICPROBE', ONE),
    'RES': ('RES', TWO), 'RESISTOR': ('RES', TWO), 'MINRES': ('RES', TWO),
    'CAP': ('CAP', TWO), 'CAPACITOR': ('CAP', TWO), 'CERAMIC': ('CAP', TWO),
    'CAP-ELEC': ('CAP-ELEC', TWO), 'ELECTROLYTIC': ('CAP-ELEC', TWO),
    'CRYSTAL': ('CRYSTAL', TWO),
    'BUZZER': ('BUZZER', TWO), 'SOUNDER': ('BUZZER', TWO), 'SPEAKER': ('BUZZER', TWO),
    'MOTOR': ('MOTOR', TWO), 'MOTOR-DC': ('MOTOR', TWO),
    'NPN': ('NPN', NPN), 'BC547': ('NPN', NPN), 'BC548': ('NPN', NPN), 'BC337': ('NPN', NPN),
    '2N2222': ('NPN', NPN), '2N3904': ('NPN', NPN),
    'VIRTUAL TERMINAL': ('VIRTUAL-TERMINAL', VT), 'VIRTUAL-TERMINAL': ('VIRTUAL-TERMINAL', VT),
    '74HC595': ('74HC595', 'num'), '74LS595': ('74HC595', 'num'), 'L293D': ('L293D', 'num'),
    '7SEG-MPX2-CC': ('7SEG-MPX2-CC', SEG7_MPX4), '7SEG-MPX2-CA': ('7SEG-MPX2-CA', SEG7_MPX4),
    'TRAFFIC LIGHTS': ('TRAFFIC-LIGHTS', TRAFFIC), 'TRAFFIC-LIGHTS': ('TRAFFIC-LIGHTS', TRAFFIC),
    'RELAY': ('RELAY', RELAY), 'G2R-14-DC5': ('RELAY', RELAY),
}
PREFIX_MAP = [('MINRES', 'RES'), ('RES', 'RES'), ('CAP-ELEC', 'CAP-ELEC'), ('CAP', 'CAP'), ('LED-BAR', 'LED-BARGRAPH-RED')]
BICOLOR = {'LED-BIRG': ('LED-RED', 'LED-GREEN'), 'LED-BIBY': ('LED-BLUE', 'LED-YELLOW'), 'LED-BIGY': ('LED-GREEN', 'LED-YELLOW')}
PREFIX = {'PIC16F628A': 'U', '7448': 'U', '7447': 'U', '74HC595': 'U', 'RES': 'R', 'CAP': 'C', 'CAP-ELEC': 'C',
          'CRYSTAL': 'X', 'BUTTON': 'SW', 'SWITCH': 'SW', 'DIPSW_8': 'DSW', 'LOGICSTATE': 'L', 'LOGICPROBE': 'LP',
          'LM016L': 'LCD', 'LM044L': 'LCD', 'BUZZER': 'BZ', 'MOTOR': 'M', 'NPN': 'Q', 'VIRTUAL-TERMINAL': 'VT',
          'POWER': 'PWR', 'GROUND': 'GND', 'KEYPAD-PHONETYPE': 'KP', 'KEYPAD-SMALLCALC': 'KP',
          'LED-BARGRAPH-RED': 'BAR'}
OUTLINE = {
    'PIC16F628A': (160, 200, -10, 0, 170, 200), '7448': (80, 120, -10, 0, 90, 120), '7447': (80, 120, -10, 0, 90, 120),
    '7SEG-MPX1-CC': (100, 120, 0, 0, 100, 130), '7SEG-MPX1-CA': (100, 120, 0, 0, 100, 130),
    '7SEG-MPX2-CC': (120, 100, 0, 0, 120, 110), '7SEG-MPX2-CA': (120, 100, 0, 0, 120, 110),
    '7SEG-MPX4-CC': (200, 100, 0, 0, 200, 110), '7SEG-MPX4-CA': (200, 100, 0, 0, 200, 110), '7SEG-BCD': (50, 70, 0, 0, 50, 80),
    'LED-BARGRAPH-RED': (50, 110, -10, 0, 60, 110), 'LM016L': (240, 120, 0, 0, 240, 130), 'LM044L': (300, 140, 0, 0, 300, 150),
    'DIPSW_8': (50, 90, -10, 0, 60, 90), 'KEYPAD-PHONETYPE': (100, 140, -10, 0, 100, 150),
    'KEYPAD-SMALLCALC': (130, 130, -10, 0, 130, 140), 'LOGICSTATE': (20, 20, 0, 0, 30, 20), 'POWER': (20, 20, 0, 0, 20, 20),
    'GROUND': (20, 20, 0, 0, 20, 20), 'CAP': (20, 20, -10, 0, 30, 20), 'CAP-ELEC': (20, 20, -10, 0, 30, 20),
    'BUZZER': (40, 40, 0, 0, 40, 50), 'NPN': (40, 40, -10, -10, 40, 50), 'VIRTUAL-TERMINAL': (240, 160, -10, 0, 240, 160),
    'TRAFFIC-LIGHTS': (40, 100, -10, 0, 40, 100), '74HC595': (80, 120, -10, 0, 90, 120), 'L293D': (100, 140, -10, 0, 110, 140),
    'RELAY': (80, 60, -10, 0, 90, 60), 'LOGICPROBE': (20, 20, -10, 0, 20, 20),
}
DEFAULT_OUTLINE = (40, 20, -10, 0, 50, 20)
POWER_NAMES = {'', 'VCC', 'VDD', '+5V', '5V', '+5', 'V+', 'VCC/VDD'}
GROUND_NAMES = {'GND', 'VSS', '0', 'GROUND', 'V-'}
HIDDEN_POWER_PINS = {'PIC16F628A': {'5', '14'}, '7448': {'8', '16'}, '7447': {'8', '16'}}


def _u16(d, o):
    return struct.unpack_from('<H', d, o)[0]


def _u32(d, o):
    return struct.unpack_from('<I', d, o)[0]


def _i32(d, o):
    return struct.unpack_from('<i', d, o)[0]


def _text(b):
    return b.decode('latin1')


def _printable(b):
    return all(32 <= c < 127 for c in b)


def _props(s):
    return {m.group(1).upper(): m.group(2) for m in re.finditer(r'\{([^=}]+)=([^}]*)\}', s or '')}


def _read_project(names, archive):
    meta = {'release': None, 'filever': None}
    key = names.get('PROJECT.XML')
    if not key:
        return meta
    try:
        root = ET.fromstring(archive.read(key))
        ts = root.find('TIMESTAMP')
        if ts is not None:
            meta['release'] = ts.get('RELEASE')
            meta['filever'] = ts.get('FILEVER')
    except ET.ParseError:
        pass
    return meta


class Dsn:
    def __init__(self, data):
        if not data.startswith(b'ISIS SCHEMATIC FILE'):
            raise ValueError('ROOT.DSN bir Proteus ISIS şeması değil')
        self.d = data
        a = data.find(b'ISIS CIRCUIT FILE')
        s = data.find(b'OBJECT DATA\x00', a if a >= 0 else 0)
        if s < 0:
            raise ValueError('ROOT.DSN içinde nesne bölümü (OBJECT DATA) yok')
        self.start, self.end = s + 12, len(data)
        self.wires = {}
        self.components = []
        self.terminals = []
        self.junctions = []
        self.labels = []
        self.buses = 0

    def wire_at(self, p):
        if p in self.wires:
            return self.wires[p]
        d = self.d
        if not (self.start <= p < self.end - 0x22) or d[p + 0x18] != 0x7f:
            return None
        z = d.find(b'\x00', p + 0x18, p + 0x58)
        if z < 0:
            return None
        style = _text(d[p + 0x19:z])
        n = _u16(d, z + 3)
        q = z + 5
        if n < 1 or n > 4096 or q + 8 * n > self.end:
            return None
        pts = [(_i32(d, q + 8 * k), _i32(d, q + 8 * k + 4)) for k in range(n)]
        w = {'off': p, 'style': style, 'points': pts, 'end': q + 8 * n}
        self.wires[p] = w
        return w

    def parse(self):
        d, s, e = self.d, self.start, self.end
        for m in re.finditer(rb'\x7f[A-Z ]{3,16}\x00', d[s:e]):
            if b'WIRE' in m.group():
                w = self.wire_at(s + m.start() - 0x18)
                if w and 'BUS' in w['style']:
                    self.buses += 1
        for m in re.finditer(rb'COMPONENT ID\x00', d[s:e]):
            c = self._component(s + m.start())
            if c:
                self.components.append(c)
        for m in re.finditer(rb'TERMINAL LABEL\x00', d[s:e]):
            t = self._terminal(s + m.start())
            if t:
                self.terminals.append(t)
        for m in re.finditer(rb'WIRE LABEL\x00', d[s:e]):
            lb = self._wire_label(s + m.start())
            if lb:
                self.labels.append(lb)
        offs = set(self.wires)
        i = d.find(b'\x01', s, e)
        while 0 <= i < e - 25:
            self._junction(i, offs)
            i = d.find(b'\x01', i + 1, e)
        return self

    def _textobj(self, kind_at):
        d = self.d
        lo = max(self.start, kind_at - 4096)
        best = None
        for k in range(kind_at - 1, lo, -1):
            if d[k] == 0xff and k + 2 + d[k + 1] + 8 + 24 <= kind_at:
                n = d[k + 1]
                if k + 2 + n + 8 + 24 + 2 <= kind_at and d[k + 2 + n + 8 + 24] == 0xff:
                    font_end = d.find(b'\x00', k + 2 + n + 8 + 26, kind_at + 1)
                    if font_end == kind_at - 1:
                        best = k
                        break
        if best is None:
            return None
        n = d[best + 1]
        return {'at': best, 'text': _text(d[best + 2:best + 2 + n]),
                'x': _i32(d, best + 2 + n), 'y': _i32(d, best + 6 + n)}

    def _component(self, id_at):
        d = self.d
        t_id = self._textobj(id_at)
        if t_id is None:
            return None
        texts = {'ID': t_id}
        pos = id_at
        for kind in (b'COMPONENT VALUE\x00', b'SUBCKT NAME\x00', b'PROPERTIES\x00'):
            k = d.find(kind, pos, pos + 8192)
            if k < 0:
                return None
            if kind != b'PROPERTIES\x00':
                texts[_text(kind[:-1])] = self._textobj(k) or {'text': ''}
            pos = k
        q = pos + len(b'PROPERTIES\x00') + 4
        plen = _u32(d, q)
        q += 4
        props = None
        for skip in (plen, 0):
            r = q + skip
            if r + 3 > self.end:
                continue
            n, ln = _u16(d, r), d[r + 2]
            name = d[r + 3:r + 3 + ln]
            if 0 < n < 512 and ln and _printable(name) and r + 3 + ln + 25 + 4 * n <= self.end:
                props = _text(d[q:q + skip]) if skip else None
                break
        else:
            return None
        device = _text(name)
        r += 3 + ln
        x, y = _i32(d, r), _i32(d, r + 4)
        angle = struct.unpack_from('<h', d, r + 8)[0]
        flags = _u16(d, r + 10)
        oid = _u32(d, r + 12)
        tbl = r + 25
        pins = [_u32(d, tbl + 4 * k) for k in range(n)]
        sub = texts.get('SUBCKT NAME', {}).get('text', '')
        if props is None:
            props = sub
        return {'off': id_at, 'obj': t_id['at'] - 1, 'id': oid, 'ref': t_id['text'], 'value': texts['COMPONENT VALUE']['text'],
                'device': device, 'x': x, 'y': y, 'angle': angle, 'flags': flags,
                'pins': pins, 'props': _props(props + sub), 'end': tbl + 4 * n}

    def _terminal(self, kind_at):
        d = self.d
        t = d.rfind(b'$TER', max(self.start, kind_at - 512), kind_at)
        if t < 0 or t < 14:
            return None
        ln = d[t - 1]
        name = _text(d[t:t + ln])
        x, y = _i32(d, t - 13), _i32(d, t - 9)
        lab = self._textobj(kind_at)
        label = lab['text'] if lab else ''
        ptr = _u32(d, kind_at + len(b'TERMINAL LABEL\x00') + 4)
        return {'off': t - 14, 'kind': name[4:], 'label': label.strip(), 'x': x, 'y': y, 'ptr': ptr}

    def _wire_label(self, kind_at):
        lab = self._textobj(kind_at)
        if not lab or not lab['text'].strip():
            return None
        ptr = _u32(self.d, kind_at + len(b'WIRE LABEL\x00') + 4)
        return {'label': lab['text'].strip(), 'x': lab['x'], 'y': lab['y'], 'ptr': ptr}

    def _junction(self, at, offs):
        d = self.d
        if at + 25 > self.end or d[at] != 0x01:
            return
        x, y = _i32(d, at + 1), _i32(d, at + 5)
        ptrs = [_u32(d, at + 9 + 4 * k) for k in range(4)]
        live = [p for p in ptrs if p]
        if len(live) < 2 or any(p not in offs for p in live):
            return
        if all((x, y) in (self.wires[p]['points'][0], self.wires[p]['points'][-1]) or
               _on_wire((x, y), self.wires[p]['points']) for p in live):
            self.junctions.append({'x': x, 'y': y, 'wires': live})


def _on_wire(pt, pts):
    x, y = pt
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        if ax == bx == x and min(ay, by) <= y <= max(ay, by):
            return True
        if ay == by == y and min(ax, bx) <= x <= max(ax, bx):
            return True
    return False


def _read_cdb(data, comp_ids):
    out = {}
    if not data:
        return out
    for oid, npins in comp_ids:
        key = struct.pack('<I', oid)
        pos = 0
        while True:
            k = data.find(key, pos)
            if k < 0:
                break
            pos = k + 1
            if k < 8 or data[k - 4:k] != b'\x00\x00\x00\x00':
                continue
            r = k + 4
            ln = data[r] if r < len(data) else 0
            ref = data[r + 1:r + 1 + ln]
            r += 1 + ln
            if r + 4 > len(data) or _u32(data, r) != npins:
                continue
            r += 4
            pins = []
            ok = True
            for _ in range(npins):
                if r + 2 > len(data):
                    ok = False
                    break
                a = data[r]
                nm = data[r + 1:r + 1 + a]
                b = data[r + 1 + a]
                num = data[r + 2 + a:r + 2 + a + b]
                if not (_printable(nm) and _printable(num)):
                    ok = False
                    break
                pins.append((_text(nm), _text(num)))
                r += 2 + a + b
            if ok:
                out[oid] = {'ref': _text(ref), 'pins': pins}
                break
    return out


def _clock(v):
    m = re.match(r'\s*([0-9.]+)\s*([kKmM]?)', v or '')
    if not m:
        return None
    try:
        f = float(m.group(1))
    except ValueError:
        return None
    f *= {'k': 1e3, 'K': 1e3, 'm': 1e6, 'M': 1e6}.get(m.group(2), 1)
    return int(round(f)) if f > 0 else None


class _UF:
    def __init__(self):
        self.p = {}

    def find(self, a):
        self.p.setdefault(a, a)
        while self.p[a] != a:
            self.p[a] = self.p[self.p[a]]
            a = self.p[a]
        return a

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[ra] = rb


def _device_entry(device, npins):
    up = device.upper()
    if up in DEVICE_MAP:
        return DEVICE_MAP[up]
    for pre, typ in PREFIX_MAP:
        if up.startswith(pre):
            if typ == 'LED-BARGRAPH-RED':
                return (typ, BAR) if npins == 20 else None
            return (typ, TWO) if npins == 2 else None
    return None


def _pin_key(pinmap, name, num, index):
    name, num = name.strip().upper(), num.strip()
    if pinmap == 'num':
        return num or (name if name.isdigit() else str(index + 1))
    for k in (name, num, str(index + 1)):
        if k and k in pinmap:
            return pinmap[k]
    if len(pinmap) == 1:
        return next(iter(pinmap.values()))
    return None


def _snap(v):
    return int(round(v / GRID)) * GRID


def _outline(p):
    w, h, x0, y0, x1, y1 = OUTLINE.get(p['type'], DEFAULT_OUTLINE)
    rot = p['rot'] % 360
    cx, cy = w / 2.0, h / 2.0

    def rp(px, py):
        if rot == 90:
            return cx + cy - py, cy - cx + px
        if rot == 180:
            return w - px, h - py
        if rot == 270:
            return cx - cy + py, cy + cx - px
        return px, py
    bx = [rp(0, 0), rp(w, h)]
    px = [rp(x0, y0), rp(x1, y1)]
    bx0, bx1 = min(q[0] for q in bx), max(q[0] for q in bx)
    by0, by1 = min(q[1] for q in bx), max(q[1] for q in bx)
    return (min(bx0, px[0][0], px[1][0]), min(by0 - 14, px[0][1], px[1][1]),
            max(bx1, px[0][0], px[1][0]), max(by1 + 12, px[0][1], px[1][1]))


def _clash(a, b):
    return a[0] < b[2] + GRID and b[0] < a[2] + GRID and a[1] < b[3] + GRID and b[1] < a[3] + GRID


def _layout(parts, raw):
    if not parts:
        return 1.0
    outs = [_outline(p) for p in parts]

    def place(s):
        pos = []
        for (x, y), o in zip(raw, outs):
            pos.append([_snap(x / UNIT * s - (o[0] + o[2]) / 2.0), _snap(-y / UNIT * s - (o[1] + o[3]) / 2.0)])
        return pos

    def boxes(pos):
        return [(x + o[0], y + o[1], x + o[2], y + o[3]) for (x, y), o in zip(pos, outs)]

    def clashes(pos):
        bs = boxes(pos)
        return [(i, j) for i in range(len(bs)) for j in range(i + 1, len(bs)) if _clash(bs[i], bs[j])]

    best = None
    for s in (1.0, 1.25, 1.5, 1.75, 2.0):
        pos = place(s)
        n = len(clashes(pos))
        if best is None or n < best[0]:
            best = (n, s, pos)
        if n == 0:
            break
    n, scale, pos = best
    for _ in range(400):
        cl = clashes(pos)
        if not cl:
            break
        bs = boxes(pos)
        for i, j in cl:
            a, b = bs[i], bs[j]
            px = min(a[2] + GRID - b[0], b[2] + GRID - a[0])
            py = min(a[3] + GRID - b[1], b[3] + GRID - a[1])
            ax = 0 if px <= py else 1
            step = int(-(-(px if ax == 0 else py) // (2 * GRID))) * GRID or GRID
            ca, cb = (a[ax] + a[ax + 2]) / 2.0, (b[ax] + b[ax + 2]) / 2.0
            lo, hi = (i, j) if (ca, i) <= (cb, j) else (j, i)
            pos[lo][ax] -= step
            pos[hi][ax] += step
            bs = boxes(pos)
    bs = boxes(pos)
    mx, my = min(b[0] for b in bs), min(b[1] for b in bs)
    for p, (x, y) in zip(parts, pos):
        p['x'] = _snap(x - mx + 40)
        p['y'] = _snap(y - my + 40)
    return scale


def _decode(dsn_bytes, cdb_bytes):
    warnings, unsupported = [], []
    dsn = Dsn(dsn_bytes).parse()
    comps = dsn.components
    cdb = _read_cdb(cdb_bytes, [(c['id'], len(c['pins'])) for c in comps])
    meta = {'clock': None, 'program': None, 'cfgword': None}

    parts, raw_pos, used, counters = [], [], set(), {}
    refs = [c['ref'] for c in comps if re.match(r'^[A-Za-z0-9_]+$', c['ref'] or '')]
    reserved = {r for r in refs if refs.count(r) == 1}

    def make_id(typ, want):
        if want and want in reserved and want not in used:
            used.add(want)
            return want
        pre = 'DS' if typ.startswith('7SEG') else 'D' if typ.startswith('LED-') and typ != 'LED-BARGRAPH-RED' else PREFIX.get(typ, 'X')
        n = counters.get(pre, 0) + 1
        while pre + str(n) in used or pre + str(n) in reserved:
            n += 1
        counters[pre] = n
        used.add(pre + str(n))
        return pre + str(n)

    def center(c):
        pts = [(c['x'], c['y'])]
        for ptr in c['pins']:
            w = dsn.wire_at(ptr) if ptr else None
            if w:
                ends = (w['points'][0], w['points'][-1])
                pts.append(min(ends, key=lambda e: abs(e[0] - c['x']) + abs(e[1] - c['y'])))
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        return ((min(xs) + max(xs)) / 2.0, (min(ys) + max(ys)) / 2.0)

    nodes = []
    for c in comps:
        info = cdb.get(c['id'])
        ref = (info['ref'] if info and info['ref'] else c['ref']) or ''
        dev = c['device']
        if dev.upper().startswith('PIC'):
            meta['clock'] = _clock(c['props'].get('CLOCK'))
            prog = c['props'].get('PROGRAM')
            meta['program'] = re.split(r'[\\/]', prog)[-1] if prog else None
            cw = c['props'].get('CFGWORD')
            try:
                meta['cfgword'] = int(cw, 0) if cw else None
            except ValueError:
                meta['cfgword'] = None
        pinlist = info['pins'] if info else [('', str(k + 1)) for k in range(len(c['pins']))]
        rot = (-int(round(c['angle'] / 900.0)) * 90) % 360
        if dev.upper() in BICOLOR:
            t1, t2 = BICOLOR[dev.upper()]
            ida = make_id(t1, ref)
            idb = make_id(t2, None)
            cx, cy = center(c)
            for pid, typ, dy in ((ida, t1, 0), (idb, t2, 30 * UNIT)):
                parts.append({'id': pid, 'type': typ, 'x': 0, 'y': 0, 'rot': rot, 'value': ''})
                raw_pos.append((cx, cy - dy))
            for k, ptr in enumerate(c['pins']):
                if ptr:
                    nodes.append((ptr, [ida + '.' + ('A' if k == 0 else 'K'), idb + '.' + ('K' if k == 0 else 'A')]))
            warnings.append('%s (%s): iki renkli LED, ters paralel iki LED olarak alındı (%s, %s).' % (ref or '?', dev, ida, idb))
            continue
        ent = _device_entry(dev, len(c['pins']))
        if not ent:
            why = ('EELAB yalnız PIC16F628A çekirdeğini simüle eder' if dev.upper().startswith('PIC')
                   else 'EELAB kütüphanesinde karşılığı yok')
            unsupported.append({'ref': ref, 'device': dev, 'reason': why})
            continue
        typ, pinmap = ent
        label_ref = typ in ('BUTTON', 'SWITCH', 'LOGICSTATE') and not re.search(r'\d', ref)
        pid = make_id(typ, None if label_ref else ref)
        value = c['value']
        if typ in ('PIC16F628A', '7448', '7447', 'LM016L', 'LM044L', '74HC595') or value.upper() == dev.upper():
            value = ''
        if ref and pid != ref and (label_ref or not value):
            value = ref
        parts.append({'id': pid, 'type': typ, 'x': 0, 'y': 0, 'rot': rot, 'value': value})
        raw_pos.append(center(c))
        hidden = HIDDEN_POWER_PINS.get(typ, set())
        for k, ptr in enumerate(c['pins']):
            if not ptr:
                continue
            nm, num = pinlist[k] if k < len(pinlist) else ('', str(k + 1))
            key = _pin_key(pinmap, nm, num, k)
            if key is None:
                warnings.append('%s: pin %s eşlenemedi, bağlantısı atlandı.' % (pid, nm or num))
                continue
            if key in hidden:
                continue
            nodes.append((ptr, [pid + '.' + key]))

    uf = _UF()
    wires = dsn.wires
    term_offs = {t['off'] for t in dsn.terminals}
    comp_offs = {c['obj'] for c in comps}
    pin_targets = {ptr for ptr, _ in nodes}
    bad_ptr = 0

    def resolve(ptr):
        if ptr in wires or ptr in term_offs or dsn.wire_at(ptr) is not None:
            return ('o', ptr)
        return 'comp' if ptr in comp_offs else None

    for ptr, addrs in nodes:
        r = resolve(ptr)
        if r is None:
            bad_ptr += 1
        elif r != 'comp':
            for a in addrs:
                uf.union(('p', a), r)
    label_nets = {}
    for t in dsn.terminals:
        kind, label, node = t['kind'], t['label'], ('o', t['off'])
        up = label.upper()
        if not t['ptr'] and t['off'] not in pin_targets:
            warnings.append('Bağlantısız terminal atlandı: %s %s' % (kind, label))
            continue
        if t['ptr']:
            r = resolve(t['ptr'])
            if r is None:
                bad_ptr += 1
                continue
            if r != 'comp':
                uf.union(node, r)
        if kind == 'BUS':
            warnings.append('Veri yolu (bus) terminali desteklenmiyor: %s' % label)
            continue
        if (kind == 'POWER' and (up in POWER_NAMES or up not in GROUND_NAMES)) or (kind != 'GROUND' and up in POWER_NAMES - {''}):
            typ = 'POWER'
            if kind == 'POWER' and up not in POWER_NAMES:
                warnings.append('Güç terminali "%s" +5V (POWER) olarak alındı.' % label)
        elif kind == 'GROUND' or up in GROUND_NAMES:
            typ = 'GROUND'
        else:
            if label:
                label_nets.setdefault(up, []).append(node)
            continue
        pid = make_id(typ, None)
        parts.append({'id': pid, 'type': typ, 'x': 0, 'y': 0, 'rot': 0, 'value': ''})
        raw_pos.append((t['x'], t['y']))
        uf.union(('p', pid + '.1'), node)
    for lb in dsn.labels:
        if lb['ptr'] in wires:
            label_nets.setdefault(lb['label'].upper(), []).append(('o', lb['ptr']))
        else:
            near = [p for p, w in wires.items() if _on_wire((lb['x'], lb['y']), w['points'])]
            if near:
                label_nets.setdefault(lb['label'].upper(), []).append(('o', near[0]))
            else:
                warnings.append('Tel etiketi "%s" bir tele bağlanamadı.' % lb['label'])
    for members in label_nets.values():
        for m in members[1:]:
            uf.union(members[0], m)
    for j in dsn.junctions:
        for p in j['wires'][1:]:
            uf.union(('o', j['wires'][0]), ('o', p))
    wl = list(wires.values())
    for i, a in enumerate(wl):
        ends = (a['points'][0], a['points'][-1])
        for b in wl:
            if a is b:
                continue
            if any(e in (b['points'][0], b['points'][-1]) or _on_wire(e, b['points']) for e in ends):
                uf.union(('o', a['off']), ('o', b['off']))

    groups = {}
    for ptr, addrs in nodes:
        for a in addrs:
            if ('p', a) in uf.p:
                groups.setdefault(uf.find(('p', a)), set()).add(a)
    for p in parts:
        if p['type'] in ('POWER', 'GROUND'):
            a = p['id'] + '.1'
            if ('p', a) in uf.p:
                groups.setdefault(uf.find(('p', a)), set()).add(a)
    nets = sorted(sorted(g) for g in groups.values() if len(g) > 1)

    if dsn.buses:
        warnings.append('Şemada %d veri yolu (bus) teli var; veri yolu bağlantıları alınmadı.' % dsn.buses)
    if bad_ptr:
        warnings.append('%d bağlantı işaretçisi çözülemedi.' % bad_ptr)
    scale = _layout(parts, raw_pos)
    meta['scale'] = scale
    if scale > 1:
        warnings.append('EELAB sembolleri Proteus\'takinden büyük olduğu için yerleşim %.2g kat açıldı.' % scale)
    stats = {'components': len(comps), 'wires': len(wires), 'junctions': len(dsn.junctions),
             'terminals': len(dsn.terminals), 'bad_ptr': bad_ptr, 'cdb': len(cdb)}
    return parts, nets, meta, unsupported, warnings, stats


def _template_fallback(parts):
    from collections import Counter
    c = Counter(p['type'] for p in parts)
    if c['PIC16F628A'] == 1 and c['7448'] == 3 and c['7SEG-MPX1-CC'] == 3 and c['BUTTON'] == 2:
        fp = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'circuits', 'lab3.json')
        if os.path.exists(fp):
            with open(fp) as f:
                return json.load(f)
    return None


def parse_pdsprj(data: bytes) -> dict:
    if not isinstance(data, (bytes, bytearray)) or len(data) < 22:
        raise ValueError('Geçersiz .pdsprj arşivi')
    try:
        archive = zipfile.ZipFile(io.BytesIO(bytes(data)))
    except (zipfile.BadZipFile, OSError, ValueError):
        raise ValueError('Geçersiz .pdsprj arşivi (zip değil)')
    try:
        names = {n.upper().split('/')[-1]: n for n in archive.namelist()}
        if 'ROOT.DSN' not in names:
            raise ValueError('ROOT.DSN bulunamadı')
        try:
            dsn = archive.read(names['ROOT.DSN'])
            cdb = archive.read(names['ROOT.CDB']) if 'ROOT.CDB' in names else b''
        except (zipfile.BadZipFile, OSError, EOFError, RuntimeError, ValueError, KeyError) as e:
            raise ValueError('Arşiv bozuk: %s' % e)
        proj = _read_project(names, archive)
    finally:
        archive.close()

    warnings = []
    filever = proj.get('filever')
    if filever not in KNOWN_FILEVER:
        warnings.append('Bilinmeyen Proteus dosya sürümü (FILEVER=%s); içe aktarma denenecek, sonucu kontrol et.' % filever)
    try:
        parts, nets, meta, unsupported, w2, stats = _decode(dsn, cdb)
    except ValueError:
        raise
    except Exception as e:
        raise ValueError('ROOT.DSN çözümlenemedi: %s' % e)
    warnings += w2
    meta.update(release=proj.get('release'), filever=filever)
    if stats['cdb'] < stats['components']:
        warnings.append('ROOT.CDB içinde %d bileşenin pin listesi bulunamadı; pin sırası varsayıldı.'
                        % (stats['components'] - stats['cdb']))
    if filever not in KNOWN_FILEVER and (stats['bad_ptr'] or not nets):
        nets = []
        warnings.append('Bu sürümde bağlantılar güvenilir çözülemedi; yalnız parça listesi alındı.')
    if not parts:
        warnings.append('Şemada EELAB\'ın tanıdığı parça bulunamadı.')
    if parts and not nets and stats['wires']:
        tpl = _template_fallback(parts)
        if tpl:
            tpl['warnings'] = warnings + ['Bağlantılar çözülemedi; Lab 3 şablonu yüklendi.']
            tpl.setdefault('meta', meta)
            tpl.setdefault('unsupported', unsupported)
            return tpl
        warnings.append('Bağlantılar çözülemedi; telleri elle çekmelisin.')
    for u in unsupported:
        warnings.append('Desteklenmeyen parça atlandı: %s (%s)' % (u['ref'] or '?', u['device']))
    if meta.get('clock'):
        warnings.append('Proteus saat frekansı: %g MHz.' % (meta['clock'] / 1e6))
    return {'version': 1, 'parts': parts, 'nets': nets, 'wires': [], 'meta': meta,
            'unsupported': unsupported, 'warnings': warnings}


if __name__ == '__main__':
    import sys
    for fn in sys.argv[1:]:
        with open(fn, 'rb') as f:
            print(json.dumps(parse_pdsprj(f.read()), ensure_ascii=False, indent=1))
