#!/usr/bin/env python3
"""EELAB - mikroC uyumlu kod editörü + devre simülatörü (yerel sunucu)."""
import argparse, ast, base64, hashlib, http.server, io, json, os, platform, re, shutil, signal, socket, subprocess, sys, tempfile, threading, time, urllib.request, webbrowser, zipfile
from urllib.parse import urlparse, parse_qs

APP = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, APP)
import eelab_paths

TC = eelab_paths.toolchain_dir(APP)
SHIM = os.path.join(APP, "shim")
HOME = eelab_paths.default_home()
PROJ = os.path.join(HOME, "Projelerim")
PATHS = None
PORT = 8321
URL = "http://127.0.0.1:%d/" % PORT
NAME_RE = re.compile(r"^[A-Za-z0-9_\-]{1,40}$")
DATA_RE = re.compile(r"^([A-Za-z0-9_\-]{1,40})\.(c|asm|hex|json|pdsprj)$")
MAX_BODY = 32 * 1024 * 1024
LOCK = threading.RLock()
last_ping = [time.time()]
LAUNCHER = [False]

STARTER = """int ones = 0;

void main() {
\tPCON.OSCF = 1;
\tCMCON = 0x07;
\tTRISA = 0xF0;
\tTRISB = 0x00;
\tPORTA = 0x00;
\tPORTB = 0x00;

\twhile(1) {
\t\tdelay_ms(100);
\t\tPORTB = ones;

\t\tones++;
\t\tif(ones == 10) {
\t\t\tones = 0;
\t\t}
\t}
}
"""


STARTER_ASM = """\tlist\tp=16f628A
#include <p16F628A.inc>
\t__CONFIG _INTRC_OSC_NOCLKOUT & _WDT_OFF & _PWRTE_ON & _MCLRE_OFF & _LVP_OFF

\torg\t0x0000
\tgoto\tbasla

basla:
\tmovlw\t0x07
\tmovwf\tCMCON
\tbanksel\tTRISB
\tclrf\tTRISB
\tbanksel\tPORTB
\tclrf\tPORTB
dongu:
\tincf\tPORTB, f
\tgoto\tdongu

\tend
"""

FILE_RE = re.compile(r"^([A-Za-z0-9_\-]{1,40})\.(c|asm)$")
SETTINGS = os.path.join(PROJ, ".ayarlar.json")
FOSCS = (4000000, 8000000, 20000000)
LIB_MODEL_DEFAULT = "eelab"
GOLDEN = {
    "Eeprom_Demo.hex": "7a87477588daee23ac1e07dac97afd1d",
    "Keypad_Demo.hex": "5cc234d24771ebf1b17ecbb556da62db",
    "Lab1_LedSwitch.hex": "bfa6e92635deb9ccf23605db12bc7be7",
    "Lab2.hex": "98b06a9c4e2d555b0e2bf45864266638",
    "Lcd_Demo.hex": "aef7dc2e42981944829c3b4e291359f9",
    "Mux4_Demo.hex": "72abfc23b02cc3f5567130db03a83b64",
    "Pwm_Demo.hex": "26dfdf732c56fa7bdcaae05ed77d2d60",
    "Task1.hex": "99437e695fd25fb340041117b14fee2c",
    "Task2.hex": "ad023cded4811665dcc6fc2e1fe2f03d",
    "Timer0_Interrupt.hex": "5ed819ec9016927d3b20dba4c52046c8",
    "Uart_Demo.hex": "1123e193112c79127408e2336d5011c5",
}


def fname(name):
    name = str(name or "")
    if NAME_RE.match(name):
        name += ".c"
    m = FILE_RE.match(name)
    return (m.group(1), m.group(2)) if m else None


def _version():
    try:
        with open(os.path.join(APP, "VERSION")) as f:
            return f.read().strip() or "dev"
    except OSError:
        return "dev"


def set_workspace(path):
    global PROJ, SETTINGS
    PROJ = path
    SETTINGS = os.path.join(path, ".ayarlar.json")


def _settings_new():
    return os.path.join(os.path.dirname(SETTINGS), ".eelab.json")


def all_settings():
    out = {}
    old = eelab_paths.read_json(SETTINGS, {})
    if isinstance(old, dict):
        for k, v in old.items():
            if isinstance(v, dict):
                out[k] = dict(v)
    new = eelab_paths.read_json(_settings_new(), {})
    if isinstance(new, dict) and isinstance(new.get("files"), dict):
        for k, v in new["files"].items():
            if isinstance(v, dict):
                out.setdefault(k, {}).update(v)
    return out


def settings():
    return all_settings()


def file_settings(fn):
    s = dict(all_settings().get(fn, {}))
    s["fosc"] = s.get("fosc") if s.get("fosc") in FOSCS else 4000000
    s["libModel"] = s.get("libModel") if s.get("libModel") in ("eelab", "mikroc") else LIB_MODEL_DEFAULT
    return s


def _safe_const(node):
    if isinstance(node, ast.Expression):
        return _safe_const(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
        return node.value
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        v = _safe_const(node.operand)
        return v if isinstance(node.op, ast.UAdd) else -v
    if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv)):
        a, b = _safe_const(node.left), _safe_const(node.right)
        if isinstance(node.op, ast.Add):
            return a + b
        if isinstance(node.op, ast.Sub):
            return a - b
        if isinstance(node.op, ast.Mult):
            return a * b
        if b == 0:
            raise ValueError("division by zero")
        if isinstance(a, int) and isinstance(b, int):
            q = abs(a) // abs(b)
            return q if (a >= 0) == (b >= 0) else -q
        return a / b
    raise ValueError("not a constant expression")


C_INT_RE = re.compile(r"\b(0[xX][0-9a-fA-F]+|0[bB][01]+|\d+(?:\.\d*)?(?:[eE][-+]?\d+)?)([uUlLfF]*)\b")


def c_const(expr, defines=None, depth=0):
    """C sabit ifadesini (sayilar, + - * / ve parantez; #define adlari) degerlendirir; olmazsa None."""
    expr = str(expr).strip()
    if not expr or depth > 8 or not re.match(r"^[\w\s\.\+\-\*/\(\)]+$", expr):
        return None
    for name in sorted(set(re.findall(r"\b[A-Za-z_]\w*\b", expr)), key=len, reverse=True):
        if name in "uUlLfFxXbBeE" and not (defines and name in defines):
            continue
        if not defines or name not in defines:
            return None
        v = c_const(defines[name], defines, depth + 1)
        if v is None:
            return None
        expr = re.sub(r"\b%s\b" % name, "(%r)" % v, expr)

    def lit(m):
        t = m.group(1)
        if t[:2] in ("0x", "0X"):
            return str(int(t, 16))
        if t[:2] in ("0b", "0B"):
            return str(int(t[2:], 2))
        if re.match(r"^0\d+$", t):
            return str(int(t, 8))
        return t
    try:
        return _safe_const(ast.parse(C_INT_RE.sub(lit, expr), mode="eval"))
    except (SyntaxError, ValueError, TypeError, RecursionError):
        return None


def c_defines(code):
    out = {}
    for m in re.finditer(r"^[ \t]*#[ \t]*define[ \t]+([A-Za-z_]\w*)[ \t]+([^\n]+)$", _strip(code), re.M):
        out[m.group(1)] = m.group(2).strip()
    return out


# Delay_ms/Delay_us/Delay_Cyc tam cevrim modeli (libModel 'mikroc').
# mikroC deseni: 1, 2 ya da 3 ic ice DECFSZ/GOTO dongusu + NOP dolgusu. Sayaclar ortak bankta degil
# (SDCC 0x70-0x7F'nin tamamini STK00-12/WSAVE/SSAVE/PSAVE icin kullanir): mc_xd[3] dizisi + tek BANKSEL (2 Tcy).
# cevrim < 4: yerinde NOP / goto $+1; aksi halde MC_DLY_<n>() cagrisi: CALL 2 + govde + RETURN 2 = n.
DLY_L2 = 770
DLY_L3 = 197122
DLY_PAD = 8
DLY_MAX3 = 3 * 256 + DLY_L2 * 255 + DLY_L3 * 255 + 9


def _dly_solve(x):
    """x cevrimi (ilk MOVLW'den dolgunun sonuna) icin (sayaclar [r13, r12, r11], dolgu)."""
    if x < 4:
        return [], x
    for lv in (1, 2, 3):
        for p in range(DLY_PAD + 1):
            if lv == 1:
                r = x - 1 - p
                if r % 3 == 0 and 1 <= r // 3 <= 256:
                    return [r // 3], p
                continue
            r = x - (5 if lv == 2 else 9) - p
            if r < 3:
                continue
            cs = [1] if lv == 2 else [c for c in range((r - 197118) // DLY_L3 + 1, (r - 3) // DLY_L3 + 2) if 1 <= c <= 256]
            for c in cs:
                r3 = r - DLY_L3 * (c - 1)
                for b in range(max(1, (r3 - 768) // DLY_L2 + 1), min(256, (r3 - 3) // DLY_L2 + 1) + 1):
                    r2 = r3 - DLY_L2 * (b - 1)
                    if 3 <= r2 <= 768 and r2 % 3 == 0:
                        return ([r2 // 3, b] if lv == 2 else [r2 // 3, b, c]), p
    raise ValueError("gecikme cevrimi cozulmedi: %d" % x)


def _pad_asm(p):
    if p <= 2:
        return ["nop"] * p
    return ["goto\t$+1"] * (p // 2) + ["nop"] * (p % 2)


def delay_plan(cycles):
    """`cycles` Tcy'lik tam gecikme plani: {'call', 'cycles', 'blocks':[[sayaclar, dolgu]...], 'banksel', 'asm':[...]}.
    call=True ise asm, MC_DLY_<n> fonksiyonunun govdesidir (RETURN haric); CALL+RETURN 4 Tcy plana dahildir."""
    cycles = int(cycles)
    if cycles < 0:
        raise ValueError("negatif gecikme")
    if cycles < 4:
        return {"cycles": cycles, "call": False, "banksel": False, "blocks": [[[], cycles]], "asm": _pad_asm(cycles)}
    x = cycles - 4
    if x <= DLY_PAD:
        return {"cycles": cycles, "call": True, "banksel": False, "blocks": [[[], x]], "asm": _pad_asm(x)}
    x -= 2
    blocks = []
    while x > DLY_MAX3:
        blocks.append([[256, 256, 256], 0])
        x -= DLY_MAX3
    blocks.append(list(_dly_solve(x)))
    reg = ("_mc_xd", "(_mc_xd + 1)", "(_mc_xd + 2)")
    asm = ["BANKSEL\t_mc_xd"]
    for i, (cnt, pad) in enumerate(blocks):
        lab = "mc_dly_%d_%d" % (cycles, i)
        for k in range(len(cnt) - 1, -1, -1):
            asm += ["movlw\t%d" % (cnt[k] & 255), "movwf\t%s" % reg[k]]
        if cnt:
            asm.append(lab + ":")
            for k in range(len(cnt)):
                asm += ["decfsz\t%s, f" % reg[k], "goto\t" + lab]
        asm += _pad_asm(pad)
    return {"cycles": cycles, "call": True, "banksel": True, "blocks": blocks, "asm": asm}


def _dly_stmt(cycles, used):
    """Delay cagrisinin yerine konacak tek-satir ifade (ardindan kullanicinin ';' isareti gelir)."""
    if cycles <= 0:
        return "do { } while (0)"
    pl = delay_plan(cycles)
    if pl["call"]:
        used.add(cycles)
        return "MC_DLY_%d()" % cycles
    parts = ["__asm %s __endasm" % a.replace("\t", " ") for a in pl["asm"]]
    return parts[0] if len(parts) == 1 else "do { %s; } while (0)" % "; ".join(parts)


def dly_cycles(kind, n, fosc):
    """Delay_ms(n) -> n*fosc/4000, Delay_us(n) -> n*fosc/4e6 (yuvarlanir), Delay_Cyc(n) -> 10n."""
    from fractions import Fraction
    if kind == "cyc":
        return 10 * int(n)
    v = Fraction(n) * fosc / (4000 if kind == "ms" else 4000000)
    return int(v + Fraction(1, 2)) if v >= 0 else -int(-v + Fraction(1, 2))


DLY_CALL_RE = re.compile(r"\b(?:([Dd]elay_ms|[Dd]elay_us|Delay_Cyc)|Delay_(\d+)(ms|us)|(Delay_1sec))\s*\(")
SKIP_RE = re.compile(r"\"(?:\\.|[^\"\\\n])*\"|'(?:\\.|[^'\\\n])*'|//[^\n]*|/\*.*?\*/", re.S)


def _call_args(code, i):
    """code[i] == '(' -> (arguman metni, kapanis+1) ya da None (satir asarsa)."""
    depth, j = 0, i
    while j < len(code):
        ch = code[j]
        if ch == "\n":
            return None
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return code[i + 1:j], j + 1
        j += 1
    return None


def exact_delays(code, fosc, defines=None):
    """Sabit argumanli gecikmeleri tam cevrimli MC_DLY_<n>() cagrilarina cevirir. -> (kod, {cevrimler}, [(satir, hata)])."""
    used, errs, out, pos = set(), [], [], 0
    skips = [(m.start(), m.end()) for m in SKIP_RE.finditer(code)]
    k = 0
    for m in DLY_CALL_RE.finditer(code):
        while k < len(skips) and skips[k][1] <= m.start():
            k += 1
        if (k < len(skips) and skips[k][0] <= m.start() < skips[k][1]) or m.start() < pos:
            continue
        ca = _call_args(code, m.end() - 1)
        if ca is None:
            continue
        arg, end = ca
        line = code.count("\n", 0, m.start()) + 1
        if m.group(1):
            kind = "ms" if m.group(1).lower().endswith("ms") else "us" if m.group(1).lower().endswith("us") else "cyc"
            n = c_const(arg, defines)
            if n is None:
                continue
            if kind == "cyc" and not (isinstance(n, int) and 3 <= n <= 255) or n < 0:
                errs.append((line, "Argument is out of range"))
                continue
        else:
            if arg.strip():
                continue
            kind, n = ("ms", 1000) if m.group(4) else (m.group(3), int(m.group(2)))
        out.append(code[pos:m.start()])
        out.append(_dly_stmt(dly_cycles(kind, n, fosc), used))
        pos = end
    out.append(code[pos:])
    return "".join(out), used, errs


LCD_DELAYS = (("MC_XD_1US", "us", 1), ("MC_XD_50US", "us", 50), ("MC_XD_5500US", "us", 5500))


def dly_header(used, fosc, lcd=False):
    used = set(used)
    lines = ["/* EELAB: tam cevrimli gecikmeler (libModel mikroc), Fosc %d Hz */" % fosc]
    macros = []
    if lcd:
        for name, kind, n in LCD_DELAYS:
            macros.append("#define %s() %s" % (name, _dly_stmt(dly_cycles(kind, n, fosc), used)))
    plans = [delay_plan(c) for c in sorted(used)]
    if any(p["banksel"] for p in plans):
        lines.append("unsigned char mc_xd[3];")
    for p in plans:
        lines.append("void MC_DLY_%d(void) {\n__asm\n%s\n__endasm;\n}" % (p["cycles"], "\n".join(("\t" + a) if not a.endswith(":") else a for a in p["asm"])))
    return "\n".join(lines + macros) + "\n"


def uart_baud(fosc, baud):
    """mikroc.h MC_BRGH/MC_SPBRG ile ayni secim -> (brgh, spbrg, gercek baud) ya da None (kurulamaz)."""
    baud = int(baud)
    if baud <= 0:
        return None
    if fosc // (16 * baud) <= 256:
        brgh, x = 1, (fosc + 8 * baud) // (16 * baud) - 1
    else:
        brgh, x = 0, (fosc + 32 * baud) // (64 * baud) - 1
    if not 0 <= x <= 255:
        return None
    return brgh, x, fosc / ((16 if brgh else 64) * (x + 1))


def pwm_ok(fosc, freq):
    freq = int(freq)
    if freq <= 0:
        return False
    x1, x16 = fosc // (4 * freq), fosc // (4 * freq * 16)
    return x1 >= 1 and x16 <= 256


def lib_checks(code, fosc, defines=None):
    """UART1_Init / PWM1_Init sabit argumanlari: -> ([mc ipucu], [(satir, hata)])."""
    hints, errs = [], []
    for m in re.finditer(r"\b(UART1?_Init|PWM1_Init)\s*\(", code):
        ca = _call_args(code, m.end() - 1)
        n = c_const(ca[0], defines) if ca else None
        if n is None:
            continue
        line = code.count("\n", 0, m.start()) + 1
        if m.group(1) == "PWM1_Init":
            if not pwm_ok(fosc, n):
                errs.append((line, "Argument is out of range"))
            continue
        b = uart_baud(fosc, n)
        if b is None:
            errs.append((line, "Cannot establish this baud rate at %.3f MHz clock" % (fosc / 1e6)))
            continue
        real = int(round(b[2]))
        hints.append({"line": line, "baud": real, "err": "%.2f" % abs((b[2] - n) * 100.0 / n), "brgh": b[0], "spbrg": b[1]})
    return hints, errs


def _clean_setting(k, v):
    if k == "fosc":
        try:
            v = int(v)
        except (TypeError, ValueError):
            return None
        return v if v in FOSCS else None
    if k == "libModel": return v if v in ("eelab", "mikroc") else None
    if k == "uiLang": return v if v in ("tr", "en") else None
    if k == "circuit":
        if v in (None, ""):
            return ""
        return v if isinstance(v, str) and NAME_RE.match(v) else None
    if k == "config":
        if v is None:
            return None
        try:
            v = int(v, 0) if isinstance(v, str) else int(v)
        except (TypeError, ValueError):
            return None
        return v if 0 <= v <= 0x3FFF else None
    if k in ("watches", "breakpoints"):
        if not isinstance(v, list) or len(json.dumps(v)) > 65536:
            return None
        return v
    return None


SETTING_KEYS = ("fosc", "circuit", "config", "watches", "breakpoints", "libModel")


def update_settings(fn, patch, remove=False):
    with LOCK:
        p = _settings_new()
        data = eelab_paths.read_json(p, {})
        if not isinstance(data, dict) or not isinstance(data.get("files"), dict):
            data = {"version": 1, "files": {}}
        data["version"] = 1
        lang = patch.get("uiLang")
        if isinstance(patch.get("ui"), dict):
            lang = patch["ui"].get("lang", lang)
        lang = _clean_setting("uiLang", lang)
        if lang:
            data.setdefault("ui", {})["lang"] = lang
        files = data["files"]
        if remove:
            files.pop(fn, None)
        else:
            cur = files.setdefault(fn, {})
            for k in SETTING_KEYS:
                if k in patch:
                    v = _clean_setting(k, patch[k])
                    if v is not None:
                        cur[k] = v
                    elif k == "config" and patch[k] is None:
                        cur.pop(k, None)
        eelab_paths.write_json(p, data)
    return file_settings(fn)


def get_fosc(fn):
    return file_settings(fn)["fosc"]


def set_fosc(fn, fosc):
    update_settings(fn, {"fosc": fosc})


def _hdr_bits():
    h = open(os.path.join(TC, "nonfree", "pic14", "pic16f628a.h")).read()
    sfrs = set(re.findall(r"extern __at\(0x[0-9A-F]+\) __sfr (\w+);", h))
    bits = {}
    for m in re.finditer(r"typedef (?:union|struct)\s*\{(.*?)\}\s*__(\w+)bits_t;", h, re.S):
        bits[m.group(2)] = set(n for n in re.findall(r"unsigned\s+(\w+)\s*:\s*1;", m.group(1)))
    return sfrs, bits


SFRS, BITS = _hdr_bits()

LIBS = [
    ("DELAY_MS", r"\b(?:[Dd]elay_ms|V[Dd]elay_ms|Delay_\d+ms|Delay_1sec)\b", []),
    ("DELAY_K", r"\b(?:[Dd]elay_us|Delay_Cyc|Delay_\d+us)\b", []),
    ("BUTTON", r"\bButton\s*\(", ["DELAY_MS"]),
    ("Lcd_Init", r"\bLcd_Init\s*\(", ["LCD_CORE", "DELAY_MS"]),
    ("Lcd_Cmd", r"\bLcd_Cmd\s*\(", ["LCD_CORE", "DELAY_MS"]),
    ("Lcd_Chr_Cp", r"\bLcd_Chr_Cp\s*\(", ["LCD_CORE"]),
    ("Lcd_Chr", r"\bLcd_Chr\s*\(", ["LCD_GOTO"]),
    ("Lcd_Out_Cp", r"\bLcd_Out_Cp\s*\(", ["LCD_CORE"]),
    ("Lcd_Out", r"\bLcd_Out\s*\(", ["LCD_GOTO"]),
    ("LCD_GOTO", None, ["LCD_CORE"]),
    ("LCD_CORE", None, ["DELAY_K"]),
    ("Keypad_Init", r"\bKeypad_Init\s*\(", []),
    ("Keypad_Key_Press", r"\bKeypad_Key_Press\s*\(", ["DELAY_K"]),
    ("Keypad_Key_Click", r"\bKeypad_Key_Click\s*\(", ["Keypad_Key_Press", "DELAY_MS"]),
    ("UART_INIT", r"\bUART1?_Init\s*\(", []),
    ("UART1_Write", r"\bUART1?_Write\s*\(", []),
    ("UART1_Read", r"\bUART1?_Read\s*\(", []),
    ("UART1_Data_Ready", r"\bUART1?_Data_Ready\s*\(", []),
    ("UART1_Tx_Idle", r"\bUART1?_Tx_Idle\s*\(", []),
    ("UART1_Write_Text", r"\bUART1?_Write_Text\s*\(", ["UART1_Write"]),
    ("UART1_Read_Text", r"\bUART1?_Read_Text\s*\(", ["UART1_Read"]),
    ("PWM_INIT", r"\bPWM1_Init\s*\(", []),
    ("PWM1_Set_Duty", r"\bPWM1_Set_Duty\s*\(", []),
    ("PWM1_Start", r"\bPWM1_Start\s*\(", []),
    ("PWM1_Stop", r"\bPWM1_Stop\s*\(", []),
    ("EEPROM_Read", r"\bEEPROM_Read\s*\(", []),
    ("EEPROM_Write", r"\bEEPROM_Write\s*\(", []),
    ("ByteToStr", r"\bByteToStr\s*\(", ["U2S"]),
    ("ShortToStr", r"\bShortToStr\s*\(", ["U2S"]),
    ("WordToStr", r"\bWordToStr\s*\(", ["U2S"]),
    ("IntToStr", r"\bIntToStr\s*\(", ["U2S"]),
    ("U2S", None, []),
    ("LongToStr", r"\bLongToStr\s*\(", ["L2S"]),
    ("LongWordToStr", r"\bLongWordToStr\s*\(", ["L2S"]),
    ("L2S", None, []),
    ("ByteToHex", r"\bByteToHex\s*\(", ["HEX"]),
    ("ShortToHex", r"\bShortToHex\s*\(", ["HEX"]),
    ("WordToHex", r"\bWordToHex\s*\(", ["HEX"]),
    ("IntToHex", r"\bIntToHex\s*\(", ["HEX"]),
    ("HEX", None, []),
    ("ByteToStrWithZeros", r"\bByteToStrWithZeros\s*\(", ["U2Z"]),
    ("ShortToStrWithZeros", r"\bShortToStrWithZeros\s*\(", ["U2Z"]),
    ("WordToStrWithZeros", r"\bWordToStrWithZeros\s*\(", ["U2Z"]),
    ("IntToStrWithZeros", r"\bIntToStrWithZeros\s*\(", ["U2Z"]),
    ("U2Z", None, []),
    ("Bcd2Dec", r"\bBcd2Dec\s*\(", []),
    ("Dec2Bcd", r"\bDec2Bcd\s*\(", []),
    ("Sound_Init", r"\bSound_Init\s*\(", ["SOUND"]),
    ("Sound_Play", r"\bSound_Play\s*\(", ["SOUND", "DELAY_K"]),
    ("SOUND", None, []),
]
LIBDEPS = {k: d for k, _, d in LIBS}


EXACT_NODEPS = {"LCD_CORE": ("DELAY_K",), "Lcd_Init": ("DELAY_MS",), "Lcd_Cmd": ("DELAY_MS",)}


def lib_uses(code, exact=False):
    use = set()

    def add(k):
        if k not in use:
            use.add(k)
            for d in LIBDEPS[k]:
                if not (exact and d in EXACT_NODEPS.get(k, ())):
                    add(d)
    for k, rx, _ in LIBS:
        if rx and re.search(rx, code):
            add(k)
    return use


def _strip(code):
    code = re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), code, flags=re.S)
    return re.sub(r"//[^\n]*", "", code)


def _member(m):
    reg, field = m.group(1), m.group(2)
    if re.match(r"^[BF][0-7]$", field):
        if reg in SFRS and reg not in ("TMR1", "CCPR1"):
            return "%s_mcb.%s" % (reg, field)
        return "MC_VB(%s).%s" % (reg, field)
    if reg in BITS and field in BITS[reg]:
        return "%sbits.%s" % (reg, field)
    return m.group(0)


def convert(code):
    """mikroC'ye ozgu yazimlari SDCC'nin anlayacagi hale getirir (satir sayisi degismez)."""
    extra = {}
    out = []
    for line in code.split("\n"):
        m = re.match(r"^(\s*)(?:extern\s+)?(?:sfr\s+)?sbit\s+(\w+)\s+at\s+([\w\.]+)\s*;\s*(//.*)?$", line)
        if m:
            out.append("%s#define %s %s" % (m.group(1), m.group(2), m.group(3)))
            continue
        if re.match(r"^\s*extern\s+(?:sfr\s+)?sbit\s+\w+\s*;", line):
            out.append("")
            continue
        m = re.match(r"^(\s*)(?:unsigned\s+)?(?:char|short)\s+keypadPort\s+at\s+(PORT[AB])\s*;\s*(//.*)?$", line)
        if m:
            out.append("%s#define keypadPort %s" % (m.group(1), m.group(2)))
            extra["MC_KP_TRIS"] = "TRIS" + m.group(2)[-1]
            continue
        if re.match(r"^\s*#\s*include\s*[<\"]built_in\.h[>\"]", line):
            out.append("")
            continue
        out.append(line)
    code = "\n".join(out)
    code = re.sub(r"\bvoid\s+interrupt\s*\(\s*(?:void)?\s*\)(?:\s*iv\s+0x[0-9A-Fa-f]+)?(?:\s*ics\s+\w+)?", "void mc_interrupt(void) __interrupt", code)
    code = re.sub(r"\b(unsigned|signed)\s+short(?:\s+int)?\b", r"\1 char", code)
    code = re.sub(r"\bshort(?:\s+int)?\b", "signed char", code)
    code = re.sub(r"^(\s*)bit\s+(?=[A-Za-z_])", r"\1unsigned char ", code, flags=re.M)
    code = re.sub(r"\basm\s*\{([^}]*)\}", lambda m: "__asm" + m.group(1) + "__endasm;", code)
    code = re.sub(r"\basm\s+(\w+[^;\n]*);", r"__asm \1 __endasm;", code)
    code = re.sub(r"\b([A-Za-z_]\w*)\s*\.\s*([A-Za-z_]\w*)\b", _member, code)
    return code, extra


LIB_DOCS = [
    ("Gecikme", "Delay_ms", "void Delay_ms(const unsigned int ms)", "Verilen milisaniye kadar bekler (Fosc'a göre ayarlı).", "Delay_ms(500);", "DELAY_MS"),
    ("Gecikme", "Vdelay_ms", "void Vdelay_ms(unsigned int ms)", "Değişken süreli milisaniye gecikmesi.", "Vdelay_ms(t);", "DELAY_MS"),
    ("Gecikme", "Delay_us", "void Delay_us(const unsigned int us)", "Mikrosaniye gecikmesi (yaklaşık, çevrim sayısına yuvarlanır).", "Delay_us(100);", "DELAY_K"),
    ("Gecikme", "Delay_Cyc", "void Delay_Cyc(const unsigned int cycles_div_by_10)", "10 komut çevriminin katları kadar bekler.", "Delay_Cyc(50);", "DELAY_K"),
    ("Gecikme", "Delay_1sec", "void Delay_1sec(void)", "1 saniye bekler.", "Delay_1sec();", "DELAY_MS"),
    ("Buton", "Button", "unsigned char Button(unsigned char *port, unsigned char pin, unsigned char time, unsigned char active_state)", "Pini time ms boyunca active_state seviyesinde görürse 1 döndürür (sıçrama önleme).", "if (Button(&PORTA, 1, 20, 1)) PORTB = ~PORTB;", "BUTTON"),
    ("LCD", "Lcd_Init", "void Lcd_Init(void)", "HD44780 LCD'yi 4-bit modda başlatır. Önce 'sbit LCD_RS at RB4_bit;' gibi pin tanımları gerekir.", "Lcd_Init();", "Lcd_Init"),
    ("LCD", "Lcd_Cmd", "void Lcd_Cmd(unsigned char out_char)", "LCD'ye komut gönderir (_LCD_CLEAR, _LCD_CURSOR_OFF ...).", "Lcd_Cmd(_LCD_CLEAR);", "Lcd_Cmd"),
    ("LCD", "Lcd_Out", "void Lcd_Out(unsigned char row, unsigned char column, char *text)", "Metni verilen satır/sütundan başlayarak yazar (1 tabanlı).", "Lcd_Out(1, 1, \"EELAB\");", "Lcd_Out"),
    ("LCD", "Lcd_Out_Cp", "void Lcd_Out_Cp(char *text)", "Metni imlecin bulunduğu yere yazar.", "Lcd_Out_Cp(txt);", "Lcd_Out_Cp"),
    ("LCD", "Lcd_Chr", "void Lcd_Chr(unsigned char row, unsigned char column, unsigned char out_char)", "Tek karakteri verilen konuma yazar.", "Lcd_Chr(2, 5, 'A');", "Lcd_Chr"),
    ("LCD", "Lcd_Chr_Cp", "void Lcd_Chr_Cp(unsigned char out_char)", "Tek karakteri imlecin bulunduğu yere yazar.", "Lcd_Chr_Cp('x');", "Lcd_Chr_Cp"),
    ("Tuş takımı", "Keypad_Init", "void Keypad_Init(void)", "4x4 tuş takımını başlatır ('char keypadPort at PORTB;' gerekir).", "Keypad_Init();", "Keypad_Init"),
    ("Tuş takımı", "Keypad_Key_Press", "unsigned char Keypad_Key_Press(void)", "Basılı tuşun kodunu (1..16) döndürür, yoksa 0.", "kp = Keypad_Key_Press();", "Keypad_Key_Press"),
    ("Tuş takımı", "Keypad_Key_Click", "unsigned char Keypad_Key_Click(void)", "Tuş bırakılana kadar bekler ve kodunu (1..16) döndürür.", "kp = Keypad_Key_Click();", "Keypad_Key_Click"),
    ("UART", "UART1_Init", "void UART1_Init(const unsigned long baud_rate)", "Donanım USART'ı verilen hızda (8N1) başlatır.", "UART1_Init(9600);", "UART_INIT"),
    ("UART", "UART1_Write", "void UART1_Write(unsigned char data_)", "Bir bayt gönderir.", "UART1_Write('A');", "UART1_Write"),
    ("UART", "UART1_Read", "unsigned char UART1_Read(void)", "Alınan baytı döndürür.", "c = UART1_Read();", "UART1_Read"),
    ("UART", "UART1_Data_Ready", "unsigned char UART1_Data_Ready(void)", "Okunmayı bekleyen bayt varsa 1 döndürür.", "if (UART1_Data_Ready()) c = UART1_Read();", "UART1_Data_Ready"),
    ("UART", "UART1_Tx_Idle", "unsigned char UART1_Tx_Idle(void)", "Gönderim bitti ise 1 döndürür.", "while (!UART1_Tx_Idle()) { }", "UART1_Tx_Idle"),
    ("UART", "UART1_Write_Text", "void UART1_Write_Text(char *uart_text)", "Sıfır sonlu metni gönderir.", "UART1_Write_Text(\"Merhaba\\r\\n\");", "UART1_Write_Text"),
    ("UART", "UART1_Read_Text", "void UART1_Read_Text(char *output, char *delimiter, unsigned char attempts)", "Sınırlayıcı gelene kadar metin okur.", "UART1_Read_Text(buf, \"\\r\", 10);", "UART1_Read_Text"),
    ("PWM", "PWM1_Init", "void PWM1_Init(const long freq)", "CCP1 (RB3) PWM modülünü verilen frekansta hazırlar.", "PWM1_Init(5000);", "PWM_INIT"),
    ("PWM", "PWM1_Set_Duty", "void PWM1_Set_Duty(unsigned char duty_ratio)", "Doluluk oranı (0..255).", "PWM1_Set_Duty(128);", "PWM1_Set_Duty"),
    ("PWM", "PWM1_Start", "void PWM1_Start(void)", "PWM çıkışını başlatır.", "PWM1_Start();", "PWM1_Start"),
    ("PWM", "PWM1_Stop", "void PWM1_Stop(void)", "PWM çıkışını durdurur.", "PWM1_Stop();", "PWM1_Stop"),
    ("EEPROM", "EEPROM_Read", "unsigned char EEPROM_Read(unsigned char address)", "Veri EEPROM'undan (0..127) bir bayt okur.", "x = EEPROM_Read(0x00);", "EEPROM_Read"),
    ("EEPROM", "EEPROM_Write", "void EEPROM_Write(unsigned char address, unsigned char data_)", "Veri EEPROM'una bir bayt yazar (ardından ~20 ms bekleyin).", "EEPROM_Write(0x00, 5);", "EEPROM_Write"),
    ("Dönüşüm", "ByteToStr", "void ByteToStr(unsigned char input, char *output)", "0..255 sayıyı 3 karakterlik metne çevirir (output en az 4 bayt).", "ByteToStr(x, txt);", "ByteToStr"),
    ("Dönüşüm", "ShortToStr", "void ShortToStr(short input, char *output)", "-128..127 sayıyı 4 karakterlik metne çevirir (output en az 5 bayt).", "ShortToStr(x, txt);", "ShortToStr"),
    ("Dönüşüm", "WordToStr", "void WordToStr(unsigned int input, char *output)", "0..65535 sayıyı 5 karakterlik metne çevirir (output en az 6 bayt).", "WordToStr(x, txt);", "WordToStr"),
    ("Dönüşüm", "IntToStr", "void IntToStr(int input, char *output)", "int sayıyı 6 karakterlik metne çevirir (output en az 7 bayt).", "IntToStr(sayac, txt);", "IntToStr"),
    ("Dönüşüm", "LongToStr", "void LongToStr(long input, char *output)", "long sayıyı 11 karakterlik metne çevirir (output en az 12 bayt).", "LongToStr(x, txt);", "LongToStr"),
    ("Dönüşüm", "LongWordToStr", "void LongWordToStr(unsigned long input, char *output)", "unsigned long sayıyı 10 karakterlik metne çevirir (output en az 11 bayt).", "LongWordToStr(x, txt);", "LongWordToStr"),
    ("Dönüşüm", "ByteToHex", "void ByteToHex(unsigned char input, char *output)", "Baytı 2 haneli onaltılık metne çevirir (output en az 3 bayt).", "ByteToHex(x, txt);", "ByteToHex"),
    ("Dönüşüm", "ShortToHex", "void ShortToHex(short input, char *output)", "short sayıyı 2 haneli onaltılık metne çevirir.", "ShortToHex(x, txt);", "ShortToHex"),
    ("Dönüşüm", "WordToHex", "void WordToHex(unsigned int input, char *output)", "16 bit sayıyı 4 haneli onaltılık metne çevirir (output en az 5 bayt).", "WordToHex(x, txt);", "WordToHex"),
    ("Dönüşüm", "IntToHex", "void IntToHex(int input, char *output)", "int sayıyı 4 haneli onaltılık metne çevirir.", "IntToHex(x, txt);", "IntToHex"),
    ("Dönüşüm", "ByteToStrWithZeros", "void ByteToStrWithZeros(unsigned char input, char *output)", "0..255 sayıyı başı sıfırlı 3 karakterlik metne çevirir.", "ByteToStrWithZeros(x, txt);", "ByteToStrWithZeros"),
    ("Dönüşüm", "ShortToStrWithZeros", "void ShortToStrWithZeros(short input, char *output)", "short sayıyı başı sıfırlı 4 karakterlik metne çevirir.", "ShortToStrWithZeros(x, txt);", "ShortToStrWithZeros"),
    ("Dönüşüm", "WordToStrWithZeros", "void WordToStrWithZeros(unsigned int input, char *output)", "0..65535 sayıyı başı sıfırlı 5 karakterlik metne çevirir.", "WordToStrWithZeros(x, txt);", "WordToStrWithZeros"),
    ("Dönüşüm", "IntToStrWithZeros", "void IntToStrWithZeros(int input, char *output)", "int sayıyı başı sıfırlı 6 karakterlik metne çevirir (-42 → \"-00042\").", "IntToStrWithZeros(x, txt);", "IntToStrWithZeros"),
    ("Dönüşüm", "Bcd2Dec", "unsigned char Bcd2Dec(unsigned char bcdnum)", "BCD'den ikiliye çevirir.", "x = Bcd2Dec(0x42);", "Bcd2Dec"),
    ("Dönüşüm", "Dec2Bcd", "unsigned char Dec2Bcd(unsigned char decnum)", "İkiliden BCD'ye çevirir.", "PORTB = Dec2Bcd(42);", "Dec2Bcd"),
    ("Ses", "Sound_Init", "void Sound_Init(unsigned char *snd_port, unsigned char snd_pin)", "Ses çıkışı için port/pin seçer.", "Sound_Init(&PORTB, 3);", "Sound_Init"),
    ("Ses", "Sound_Play", "void Sound_Play(unsigned int freq_in_hz, unsigned int duration_ms)", "Verilen frekansta kare dalga üretir.", "Sound_Play(1000, 100);", "Sound_Play"),
    ("Yardımcı", "Lo", "unsigned char Lo(x)", "Değerin düşük baytı.", "PORTB = Lo(sayi);", None),
    ("Yardımcı", "Hi", "unsigned char Hi(x)", "Değerin yüksek baytı.", "PORTB = Hi(sayi);", None),
    ("Yardımcı", "Swap", "unsigned char Swap(unsigned char x)", "Yarım baytların yerini değiştirir.", "x = Swap(x);", None),
    ("Yardımcı", "Clock_MHz", "unsigned long Clock_MHz(void)", "Proje saat frekansı (MHz).", "f = Clock_MHz();", None),
]


def lib_info():
    h = open(os.path.join(SHIM, "mikroc.h")).read()
    consts = sorted(set(re.findall(r"#define\s+(_LCD_\w+)\s", h)))
    funcs = [{"name": n, "group": g, "sig": s, "desc": d, "example": e, "key": k, "deps": sorted(LIBDEPS.get(k, [])) if k else []} for g, n, s, d, e, k in LIB_DOCS]
    return {"functions": funcs, "constants": consts, "sfrs": sorted(SFRS), "bits": {k: sorted(v) for k, v in sorted(BITS.items())},
            "sbits": sorted(set(re.findall(r"#define\s+(\w+_bit)\b", _read(os.path.join(SHIM, "mc_regs.h"))))),
            "keywords": ["sbit", "at", "sfr", "bit", "interrupt", "iv", "ics", "asm", "code", "data", "rx", "volatile", "const"]}


_TOOLS = {}


def _probe(cmd):
    try:
        p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=20)
        out = p.stdout.decode("utf-8", "replace").strip().splitlines()
        return p.returncode == 0, out[0].strip() if out else ""
    except (OSError, subprocess.SubprocessError):
        return False, ""


def toolchain_status():
    with LOCK:
        if _TOOLS.get("tc") == TC:
            return _TOOLS
        gp = os.path.join(TC, "bin", "gpasm")
        mode, prefix = "missing", []
        ok, ver = _probe([gp, "-v"])
        if ok:
            mode = "native"
        elif sys.platform == "darwin" and os.path.exists(gp) and os.path.exists("/usr/bin/arch"):
            ok, ver = _probe(["/usr/bin/arch", "-x86_64", gp, "-v"])
            if ok:
                mode, prefix = "rosetta", ["/usr/bin/arch", "-x86_64"]
        sv = ""
        if mode != "missing":
            _, sv = _probe(prefix + [os.path.join(TC, "bin", "sdcc"), "-v"])
        _TOOLS.clear()
        _TOOLS.update(tc=TC, mode=mode, prefix=prefix, gputils=ver, sdcc=sv)
        return _TOOLS


def tool_cmd(name):
    return toolchain_status()["prefix"] + [os.path.join(TC, "bin", name)]


def run(cmd, cwd, env):
    p = subprocess.run(cmd, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=60)
    return p.returncode, p.stdout.decode("utf-8", "replace")


def tool_env():
    return {"PATH": os.path.join(TC, "bin") + ":/usr/bin:/bin", "GPUTILS_HEADER_PATH": os.path.join(TC, "gpheader")}


def build_c(base, code, fosc, tmp, config=None, lib_model="eelab"):
    t0 = time.time()
    conv, extra = convert(code)
    exact = lib_model == "mikroc"
    defs_c = c_defines(code)
    hints, errs = lib_checks(_strip(code), fosc, defs_c)
    dly = set()
    if exact:
        conv, dly, e2 = exact_delays(conv, fosc, defs_c)
        errs += e2
        use = lib_uses(_strip(conv), exact=True)
    else:
        use = lib_uses(_strip(code))
    msgs = ["%s.c:%d: error: %s" % (base, ln, t) for ln, t in sorted(errs)]
    times = {"comp": 0, "link": 0}
    if errs:
        return {"ok": False, "messages": msgs, "hints": hints, "times": times}
    if any(k.startswith("Lcd_") for k in use) and not re.search(r"\bLCD_RS\b", conv):
        msgs.append("%s.c: uyari: Lcd_* kullanildi ama 'sbit LCD_RS at ...;' gibi LCD pin tanimlari yok." % base)
    if any(k.startswith("Keypad_") for k in use) and "MC_KP_TRIS" not in extra:
        msgs.append("%s.c: uyari: Keypad_* kullanildi ama 'char keypadPort at PORTB;' tanimi yok." % base)
        extra["MC_KP_TRIS"] = "TRISB"
    if exact:
        with open(os.path.join(tmp, "mc_dly.h"), "w") as f:
            f.write(dly_header(dly, fosc, "LCD_CORE" in use))
        src = '#include "mikroc.h"\n#include "mc_dly.h"\n#line 1 "%s.c"\n%s\n#include "mikroc_lib.c"\n' % (base, conv)
    else:
        src = '#include "mikroc.h"\n#line 1 "%s.c"\n%s\n#include "mikroc_lib.c"\n' % (base, conv)
    with open(os.path.join(tmp, base + ".c"), "w") as f:
        f.write(src)
    env = tool_env()
    inc = ["-I" + os.path.join(TC, "include", "pic14"), "-I" + os.path.join(TC, "nonfree", "pic14"),
           "-I" + os.path.join(TC, "include"), "-I" + SHIM]
    defs = ["-DMC_FOSC=%dUL" % fosc] + (["-DMC_EXACT=1"] if lib_model == "mikroc" else []) + ["-DMC_USE_%s" % k for k in sorted(use)] + ["-D%s=%s" % kv for kv in extra.items()]
    if config is not None:
        defs.append("-DMC_CONFIG=0x%04X" % config)
    sdcc = tool_cmd("sdcc") + ["-mpic14", "-p16f628a", "--use-non-free"] + inc + defs
    rc, out = run(sdcc + ["-c", base + ".c", "-o", base + ".o"], tmp, env)
    for line in out.splitlines():
        if not line.strip() or "Page selection" in line or "warning 283" in line or "mikroc.h" in line or "mikroc_lib.c" in line and "error" not in line:
            continue
        msgs.append(line)
    if rc != 0 or not os.path.exists(os.path.join(tmp, base + ".o")):
        return {"ok": False, "messages": msgs or ["Derleme basarisiz."], "hints": hints, "times": times}
    rc, out = run(sdcc + ["-c", os.path.join(SHIM, "mcdev.c"), "-o", "mcdev.o"], tmp, env)
    if rc != 0:
        return {"ok": False, "messages": msgs + out.splitlines(), "hints": hints, "times": times}
    t1 = time.time()
    times["comp"] = int(round((t1 - t0) * 1000))
    rc, out = run(tool_cmd("gplink") + ["-m", "-w", "-r", "-s", os.path.join(TC, "lkr", "16f628a_g.lkr"),
                  "-I", os.path.join(TC, "lib"), "-o", base + ".hex", base + ".o", "mcdev.o", "libsdcc.lib"], tmp, env)
    for line in out.splitlines():
        if line.strip() and "_cinit" not in line:
            msgs.append(line)
    times["link"] = int(round((time.time() - t1) * 1000))
    if rc != 0:
        return {"ok": False, "messages": msgs or ["Baglama (link) basarisiz."], "hints": hints, "times": times}
    return {"ok": True, "messages": msgs, "hints": hints, "times": times}


def build_asm(base, code, tmp):
    t0 = time.time()
    with open(os.path.join(tmp, base + ".asm"), "w") as f:
        f.write(code)
    rc, out = run(tool_cmd("gpasm") + ["-p", "p16f628a", "-I", os.path.join(TC, "gpheader"),
                  "-o", base + ".hex", base + ".asm"], tmp, tool_env())
    msgs, hid = [], 0
    for l in out.splitlines():
        if not l.strip() or "superseded" in l:
            continue
        if re.search(r"Warning\[20[35]\]|Message\[1302\]", l):
            hid += 1
            continue
        msgs.append(l)
    if hid:
        msgs.append("(%d adet 'column 1' / bank uyarisi gizlendi)" % hid)
    times = {"comp": int(round((time.time() - t0) * 1000)), "link": 0}
    if rc != 0:
        return {"ok": False, "messages": msgs or ["Assembly basarisiz."], "times": times}
    return {"ok": True, "messages": msgs, "times": times}


def _read(path):
    try:
        with open(path, errors="replace") as f:
            return f.read()
    except OSError:
        return ""


def hex_words(text):
    mem = {}
    upper = 0
    for line in (text or "").splitlines():
        line = line.strip()
        if not line.startswith(":") or len(line) < 11:
            continue
        try:
            n, addr, typ = int(line[1:3], 16), int(line[3:7], 16), int(line[7:9], 16)
            data = bytes.fromhex(line[9:9 + 2 * n])
        except ValueError:
            continue
        if len(data) != n:
            continue
        if typ == 4:
            upper = int(line[9:13], 16) << 16
        if typ != 0:
            continue
        for i in range(0, n - 1, 2):
            mem[(upper + addr + i) // 2] = data[i] | (data[i + 1] << 8)
    return mem


def _hexrec(addr, typ, data):
    body = bytes([len(data), (addr >> 8) & 255, addr & 255, typ]) + bytes(data)
    return ":" + body.hex().upper() + "%02X" % (-sum(body) & 255)


def set_config_hex(text, word):
    lo, hi = word & 255, (word >> 8) & 255
    nl = "\r\n" if "\r\n" in text else "\n"
    out, upper, done = [], 0, False
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            n, addr, typ = int(line[1:3], 16), int(line[3:7], 16), int(line[7:9], 16)
        except ValueError:
            out.append(line)
            continue
        if typ == 4:
            upper = int(line[9:13], 16)
        elif typ == 0 and upper == 0 and addr <= 0x400E and addr + n >= 0x4010:
            data = bytearray.fromhex(line[9:9 + 2 * n])
            data[0x400E - addr], data[0x400F - addr] = lo, hi
            line, done = _hexrec(addr, 0, data), True
        elif typ == 1 and not done:
            if upper:
                out.append(":020000040000FA")
            out.append(_hexrec(0x400E, 0, [lo, hi]))
            done = True
        out.append(line)
    return nl.join(out) + nl


def hex_summary(text):
    mem = hex_words(text)
    return {"rom": sum(1 for a in mem if a < 0x2000), "config": mem.get(0x2007)}


def diagnostics(messages, filename, nlines):
    out = []
    for msg in messages:
        m = re.match(r"^(.+?):(\d+):\s*(?:(error|warning)\s*\d*\s*:|(syntax error)\s*:?)\s*(.*)$", msg, re.I)
        if m:
            sev = "warning" if (m.group(3) or "").lower() == "warning" else "error"
            text = ("syntax error: " if m.group(4) else "") + m.group(5).strip()
        else:
            m = re.match(r"^(.+?):(\d+):\s*(Error|Warning|Message)\[(\d+)\]\s*(.*)$", msg)
            if not m:
                continue
            sev = "error" if m.group(3) == "Error" else "warning"
            text = "%s[%s] %s" % (m.group(3), m.group(4), " ".join(m.group(5).split()))
        if os.path.basename(m.group(1)) != filename:
            continue
        line = int(m.group(2))
        if line < 1:
            continue
        out.append({"line": min(line, max(nlines, 1)), "sev": sev, "text": text})
    return out


def _ranges(rows):
    rows.sort()
    out = []
    for a, n, ln in rows:
        if out and out[-1][2] == ln and out[-1][1] == a:
            out[-1][1] = a + n
        elif out and a < out[-1][1]:
            continue
        else:
            out.append([a, a + n, ln])
    return out


def _map_info(mp):
    sections, syms = [], {}
    part = None
    for row in mp.splitlines():
        if "Section Info" in row:
            part = "sec"
        elif "Program Memory Usage" in row:
            part = None
        elif "Symbols - Sorted by Name" in row:
            part = "sym"
        elif "Symbols - Sorted by Address" in row:
            part = None
        elif part == "sec":
            m = re.match(r"^\s*(\S+)\s+(\w+)\s+0x([0-9a-fA-F]+)\s+(program|data)\s+0x([0-9a-fA-F]+)\s*$", row)
            if m:
                sections.append({"name": m.group(1), "type": m.group(2), "addr": int(m.group(3), 16), "loc": m.group(4), "size": int(m.group(5), 16)})
        elif part == "sym":
            m = re.match(r"^\s*(\S+)\s+0x([0-9a-fA-F]+)\s+(program|data)\s+(extern|static)\s*(\S*)\s*$", row)
            if m:
                syms[(m.group(1), int(m.group(2), 16), m.group(3))] = {"raw": m.group(1), "addr": int(m.group(2), 16), "loc": m.group(3), "scope": m.group(4), "file": m.group(5)}
    return sections, list(syms.values())


def _c_debug(base, tmp, code):
    user = base + ".c"
    nlines = code.count("\n") + 1
    lst = _read(os.path.join(tmp, base + ".lst"))
    rows, cur = [], None
    for row in lst.splitlines():
        m = re.match(r"^([0-9a-fA-F]{6})\s+([0-9a-fA-F]{4})\s", row)
        if m:
            a = int(m.group(1), 16)
            if cur and a < 0x2000:
                rows.append((a, 1, cur))
            continue
        lm = re.search(r';\s*\.line\s+(\d+);\s*"([^"]*)"', row)
        if lm:
            n = int(lm.group(1))
            cur = n if lm.group(2) == user and 1 <= n <= nlines else None
        elif re.match(r"^\s{20,}\S+\s+code\b", row):
            cur = None
    ranges = _ranges(rows)
    sections, syms = _map_info(_read(os.path.join(tmp, base + ".map")))
    mod = base + ".asm"
    fsec = set()
    for x in sections:
        mm = re.match(r"^S_%s__(\w+)$" % re.escape(base), x["name"])
        if mm and x["type"] == "code":
            fsec.add(mm.group(1))
    isr = next((x["addr"] for x in sections if x["name"] == "c_interrupt"), None)
    for s in syms:
        if s["loc"] == "program" and s["file"] == mod and s["addr"] == isr and s["raw"].startswith("_") and not s["raw"].startswith("__"):
            fsec.add(s["raw"][1:])
    funcs = {}
    for s in syms:
        if s["loc"] == "program" and s["file"] == mod and s["raw"].startswith("_") and s["raw"][1:] in fsec:
            funcs[s["raw"][1:]] = s["addr"]
    dsecs = [x for x in sections if x["loc"] == "data" and not x["name"].startswith("UD_abs_")]
    data_addrs = sorted(set(s["addr"] for s in syms if s["loc"] == "data"))
    symbols = []
    for fn_, a in sorted(funcs.items(), key=lambda kv: kv[1]):
        inuser = a == isr or any(r[0] <= a < r[1] for r in ranges)
        symbols.append({"name": "interrupt" if fn_ == "mc_interrupt" else fn_, "raw": "_" + fn_, "addr": a, "size": 0, "kind": "func", "lib": not inuser})
    for s in sorted(syms, key=lambda s: (s["addr"], s["raw"])):
        raw = s["raw"]
        if s["loc"] != "data" or s["file"] != mod or not raw.startswith("_") or raw.startswith(("_mc_", "_MC_", "__")):
            continue
        name, scope = raw[1:], None
        for f in sorted(funcs, key=len, reverse=True):
            mm = re.match(r"^_%s_(\w+?)_\d+_\d+$" % re.escape(f), raw)
            if mm:
                name, scope = mm.group(1), f
                break
        sec = next((x for x in dsecs if x["addr"] <= s["addr"] < x["addr"] + x["size"]), None)
        end = sec["addr"] + sec["size"] if sec else s["addr"] + 1
        nxt = next((a for a in data_addrs if a > s["addr"]), end)
        sym = {"name": name, "raw": raw, "addr": s["addr"], "size": max(1, min(end, nxt) - s["addr"]), "kind": "var"}
        if scope:
            sym["scope"] = scope
        symbols.append(sym)
    used = set()
    for x in dsecs:
        used.update(range(x["addr"], x["addr"] + x["size"]))
    lst = lst.replace(os.path.join(SHIM, ""), "")
    user = set(s["name"] for s in symbols if s["kind"] == "func" and not s.get("lib"))
    code = []
    for x in sections:
        if x["loc"] != "program" or x["addr"] >= 0x2000 or not x["size"]:
            continue
        mm = re.match(r"^S_%s__(\w+)$" % re.escape(base), x["name"])
        if mm:
            n = "interrupt" if mm.group(1) == "mc_interrupt" else mm.group(1)
            kind = "user" if n in user else "lib"
        elif x["name"] == "c_interrupt":
            n, kind = "interrupt", "user" if "interrupt" in user else "lib"
        elif x["type"] == "romdata" or x["name"].startswith(("IDC_", "IDD_")):
            n, kind = x["name"], "data"
        else:
            mm = re.match(r"^S_(\w+?)___?(\w+)$", x["name"])
            n, kind = (mm.group(2) if mm and not x["name"].startswith("S_idata_") else x["name"]), "sys"
        code.append({"name": n, "sec": x["name"], "addr": x["addr"], "words": (x["size"] + 1) // 2, "kind": kind})
    code.sort(key=lambda c: c["addr"])
    return ranges, symbols, lst, len(used), code


def _is_gpr(a):
    if not 0 <= a < 0x200:
        return False
    bank, off = a >> 7, a & 0x7F
    return off >= 0x70 or (bank == 0 and off >= 0x20) or (bank == 1 and off >= 0x20) or (bank == 2 and 0x20 <= off < 0x50)


def _asm_debug(base, tmp, code):
    src = code.split("\n")
    norm = [" ".join(l.split()) for l in src]
    lst = _read(os.path.join(tmp, base + ".lst"))
    rows, last, symtab = [], None, False
    syms = {}
    for row in lst.splitlines():
        if row.startswith("SYMBOL TABLE"):
            symtab = True
            continue
        if symtab:
            m = re.match(r"^(\S+)\s+(ADDRESS|CONSTANT|VARIABLE)\s+([0-9A-Fa-f]{8})\s", row)
            if m:
                syms[m.group(1)] = (m.group(2), int(m.group(3), 16))
            continue
        if len(row) < 28 or not re.match(r"^[0-9A-F]{4}\s", row) or not re.match(r"^\d{5}$", row[22:27]):
            continue
        a = int(row[0:4], 16)
        n = len(row[7:21].split())
        ln = int(row[22:27])
        if 1 <= ln <= len(src) and " ".join(row[28:].split()) == norm[ln - 1]:
            last = ln
            hit = ln
        else:
            hit = last
        if n and hit and a < 0x2000:
            rows.append((a, n, hit))
    ranges = _ranges(rows)
    defs, sizes = set(), {}
    nocom = [re.sub(r";.*$", "", l) for l in src]
    inblock = False
    for l in nocom:
        if re.match(r"^\s*cblock\b", l, re.I):
            inblock = True
            continue
        if inblock:
            if re.match(r"^\s*endc\b", l, re.I):
                inblock = False
                continue
            for part in l.split(","):
                mm = re.match(r"^\s*([A-Za-z_]\w*)\s*(?::\s*(\d+))?\s*$", part)
                if mm:
                    defs.add(mm.group(1))
                    sizes[mm.group(1)] = int(mm.group(2) or 1)
            continue
        mm = re.match(r"^\s*([A-Za-z_]\w*):?\s+(?:equ|set)\s", l, re.I)
        if mm:
            defs.add(mm.group(1))
    symbols, used = [], set()
    for name, (typ, val) in sorted(syms.items(), key=lambda kv: (kv[1][1], kv[0])):
        if typ == "ADDRESS":
            symbols.append({"name": name, "raw": name, "addr": val, "size": 0, "kind": "label"})
        elif name in defs and _is_gpr(val):
            sz = sizes.get(name, 1)
            symbols.append({"name": name, "raw": name, "addr": val, "size": sz, "kind": "var"})
            used.update(range(val, val + sz))
    return ranges, symbols, lst, len(used), None


def debug_info(lang, base, code, tmp, hextext):
    if lang == "c":
        ranges, symbols, lst, ram, cs = _c_debug(base, tmp, code)
    else:
        ranges, symbols, lst, ram, cs = _asm_debug(base, tmp, code)
    hs = hex_summary(hextext)
    d = {"lang": lang, "file": "%s.%s" % (base, lang), "lines": [[r[0], r[2]] for r in ranges],
         "ranges": ranges, "symbols": symbols, "lst": lst, "rom": hs["rom"], "ram": ram, "config": hs["config"]}
    if cs is not None:
        d["code"] = cs
    return d


RAM_TOTAL, ROM_TOTAL = 224, 2048
MONTHS_EN = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
MC_EN = {
    "avail": "Available RAM: {0} [bytes], Available ROM: {1} [bytes]",
    "compStart": "Compilation Started", "compOk": "Compiled Successfully", "allComp": "All files Compiled in {0} ms",
    "usedRam": "Used RAM (bytes): {0} ({1}%)  Free RAM (bytes): {2} ({3}%)",
    "usedRom": "Used ROM (program words): {0} ({1}%)  Free ROM (program words): {2} ({3}%)",
    "linked": "Project Linked Successfully", "linkedIn": "Linked in {0} ms", "completed": "Project '{0}' completed: {1} ms",
    "finishedOk": "Finished successfully: {0}", "finishedErr": "Finished (with errors): {0}",
    "baud": "Generated baud rate is {0} bps (error = {1} percent)",
    "undeclared": "Undeclared identifier '{0}' in expression", "expected": "; expected, but '{0}' found", "raw": "{0}",
}
MC_ERR = ((re.compile(r"undefined identifier '(\w+)'", re.I), 324, "undeclared"),
          (re.compile(r"syntax error: token -> '([^']*)'", re.I), 402, "expected"))


def mc_date(t=None):
    t = time.localtime(t)
    return "%d %s %d, %02d:%02d:%02d" % (t.tm_mday, MONTHS_EN[t.tm_mon - 1], t.tm_year, t.tm_hour, t.tm_min, t.tm_sec)


def mc_msg(typ, line, no, key, args=(), unit=""):
    args = list(args)
    return {"type": typ, "line": int(line), "no": no, "key": key, "args": args, "unit": unit,
            "text": MC_EN[key].format(*args)}


def mc_map_error(sev, text):
    for rx, no, key in MC_ERR:
        m = rx.search(text)
        if m and sev == "error":
            return no, key, [m.group(1)]
    return 0, "raw", [text]


def mc_messages(r, base, ext, code):
    """K-F5 / G-MSG: mikroC Messages penceresi satirlari (EN metin 'text' alaninda)."""
    fn, proj = "%s.%s" % (base, ext), base + ".mcppi"
    times = r.get("times") or {"comp": 0, "link": 0}
    nlines = code.count("\n") + 1
    now = time.time()
    out = [mc_msg("hint", 0, 1139, "avail", [RAM_TOTAL, ROM_TOTAL]), mc_msg("diagnostics", 0, 122, "compStart", [], fn)]
    for h in r.get("hints") or []:
        out.append(mc_msg("warning", h["line"], 1509, "baud", [h["baud"], h["err"]], fn))
    for d in r.get("diag") or []:
        no, key, args = mc_map_error(d["sev"], d["text"])
        out.append(mc_msg(d["sev"], d["line"], no, key, args, fn))
    if not r.get("ok"):
        if not any(d["sev"] == "error" for d in r.get("diag") or []):
            for m in r.get("messages") or []:
                if re.search(r"error|hata|No target memory|basarisiz", m, re.I):
                    t = "Output limit has raised 2K words" if "No target memory" in m else m
                    out.append(mc_msg("error", 0, 0, "raw", [t], fn))
        m = mc_msg("error", 0, 102, "finishedErr", [mc_date(now)], proj)
        m["ts"] = int(now * 1000)
        return out + [m]
    d = r.get("debug") or {}
    ram = int(d.get("ram") or 0)
    rom = int(d.get("rom") or hex_summary(r.get("hex", ""))["rom"])
    pc = lambda n, t: int(round(n * 100.0 / t))
    out += [mc_msg("diagnostics", nlines, 123, "compOk", [], fn),
            mc_msg("diagnostics", 0, 127, "allComp", [times["comp"]]),
            mc_msg("hint", 0, 1144, "usedRam", [ram, pc(ram, RAM_TOTAL), RAM_TOTAL - ram, pc(RAM_TOTAL - ram, RAM_TOTAL)]),
            mc_msg("hint", 0, 1144, "usedRom", [rom, pc(rom, ROM_TOTAL), ROM_TOTAL - rom, pc(ROM_TOTAL - rom, ROM_TOTAL)]),
            mc_msg("diagnostics", 0, 125, "linked", [], proj),
            mc_msg("diagnostics", 0, 128, "linkedIn", [times["link"]]),
            mc_msg("diagnostics", 0, 129, "completed", [proj, times["comp"] + times["link"]])]
    m = mc_msg("diagnostics", 0, 103, "finishedOk", [mc_date(now)], proj)
    m["ts"] = int(now * 1000)
    return out + [m]


def build(name, code, fosc=None, lib_model=None):
    base, ext = fname(name)
    code = code.replace("\r\n", "\n").replace("\r", "\n")
    fn = base + "." + ext
    with open(os.path.join(PROJ, fn), "w") as f:
        f.write(code)
    if fosc is not None:
        set_fosc(fn, fosc)
    if lib_model in ("eelab", "mikroc"):
        update_settings(fn, {"libModel": lib_model})
    fs = file_settings(fn)
    fosc, config = fs["fosc"], fs.get("config")
    if not isinstance(config, int) or not 0 <= config <= 0x3FFF:
        config = None
    tmp = tempfile.mkdtemp(prefix="eelab_")
    try:
        r = build_c(base, code, fosc, tmp, config, fs["libModel"]) if ext == "c" else build_asm(base, code, tmp)
        hexp = os.path.join(tmp, base + ".hex")
        if r["ok"] and not os.path.exists(hexp):
            r = {"ok": False, "messages": r["messages"] + ["HEX dosyasi uretilemedi."]}
        if r["ok"] and config is not None and ext == "asm":
            with open(hexp, newline="") as f:
                patched = set_config_hex(f.read(), config)
            with open(hexp, "w", newline="") as f:
                f.write(patched)
        r["configSource"] = "settings" if config is not None else ("default" if ext == "c" else "source")
        r["diag"] = diagnostics(r.get("messages", []), fn, code.count("\n") + 1)
        if r["ok"]:
            shutil.copy(hexp, os.path.join(PROJ, base + ".hex"))
            r.update(hex=open(hexp).read(), hexPath=os.path.join(PROJ, base + ".hex"))
            try:
                r["debug"] = debug_info(ext, base, code, tmp, r["hex"])
            except Exception as e:
                r["messages"].append("(hata ayiklama bilgisi cikarilamadi: %s)" % e)
        r["fosc"] = fosc
        r["libModel"] = fs["libModel"] if ext == "c" else "eelab"
        r["mc"] = mc_messages(r, base, ext, code)
        r.pop("hints", None)
        r.pop("times", None)
        return r
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _strip_c(text):
    out, i, n = [], 0, len(text)
    while i < n:
        c = text[i]
        if c in "\"'":
            j = i + 1
            while j < n and text[j] != c and text[j] != "\n":
                j += 2 if text[j] == "\\" else 1
            out.append(text[i:j + 1])
            i = j + 1
        elif text.startswith("//", i):
            j = text.find("\n", i)
            i = n if j < 0 else j
        elif text.startswith("/*", i):
            j = text.find("*/", i + 2)
            j = n if j < 0 else j + 2
            out.append("\n" * text.count("\n", i, j))
            i = j
        else:
            out.append(c)
            i += 1
    return "".join(out)


def _strip_asm(text):
    out = []
    for line in text.split("\n"):
        q, cut = None, len(line)
        for k, ch in enumerate(line):
            if q:
                if ch == q:
                    q = None
            elif ch in "\"'":
                q = ch
            elif ch == ";":
                cut = k
                break
        out.append(line[:cut])
    return "\n".join(out)


def strip_comments(filename, text):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    new = _strip_c(text) if filename.endswith(".c") else _strip_asm(text)
    keep = []
    for o, s in zip(text.split("\n"), new.split("\n")):
        if s.strip() or not o.strip():
            keep.append(s.rstrip())
    return "\n".join(keep)


def _safe_zip_name(s):
    s = re.sub(r"\.zip$", "", str(s or "").strip(), flags=re.I)
    s = re.sub(r"[^A-Za-z0-9_\-]", "_", s)[:40].strip("_")
    return s


def _find_data_file(fn):
    p = os.path.join(PROJ, fn)
    if os.path.isfile(p):
        return p
    if fn.endswith(".json"):
        p = os.path.join(APP, "circuits", fn)
        if os.path.isfile(p):
            return p
    return None


def export_zip(body):
    student = body.get("student") if isinstance(body.get("student"), dict) else {}
    zname = _safe_zip_name(body.get("name")) or _safe_zip_name(student.get("no")) or "teslim"
    strip = bool(body.get("stripComments") or body.get("noComments"))
    entries, missing, notes = {}, [], []
    sett = all_settings()
    for item in body.get("files") or []:
        fn = str(item)
        m = DATA_RE.match(fn)
        p = m and _find_data_file(fn)
        if not p:
            missing.append(fn)
            continue
        with open(p, "rb") as f:
            data = f.read()
        if strip and m.group(2) in ("c", "asm"):
            data = strip_comments(fn, data.decode("utf-8", "replace")).encode("utf-8")
        entries[fn] = data
        if m.group(2) in ("c", "asm"):
            s = sett.get(fn, {})
            fos = s.get("fosc") if s.get("fosc") in FOSCS else 4000000
            hs = hex_summary(_read(os.path.join(PROJ, m.group(1) + ".hex")))
            cw = "0x%04X" % hs["config"] if hs["config"] is not None else "-"
            notes.append("  %s: Fosc %g MHz, config word %s, ROM %s word" % (fn, fos / 1e6, cw, hs["rom"] if hs["rom"] else "-"))
    for x in body.get("extra") or []:
        if not isinstance(x, dict):
            continue
        fn = str(x.get("name", ""))
        if not DATA_RE.match(fn) and not re.match(r"^[A-Za-z0-9_\-]{1,40}\.(svg|png|txt|csv)$", fn):
            continue
        entries[fn] = base64.b64decode(x["base64"]) if x.get("base64") else str(x.get("text", "")).encode("utf-8")
    if body.get("svg"):
        entries["sema.svg"] = str(body["svg"]).encode("utf-8")
    if body.get("pngBase64"):
        b = str(body["pngBase64"])
        entries["sema.png"] = base64.b64decode(b.split(",", 1)[1] if b.startswith("data:") else b)
    if not entries:
        return {"error": "Pakete eklenecek dosya yok."}
    if body.get("readme", True):
        lines = ["EELAB teslim paketi", "",
                 "Ad Soyad : %s" % str(student.get("ad", "")).strip(),
                 "Numara   : %s" % str(student.get("no", "")).strip(),
                 "Tarih    : %s" % time.strftime("%Y-%m-%d %H:%M"),
                 "Klasör   : %s" % os.path.basename(PROJ),
                 "EELAB    : %s" % _version(),
                 "Yorumlar : %s" % ("kaldırıldı" if strip else "korundu"), "", "Dosyalar:"]
        lines += ["  " + k for k in sorted(entries)]
        if notes:
            lines += ["", "Program bilgisi:"] + notes
        entries["BENIOKU.txt"] = ("\r\n".join(lines) + "\r\n").encode("utf-8")
    dest_dir = os.path.join(HOME, "Teslim")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, zname + ".zip")
    tmp = dest + ".eelab_tmp"
    stamp = time.localtime()[:6]
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        for fn in sorted(entries):
            zi = zipfile.ZipInfo(fn, stamp)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            z.writestr(zi, entries[fn])
    os.replace(tmp, dest)
    if body.get("reveal", True):
        reveal(dest, True)
    return {"ok": True, "path": dest, "name": zname + ".zip", "files": sorted(entries), "missing": missing}


def reveal(path, select=False):
    if os.environ.get("EELAB_NO_REVEAL"):
        return False
    try:
        if sys.platform == "darwin":
            subprocess.Popen(["/usr/bin/open"] + (["-R"] if select else []) + [path])
        elif sys.platform.startswith("win"):
            subprocess.Popen(["explorer", "/select," + path] if select else ["explorer", path])
        else:
            subprocess.Popen(["xdg-open", os.path.dirname(path) if select else path])
        return True
    except OSError:
        return False


MCPPI_LIBS = (("Lcd", ("Lcd_Init", "Lcd_Cmd", "Lcd_Chr_Cp", "Lcd_Chr", "Lcd_Out_Cp", "Lcd_Out")),
              ("Lcd_Constants", ("Lcd_Init", "Lcd_Cmd", "Lcd_Chr_Cp", "Lcd_Chr", "Lcd_Out_Cp", "Lcd_Out")),
              ("Keypad4x4", ("Keypad_Init", "Keypad_Key_Press", "Keypad_Key_Click")),
              ("UART", ("UART_INIT", "UART1_Write", "UART1_Read", "UART1_Data_Ready", "UART1_Tx_Idle", "UART1_Write_Text", "UART1_Read_Text")),
              ("PWM", ("PWM_INIT", "PWM1_Set_Duty", "PWM1_Start", "PWM1_Stop")),
              ("EEPROM", ("EEPROM_Read", "EEPROM_Write")),
              ("Button", ("BUTTON",)),
              ("Sound", ("SOUND",)),
              ("Conversions", ("U2S", "L2S", "HEX", "U2Z", "Bcd2Dec", "Dec2Bcd")))


def mcppi_text(src, fosc, code):
    """F1: mikroC proje dosyasi (INI, CRLF)."""
    use = lib_uses(_strip(code)) if src.endswith(".c") else set()
    libs = [n for n, keys in MCPPI_LIBS if use & set(keys)]
    rows = ["[DEVICE]", "Name=P16F628A", "Clock=%d" % fosc, "[MEMORY_MODEL]", "Value=0", "[BUILD_TYPE]", "Value=0",
            "[ACTIVE_TAB]", "Value=" + src, "[USE_EEPROM]", "Value=0", "[USE_HEAP]", "Value=0", "[HEAP_SIZE]", "Value=0",
            "[EEPROM_DEFINITION]", "Value=", "[FILES]", "File0=" + src, "Count=1", "[BINARIES]", "Count=0",
            "[IMAGES]", "Count=0", "ActiveImageIndex=-1", "[OPENED_FILES]", "File0=" + src, "Count=1", "[EEPROM]", "Count=0",
            "[ACTIVE_COMMENTS_FILES]", "Count=0", "[OTHER_FILES]", "Count=0", "[SEARCH_PATH]", "Count=0", "[HEADER_PATH]", "Count=0",
            "[HEADERS]", "Count=0", "[PLDS]", "Count=0", "[Useses]"]
    rows += ["File%d=%s" % (i, n) for i, n in enumerate(libs)] + ["Count=%d" % len(libs)]
    rows += ["[EXPANDED_NODES]", "Count=0", "[LIB_EXPANDED_NODES]", "0=mikroE Libraries", "1=System Libraries", "Count=2"]
    return "\r\n".join(rows) + "\r\n"


def parse_ini(text):
    out, sec = {}, None
    for line in str(text or "").replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = line.strip().lstrip("\ufeff")
        if not line or line.startswith((";", "#")):
            continue
        m = re.match(r"^\[(.+)\]$", line)
        if m:
            sec = out.setdefault(m.group(1).strip().upper(), {})
        elif sec is not None and "=" in line:
            k, v = line.split("=", 1)
            sec[k.strip()] = v.strip()
    return out


def _free_name(fn):
    base, ext = os.path.splitext(fn)
    if not os.path.exists(os.path.join(PROJ, fn)):
        return fn
    for i in range(2, 1000):
        cand = "%s_%d%s" % (base[:37], i, ext)
        if not os.path.exists(os.path.join(PROJ, cand)):
            return cand
    raise OSError("bos ad bulunamadi")


def import_mcppi(body):
    ini = parse_ini(body.get("mcppi"))
    files = body.get("files") if isinstance(body.get("files"), dict) else {}
    warnings = []
    dev = ini.get("DEVICE", {})
    if dev.get("Name", "").upper() != "P16F628A":
        warnings.append("Aygıt %s; EELAB yalnızca P16F628A simüle eder." % (dev.get("Name") or "?"))
    try:
        clock = int(float(dev.get("Clock", "4000000")))
    except ValueError:
        clock = 4000000
    fosc = clock
    if clock not in FOSCS:
        fosc = min(FOSCS, key=lambda f: abs(f - clock))
        warnings.append("Saat %d Hz desteklenmiyor; %d Hz kullanıldı." % (clock, fosc))
    main = re.split(r"[\\/]", ini.get("FILES", {}).get("File0", ""))[-1]
    copied, main_to = [], None
    with LOCK:
        for fn, code in sorted(files.items()):
            fn = re.split(r"[\\/]", str(fn))[-1]
            if not FILE_RE.match(fn) or not isinstance(code, str):
                warnings.append("Atlandı: %s" % fn)
                continue
            to = _free_name(fn)
            with open(os.path.join(PROJ, to), "w") as f:
                f.write(code.replace("\r\n", "\n").replace("\r", "\n"))
            update_settings(to, {"fosc": fosc, "libModel": "mikroc"})
            copied.append(to)
            if fn.lower() == main.lower():
                main_to = to
    if not copied:
        return {"ok": False, "error": "Projede kopyalanacak .c dosyası yok.", "warnings": warnings}
    if not main_to:
        main_to = next((c for c in copied if c.endswith(".c")), copied[0])
        warnings.append("Ana dosya (%s) gönderilmedi; %s açıldı." % (main or "?", main_to))
    return {"ok": True, "name": main_to, "fosc": fosc, "warnings": warnings, "files": copied}


def export_mcppi(name):
    fn = fname(name)
    p = fn and os.path.join(PROJ, "%s.%s" % fn)
    if not fn or not os.path.isfile(p):
        return None
    base, ext = fn
    src = "%s.%s" % fn
    code = _read(p)
    buf = io.BytesIO()
    stamp = time.localtime()[:6]
    entries = {base + ".mcppi": mcppi_text(src, get_fosc(src), code).encode("utf-8"), src: code.encode("utf-8")}
    for k in ("hex", "lst", "asm", "log"):
        q = os.path.join(PROJ, base + "." + k)
        if k != ext and os.path.isfile(q):
            entries[base + "." + k] = open(q, "rb").read()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for k in sorted(entries):
            zi = zipfile.ZipInfo(k, stamp)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            z.writestr(zi, entries[k])
    return buf.getvalue()


OUTPUT_KINDS = ("lst", "asm", "log")


def write_output(body):
    fn = fname(body.get("name"))
    kind = body.get("kind")
    if kind not in OUTPUT_KINDS:
        return {"error": "Geçersiz çıktı türü (lst, asm, log)."}, 400
    if not fn or not os.path.isfile(os.path.join(PROJ, "%s.%s" % fn)):
        return {"error": "Kaynak dosya yok."}, 404
    if kind == fn[1]:
        return {"error": "Kaynak dosyanın üzerine yazılamaz."}, 400
    p = os.path.join(PROJ, "%s.%s" % (fn[0], kind))
    with open(p, "w", newline="") as f:
        f.write(str(body.get("text", "")))
    return {"ok": True, "path": p, "name": "%s.%s" % (fn[0], kind)}, 200


def ui_settings():
    d = eelab_paths.read_json(_settings_new(), {})
    ui = d.get("ui") if isinstance(d, dict) and isinstance(d.get("ui"), dict) else {}
    return {"lang": ui.get("lang") if ui.get("lang") in ("tr", "en") else "tr"}


def set_ui(patch):
    lang = patch.get("uiLang")
    if isinstance(patch.get("ui"), dict):
        lang = patch["ui"].get("lang", lang)
    lang = _clean_setting("uiLang", lang)
    if not lang:
        return None
    with LOCK:
        p = _settings_new()
        data = eelab_paths.read_json(p, {})
        if not isinstance(data, dict) or not isinstance(data.get("files"), dict):
            data = {"version": 1, "files": {}}
        data.setdefault("ui", {})["lang"] = lang
        eelab_paths.write_json(p, data)
    return ui_settings()


def templates():
    items = eelab_paths.read_json(os.path.join(APP, "templates", "index.json"), [])
    out = []
    for t in items if isinstance(items, list) else []:
        if not isinstance(t, dict) or not NAME_RE.match(str(t.get("id", ""))) or t.get("lang") not in ("c", "asm"):
            continue
        if not os.path.isfile(os.path.join(APP, "templates", "%s.%s" % (t["id"], t["lang"]))):
            continue
        t = {k: t[k] for k in ("id", "title", "lang", "fosc", "desc", "circuit") if k in t}
        if t.get("fosc") not in FOSCS:
            t["fosc"] = 4000000
        if t.get("circuit") and not os.path.isfile(os.path.join(APP, "circuits", t["circuit"] + ".json")):
            t.pop("circuit")
        out.append(t)
    return out


def template_code(tid):
    for t in templates():
        if t["id"] == tid:
            with open(os.path.join(APP, "templates", "%s.%s" % (t["id"], t["lang"]))) as f:
                return t, f.read()
    return None, None


def info():
    t = toolchain_status()
    translated = False
    if sys.platform == "darwin":
        ok, out = _probe(["/usr/sbin/sysctl", "-n", "sysctl.proc_translated"])
        translated = ok and out.strip() == "1"
    d = {"app": "EELAB", "version": _version(), "home": HOME, "workspace": PROJ, "current": os.path.basename(PROJ),
         "arch": platform.machine(), "translated": translated, "platform": sys.platform,
         "python": sys.executable, "pythonVersion": platform.python_version(), "app_dir": APP, "port": PORT,
         "toolchain": {"sdcc": t["sdcc"], "gputils": t["gputils"], "mode": t["mode"], "dir": TC}}
    if PATHS:
        d.update(stateDir=PATHS["state_dir"], notices=PATHS["notices"], migrated=PATHS["migrated"], examplesCopied=PATHS["copied"])
    return d


def workspace_info():
    return {"root": HOME, "current": os.path.basename(PROJ), "path": PROJ, "folders": eelab_paths.folders(HOME)}


def list_files():
    try:
        names = os.listdir(PROJ)
    except OSError:
        names = []
    return sorted((f for f in names if FILE_RE.match(f)), key=lambda f: (f.lower(), f))


def _trash(path):
    d = os.path.join(HOME, ".Silinenler")
    os.makedirs(d, exist_ok=True)
    dest = os.path.join(d, time.strftime("%Y%m%d-%H%M%S_") + os.path.basename(path))
    shutil.move(path, dest)
    return dest


class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, obj, code=200, ctype="application/json"):
        data = obj if isinstance(obj, bytes) else json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype + "; charset=utf-8" if ctype.startswith(("text/", "application/j")) else ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def _host_ok(self):
        ok = ("127.0.0.1:%d" % PORT, "localhost:%d" % PORT)
        if self.headers.get("Host", "") not in ok:
            return False
        o = self.headers.get("Origin")
        return not o or o in ("http://" + h for h in ok) or o == "null" and self.command == "GET"

    def do_GET(self):
        if not self._host_ok():
            return self.send({"error": "yasak"}, 403)
        u = urlparse(self.path)
        q = parse_qs(u.query)
        arg = lambda k: q.get(k, [""])[0]
        if u.path in ("/", "/index.html"):
            return self.send(open(os.path.join(APP, "index.html"), "rb").read(), ctype="text/html")
        m = re.match(r"^/(js|css|img|circuits)/([A-Za-z0-9_\-]+(?:\.[A-Za-z0-9_\-]+)*\.(js|css|json|png|svg))$", u.path)
        if m:
            fp = os.path.join(APP, m.group(1), m.group(2))
            if not os.path.isfile(fp):
                return self.send({"error": "yok"}, 404)
            ct = {"js": "text/javascript", "css": "text/css", "json": "application/json", "png": "image/png", "svg": "image/svg+xml"}[m.group(3)]
            return self.send(open(fp, "rb").read(), ctype=ct)
        if u.path == "/api/ping":
            last_ping[0] = time.time()
            return self.send({"ok": True, "app": "EELAB", "version": _version(), "pid": os.getpid(), "port": PORT})
        last_ping[0] = time.time()
        if u.path == "/api/info":
            d = info()
            d.update(libModels=["eelab", "mikroc"], libModelDefault=LIB_MODEL_DEFAULT, ui=ui_settings())
            return self.send(d)
        if u.path == "/api/export-mcppi":
            data = export_mcppi(arg("name"))
            if data is None:
                return self.send({"error": "dosya yok"}, 404)
            return self.send(data, ctype="application/zip")
        if u.path == "/api/workspace":
            return self.send(workspace_info())
        if u.path == "/api/templates":
            return self.send(templates())
        if u.path == "/api/template":
            t, code = template_code(arg("id"))
            if not t:
                return self.send({"error": "Şablon bulunamadı"}, 404)
            return self.send(dict(t, code=code))
        if u.path == "/api/libs":
            return self.send(lib_info())
        if u.path == "/api/circuits":
            ws, ex = set(), set()
            for d, s in ((PROJ, ws), (os.path.join(APP, "circuits"), ex)):
                if os.path.isdir(d):
                    s.update(f[:-5] for f in os.listdir(d) if f.endswith(".json") and NAME_RE.match(f[:-5]))
            return self.send({"files": sorted(ws | ex), "workspace": sorted(ws), "examples": sorted(ex)})
        if u.path == "/api/circuit":
            name = arg("name")
            if not NAME_RE.match(name):
                return self.send({"error": "dosya yok"}, 404)
            fp = _find_data_file(name + ".json")
            if not fp:
                return self.send({"error": "dosya yok"}, 404)
            return self.send(open(fp, "rb").read())
        if u.path == "/api/files":
            fs = list_files()
            st = all_settings()
            return self.send({"files": fs, "dir": PROJ, "workspace": os.path.basename(PROJ), "fosc": {f: get_fosc(f) for f in fs},
                              "circuit": {f: st[f]["circuit"] for f in fs if st.get(f, {}).get("circuit")},
                              "libModel": {f: file_settings(f)["libModel"] for f in fs if f.endswith(".c")}})
        if u.path == "/api/file":
            fn = fname(arg("name"))
            p = fn and os.path.join(PROJ, "%s.%s" % fn)
            if not fn or not os.path.isfile(p):
                return self.send({"error": "dosya yok"}, 404)
            code = open(p, newline="", errors="replace").read().replace("\r\n", "\n").replace("\r", "\n")
            full = "%s.%s" % fn
            s = file_settings(full)
            return self.send({"name": full, "code": code, "lang": fn[1], "fosc": s["fosc"], "settings": s,
                              "hasHex": os.path.isfile(os.path.join(PROJ, fn[0] + ".hex"))})
        if u.path == "/api/hex":
            n = arg("name")
            n = n[:-4] if n.endswith(".hex") else re.sub(r"\.(c|asm)$", "", n)
            p = os.path.join(PROJ, n + ".hex")
            if not NAME_RE.match(n) or not os.path.isfile(p):
                return self.send({"error": "dosya yok"}, 404)
            return self.send({"name": n + ".hex", "hex": _read(p)})
        self.send({"error": "yok"}, 404)

    def do_POST(self):
        if not self._host_ok():
            return self.send({"error": "yasak"}, 403)
        try:
            n = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            n = -1
        if n < 0 or n > MAX_BODY:
            return self.send({"error": "istek çok büyük"}, 413)
        raw = self.rfile.read(n)
        u = urlparse(self.path)
        last_ping[0] = time.time()
        if u.path == "/api/import-pdsprj":
            try:
                import importlib, pdsprj
                importlib.reload(pdsprj)
                r = pdsprj.parse_pdsprj(raw)
            except Exception as e:
                return self.send({"error": "Proteus dosyasi okunamadi: %s" % e})
            save = parse_qs(u.query).get("save", [""])[0]
            if save and isinstance(r, dict) and not r.get("error"):
                save = re.sub(r"\.pdsprj$", "", save, flags=re.I)
                if NAME_RE.match(save):
                    with open(os.path.join(PROJ, save + ".pdsprj"), "wb") as f:
                        f.write(raw)
                    r["saved"] = save + ".pdsprj"
            return self.send(r)
        try:
            body = json.loads(raw or b"{}")
        except ValueError:
            return self.send({"error": "gecersiz istek"}, 400)
        if not isinstance(body, dict):
            return self.send({"error": "gecersiz istek"}, 400)
        try:
            return self.route(u.path, body)
        except OSError as e:
            return self.send({"error": "Dosya işlemi başarısız: %s" % (e.strerror or e)}, 500)

    def route(self, path, body):
        name = str(body.get("name", ""))
        if path == "/api/reveal":
            folder = str(body.get("folder", ""))
            if folder == "Teslim":
                target, sel = os.path.join(HOME, "Teslim"), False
            elif folder == "home":
                target, sel = HOME, False
            elif name:
                if not DATA_RE.match(name) or not os.path.exists(os.path.join(PROJ, name)):
                    return self.send({"error": "dosya yok"}, 404)
                target, sel = os.path.join(PROJ, name), True
            else:
                target, sel = PROJ, False
            if not sel:
                os.makedirs(target, exist_ok=True)
            return self.send({"ok": True, "path": target, "opened": reveal(target, sel)})
        if path == "/api/workspace":
            action = body.get("action")
            if action not in ("open", "create") or not NAME_RE.match(name) or name == "Teslim":
                return self.send({"error": "Geçersiz klasör adı (harf, rakam, _ ve -; en çok 40)."}, 400)
            target = os.path.join(HOME, name)
            with LOCK:
                if action == "create":
                    os.makedirs(target, exist_ok=True)
                elif not os.path.isdir(target):
                    return self.send({"error": "Klasör bulunamadı: " + name}, 404)
                set_workspace(target)
                if PATHS:
                    eelab_paths.save_current(PATHS, name)
            return self.send(workspace_info())
        if path == "/api/export":
            r = export_zip(body)
            return self.send(r, 200 if r.get("ok") else 400)
        if path == "/api/export-file":
            ext = body.get("ext")
            if ext not in ("svg", "png", "csv", "txt") or not NAME_RE.match(name):
                return self.send({"error": "Geçersiz ad veya uzantı"}, 400)
            b = body.get("base64")
            if b:
                b = str(b)
                data = base64.b64decode(b.split(",", 1)[1] if b.startswith("data:") else b)
            else:
                data = str(body.get("text", "")).encode("utf-8")
            p = os.path.join(PROJ, name + "." + ext)
            with open(p, "wb") as f:
                f.write(data)
            if body.get("reveal"):
                reveal(p, True)
            return self.send({"ok": True, "path": p})
        if path == "/api/circuit-save":
            if not NAME_RE.match(name):
                return self.send({"error": "Dosya adi sadece harf, rakam, _ ve - icerebilir."}, 400)
            with open(os.path.join(PROJ, name + ".json"), "w") as f:
                json.dump(body.get("circuit", {}), f)
            return self.send({"ok": True})
        if path == "/api/circuit-delete":
            p = os.path.join(PROJ, name + ".json")
            if not NAME_RE.match(name) or not os.path.isfile(p):
                return self.send({"error": "Devre bu klasörde yok: " + name}, 404)
            _trash(p)
            return self.send({"ok": True})
        if path in ("/api/delete", "/api/rename", "/api/duplicate"):
            src = name if DATA_RE.match(name) else ("%s.%s" % fname(name) if fname(name) else "")
            p = os.path.join(PROJ, src)
            if not src or not os.path.isfile(p):
                return self.send({"error": "Dosya bulunamadı: " + name}, 404)
            if path == "/api/delete":
                _trash(p)
                if FILE_RE.match(src):
                    update_settings(src, {}, remove=True)
                return self.send({"ok": True})
            to = str(body.get("to", ""))
            if NAME_RE.match(to):
                to += os.path.splitext(src)[1]
            if not DATA_RE.match(to) or os.path.splitext(to)[1] != os.path.splitext(src)[1]:
                return self.send({"error": "Yeni ad geçersiz (uzantı aynı kalmalı)."}, 400)
            q = os.path.join(PROJ, to)
            if os.path.exists(q):
                return self.send({"error": "Bu adda bir dosya zaten var: " + to}, 409)
            s = all_settings().get(src)
            if path == "/api/rename":
                os.rename(p, q)
                if FILE_RE.match(src):
                    update_settings(src, {}, remove=True)
            else:
                shutil.copy2(p, q)
            if s and FILE_RE.match(to):
                update_settings(to, s)
            return self.send({"ok": True, "name": to})
        if path == "/api/output":
            r, code = write_output(body)
            return self.send(r, code)
        if path == "/api/import-mcppi":
            r = import_mcppi(body)
            return self.send(r, 200 if r.get("ok") else 400)
        if path == "/api/settings" and not name:
            ui = set_ui(body)
            if ui is None:
                return self.send({"error": "Geçersiz ayar (ui.lang: tr | en)."}, 400)
            return self.send({"ok": True, "ui": ui})
        if path == "/api/new":
            tid = body.get("template")
            t, tcode = template_code(str(tid)) if tid else (None, None)
            if tid and not t:
                return self.send({"error": "Şablon bulunamadı: %s" % tid}, 404)
            if t and NAME_RE.match(name):
                name = name + "." + t["lang"]
            fn = fname(name)
            if not fn:
                return self.send({"error": "Dosya adi sadece harf, rakam, _ ve - icerebilir (uzanti .c ya da .asm)."}, 400)
            if t and fn[1] != t["lang"]:
                return self.send({"error": "Şablon dili (%s) dosya uzantısıyla uyuşmuyor." % t["lang"]}, 400)
            full = "%s.%s" % fn
            p = os.path.join(PROJ, full)
            if os.path.exists(p):
                return self.send({"error": "Bu adda bir dosya zaten var: " + full})
            if tcode is None:
                _, tcode = template_code("blank_" + fn[1])
            code = tcode if tcode is not None else (STARTER if fn[1] == "c" else STARTER_ASM)
            with open(p, "w") as f:
                f.write(code)
            patch = {}
            patch["libModel"] = "mikroc"
            if t:
                patch["fosc"] = t["fosc"]
                if t.get("circuit"):
                    patch["circuit"] = t["circuit"]
            if "fosc" in body:
                patch["fosc"] = body.get("fosc")
            s = update_settings(full, patch) if patch else file_settings(full)
            return self.send({"ok": True, "name": full, "settings": s, "circuit": s.get("circuit") or None})
        fn = fname(name)
        if not fn:
            return self.send({"error": "Dosya adi sadece harf, rakam, _ ve - icerebilir (uzanti .c ya da .asm)."}, 400)
        full = "%s.%s" % fn
        p = os.path.join(PROJ, full)
        if path == "/api/settings":
            s = update_settings(full, body)
            return self.send({"ok": True, "name": full, "settings": s, "fosc": s["fosc"], "libModel": s["libModel"]})
        code = str(body.get("code", ""))
        if path == "/api/save":
            with open(p, "w") as f:
                f.write(code.replace("\r\n", "\n").replace("\r", "\n"))
            if "fosc" in body:
                set_fosc(full, body.get("fosc"))
            return self.send({"ok": True})
        if path == "/api/build":
            try:
                return self.send(build(full, code, body.get("fosc"), body.get("libModel")))
            except Exception as e:
                t = "Derleyici calistirilamadi: %s" % e
                return self.send({"ok": False, "messages": [t], "diag": [],
                                  "mc": [mc_msg("error", 0, 0, "raw", [t], full), mc_msg("error", 0, 102, "finishedErr", [mc_date()], fn[0] + ".mcppi")]})
        self.send({"error": "yok"}, 404)


def watchdog():
    while True:
        time.sleep(30)
        if time.time() - last_ping[0] > 900:
            shutdown(0)


def _server_json():
    return os.path.join(eelab_paths.state_dir(), "server.json")


def _write_server_state(port):
    p = _server_json()
    os.makedirs(os.path.dirname(p), exist_ok=True)
    eelab_paths.write_json(p, {"pid": os.getpid(), "port": port, "url": "http://127.0.0.1:%d/" % port, "version": _version()})


def shutdown(code=0, *_):
    if LAUNCHER[0]:
        try:
            if eelab_paths.read_json(_server_json(), {}).get("pid") == os.getpid():
                os.remove(_server_json())
        except OSError:
            pass
    os._exit(code)


def _is_eelab(port):
    try:
        with urllib.request.urlopen("http://127.0.0.1:%d/api/ping" % port, timeout=1.5) as r:
            return json.loads(r.read().decode()).get("app") == "EELAB"
    except Exception:
        return False


def selftest():
    global PROJ, SETTINGS
    t = toolchain_status()
    golden = dict(GOLDEN)
    for gp in (os.path.join(APP, "..", "selftest", "golden.json"), os.path.join(APP, "packaging", "selftest", "golden.json")):
        g = eelab_paths.read_json(gp, None)
        if isinstance(g, dict) and isinstance(g.get("files"), dict):
            g = g["files"]
        if isinstance(g, dict):
            golden.update({k: v for k, v in g.items() if isinstance(v, str)})
            break
    src = os.path.join(APP, "projeler")
    work = tempfile.mkdtemp(prefix="eelab_selftest_")
    old = (PROJ, SETTINGS)
    results = []
    try:
        set_workspace(work)
        if os.path.isfile(os.path.join(src, ".ayarlar.json")):
            shutil.copy(os.path.join(src, ".ayarlar.json"), SETTINGS)
        for f in sorted(os.listdir(src)) if os.path.isdir(src) else []:
            if not FILE_RE.match(f):
                continue
            with open(os.path.join(src, f)) as fh:
                r = build(f, fh.read())
            hx = os.path.splitext(f)[0] + ".hex"
            md5 = hashlib.md5(r["hex"].encode()).hexdigest() if r.get("ok") else None
            exp = golden.get(hx)
            results.append({"file": f, "ok": bool(r.get("ok")), "md5": md5, "expected": exp, "match": None if exp is None else md5 == exp,
                            "messages": [] if r.get("ok") else r.get("messages", [])[:5]})
    finally:
        PROJ, SETTINGS = old
        shutil.rmtree(work, ignore_errors=True)
    ok = t["mode"] != "missing" and bool(results) and all(x["ok"] and x["match"] is not False for x in results)
    return {"ok": ok, "app": "EELAB", "version": _version(), "arch": platform.machine(), "platform": sys.platform,
            "python": sys.executable, "toolchain": {"mode": t["mode"], "sdcc": t["sdcc"], "gputils": t["gputils"], "dir": TC}, "results": results}


def main():
    global PORT, URL, HOME, PATHS
    parser = argparse.ArgumentParser(prog="server.py", description="EELAB yerel sunucusu")
    parser.add_argument("--no-open", action="store_true", help="tarayıcıyı açma")
    parser.add_argument("--launcher", action="store_true", help="başlatıcı kipi: server.json yazar, tarayıcıyı açar")
    parser.add_argument("--port", type=int, help="bu porta bağlan (0 = boş bir port)")
    parser.add_argument("--selftest", action="store_true", help="örnekleri derle, md5 karşılaştır, JSON yaz")
    args = parser.parse_args()
    if args.port is not None and not 0 <= args.port <= 65535:
        parser.error("port must be between 0 and 65535")
    if args.selftest:
        r = selftest()
        print(json.dumps(r, ensure_ascii=False))
        sys.exit(0 if r["ok"] else 1)
    LAUNCHER[0] = args.launcher
    PATHS = eelab_paths.init(APP, _version())
    HOME = PATHS["home"]
    set_workspace(PATHS["workspace"])
    srv = None
    if args.port is not None:
        try:
            srv = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), H)
        except OSError as e:
            sys.stderr.write("EELAB: port %d kullanılamıyor: %s\n" % (args.port, e))
            sys.exit(1)
    else:
        for p in range(8321, 8400):
            if p == 8321 and _is_eelab(p):
                url = "http://127.0.0.1:%d/" % p
                print("EELAB zaten çalışıyor: " + url, flush=True)
                if not args.no_open:
                    webbrowser.open(url)
                return
            try:
                srv = http.server.ThreadingHTTPServer(("127.0.0.1", p), H)
                break
            except OSError:
                continue
        if srv is None:
            sys.stderr.write("EELAB: 8321-8399 arasında boş port yok\n")
            sys.exit(1)
    PORT = srv.server_address[1]
    URL = "http://127.0.0.1:%d/" % PORT
    if args.launcher:
        _write_server_state(PORT)
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *a: shutdown(0))
    threading.Thread(target=toolchain_status, daemon=True).start()
    threading.Thread(target=watchdog, daemon=True).start()
    print("EELAB %s %s" % (_version(), URL), flush=True)
    if not args.no_open:
        threading.Timer(0.4, lambda: webbrowser.open(URL)).start()
    srv.serve_forever()


if __name__ == "__main__":
    main()
