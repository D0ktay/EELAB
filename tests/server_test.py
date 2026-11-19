import hashlib, http.client, io, json, os, re, shutil, signal, socket, subprocess, sys, tempfile, time, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import server

PY = sys.argv[sys.argv.index("--python") + 1] if "--python" in sys.argv else sys.executable
OK = [0]


def check(cond, what):
    if not cond:
        raise AssertionError(what)
    OK[0] += 1


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


class Srv:
    def __init__(self, env, extra=()):
        self.port = free_port()
        self.p = subprocess.Popen([PY, "-B", os.path.join(ROOT, "server.py"), "--no-open", "--port", str(self.port)] + list(extra),
                                  env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        for _ in range(100):
            try:
                if self.get("/api/ping")[1].get("app") == "EELAB":
                    return
            except OSError:
                pass
            time.sleep(0.1)
        self.p.kill()
        raise RuntimeError("sunucu açılmadı: " + self.p.stdout.read().decode())

    def req(self, method, path, body=None, headers=None, raw=False):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=120)
        h = {"Host": "127.0.0.1:%d" % self.port}
        h.update(headers or {})
        data = body if isinstance(body, bytes) or body is None else json.dumps(body).encode()
        if data is not None:
            h["Content-Type"] = "application/octet-stream" if isinstance(body, bytes) else "application/json"
        c.request(method, path, body=data, headers=h)
        r = c.getresponse()
        out = r.read()
        c.close()
        if raw:
            return r.status, out
        try:
            return r.status, json.loads(out.decode())
        except ValueError:
            return r.status, {"_raw": out}

    def get(self, path, **kw):
        return self.req("GET", path, **kw)

    def post(self, path, body, **kw):
        return self.req("POST", path, body, **kw)

    def stop(self, sig=signal.SIGTERM):
        self.p.send_signal(sig)
        try:
            self.p.wait(10)
        except subprocess.TimeoutExpired:
            self.p.kill()


def tree_hash(d):
    h = hashlib.sha256()
    for f in sorted(os.listdir(d)):
        h.update(f.encode())
        with open(os.path.join(d, f), "rb") as fh:
            h.update(fh.read())
    return h.hexdigest()


def dly_sim(plan):
    """delay_plan govdesini sayan kucuk PIC cevrim sayaci (CALL/RETURN 4 Tcy plana dahil)."""
    prog = [l.strip() for l in plan["asm"]]
    labels = {l[:-1]: i for i, l in enumerate(prog) if l.endswith(":")}
    regs, w, pc, cyc = {}, 0, 0, 4 if plan["call"] else 0
    while pc < len(prog):
        op, _, arg = prog[pc].partition("\t")
        op, a = op.lower(), arg.split(",")[0].strip()
        if op.endswith(":"):
            pc += 1
        elif op == "nop":
            cyc, pc = cyc + 1, pc + 1
        elif op == "banksel":
            cyc, pc = cyc + 2, pc + 1
        elif op == "movlw":
            w, cyc, pc = int(a), cyc + 1, pc + 1
        elif op == "movwf":
            regs[a], cyc, pc = w, cyc + 1, pc + 1
        elif op == "decfsz":
            regs[a] = (regs.get(a, 0) - 1) & 255
            cyc, pc = cyc + 1, pc + 1
            if regs[a] == 0:
                cyc, pc = cyc + 1, pc + 1
        elif op == "goto":
            cyc, pc = cyc + 2, pc + 1 if a == "$+1" else labels[a]
        else:
            raise AssertionError("bilinmeyen komut " + op)
    return cyc


def ws4_units():
    for c in (0, 1, 2, 3, 4, 5, 9, 10, 12, 13, 50, 777, 778, 1000, 10000, 100000, 197131, 197134, 1000000, 5000000):
        pl = server.delay_plan(c)
        check(dly_sim(pl) == c, "delay_plan(%d) -> %d" % (c, dly_sim(pl)))
    for c in range(0, 3000):
        check(dly_sim(server.delay_plan(c)) == c, "delay_plan(%d)" % c)
    mk = {"call": False, "asm": ["movlw\t130", "movwf\tR12", "movlw\t221", "movwf\tR13", "L:", "decfsz\tR13, f", "goto\tL", "decfsz\tR12, f", "goto\tL", "nop", "nop"]}
    check(dly_sim(mk) == 100000, "mikroC Delay_ms(100)@4MHz deseni R12=130 R13=221 = 100000")
    big = server.delay_plan(327675000)
    check(len(big["blocks"]) == 7 and sum(len(b[0]) for b in big["blocks"]) == 21, "Delay_ms(65535)@20MHz zincir")
    check(server.dly_cycles("ms", 100, 4000000) == 100000 and server.dly_cycles("us", 1, 8000000) == 2 and server.dly_cycles("cyc", 3, 0) == 30, "dly_cycles")
    check(server.dly_cycles("us", 1, 4000000) == 1 and server.dly_cycles("ms", 1000, 20000000) == 5000000, "dly_cycles 2")
    d = {"T": "250", "U": "T * 2"}
    for e, v in (("1 + 2 * 2", 5), ("0x10", 16), ("100UL", 100), ("010", 8), ("(1000 / 3)", 333), ("-7 / 2", -3), ("U", 500), ("T + U", 750), ("1.5 * 2", 3.0)):
        check(server.c_const(e, d) == v, "c_const %s" % e)
    for e in ("x", "f()", "a[1]", "1 << 2", "", "T + y"):
        check(server.c_const(e, d) is None, "c_const reddeder %r" % e)
    code = 'void main() {\n\tDelay_ms(100); // Delay_ms(5)\n\tchar *s = "Delay_ms(7)";\n\tDelay_ms(t);\n\tif (a) Delay_us(3); else Delay_us(1);\n\tVdelay_ms(4); Delay_1sec(); Delay_5500us();\n\tDelay_Cyc(2);\n}\n'
    out, used, errs = server.exact_delays(code, 4000000)
    lines = out.split("\n")
    check(len(lines) == len(code.split("\n")), "exact_delays satir sayisi")
    check(lines[1] == "\tMC_DLY_100000(); // Delay_ms(5)" and '"Delay_ms(7)"' in lines[2] and lines[3] == "\tDelay_ms(t);", "exact_delays yorum/metin/degisken %r" % lines[1:4])
    check(lines[4] == "\tif (a) do { __asm goto $+1 __endasm; __asm nop __endasm; } while (0); else __asm nop __endasm;", "exact_delays if/else %r" % lines[4])
    check("Vdelay_ms(4)" in lines[5] and "MC_DLY_1000000()" in lines[5] and "MC_DLY_5500()" in lines[5], "Vdelay_ms dokunulmaz %r" % lines[5])
    check(used == {100000, 1000000, 5500} and errs == [(7, "Argument is out of range")], "exact_delays %r %r" % (used, errs))
    hdr = server.dly_header(used, 4000000, lcd=True)
    check("unsigned char mc_xd[3];" in hdr and "void MC_DLY_100000(void)" in hdr and "#define MC_XD_1US() __asm nop __endasm" in hdr and "#define MC_XD_5500US() MC_DLY_5500()" in hdr, "dly_header")
    check(server.uart_baud(4000000, 9600) == (1, 25, 4000000 / 416.0) and server.uart_baud(4000000, 115200)[:2] == (1, 1) and server.uart_baud(20000000, 300) is None, "uart_baud")
    h, e = server.lib_checks("UART1_Init(9600);\nPWM1_Init(5000);\nPWM1_Init(100);\n", 4000000)
    check(h == [{"line": 1, "baud": 9615, "err": "0.16", "brgh": 1, "spbrg": 25}] and e == [(3, "Argument is out of range")], "lib_checks %r %r" % (h, e))
    use = server.lib_uses("LongToStr(a, b); WordToHex(1, t); IntToStrWithZeros(1, t); ByteToStr(1, t);")
    check({"LongToStr", "L2S", "WordToHex", "HEX", "IntToStrWithZeros", "U2Z", "ByteToStr", "U2S"} <= use and "ByteToStrWithZeros" not in use, "yeni donusum kutuphaneleri %r" % use)
    check(server.lib_uses("Lcd_Init();", exact=True) == {"Lcd_Init", "LCD_CORE"} and "DELAY_MS" in server.lib_uses("Lcd_Init();"), "exact LCD bagimliliklari")
    m = server.mc_msg("hint", 0, 1144, "usedRom", [430, 21, 1618, 79])
    check(m["text"] == "Used ROM (program words): 430 (21%)  Free ROM (program words): 1618 (79%)", "G-MSG usedRom")
    check(server.mc_map_error("error", "Undefined identifier 'foo'") == (324, "undeclared", ["foo"]) and server.mc_map_error("error", "syntax error: token -> '}' ; column 1") == (402, "expected", ["}"]), "G-ERR")
    check(server.mc_map_error("warning", "overflow in implicit constant conversion") == (0, "raw", ["overflow in implicit constant conversion"]), "G-ERR raw")
    ini = server.parse_ini(open(os.path.join(ROOT, "tests", "fixtures", "mikroc", "Lab_5.mcppi")).read())
    check(ini["DEVICE"] == {"Name": "P16F628A", "Clock": "8000000"} and ini["FILES"]["File0"] == "Lab_5.c" and ini["USESES"]["Count"] == "2", "Lab_5.mcppi")
    txt = server.mcppi_text("Lab_5.c", 8000000, open(os.path.join(ROOT, "tests", "fixtures", "mikroc", "Lab_5.c")).read())
    check(txt == open(os.path.join(ROOT, "tests", "fixtures", "mikroc", "Lab_5.mcppi"), newline="").read(), "mcppi_text == fixture (F1 bolumleri)")
    print("ok   WS-4 birim: delay_plan (simulasyon), c_const, exact_delays, baud/PWM, kutuphaneler, G-MSG/G-ERR, .mcppi")


def ws4_http(s, ws):
    st, r = s.get("/api/info")
    check(r["libModels"] == ["eelab", "mikroc"] and r["libModelDefault"] == "eelab" and r["ui"] == {"lang": "tr"}, "info libModels %r" % r.get("libModels"))
    st, r = s.get("/api/file?name=Task1.c")
    check(r["settings"]["libModel"] == "eelab", "var olan dosya eelab")
    st, r = s.get("/api/file?name=Kronometre.c")
    check(r["settings"]["libModel"] == "mikroc", "sablondan yeni dosya mikroc (D2=B)")
    st, r = s.post("/api/new", {"name": "Yeni4"})
    check(r["ok"] and r["settings"]["libModel"] == "mikroc", "/api/new bos -> mikroc")
    st, r = s.post("/api/settings", {"name": "Yeni4.c", "libModel": "bozuk"})
    check(r["settings"]["libModel"] == "mikroc" and r["libModel"] == "mikroc", "gecersiz libModel yok sayilir")
    st, r = s.post("/api/settings", {"name": "Yeni4.c", "libModel": "eelab"})
    check(r["settings"]["libModel"] == "eelab", "libModel degisir")
    s.post("/api/settings", {"name": "Yeni4.c", "libModel": "mikroc"})
    code1 = open(os.path.join(ws, "Task1.c")).read()
    st, r = s.post("/api/build", {"name": "Task1.c", "code": code1})
    check(r["ok"] and r["libModel"] == "eelab" and hashlib.md5(r["hex"].encode()).hexdigest() == server.GOLDEN["Task1.hex"], "eelab build Ek B")
    keys = [m["key"] for m in r["mc"]]
    check(keys == ["avail", "compStart", "compOk", "allComp", "usedRam", "usedRom", "linked", "linkedIn", "completed", "finishedOk"], "G-MSG sirasi %r" % keys)
    mc = {m["key"]: m for m in r["mc"]}
    check(mc["avail"]["text"] == "Available RAM: 224 [bytes], Available ROM: 2048 [bytes]" and mc["avail"]["no"] == 1139 and mc["avail"]["type"] == "hint", "G-MSG avail")
    check(mc["compStart"] == dict(mc["compStart"], type="diagnostics", line=0, no=122, unit="Task1.c") and mc["compOk"]["line"] == code1.count("\n") + 1 and mc["compOk"]["no"] == 123, "G-MSG comp")
    rom = r["debug"]["rom"]
    check(mc["usedRom"]["args"] == [rom, int(round(rom * 100.0 / 2048)), 2048 - rom, int(round((2048 - rom) * 100.0 / 2048))] and mc["usedRom"]["no"] == 1144, "G-MSG usedRom")
    check(mc["usedRam"]["args"][0] == r["debug"]["ram"] and mc["usedRam"]["args"][2] == 224 - r["debug"]["ram"], "G-MSG usedRam")
    check(mc["linked"]["unit"] == "Task1.mcppi" and mc["completed"]["args"][0] == "Task1.mcppi" and mc["finishedOk"]["no"] == 103 and mc["finishedOk"]["unit"] == "Task1.mcppi", "G-MSG link/finish")
    check(re.match(r"^Finished successfully: \d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}, \d\d:\d\d:\d\d$", mc["finishedOk"]["text"]) and isinstance(mc["finishedOk"]["ts"], int), "G-MSG tarih %r" % mc["finishedOk"]["text"])
    check(all(set(m) >= {"type", "line", "no", "key", "args", "unit", "text"} for m in r["mc"]), "mc alanlari (K-F5)")
    check(set(r) >= {"ok", "messages", "hex", "hexPath", "fosc", "diag", "debug"}, "eski build alanlari korunur")
    st, r2 = s.post("/api/build", {"name": "Task1.c", "code": code1, "libModel": "mikroc"})
    check(r2["ok"] and r2["libModel"] == "mikroc" and hashlib.md5(r2["hex"].encode()).hexdigest() != server.GOLDEN["Task1.hex"], "mikroc build farkli HEX")
    check(any(c["name"] == "MC_DLY_10000" and c["kind"] == "lib" for c in r2["debug"]["code"]) and r2["debug"]["lines"], "mikroc debug: MC_DLY_10000 kutuphane")
    s.post("/api/settings", {"name": "Task1.c", "libModel": "eelab"})
    st, r = s.post("/api/build", {"name": "Task1.c", "code": code1})
    check(hashlib.md5(r["hex"].encode()).hexdigest() == server.GOLDEN["Task1.hex"], "eelab'a donus Ek B")
    st, r = s.post("/api/build", {"name": "Hata4.c", "code": "void main() {\n\tPORTB = 1\n}\n"})
    ek = [(m["type"], m["line"], m["no"], m["key"], m["args"]) for m in r["mc"] if m["type"] == "error"]
    check(not r["ok"] and ek[0] == ("error", 3, 402, "expected", ["}"]) and ek[0][:4] and r["mc"][[m["key"] for m in r["mc"]].index("expected")]["text"] == "; expected, but '}' found", "G-ERR 402 %r" % ek)
    st, r = s.post("/api/build", {"name": "Hata4.c", "code": "void main() {\n\tfoo = 3;\n}\n"})
    ek = [(m["type"], m["line"], m["no"], m["key"], m["args"]) for m in r["mc"] if m["type"] == "error"]
    check(not r["ok"] and ek[0] == ("error", 2, 324, "undeclared", ["foo"]) and ek[-1][2:4] == (102, "finishedErr"), "G-ERR 324 %r" % ek)
    check(r["mc"][-1]["text"].startswith("Finished (with errors): ") and r["mc"][-1]["unit"] == "Hata4.mcppi", "finishedErr")
    st, r = s.post("/api/build", {"name": "Baud4.c", "code": "void main() {\n\tUART1_Init(9600);\n\tUART1_Write('A');\n\twhile (1) { }\n}\n"})
    b = [m for m in r["mc"] if m["key"] == "baud"]
    check(r["ok"] and len(b) == 1 and {k: b[0][k] for k in ("type", "no", "key", "args", "line", "unit")} == {"type": "warning", "no": 1509, "key": "baud", "args": [9615, "0.16"], "line": 2, "unit": "Baud4.c"}, "G-BAUD %r" % b)
    check(b[0]["text"] == "Generated baud rate is 9615 bps (error = 0.16 percent)" and r["diag"] == [], "G-BAUD metin, diag degismez")
    st, r = s.post("/api/build", {"name": "Baud5.c", "code": "void main() {\n\tUART1_Init(300);\n}\n", "fosc": 20000000})
    check(not r["ok"] and any(m["text"] == "Cannot establish this baud rate at 20.000 MHz clock" and m["line"] == 2 for m in r["mc"]), "baud kurulamaz")
    st, r = s.post("/api/build", {"name": "Cyc4.c", "code": "void main() {\n\tDelay_Cyc(2);\n}\n", "libModel": "mikroc"})
    check(not r["ok"] and r["diag"] == [{"line": 2, "sev": "error", "text": "Argument is out of range"}], "Delay_Cyc aralik %r" % r["diag"])

    st, r = s.post("/api/output", {"name": "Task1.c", "kind": "lst", "text": ";  LST file generated by mikroListExporter - v.2.0\r\n"})
    check(r["ok"] and r["name"] == "Task1.lst" and open(os.path.join(ws, "Task1.lst"), newline="").read().endswith("v.2.0\r\n"), "/api/output lst")
    s.post("/api/output", {"name": "Task1", "kind": "log", "text": "hint: 0 1139 Available RAM\n"})
    check(os.path.isfile(os.path.join(ws, "Task1.log")), "/api/output log (uzantisiz ad)")
    for body, code in (({"name": "Task1.c", "kind": "hex", "text": ""}, 400), ({"name": "../Task1.c", "kind": "lst", "text": ""}, 404),
                       ({"name": "Yok.c", "kind": "lst", "text": ""}, 404), ({"name": "Say.asm", "kind": "asm", "text": "x"}, 400),
                       ({"name": "Task1.c", "kind": "../x", "text": ""}, 400)):
        st, r = s.post("/api/output", body)
        check(st == code and "error" in r, "/api/output red %r -> %d" % (body, st))
    check(open(os.path.join(ws, "Say.asm")).read() != "x", "asm kaynagi korunur")

    st, raw = s.get("/api/export-mcppi?name=Task1.c", raw=True)
    z = zipfile.ZipFile(io.BytesIO(raw))
    names = sorted(z.namelist())
    check(st == 200 and names == ["Task1.c", "Task1.hex", "Task1.log", "Task1.lst", "Task1.mcppi"], "export-mcppi %r" % names)
    mp = z.read("Task1.mcppi").decode()
    check(mp.replace("\r\n", "\n").startswith("[DEVICE]\nName=P16F628A\nClock=4000000\n") and "\r\n" in mp and "[FILES]\r\nFile0=Task1.c\r\nCount=1" in mp, "Task1.mcppi")
    check("[Useses]\r\nCount=0\r\n" in mp and z.read("Task1.c").decode() == code1, "Task1.mcppi Useses / kaynak")
    st, r = s.get("/api/export-mcppi?name=../server.py", raw=True)
    check(st == 404, "export-mcppi kacis")
    st, r = s.post("/api/import-mcppi", {"mcppi": mp, "files": {"Task1.c": z.read("Task1.c").decode()}})
    check(r["ok"] and r["fosc"] == 4000000 and r["name"] == "Task1_2.c" and r["warnings"] == [], "import-mcppi round trip %r" % r)
    st, f = s.get("/api/file?name=Task1_2.c")
    check(f["code"] == code1 and f["fosc"] == 4000000 and f["settings"]["libModel"] == "mikroc", "ice aktarilan dosya")
    fx = os.path.join(ROOT, "tests", "fixtures", "mikroc")
    st, r = s.post("/api/import-mcppi", {"mcppi": open(os.path.join(fx, "Lab_5.mcppi")).read(), "files": {"Lab_5.c": open(os.path.join(fx, "Lab_5.c")).read(), "../kotu.c": "x", "not.txt": "y"}})
    check(r["ok"] and r["name"] == "Lab_5.c" and r["fosc"] == 8000000 and len(r["warnings"]) == 1 and sorted(r["files"]) == ["Lab_5.c", "kotu.c"], "import Lab_5 %r" % r)
    st, r = s.post("/api/build", {"name": "Lab_5.c", "code": open(os.path.join(ws, "Lab_5.c")).read()})
    check(r["ok"] and r["libModel"] == "mikroc" and r["fosc"] == 8000000, "Lab_5 derlenir (mikroc, 8 MHz)")
    st, raw = s.get("/api/export-mcppi?name=Lab_5.c", raw=True)
    mp5 = zipfile.ZipFile(io.BytesIO(raw)).read("Lab_5.mcppi").decode()
    check("[Useses]\r\nFile0=Lcd\r\nFile1=Lcd_Constants\r\nCount=2" in mp5 and mp5 == open(os.path.join(fx, "Lab_5.mcppi"), newline="").read(), "Lab_5 export == fixture")
    st, r = s.post("/api/import-mcppi", {"mcppi": "[DEVICE]\nName=P16F877A\nClock=6000000\n[FILES]\nFile0=C:\\x\\Ana.c\n", "files": {"Ana.c": "void main() { }\n"}})
    check(r["ok"] and r["name"] == "Ana.c" and r["fosc"] == 4000000 and len(r["warnings"]) == 2, "import uyarilari %r" % r)
    st, r = s.post("/api/import-mcppi", {"mcppi": "", "files": {}})
    check(st == 400 and not r["ok"], "bos import")

    st, r = s.post("/api/settings", {"ui": {"lang": "en"}})
    check(st == 200 and r["ui"] == {"lang": "en"}, "ui.lang en")
    st, r = s.post("/api/settings", {"uiLang": "xx"})
    check(st == 400, "ui.lang gecersiz")
    st, r = s.get("/api/info")
    check(r["ui"] == {"lang": "en"} and json.load(open(os.path.join(ws, ".eelab.json")))["ui"] == {"lang": "en"}, ".eelab.json ui")
    st, r = s.post("/api/settings", {"name": "Task1.c", "uiLang": "tr"})
    check(r["ok"] and json.load(open(os.path.join(ws, ".eelab.json")))["ui"] == {"lang": "tr"}, "dosya ayari ile uiLang")
    print("ok   WS-4 HTTP: libModel (D2=B), mc mesajlari (G-MSG/G-ERR/G-BAUD), /api/output, .mcppi disa/ice aktarma, ui.lang")


def main():
    ws4_units()
    tmp = tempfile.mkdtemp(prefix="eelab_st_")
    fake_home = os.path.join(tmp, "user")
    home = os.path.join(tmp, "EE Lab Öğrenci", "EELAB")
    state = os.path.join(tmp, "state")
    old = os.path.join(tmp, "eski_projeler")
    os.makedirs(fake_home)
    os.makedirs(old)
    shutil.copy(os.path.join(ROOT, "projeler", "Task1.c"), old)
    open(os.path.join(old, "Odev.c"), "w").write("void main() {\n\tTRISB = 0;\n\twhile (1) { PORTB++; }\n}\n")
    open(os.path.join(old, "Devre1.json"), "w").write('{"version":1,"parts":[],"wires":[]}')
    open(os.path.join(old, "notlar.txt"), "w").write("kopyalanmamali")
    json.dump({"Odev.c": {"fosc": 8000000}}, open(os.path.join(old, ".ayarlar.json"), "w"))
    os.makedirs(os.path.join(home, "Projelerim"))
    open(os.path.join(home, "Projelerim", "Odev.c"), "w").write("// kullanicinin yeni dosyasi\n")
    old_hash = tree_hash(old)
    env = {"PATH": "/usr/bin:/bin", "HOME": fake_home, "LANG": "en_US.UTF-8", "EELAB_HOME": home, "EELAB_STATE_DIR": state,
           "EELAB_MIGRATE_FROM": old, "EELAB_NO_REVEAL": "1"}
    app_before = tree_hash(os.path.join(ROOT, "projeler"))
    s = Srv(env, ["--launcher"])
    try:
        st, r = s.get("/api/ping")
        check(st == 200 and r["app"] == "EELAB" and r["version"], "ping")
        sj = json.load(open(os.path.join(state, "server.json")))
        check(sj["port"] == s.port and sj["pid"] == s.p.pid and sj["url"].endswith(":%d/" % s.port), "server.json")
        st, r = s.get("/api/info")
        check(r["home"] == home and r["toolchain"]["mode"] in ("native", "rosetta") and "gpasm" in r["toolchain"]["gputils"], "info %r" % r)
        check(r["current"] == "Projelerim" and r["migrated"] and r["migrated"][0]["from"] == old, "info migrated")
        print("ok   ping / info / server.json")

        pj = os.path.join(home, "Projelerim")
        check(sorted(os.listdir(pj)) == [".eelab.json", "Devre1.json", "Odev.c", "Odev_eski.c"], "göç dosyaları %r" % os.listdir(pj))
        check(open(os.path.join(pj, "Odev.c")).read().startswith("// kullanicinin"), "göç ezmedi")
        check(tree_hash(old) == old_hash, "eski klasör değişmedi")
        st, r = s.get("/api/file?name=Odev_eski.c")
        check(r["fosc"] == 8000000 and r["settings"]["fosc"] == 8000000, "göç fosc")
        ex = os.path.join(home, "Ornekler")
        check({"Task1.c", "Lab2.asm", "lab3.json", "Task1.hex"} <= set(os.listdir(ex)), "örnekler")
        exs = json.load(open(os.path.join(ex, ".eelab.json")))["files"]
        check(exs["Task1.c"]["circuit"] == "lab3" and exs["Lab1_LedSwitch.c"]["fosc"] == 8000000, "örnek ayarları")
        check(os.path.isdir(os.path.join(home, "Teslim")), "Teslim")
        print("ok   ilk açılış: örnekler + göç (kopyalandı, ezmedi, eski klasör aynı)")

        st, _ = s.get("/api/ping", headers={"Host": "evil.example:%d" % s.port})
        check(st == 403, "Host GET")
        st, _ = s.post("/api/save", {"name": "x.c", "code": ""}, headers={"Host": "evil.example"})
        check(st == 403, "Host POST")
        st, _ = s.post("/api/save", {"name": "x.c", "code": ""}, headers={"Origin": "http://evil.example"})
        check(st == 403 and not os.path.exists(os.path.join(pj, "x.c")), "Origin POST")
        for p in ("/api/file?name=../server.py", "/api/file?name=..%2Fserver.py", "/api/circuit?name=../../server", "/js/../server.py", "/js/..%2Fserver.py", "/api/hex?name=../x"):
            st, r = s.get(p)
            check(st in (400, 404) and "code" not in r, "kaçış GET " + p)
        for body in ({"name": "../evil.c", "code": "x"}, {"name": "a/b.c", "code": "x"}, {"name": "..", "code": "x"}):
            st, r = s.post("/api/save", body)
            check(st == 400, "kaçış save %r" % body)
        st, r = s.post("/api/workspace", {"action": "create", "name": "../dis"})
        check(st == 400 and not os.path.exists(os.path.join(tmp, "dis")), "kaçış workspace")
        st, r = s.post("/api/rename", {"name": "Odev.c", "to": "../Odev.c"})
        check(st == 400, "kaçış rename")
        print("ok   Host/Origin denetimi + yol kaçışı reddi")

        st, t = s.get("/api/templates")
        ids = [x["id"] for x in t]
        check(len(t) >= 13 and {"blank_c", "blank_asm", "lab1", "lab2", "lab3", "timer0", "rb0_int", "seven_seg", "lcd", "keypad_lcd", "uart", "pwm", "eeprom"} <= set(ids), "templates")
        check(all(x["lang"] in ("c", "asm") and x["fosc"] in (4000000, 8000000, 20000000) and x["title"] for x in t), "template alanları")
        st, r = s.get("/api/template?id=lab1")
        check(r["lang"] == "c" and "PORTB" in r["code"], "template code")
        st, r = s.post("/api/workspace", {"action": "create", "name": "Lab3"})
        check(st == 200 and r["current"] == "Lab3" and "Lab3" in r["folders"] and "Teslim" not in r["folders"], "workspace create")
        st, r = s.get("/api/files")
        check(r["files"] == [] and r["workspace"] == "Lab3", "boş klasör")
        st, r = s.post("/api/new", {"name": "Kronometre", "template": "lab3"})
        check(r["ok"] and r["name"] == "Kronometre.c" and r["circuit"] == "lab3" and r["settings"]["fosc"] == 4000000, "new template %r" % r)
        st, r = s.post("/api/new", {"name": "Say.c", "template": "lab2"})
        check(st == 400, "template dil uyuşmazlığı")
        st, r = s.post("/api/new", {"name": "Say", "template": "lab2", "fosc": 20000000})
        check(r["name"] == "Say.asm" and r["settings"]["fosc"] == 20000000, "new asm template")
        st, r = s.post("/api/new", {"name": "Bos.c"})
        check(r["ok"] and "void main" in open(os.path.join(home, "Lab3", "Bos.c")).read(), "new boş")
        st, r = s.post("/api/new", {"name": "Bos.c"})
        check("error" in r, "new var olan")
        st, r = s.get("/api/files")
        check(r["files"] == ["Bos.c", "Kronometre.c", "Say.asm"] and r["circuit"] == {"Kronometre.c": "lab3", "Say.asm": "lab2"}, "files %r" % r)
        print("ok   şablonlar + çalışma klasörü oluştur + yeni dosya")

        code1 = open(os.path.join(ROOT, "projeler", "Task1.c")).read()
        st, r = s.post("/api/save", {"name": "Task1.c", "code": code1})
        check(r.get("ok"), "save")
        st, r = s.post("/api/settings", {"name": "Task1.c", "fosc": 8000000, "breakpoints": [36], "watches": [{"name": "ones", "fmt": "dec"}], "circuit": "lab3"})
        check(r["ok"] and r["settings"]["fosc"] == 8000000 and r["settings"]["breakpoints"] == [36] and r["fosc"] == 8000000, "settings")
        st, r = s.post("/api/settings", {"name": "Task1.c", "fosc": 4000000, "config": "0x3F10"})
        check(r["settings"]["breakpoints"] == [36] and r["settings"]["circuit"] == "lab3" and r["settings"]["config"] == 0x3F10 and r["settings"]["fosc"] == 4000000, "settings birleşir")
        st, r = s.post("/api/settings", {"name": "Task1.c", "fosc": 1234})
        check(r["settings"]["fosc"] == 4000000, "geçersiz fosc yok sayılır")
        st, r = s.get("/api/file?name=Task1.c")
        check(r["code"] == code1 and r["settings"]["watches"][0]["name"] == "ones" and r["lang"] == "c", "file + settings")
        eel = json.load(open(os.path.join(home, "Lab3", ".eelab.json")))
        check(eel["version"] == 1 and "Task1.c" in eel["files"], ".eelab.json")
        print("ok   kaydet/aç + .eelab.json ayarları")

        st, r = s.post("/api/build", {"name": "Task1.c", "code": code1, "fosc": 4000000})
        check(r["ok"] and hashlib.md5(r["hex"].encode()).hexdigest() == server.GOLDEN["Task1.hex"], "Task1 md5")
        check(r["hexPath"] == os.path.join(home, "Lab3", "Task1.hex") and r["diag"] == [], "hexPath/diag")
        d = r["debug"]
        check(d["lang"] == "c" and d["file"] == "Task1.c" and d["lines"] and d["rom"] == 488 and d["config"] == 0x3F10 and d["ram"] > 0, "debug alanları")
        check([a for a, _ in d["lines"]] == sorted(a for a, _ in d["lines"]), "lines artan")
        check(all(r0 < r1 for r0, r1, _ in d["ranges"]), "ranges")
        mem = server.hex_words(r["hex"])
        ln = code1.split("\n").index("\t\t\tones++;") + 1
        ones = [x for x in d["symbols"] if x["name"] == "ones"]
        check(len(ones) == 1 and ones[0]["kind"] == "var" and ones[0]["size"] == 2 and ones[0]["raw"] == "_ones", "ones sembolü")
        bp = [a for a, l in d["lines"] if l == ln]
        rng = [x for x in d["ranges"] if x[2] == ln]
        incf = 0x0A80 | (ones[0]["addr"] & 0x7F)
        check(bp and rng and rng[0][0] == bp[0], "ones++ satırı eşlendi")
        check(any(mem.get(a) == incf for a0, a1, _ in rng for a in range(a0, a1)), "ones++ aralığında incf ones,f")
        lstrow = [x for x in d["lst"].splitlines() if x.startswith("%06x" % bp[0])]
        check(lstrow and int(lstrow[0].split()[1], 16) == mem[bp[0]], "lst ↔ hex")
        main = [x for x in d["symbols"] if x["name"] == "main"]
        check(main and main[0]["kind"] == "func" and not main[0]["lib"] and mem.get(1, 0) & 0x3800 == 0x2800, "main")
        check(r["configSource"] == "settings" and d["code"] and sum(c["words"] for c in d["code"]) == d["rom"], "debug.code toplamı = ROM")
        check(any(c["name"] == "main" and c["kind"] == "user" for c in d["code"]) and any(c["name"] == "mc_delay_ms" and c["kind"] == "lib" for c in d["code"]), "debug.code türleri")
        st, r = s.post("/api/settings", {"name": "Task1.c", "config": 0x3F14})
        check(r["settings"]["config"] == 0x3F14, "config ayarı")
        st, r = s.post("/api/build", {"name": "Task1.c", "code": code1})
        check(r["ok"] and r["debug"]["config"] == 0x3F14 and server.hex_summary(r["hex"])["config"] == 0x3F14 and r["configSource"] == "settings", "build config word'ü uygular")
        check(server.hex_summary(open(os.path.join(home, "Lab3", "Task1.hex")).read())["config"] == 0x3F14, "diskteki HEX de")
        st, r = s.post("/api/settings", {"name": "Task1.c", "config": None})
        check("config" not in r["settings"], "config null → silinir")
        st, r = s.post("/api/build", {"name": "Task1.c", "code": code1})
        check(r["ok"] and hashlib.md5(r["hex"].encode()).hexdigest() == server.GOLDEN["Task1.hex"] and r["configSource"] == "default", "varsayılan → Ek B md5")
        st, r = s.post("/api/settings", {"name": "Say.asm", "config": "0x3F14"})
        st, r = s.post("/api/build", {"name": "Say.asm", "code": open(os.path.join(home, "Lab3", "Say.asm")).read()})
        check(r["ok"] and r["debug"]["config"] == 0x3F14 and r["configSource"] == "settings", "asm: config HEX'e yamalanır")
        hx = server.set_config_hex(":020000000528D1\n:00000001FF\n", 0x3F14)
        check(hx == ":020000000528D1\n:02400E00143F5D\n:00000001FF\n", "set_config_hex ekler %r" % hx)
        check(server.set_config_hex(hx, 0x3F10).count(":02400E00103F61") == 1, "set_config_hex değiştirir")
        print("ok   config bitleri (S2): build uygular, varsayılan md5 korunur, asm yaması, debug.code")
        for a, l in d["lines"]:
            check(a < 0x800 and 1 <= l <= code1.count("\n") + 1, "satır aralığı")
        print("ok   build Task1.c: md5 = Ek B, ones++ (satır %d) -> 0x%03X, incf 0x%04X bulundu" % (ln, bp[0], incf))

        asm = open(os.path.join(ROOT, "projeler", "Lab2.asm")).read()
        st, r = s.post("/api/build", {"name": "Lab2.asm", "code": asm})
        check(r["ok"] and hashlib.md5(r["hex"].encode()).hexdigest() == server.GOLDEN["Lab2.hex"], "Lab2 md5")
        d = r["debug"]
        mem = server.hex_words(r["hex"])
        lt = [x for x in d["symbols"] if x["name"] == "loopTop"]
        check(lt and lt[0]["kind"] == "label", "loopTop etiketi")
        src = asm.split("\n")
        hit = [l for a, l in d["lines"] if a == lt[0]["addr"]]
        check(hit and src[hit[0] - 1].strip().lower().startswith("movlw 0x01") and mem[lt[0]["addr"]] == 0x3001, "loopTop satırı ↔ movlw 0x01")
        cnt = [x for x in d["symbols"] if x["name"] == "cnt"]
        check(cnt and cnt[0]["kind"] == "var" and cnt[0]["addr"] == 0x35, "asm değişken cnt")
        check(not [x for x in d["symbols"] if x["name"] in ("PORTB", "STATUS", "_WDT_OFF")], "include sabitleri yok")
        check(d["rom"] == 45 and d["lang"] == "asm", "asm rom")
        print("ok   build Lab2.asm: md5 = Ek B, loopTop -> satır %d" % hit[0])

        st, r = s.post("/api/build", {"name": "Hata.c", "code": "void main() {\n\tint a;\n\tunsigned char b = 300;\n\tfoo = 3;\n\twhile (1) { }\n}\n"})
        check(not r["ok"] and {"line": 4, "sev": "error"}.items() <= r["diag"][0].items(), "diag C %r" % r["diag"])
        st, r = s.post("/api/build", {"name": "Hata.asm", "code": "\tlist p=16f628A\n#include <p16F628A.inc>\n\tmovwf yok\n\tend\n"})
        check(not r["ok"] and r["diag"] and r["diag"][0]["line"] == 3 and r["diag"][0]["sev"] == "error", "diag asm %r" % r["diag"])
        st, r = s.post("/api/build", {"name": "Uyari.c", "code": "void main() {\n\tunsigned char b = 300;\n\tPORTB = b;\n\twhile (1) { }\n}\n"})
        check(r["ok"] and r["diag"] == [{"line": 2, "sev": "warning", "text": "overflow in implicit constant conversion"}], "diag uyarı %r" % r["diag"])
        print("ok   diag (C hata/uyarı, asm hata)")

        shutil.copy(os.path.join(ROOT, "tests", "fixtures", "Lab3.pdsprj"), os.path.join(home, "Lab3", "Lab3.pdsprj"))
        st, r = s.post("/api/import-pdsprj?save=Kopya", open(os.path.join(ROOT, "tests", "fixtures", "Lab3.pdsprj"), "rb").read())
        check(st == 200 and (("error" in r) or (r.get("saved") == "Kopya.pdsprj" and os.path.isfile(os.path.join(home, "Lab3", "Kopya.pdsprj")))), "import-pdsprj")
        st, r = s.post("/api/import-pdsprj", b"bozuk")
        check(st == 200 and "error" in r, "bozuk pdsprj")
        st, r = s.post("/api/export", {"student": {"ad": "Ayşe Yılmaz", "no": "S040141"}, "files": ["Task1.c", "Task1.hex", "lab3.json", "Lab3.pdsprj", "../server.py", "Yok.c"],
                                       "stripComments": True, "svg": "<svg xmlns='http://www.w3.org/2000/svg'/>", "pngBase64": "data:image/png;base64,iVBORw0KGgo="})
        check(st == 200 and r["ok"] and r["path"] == os.path.join(home, "Teslim", "S040141.zip") and set(r["missing"]) == {"../server.py", "Yok.c"}, "export %r" % r)
        z = zipfile.ZipFile(r["path"])
        names = z.namelist()
        check(names == sorted(names) and set(names) == {"BENIOKU.txt", "Lab3.pdsprj", "Task1.c", "Task1.hex", "lab3.json", "sema.png", "sema.svg"}, "zip içeriği %r" % names)
        c = z.read("Task1.c").decode()
        check("//" not in c and "/*" not in c and "ones++;" in c and "\n\n\n" not in c, "yorumlar kaldırıldı")
        check(z.read("Task1.hex") == open(os.path.join(home, "Lab3", "Task1.hex"), "rb").read(), "hex aynı")
        check(z.read("lab3.json") == open(os.path.join(ROOT, "circuits", "lab3.json"), "rb").read(), "devre json")
        check(z.read("Lab3.pdsprj") == open(os.path.join(ROOT, "tests", "fixtures", "Lab3.pdsprj"), "rb").read(), "pdsprj")
        check(z.read("sema.png").startswith(b"\x89PNG"), "png")
        rd = z.read("BENIOKU.txt").decode()
        check("S040141" in rd and "Ayşe Yılmaz" in rd and "0x3F10" in rd and "4 MHz" in rd and "ROM 488" in rd, "BENIOKU %r" % rd)
        st, r2 = s.post("/api/build", {"name": "Temiz.c", "code": c})
        check(r2["ok"] and r2["hex"] == open(os.path.join(home, "Lab3", "Task1.hex")).read(), "yorumsuz kod aynı HEX")
        st, r = s.post("/api/export", {"name": "Kod", "files": ["Lab2.asm"], "readme": False})
        z = zipfile.ZipFile(r["path"])
        check(z.namelist() == ["Lab2.asm"] and z.read("Lab2.asm").decode() == asm.replace("\r\n", "\n"), "export yorumlu, BENIOKU'suz")
        st, r = s.post("/api/export", {"files": []})
        check(st == 400 and "error" in r, "boş export")
        st, r = s.post("/api/export-file", {"name": "sema", "ext": "svg", "text": "<svg/>"})
        check(r["ok"] and open(os.path.join(home, "Lab3", "sema.svg")).read() == "<svg/>", "export-file")
        st, r = s.post("/api/export-file", {"name": "../x", "ext": "svg", "text": ""})
        check(st == 400, "export-file kaçış")
        print("ok   teslim zip'i S040141.zip (yorumsuz kod derlenince aynı HEX) + export-file")

        st, r = s.post("/api/rename", {"name": "Bos.c", "to": "Bos2"})
        check(r["ok"] and r["name"] == "Bos2.c" and os.path.isfile(os.path.join(home, "Lab3", "Bos2.c")), "rename")
        st, r = s.post("/api/duplicate", {"name": "Kronometre.c", "to": "Kron2.c"})
        st, f = s.get("/api/file?name=Kron2.c")
        check(r["ok"] and f["settings"]["circuit"] == "lab3", "duplicate + ayar")
        st, r = s.post("/api/rename", {"name": "Kron2.c", "to": "Say.asm"})
        check(st == 400, "rename uzantı")
        st, r = s.post("/api/delete", {"name": "Kron2.c"})
        check(r["ok"] and not os.path.exists(os.path.join(home, "Lab3", "Kron2.c")) and any(x.endswith("Kron2.c") for x in os.listdir(os.path.join(home, ".Silinenler"))), "delete -> .Silinenler")
        s.post("/api/circuit-save", {"name": "Devre2", "circuit": {"version": 1, "parts": []}})
        st, r = s.get("/api/circuits")
        check("Devre2" in r["workspace"] and "lab3" in r["examples"], "circuits")
        st, r = s.post("/api/circuit-delete", {"name": "Devre2"})
        check(r["ok"] and not os.path.exists(os.path.join(home, "Lab3", "Devre2.json")), "circuit-delete")
        st, r = s.post("/api/circuit-delete", {"name": "lab3"})
        check(st == 404, "örnek devre silinmez")
        st, r = s.get("/api/libs")
        fn = {x["name"]: x for x in r["functions"]}
        check({"Lcd_Out", "UART1_Init", "Delay_ms", "Button", "EEPROM_Write"} <= set(fn) and "PORTB" in r["sfrs"] and "T0IF" in r["bits"]["INTCON"] and "_LCD_CLEAR" in r["constants"], "libs")
        check(all(x["key"] is None or x["key"] in server.LIBDEPS for x in r["functions"]), "libs ↔ LIBS")
        check("RB0_bit" in r["sbits"] and "TRISB4_bit" in r["sbits"] and all(x["sig"] and x["desc"] and x["group"] for x in r["functions"]), "libs sbits/imza")
        st, r = s.get("/api/hex?name=Task1")
        check(r["hex"].startswith(":"), "hex")
        st, r = s.post("/api/reveal", {"folder": "Teslim"})
        check(r["ok"] and r["opened"] is False, "reveal (test kipinde açılmaz)")
        for p in ("/", "/js/pic.js", "/circuits/lab3.json"):
            st, b = s.get(p, raw=True)
            check(st == 200 and b, "statik " + p)
        print("ok   rename/duplicate/delete, circuits, libs, hex, reveal, statik")
        ws4_http(s, os.path.join(home, "Lab3"))
    finally:
        s.stop()
    check(not os.path.exists(os.path.join(state, "server.json")), "server.json silindi")
    st_json = json.load(open(os.path.join(state, "state.json")))
    check(st_json["current"] == "Lab3" and st_json["migrated"] == [old], "state.json")

    open(os.path.join(old, "Yeni.c"), "w").write("void main() { }\n")
    os.remove(os.path.join(home, "Projelerim", "Odev_eski.c"))
    open(os.path.join(home, "Projelerim", "Devre1.json"), "w").write("{}")
    s = Srv(env)
    try:
        st, r = s.get("/api/workspace")
        check(r["current"] == "Lab3", "ikinci açılış klasörü hatırlar")
        pj = sorted(os.listdir(os.path.join(home, "Projelerim")))
        check(pj == [".eelab.json", "Devre1.json", "Odev.c"] and open(os.path.join(home, "Projelerim", "Devre1.json")).read() == "{}", "ikinci açılışta göç tekrarlanmaz %r" % pj)
        st, r = s.post("/api/workspace", {"action": "open", "name": "Yok"})
        check(st == 404, "olmayan klasör")
        st, r = s.post("/api/workspace", {"action": "open", "name": "Ornekler"})
        check(r["current"] == "Ornekler", "örnekler aç")
        st, r = s.get("/api/file?name=Lab1_LedSwitch.c")
        check(r["fosc"] == 8000000 and r["settings"]["circuit"] == "lab1_led_switch", "örnek eşleme")
    finally:
        s.stop()
    print("ok   ikinci açılış: göç tekrarlanmadı, son klasör hatırlandı")
    check(not os.path.exists(os.path.join(state, "server.json")), "launcher olmayan kip server.json yazmaz")
    check(tree_hash(os.path.join(ROOT, "projeler")) == app_before, "uygulama klasörüne yazılmadı")

    p = subprocess.run([PY, "-B", os.path.join(ROOT, "server.py"), "--selftest"], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600)
    r = json.loads(p.stdout.decode())
    check(p.returncode == 0 and r["ok"] and r["app"] == "EELAB" and len(r["results"]) == 11 and all(x["match"] for x in r["results"]), "selftest %r" % r)
    print("ok   --selftest: %d dosya md5 = Ek B (%s, %s)" % (len(r["results"]), r["toolchain"]["mode"], r["arch"]))
    shutil.rmtree(tmp, ignore_errors=True)
    print("\nserver_test: %d denetim geçti (%s)" % (OK[0], PY))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except AssertionError as e:
        print("FAIL " + str(e))
        sys.exit(1)
