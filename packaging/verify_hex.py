import argparse, hashlib, json, os, shutil, sys, tempfile


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--toolchain", required=True)
    ap.add_argument("--golden")
    a = ap.parse_args()
    root = os.path.abspath(a.root)
    golden = json.load(open(a.golden or os.path.join(root, "packaging", "selftest", "golden.json")))["files"]
    tmp = tempfile.mkdtemp(prefix="eelab_vh_")
    os.environ.update(EELAB_TOOLCHAIN=os.path.abspath(a.toolchain), EELAB_HOME=os.path.join(tmp, "home"), HOME=tmp)
    sys.path.insert(0, root)
    try:
        import server
        work = os.path.join(tmp, "work")
        os.makedirs(work)
        server.PROJ = work
        server.SETTINGS = os.path.join(work, ".ayarlar.json")
        src = os.path.join(root, "projeler")
        if os.path.exists(os.path.join(src, ".ayarlar.json")):
            shutil.copy(os.path.join(src, ".ayarlar.json"), server.SETTINGS)
        bad = 0
        for f in sorted(x for x in os.listdir(src) if server.FILE_RE.match(x)):
            hx = f.rsplit(".", 1)[0] + ".hex"
            r = server.build(f, open(os.path.join(src, f)).read())
            got = hashlib.md5(r["hex"].encode()).hexdigest() if r.get("ok") else "FAIL"
            want = golden.get(hx)
            ok = want is None or got == want
            bad += not ok
            print("%s %-22s %s%s" % ("ok  " if ok else "FARK", hx, got, "" if ok else " (beklenen %s)" % want))
            if got == "FAIL":
                print("\n".join("      " + m for m in r.get("messages", [])))
        missing = set(golden) - {f.rsplit(".", 1)[0] + ".hex" for f in os.listdir(src) if server.FILE_RE.match(f)}
        for m in sorted(missing):
            print("YOK  %s" % m)
        bad += len(missing)
        print("HEX: %d fark" % bad)
        return 1 if bad else 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
