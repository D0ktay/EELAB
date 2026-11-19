import hashlib
import json
import os
import re
import shutil
import sys
import time

NAME_RE = re.compile(r"^[A-Za-z0-9_\-]{1,40}$")
DATA_RE = re.compile(r"^[A-Za-z0-9_\-]{1,40}\.(c|asm|hex|json|pdsprj)$")
SPECIAL = ("Ornekler", "Projelerim", "Teslim")
EXAMPLE_CIRCUITS = {
    "Lab1_LedSwitch.c": "lab1_led_switch",
    "Lab2.asm": "lab2",
    "Task1.c": "lab3",
    "Task2.c": "lab3",
    "Timer0_Interrupt.c": "lab1_led_switch",
    "Pwm_Demo.c": "lab1_led_switch",
    "Eeprom_Demo.c": "lab1_led_switch",
    "Lcd_Demo.c": "lcd_demo",
    "Keypad_Demo.c": "keypad_demo",
    "Uart_Demo.c": "uart_demo",
    "Mux4_Demo.c": "mux4_demo",
}


def toolchain_dir(app):
    env = os.environ.get("EELAB_TOOLCHAIN")
    if env:
        return os.path.abspath(env)
    local = os.path.join(app, "toolchain")
    return os.path.abspath(local if os.path.isdir(local) else os.path.join(app, "..", "toolchain"))


def state_dir():
    env = os.environ.get("EELAB_STATE_DIR")
    if env:
        return os.path.abspath(env)
    if sys.platform == "darwin":
        return os.path.expanduser("~/Library/Application Support/EELAB")
    if sys.platform.startswith("win"):
        return os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), "EELAB")
    return os.path.join(os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share"), "EELAB")


def read_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write_json(path, data):
    tmp = path + ".eelab_tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1, sort_keys=True, ensure_ascii=False)
    os.replace(tmp, path)


def load_state():
    return read_json(os.path.join(state_dir(), "state.json"), {})


def default_home(state=None):
    env = os.environ.get("EELAB_HOME")
    if env:
        return os.path.abspath(os.path.expanduser(env))
    st = load_state() if state is None else state
    h = st.get("home") if isinstance(st, dict) else None
    if isinstance(h, str) and h and os.path.isdir(h):
        return h
    return os.path.join(os.path.expanduser("~/Documents"), "EELAB")


def folders(home):
    try:
        names = os.listdir(home)
    except OSError:
        return []
    return sorted((n for n in names if NAME_RE.match(n) and n != "Teslim" and os.path.isdir(os.path.join(home, n))), key=lambda n: (n.lower(), n))


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(65536), b""):
            h.update(b)
    return h.hexdigest()


def legacy_settings(src):
    d = read_json(os.path.join(src, ".ayarlar.json"), {})
    return {k: v for k, v in d.items() if isinstance(v, dict)} if isinstance(d, dict) else {}


def merge_settings(folder, files):
    if not files:
        return
    p = os.path.join(folder, ".eelab.json")
    data = read_json(p, {})
    if not isinstance(data, dict) or not isinstance(data.get("files"), dict):
        data = {"version": 1, "files": {}}
    for fn, s in files.items():
        cur = data["files"].setdefault(fn, {})
        for k, v in s.items():
            cur.setdefault(k, v)
    write_json(p, data)


def example_sources(app):
    out = []
    for sub in ("projeler", "circuits"):
        d = os.path.join(app, sub)
        if os.path.isdir(d):
            for f in sorted(os.listdir(d)):
                if DATA_RE.match(f) and os.path.isfile(os.path.join(d, f)):
                    out.append(os.path.join(d, f))
    return out


def copy_examples(app, examples):
    copied = []
    for s in example_sources(app):
        d = os.path.join(examples, os.path.basename(s))
        if not os.path.exists(d):
            shutil.copy2(s, d)
            copied.append(os.path.basename(s))
    present = set(os.listdir(examples))
    files = {}
    for fn, s in legacy_settings(os.path.join(app, "projeler")).items():
        if fn in present:
            files[fn] = {k: v for k, v in s.items() if k == "fosc"}
    for fn, c in EXAMPLE_CIRCUITS.items():
        if fn in present and c + ".json" in present:
            files.setdefault(fn, {})["circuit"] = c
    merge_settings(examples, files)
    return copied


def migration_candidates(app):
    c = [os.environ.get("EELAB_MIGRATE_FROM"), os.path.expanduser("~/Downloads/EE321_Lab3_Studio/projeler")]
    m = re.search(r"^(.*?)[/\\][^/\\]+\.app[/\\]Contents[/\\]Resources[/\\]app$", app)
    c.append(os.path.join(m.group(1) if m else os.path.dirname(app), "projeler"))
    out = []
    for p in c:
        if p:
            p = os.path.abspath(os.path.expanduser(p))
            if p not in out:
                out.append(p)
    return out


def migrate(app, home, state):
    done = state.setdefault("migrated", [])
    dest = os.path.join(home, "Projelerim")
    known = set()
    for s in example_sources(app):
        try:
            known.add(sha256(s))
        except OSError:
            pass
    report = []
    for src in migration_candidates(app):
        if src in done or not os.path.isdir(src):
            continue
        try:
            if os.path.commonpath([src, home]) == home:
                continue
        except ValueError:
            pass
        copied, fos = [], {}
        old = legacy_settings(src)
        for f in sorted(os.listdir(src)):
            s = os.path.join(src, f)
            if not DATA_RE.match(f) or not os.path.isfile(s) or os.path.islink(s):
                continue
            h = sha256(s)
            if h in known:
                continue
            d = os.path.join(dest, f)
            root, ext = os.path.splitext(f)
            n = 0
            while os.path.exists(d):
                if sha256(d) == h:
                    d = None
                    break
                n += 1
                d = os.path.join(dest, "%s_eski%s%s" % (root, "" if n == 1 else n, ext))
            if d is None:
                continue
            shutil.copy2(s, d)
            copied.append(os.path.basename(d))
            if f in old:
                fos[os.path.basename(d)] = {k: v for k, v in old[f].items() if k in ("fosc", "circuit")}
        merge_settings(dest, fos)
        done.append(src)
        report.append({"from": src, "files": copied})
    return report


def init(app, version="dev"):
    app = os.path.abspath(app)
    sdir = state_dir()
    os.makedirs(sdir, exist_ok=True)
    spath = os.path.join(sdir, "state.json")
    state = read_json(spath, {})
    if not isinstance(state, dict):
        state = {}
    notices = []
    home = default_home(state)
    try:
        os.makedirs(home, exist_ok=True)
        for n in SPECIAL:
            os.makedirs(os.path.join(home, n), exist_ok=True)
    except OSError as e:
        fb = os.path.expanduser("~/EELAB")
        notices.append("%s klasörüne yazılamadı (%s); veriler %s altında tutulacak." % (home, e.strerror or e, fb))
        home = fb
        os.makedirs(home, exist_ok=True)
        for n in SPECIAL:
            os.makedirs(os.path.join(home, n), exist_ok=True)
    state["schema"] = 1
    if not os.environ.get("EELAB_HOME"):
        state["home"] = home
    examples = os.path.join(home, "Ornekler")
    copied = []
    if state.get("examplesVersion") != version or not os.listdir(examples):
        copied = copy_examples(app, examples)
        state["examplesVersion"] = version
    migrated = migrate(app, home, state)
    cur = state.get("current")
    if not isinstance(cur, str) or not NAME_RE.match(cur) or cur == "Teslim" or not os.path.isdir(os.path.join(home, cur)):
        cur = "Projelerim"
    state["current"] = cur
    state["updated"] = int(time.time())
    write_json(spath, state)
    return {"home": home, "workspace": os.path.join(home, cur), "current": cur, "state": state, "state_path": spath,
            "state_dir": sdir, "notices": notices, "copied": copied, "migrated": migrated}


def save_current(info, name):
    info["state"]["current"] = name
    info["current"] = name
    info["workspace"] = os.path.join(info["home"], name)
    write_json(info["state_path"], info["state"])
