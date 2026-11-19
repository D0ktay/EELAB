import hashlib, json, os, shutil, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import server

SRC = os.path.join(ROOT, "projeler")


def main():
    out = None
    if "--out" in sys.argv:
        out = sys.argv[sys.argv.index("--out") + 1]
        os.makedirs(out, exist_ok=True)
    work = tempfile.mkdtemp(prefix="ee321_bt_")
    server.PROJ = work
    server.SETTINGS = os.path.join(work, ".ayarlar.json")
    assert not os.path.exists(os.path.join(work, ".eelab.json"))
    try:
        if os.path.exists(os.path.join(SRC, ".ayarlar.json")):
            shutil.copy(os.path.join(SRC, ".ayarlar.json"), server.SETTINGS)
        files = sorted(f for f in os.listdir(SRC) if server.FILE_RE.match(f))
        failed = 0
        for f in files:
            code = open(os.path.join(SRC, f)).read()
            r = server.build(f, code)
            ok = r.get("ok") and r.get("hex", "").count(":") > 2
            words = 0
            if ok:
                for line in r["hex"].splitlines():
                    if line.startswith(":") and line[7:9] == "00" and int(line[3:7], 16) < 0x1000:
                        words += int(line[1:3], 16) // 2
                if out:
                    open(os.path.join(out, f.rsplit(".", 1)[0] + ".hex"), "w").write(r["hex"])
            hx = f.rsplit(".", 1)[0] + ".hex"
            exp = server.GOLDEN.get(hx)
            md5 = hashlib.md5(r["hex"].encode()).hexdigest() if ok else ""
            same = exp is None or md5 == exp
            print("%s %-22s %7d Hz %5s word  md5 %s" % ("ok  " if ok and same else "FAIL", f, r.get("fosc", 0), words if ok else "-", "=" if exp and same else md5 or "-"))
            if ok and not same:
                failed += 1
                print("      md5 %s != Ek B %s" % (md5, exp))
            if not ok:
                failed += 1
                for m in r.get("messages", []):
                    print("      " + m)
            elif words > 2048:
                failed += 1
                print("      program 2K word sinirini asiyor")
        tpls = server.templates()
        assert len(tpls) >= 13, tpls
        for t in tpls:
            _, code = server.template_code(t["id"])
            r = server.build("tpl_%s.%s" % (t["id"], t["lang"]), code, t["fosc"])
            words = sum(1 for a in server.hex_words(r.get("hex", "")) if a < 0x2000) if r.get("ok") else 0
            good = r.get("ok") and 0 < words <= 2048 and r.get("debug", {}).get("lines")
            print("%s sablon %-18s %7d Hz %5s word%s" % ("ok  " if good else "FAIL", t["id"], r.get("fosc", 0), words or "-", "  devre " + t["circuit"] if t.get("circuit") else ""))
            if not good:
                failed += 1
                for m in r.get("messages", []):
                    print("      " + m)
        print("\nlibModel 'mikroc' (D2: yalniz yeni dosyalar/sablonlar; Ek B md5'leri 'eelab' ile korunur):")
        for f in files:
            code = open(os.path.join(SRC, f)).read()
            r = server.build("mc_" + f, code, server.get_fosc(f), "mikroc")
            words = sum(1 for a in server.hex_words(r.get("hex", "")) if a < 0x2000) if r.get("ok") else 0
            good = r.get("ok") and 0 < words <= 2048 and r.get("libModel") == ("mikroc" if f.endswith(".c") else "eelab") and r.get("mc")
            md5 = hashlib.md5(r["hex"].encode()).hexdigest() if r.get("ok") else "-"
            exp = server.GOLDEN.get(f.rsplit(".", 1)[0] + ".hex")
            print("%s mikroc %-22s %7d Hz %5s word  md5 %s%s" % ("ok  " if good else "FAIL", f, r.get("fosc", 0), words or "-", md5, "  (= Ek B)" if md5 == exp else ""))
            if not good:
                failed += 1
                for m in r.get("messages", []):
                    print("      " + m)
        for t in tpls:
            _, code = server.template_code(t["id"])
            r = server.build("mctpl_%s.%s" % (t["id"], t["lang"]), code, t["fosc"], "mikroc")
            words = sum(1 for a in server.hex_words(r.get("hex", "")) if a < 0x2000) if r.get("ok") else 0
            good = r.get("ok") and 0 < words <= 2048 and r.get("debug", {}).get("lines")
            print("%s mikroc sablon %-11s %7d Hz %5s word" % ("ok  " if good else "FAIL", t["id"], r.get("fosc", 0), words or "-"))
            if not good:
                failed += 1
                for m in r.get("messages", []):
                    print("      " + m)
        conv, extra = server.convert("sbit LCD_RS at RB4_bit;\nchar keypadPort at PORTB;\nvoid interrupt() {\nINTCON.GIE = 1; PORTB.B3 = 0; TMR0.F7 = 1; x.B2 = 1;\nunsigned short a; short b;\n")
        lines = conv.split("\n")
        assert lines[0] == "#define LCD_RS RB4_bit", lines[0]
        assert lines[1] == "#define keypadPort PORTB" and extra["MC_KP_TRIS"] == "TRISB"
        assert "void mc_interrupt(void) __interrupt" in lines[2]
        assert lines[3] == "INTCONbits.GIE = 1; PORTB_mcb.B3 = 0; TMR0_mcb.F7 = 1; MC_VB(x).B2 = 1;", lines[3]
        assert lines[4] == "unsigned char a; signed char b;", lines[4]
        use = server.lib_uses("Lcd_Out(1,1,\"a\"); UART1_Write_Text(\"x\");")
        assert {"Lcd_Out", "LCD_GOTO", "LCD_CORE", "DELAY_K", "UART1_Write_Text", "UART1_Write"} <= use and "Lcd_Init" not in use, use
        print("ok   convert() / kutuphane secimi")
        print("\n%d dosya + %d sablon, %d basarisiz" % (len(files), len(tpls), failed))
        return 1 if failed else 0
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
