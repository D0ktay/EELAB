"""Çapraz denetimler (EELAB_PLAN §3.3 WS-F): modüller arası sözleşmeler tutarlı mı."""
import hashlib, json, os, re, subprocess, sys, tempfile

_TMP = tempfile.mkdtemp(prefix="eelab_cross_")
os.environ["EELAB_HOME"] = os.path.join(_TMP, "home")
os.environ["EELAB_STATE_DIR"] = os.path.join(_TMP, "state")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
import eelab_paths, pdsprj, server  # noqa: E402

OK = [0]
FAIL = []


def check(cond, what):
    if cond:
        OK[0] += 1
    else:
        FAIL.append(what)


def node_json(expr):
    js = "const LIB=require(%r),SIM=require(%r);console.log(JSON.stringify(%s));" % (
        os.path.join(ROOT, "js", "library.js"), os.path.join(ROOT, "js", "sim.js"), expr)
    return json.loads(subprocess.check_output(["node", "-e", js]))


lib_types = set(node_json("Object.keys(LIB.types)"))
lib_order = node_json("LIB.order")
cats = node_json("LIB.categories.map(c=>c.types)")

for dev, (typ, _) in pdsprj.DEVICE_MAP.items():
    check(typ in lib_types, "DEVICE_MAP %s → %s LIB.types'ta yok" % (dev, typ))
for t in lib_types:
    check(t in lib_order, "LIB.order eksik: " + t)
    check(any(t in c for c in cats), "LIB.categories eksik: " + t)
check("OSCILLOSCOPE" in lib_types and "LOGIC-ANALYSER" in lib_types, "K6 alet tipleri")

tpls = json.load(open(os.path.join(ROOT, "templates", "index.json"), encoding="utf-8"))
ids = [t["id"] for t in tpls]
check(len(ids) == len(set(ids)) and len(ids) >= 13, "şablon kimlikleri benzersiz, en az 13")
for t in tpls:
    check(os.path.isfile(os.path.join(ROOT, "templates", "%s.%s" % (t["id"], t["lang"]))), "şablon dosyası: " + t["id"])
    if not t["id"].startswith("blank_"):
        check(bool(t.get("circuit")), "şablon devresiz: " + t["id"])
    if t.get("circuit"):
        p = os.path.join(ROOT, "circuits", t["circuit"] + ".json")
        check(os.path.isfile(p), "şablon devresi yok: %s → %s" % (t["id"], t["circuit"]))
check(len(server.templates()) == len(tpls), "server.templates() hepsini döndürür")

for fn, c in eelab_paths.EXAMPLE_CIRCUITS.items():
    check(os.path.isfile(os.path.join(ROOT, "projeler", fn)), "örnek dosya yok: " + fn)
    check(os.path.isfile(os.path.join(ROOT, "circuits", c + ".json")), "örnek devresi yok: %s → %s" % (fn, c))

for f in sorted(os.listdir(os.path.join(ROOT, "circuits"))):
    if not f.endswith(".json"):
        continue
    c = json.load(open(os.path.join(ROOT, "circuits", f)))
    check(c.get("version") == 1 and isinstance(c.get("parts"), list) and isinstance(c.get("wires"), list), "devre şeması: " + f)
    bad = [p["type"] for p in c["parts"] if p["type"] not in lib_types]
    check(not bad, "devrede bilinmeyen tip %s: %r" % (f, bad))
    check(len({p["id"] for p in c["parts"]}) == len(c["parts"]), "devrede yinelenen id: " + f)

PLAN_B = dict(re.findall(r"^\| (\w+\.hex) \| `([0-9a-f]{32})` \|$", open(os.path.join(ROOT, "EELAB_PLAN.md"), encoding="utf-8").read(), re.M))
check(len(PLAN_B) == 11, "Ek B tablosu 11 satır")
check(server.GOLDEN == PLAN_B, "server.GOLDEN = Ek B")
gp = os.path.join(ROOT, "packaging", "selftest", "golden.json")
if os.path.isfile(gp):
    g = json.load(open(gp))
    check(g.get("files") == PLAN_B, "packaging/selftest/golden.json = Ek B")
frozen = {"Task1.hex": "c87140f8824b23ebf3ccf28a610e86f5", "Task2.hex": "6418f6256b7116b45d7758d365f35725"}
for f, m in frozen.items():
    check(hashlib.md5(open(os.path.join(ROOT, "projeler", f), "rb").read()).hexdigest() == m, "dondurulmuş %s değişmiş" % f)

html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
for s in ("/js/pic.js", "/js/library.js", "/js/sim.js", "/js/editor.js", "/js/ide.js", "/js/debug.js", "/js/scope.js"):
    check(s in html, "index.html yüklemiyor: " + s)
check("EE321 Lab Studio" not in html, "index.html'de eski ad")
for bad in ("mikroC PRO for PIC (Mac)", "Proteus 8 (Mac)", "MPLAB IDE v8.92"):
    check(bad not in html, "ürün kimliği olarak üçüncü taraf adı: " + bad)
check(re.search(r"https?://(?!127\.0\.0\.1|localhost|www\.w3\.org)", html) is None, "index.html harici URL içeriyor")
for f in os.listdir(os.path.join(ROOT, "js")):
    t = open(os.path.join(ROOT, "js", f), encoding="utf-8").read()
    check("/Users/" not in t and not re.search(r"https?://(?!www\.w3\.org)", t), "js/%s mutlak yol/harici URL" % f)
for f in ("server.py", "eelab_paths.py", "pdsprj.py"):
    t = open(os.path.join(ROOT, f), encoding="utf-8").read()
    check("/Users/" not in t, f + " mutlak kullanıcı yolu")

import shutil  # noqa: E402
shutil.rmtree(_TMP, ignore_errors=True)
if FAIL:
    for f in FAIL:
        print("FAIL " + f)
    print("cross_test: %d geçti, %d başarısız" % (OK[0], len(FAIL)))
    sys.exit(1)
print("cross_test: %d denetim geçti" % OK[0])
