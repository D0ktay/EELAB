import io
import itertools
import json
import random
import subprocess
import sys
import zipfile
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
FIX = HERE / 'fixtures'
sys.path.insert(0, str(ROOT))
from pdsprj import DEVICE_MAP, parse_pdsprj

NODE_CHECK = r"""
const LIB = require(process.argv[1] + '/js/library.js'), SIM = require(process.argv[1] + '/js/sim.js');
const inp = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const out = { types: Object.keys(LIB.types), results: [] };
for (const c of inp) {
  const bad = [];
  for (const p of c.parts) if (!LIB.types[p.type]) bad.push('tip yok: ' + p.type);
  const ids = new Map(c.parts.map(p => [p.id, p]));
  for (const n of c.nets) for (const a of n) {
    const [id, num] = [a.slice(0, a.indexOf('.')), a.slice(a.indexOf('.') + 1)], p = ids.get(id);
    if (!p) bad.push('parça yok: ' + a); else if (!LIB.types[p.type].pins.some(q => q.num === num)) bad.push('pin yok: ' + a);
  }
  const overlap = SIM.overlaps(c.parts, LIB);
  const r = SIM.route({ parts: c.parts, wires: [], nets: c.nets }, LIB);
  const got = SIM.pinNets({ parts: c.parts, wires: r.wires }, LIB);
  out.results.push({ bad, overlap, routeWarnings: r.warnings, routed: got, want: SIM.canon(c.nets) });
}
console.log(JSON.stringify(out));
"""


def node_check(circuits):
    p = subprocess.run(['node', '-e', NODE_CHECK, str(ROOT)], input=json.dumps(circuits),
                       capture_output=True, text=True, timeout=300)
    assert p.returncode == 0, p.stderr
    return json.loads(p.stdout)


def load(name):
    return parse_pdsprj((FIX / name).read_bytes())


def canon(nets):
    return sorted(sorted(n) for n in nets if len(n) > 1)


def reduce_nets(nets, types, drop_res=()):
    uf = {}

    def find(a):
        uf.setdefault(a, a)
        while uf[a] != a:
            uf[a] = uf[uf[a]]
            a = uf[a]
        return a

    def union(a, b):
        uf[find(a)] = find(b)
    def token(a):
        t = types.get(a.split('.')[0])
        return 'GND' if t == 'GROUND' else 'VCC' if t == 'POWER' else a
    for n in nets:
        toks = [token(a) for a in n]
        for x in toks:
            union(toks[0], x)
    for r in drop_res:
        union(r + '.1', r + '.2')
    groups = {}
    for a in list(uf):
        if a.split('.')[0] in drop_res:
            continue
        groups.setdefault(find(a), set()).add(a)
    return groups


def equivalent(imp, golden_parts, golden_nets):
    itypes = {p['id']: p['type'] for p in imp['parts']}
    gtypes = {p['id']: p['type'] for p in golden_parts}
    ivals = Counter((p['type'], p['value']) for p in imp['parts'] if p['type'] == 'RES')
    gres = {}
    for p in golden_parts:
        if p['type'] == 'RES':
            gres.setdefault(p['value'], []).append(p['id'])
    drop = set()
    for val, ids in gres.items():
        if len(ids) > ivals.get(('RES', val), 0):
            drop |= set(ids[ivals.get(('RES', val), 0):])
    g = reduce_nets(golden_nets, gtypes, drop)
    i = reduce_nets(imp['nets'], itypes)
    gsig = {frozenset(s) for s in g.values() if len(s) > 1}
    isig_raw = [s for s in i.values() if len(s) > 1]
    kinds = sorted({t for t in itypes.values() if t not in ('GROUND', 'POWER')})
    groups = []
    for t in kinds:
        a = sorted(k for k, v in itypes.items() if v == t)
        b = sorted(k for k, v in gtypes.items() if v == t and k not in drop)
        if len(a) != len(b):
            return False, 'parça sayısı farklı: %s %d/%d' % (t, len(a), len(b))
        groups.append((a, list(itertools.permutations(b))))
    best = None
    for combo in itertools.product(*[g[1] for g in groups]):
        m = {}
        for (a, _), perm in zip(groups, combo):
            m.update(zip(a, perm))
        mapped = {frozenset(m.get(x.split('.')[0], x.split('.')[0]) + x[len(x.split('.')[0]):] if '.' in x else x for x in s)
                  for s in isig_raw}
        if mapped == gsig:
            return True, m
        d = len(mapped ^ gsig)
        if best is None or d < best[0]:
            best = (d, sorted(map(sorted, mapped - gsig))[:5], sorted(map(sorted, gsig - mapped))[:5])
    return False, best


def test_device_map_types(lib_types):
    for dev, (typ, _) in DEVICE_MAP.items():
        assert typ in lib_types, 'DEVICE_MAP %s -> %s LIB.types içinde yok' % (dev, typ)


def test_corrupt():
    good = (FIX / 'Lab3.pdsprj').read_bytes()
    cases = [b'', b'PK', b'not a zip at all' * 10, good[:len(good) // 2], good[:-30]]
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        z.writestr('PROJECT.XML', '<PROJECT/>')
    cases.append(buf.getvalue())
    for c in cases:
        try:
            r = parse_pdsprj(c)
            assert isinstance(r, dict)
        except ValueError:
            pass
    with zipfile.ZipFile(io.BytesIO(good)) as z:
        files = {n: z.read(n) for n in z.namelist()}
    dsn_name = next(n for n in files if n.upper().endswith('ROOT.DSN'))
    rnd = random.Random(321)
    for k in range(150):
        dsn = bytearray(files[dsn_name])
        if k % 3 == 0:
            dsn = dsn[:rnd.randrange(len(dsn))]
        else:
            for _ in range(rnd.randrange(1, 60)):
                dsn[rnd.randrange(len(dsn))] = rnd.randrange(256)
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w') as z:
            for n, b in files.items():
                z.writestr(n, bytes(dsn) if n == dsn_name else b)
        try:
            r = parse_pdsprj(buf.getvalue())
            assert isinstance(r, dict) and isinstance(r['parts'], list) and isinstance(r['nets'], list)
        except ValueError:
            pass


def with_filever(data, ver):
    out = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(data)) as zi, zipfile.ZipFile(out, 'w') as zo:
        for n in zi.namelist():
            b = zi.read(n)
            if n.upper().endswith('PROJECT.XML'):
                b = b.replace(b'FILEVER="814"', b'FILEVER="%s"' % ver.encode())
            zo.writestr(n, b)
    return out.getvalue()


def main():
    assert '/' + 'Users/' not in Path(__file__).read_text()
    results = {n: load(n) for n in ('Lab3.pdsprj', 'LAB2.pdsprj', 'Led_Switch.pdsprj')}
    for name, r in results.items():
        assert r['version'] == 1 and r['wires'] == [] and r['nets'], name
        assert r['unsupported'] == [], (name, r['unsupported'])
        assert r['meta']['filever'] == '814' and r['meta']['release'] == '806', name
        assert r['meta']['clock'] == 8000000 and r['meta']['cfgword'] == 0x3F6B, name
        ids = [p['id'] for p in r['parts']]
        assert len(ids) == len(set(ids)), name
        for p in r['parts']:
            assert p['x'] % 10 == 0 and p['y'] % 10 == 0 and p['x'] >= 0 and p['y'] >= 0 and p['rot'] in (0, 90, 180, 270)
        assert not any('şablon' in w for w in r['warnings']), name
    nc = node_check([{'parts': r['parts'], 'nets': r['nets']} for r in results.values()])
    test_device_map_types(set(nc['types']))
    for (name, r), res in zip(results.items(), nc['results']):
        assert not res['bad'], (name, res['bad'])
        assert not res['overlap'], (name, 'parçalar üst üste')
        assert res['routed'] == res['want'], (name, res['routeWarnings'])

    lab3 = results['Lab3.pdsprj']
    c = Counter(p['type'] for p in lab3['parts'])
    assert (c['PIC16F628A'], c['7448'], c['7SEG-MPX1-CC'], c['BUTTON'], c['RES']) == (1, 3, 3, 2, 2), c
    by_val = {p['value']: p for p in lab3['parts'] if p['type'] == 'BUTTON'}
    assert set(by_val) == {'START/STOP', 'RESET'}
    golden = json.loads((ROOT / 'circuits' / 'lab3.json').read_text())
    golden_nets = json.loads((FIX / 'lab3_nets.json').read_text())
    ok, info = equivalent(lab3, golden['parts'], golden_nets)
    assert ok, ('Lab3 ağları altın dosyayla eşleşmedi', info)

    for name, gold in (('LAB2.pdsprj', 'lab2_nets.json'), ('Led_Switch.pdsprj', 'led_switch_nets.json')):
        want = json.loads((FIX / gold).read_text())
        assert canon(results[name]['nets']) == canon(want), (name, results[name]['nets'])

    v = parse_pdsprj(with_filever((FIX / 'Lab3.pdsprj').read_bytes(), '999'))
    assert any('FILEVER=999' in w for w in v['warnings']) and v['parts']

    test_corrupt()
    n = {k: len(r['nets']) for k, r in results.items()}
    print('OK: pdsprj — Lab3 ağları altın dosyayla eşdeğer (%d ağ), LAB2 %d ağ, Led_Switch %d ağ; bozuk girdiler güvenli'
          % (n['Lab3.pdsprj'], n['LAB2.pdsprj'], n['Led_Switch.pdsprj']))


if __name__ == '__main__':
    main()
