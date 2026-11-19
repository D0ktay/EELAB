#!/bin/bash
# EELAB paket testi (plan §3.3 WS-A): uygulamayı derler (ya da --skip-build ile mevcut dist/EELAB.app'i kullanır),
# statik denetimler + boşluklu/Türkçe karakterli yola kopyalanmış paketle gerçek HTTP derleme + kur.sh denetimi.
# Kullanım: tests/package_test.sh [--skip-build] [--arch universal|x86_64|arm64] [--dmg]
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKIP=0; ARCH=universal; DMG=0
while (($#)); do case "$1" in
  --skip-build) SKIP=1; shift;; --arch) ARCH="$2"; shift 2;; --dmg) DMG=1; shift;;
  *) echo "bilinmeyen seçenek: $1" >&2; exit 2;; esac; done
case "$ARCH" in universal) WANT="arm64 x86_64";; *) WANT="$ARCH";; esac
HOSTARCH="$(uname -m)"
FAILS=0; PASSES=0
ok()   { PASSES=$((PASSES + 1)); echo "ok    $*"; }
bad()  { FAILS=$((FAILS + 1)); echo "FAIL  $*"; }
step() { echo; echo "== $*"; }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/eelab_pkg.XXXXXX")"; TMP="$(cd "$TMP" && pwd -P)"
SRV=""
cleanup() {
  [ -n "$SRV" ] && kill "$SRV" 2>/dev/null && wait "$SRV" 2>/dev/null
  [ -n "${MNT:-}" ] && [ -d "$MNT" ] && hdiutil detach -quiet "$MNT" 2>/dev/null
  rm -rf "$TMP"
}
trap cleanup EXIT

APP="$ROOT/dist/EELAB.app"
if ((!SKIP)); then
  step "paket derleniyor ($ARCH)"
  "$ROOT/packaging/build_app.sh" --arch "$ARCH" || { echo "FAIL  build_app.sh"; exit 1; }
  if ((DMG)); then "$ROOT/packaging/make_dmg.sh" --skip-build || { echo "FAIL  make_dmg.sh"; exit 1; }; fi
fi
[ -d "$APP" ] || { echo "FAIL  $APP yok"; exit 1; }
R="$APP/Contents/Resources"

step "1-4) Mach-O dilimleri, bağımlılıklar, minos, gömülü yollar"
MACHOS=()
while IFS= read -r -d '' f; do file -b "$f" | grep -q '^Mach-O' && MACHOS+=("$f"); done < <(find "$APP" -type f -print0)
echo "Mach-O sayısı: ${#MACHOS[@]}"
for f in "${MACHOS[@]}"; do
  rel="${f#$APP/}"
  archs="$(lipo -archs "$f" 2>/dev/null | tr ' ' '\n' | sort | tr '\n' ' ' | sed 's/ $//')"
  case "$rel" in
    */python/arm64/*) want=arm64;; */python/x86_64/*) want=x86_64;; *) want="$WANT";;
  esac
  [ "$archs" = "$want" ] && ok "dilim  $rel: $archs" || bad "dilim  $rel: '$archs' (beklenen '$want')"
  deps="$(otool -L "$f" | tail -n +2 | awk '{print $1}' | grep -v -E '^(/usr/lib/|/System/Library/)' | grep -v -E '^@' | sort -u)"
  [ -z "$deps" ] && ok "bağım  $rel" || bad "bağım  $rel: $deps"
  for a in $archs; do
    m="$(otool -arch "$a" -l "$f" | awk '/LC_BUILD_VERSION/{b=1} b&&/minos/{print $2; exit} /LC_VERSION_MIN_MACOSX/{v=1} v&&/version/{print $2; exit}')"
    if [ -n "$m" ] && [ "$(printf '%s\n11.0\n' "$m" | sort -V | tail -1)" = 11.0 ]; then ok "minos  $rel [$a] $m"; else bad "minos  $rel [$a] '$m' > 11.0"; fi
  done
  n="$(strings -a "$f" | grep -c -E '(^|[^:A-Za-z])/Users/')"
  [ "$n" = 0 ] && ok "yol    $rel: /Users/ yok" || bad "yol    $rel içinde $n adet /Users/ dizgesi"
done
U="$(id -un)"
leaks="$(grep -rIl -E '(^|[^:A-Za-z])/Users/' "$APP" 2>/dev/null)"
[ -z "$leaks" ] && ok "pakette /Users/ yolu yok" || bad "pakette /Users/ yolu: $leaks"
FIXED_RE="^$R/toolchain/(lib|include|nonfree|lkr|gpheader)/"
leaks="$(grep -rl -- "/$U/" "$APP" 2>/dev/null | grep -v -E "$FIXED_RE")"
[ -z "$leaks" ] && ok "pakette kullanıcı adı yolu yok (sabit PIC kütüphaneleri hariç)" || bad "pakette /$U/ geçen dosyalar: $leaks"
fixed_leaks="$(grep -rl -- "/$U/" "$APP" 2>/dev/null | grep -E "$FIXED_RE" | sed "s|^$R/||" | tr '\n' ' ')"
[ -n "$fixed_leaks" ] && echo "bilgi bayt bayt korunan sabit dosyalarda özgün derleme yolu var (plan gereği değiştirilmedi): $fixed_leaks"
for p in Contents/MacOS/EELAB Contents/Info.plist Contents/Resources/EELAB.icns Resources/app/server.py \
         Resources/toolchain/bin/sdcpp Resources/selftest/golden.json Resources/LICENSES/KAYNAKLAR.txt; do
  p="${p#Contents/}"; [ -e "$APP/Contents/$p" ] && ok "dosya  $p" || bad "dosya  $p yok"
done
for f in tests SPEC.md EELAB_PLAN.md packaging; do [ -e "$R/app/$f" ] && bad "pakete girmemeli: app/$f"; done
for f in "$R/app/projeler/"Task1.* "$R/app/projeler/"Task2.* "$R/app/projeler/"*.hex; do
  [ -e "$f" ] && bad "pakete girmemeli: ${f#$R/}"
done
[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleName' "$APP/Contents/Info.plist")" = EELAB ] && ok "CFBundleName=EELAB" || bad "CFBundleName"
[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist")" = "$(head -1 "$ROOT/VERSION")" ] && ok "sürüm = VERSION" || bad "sürüm"
/usr/bin/python3 -I - "$R/toolchain" "$ROOT/toolchain" <<'PY' && ok "toolchain sabit dosyaları depo ve manifestle bayt bayt aynı" || bad "toolchain sabit dosyaları farklı"
import hashlib, json, os, sys
pk, repo = sys.argv[1], sys.argv[2]
man = json.load(open(os.path.join(pk, "VERSION.json")))["fixed"]
h = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
bad = [k for k, v in man.items() if h(os.path.join(pk, k)) != v or h(os.path.join(repo, k)) != v]
for d in ("include", "lib", "nonfree", "lkr", "gpheader"):
    for r, _, fs in os.walk(os.path.join(pk, d)):
        bad += [os.path.relpath(os.path.join(r, f), pk) for f in fs if os.path.relpath(os.path.join(r, f), pk) not in man]
print("\n".join(bad)); sys.exit(1 if bad else 0)
PY

step "5) imza"
codesign --verify --deep --strict "$APP" 2>&1 && ok "codesign --verify --deep --strict" || bad "codesign doğrulaması"

step "6) boşluklu/Türkçe yola kopyala, env -i ile çalıştır, HTTP derleme"
DEST="$TMP/EE Lab Öğrenci"; mkdir -p "$DEST"
ditto "$APP" "$DEST/EELAB.app"
CA="$DEST/EELAB.app"
HOMEDIR="$TMP/ev"; mkdir -p "$HOMEDIR"
snapshot() { (cd "$CA" && find . -print0 | sort -z | xargs -0 stat -f '%N %z %m %p') | shasum -a 256 | cut -d' ' -f1; }
SNAP0="$(snapshot)"
CFG="$(env -i HOME="$HOMEDIR" PATH=/usr/bin:/bin "$CA/Contents/MacOS/EELAB" --print-config)" && ok "başlatıcı --print-config" || bad "başlatıcı --print-config"
PY="$(printf '%s' "$CFG" | /usr/bin/python3 -I -c 'import json,sys; c=json.load(sys.stdin)["candidates"]; print(c[0]["python"] if c else "")')"
same() { /usr/bin/python3 -I -c 'import os,sys,unicodedata as u; n=lambda p: u.normalize("NFC", os.path.realpath(p)); sys.exit(n(sys.argv[1]) != n(sys.argv[2]))' "$1" "$2"; }
same "$PY" "$CA/Contents/Resources/python/$HOSTARCH/bin/python3" && ok "başlatıcı göreli python seçti: …/Resources/python/$HOSTARCH/bin/python3" || bad "başlatıcı python seçimi: '$PY'"
[ -x "$PY" ] || { echo "FAIL  python yok; devam edilemiyor"; exit 1; }
SERVER="$CA/Contents/Resources/app/server.py"
PORT="$(env -i "$PY" -I -B -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])')"
EHOME="$HOMEDIR/Documents/EELAB"
env -i HOME="$HOMEDIR" PATH=/usr/bin:/bin LANG=en_US.UTF-8 EELAB_HOME="$EHOME" TMPDIR="$TMP/" \
  "$PY" -I -B "$SERVER" --launcher --no-open --port "$PORT" >"$TMP/server.log" 2>&1 &
SRV=$!
BASE="http://127.0.0.1:$PORT"
for _ in $(seq 1 100); do curl -fsm 1 "$BASE/api/ping" >/dev/null 2>&1 && break; sleep 0.1; done
PING="$(curl -fsm 3 "$BASE/api/ping")"
case "$PING" in *'"app": "EELAB"'*|*'"app":"EELAB"'*) ok "/api/ping → $PING";; *) bad "/api/ping: '$PING'"; cat "$TMP/server.log";; esac
code="$(curl -s -o "$TMP/index.html" -w '%{http_code}' "$BASE/")"
[ "$code" = 200 ] && grep -qi '<html' "$TMP/index.html" && ok "GET / → 200" || bad "GET / → $code"
SJ="$HOMEDIR/Library/Application Support/EELAB/server.json"
[ -f "$SJ" ] && grep -q "\"port\": *$PORT" "$SJ" && ok "server.json yazıldı (port $PORT)" || bad "server.json yok/yanlış"
INFO="$(curl -fsm 5 "$BASE/api/info")"
/usr/bin/python3 -I - "$INFO" "$CA" <<'PY' && ok "/api/info: python ve toolchain paket içinde, kip native" || bad "/api/info: $INFO"
import json, os, sys
import unicodedata
n = lambda p: unicodedata.normalize("NFC", os.path.realpath(p))
i, ca = json.loads(sys.argv[1]), n(sys.argv[2])
inside = lambda p: n(p).startswith(ca + os.sep)
tc = i.get("toolchain", {})
ok = inside(i["python"]) and tc.get("mode") == "native" and inside(tc.get("dir") or tc.get("sdcc") or "")
sys.exit(0 if ok else 1)
PY
BRES="$(/usr/bin/python3 -I - "$BASE" "$R/app/projeler" "$ROOT/projeler/.ayarlar.json" "$R/selftest/golden.json" <<'PY'
import hashlib, json, os, sys, urllib.request
base, src, ayar, gold = sys.argv[1:5]
golden = json.load(open(gold))["files"]
fosc = {k: v.get("fosc") for k, v in json.load(open(ayar)).items()} if os.path.exists(ayar) else {}
bad = n = 0
for f in sorted(os.listdir(src)):
    if not f.endswith((".c", ".asm")):
        continue
    body = {"name": f, "code": open(os.path.join(src, f)).read(), "fosc": fosc.get(f) or 4000000}
    req = urllib.request.Request(base + "/api/build", json.dumps(body).encode(), {"Content-Type": "application/json"})
    r = json.load(urllib.request.urlopen(req, timeout=120))
    hx = f.rsplit(".", 1)[0] + ".hex"
    md5 = hashlib.md5(r["hex"].encode()).hexdigest() if r.get("ok") else "FAIL " + " | ".join(r.get("messages", [])[:3])
    good = md5 == golden.get(hx)
    n += 1; bad += not good
    print("%s %-22s %s" % ("ok  " if good else "FARK", hx, md5))
print("SONUC %d %d" % (n, bad))
PY
)"
echo "$BRES" | sed 's/^/      /'
echo "$BRES" | grep -q '^SONUC [1-9][0-9]* 0$' && ok "/api/build: paketteki tüm örneklerin HEX md5'leri Ek B ile aynı" || bad "/api/build HEX farkı"
TEST_C='int ones = 0;
void main() {
	CMCON = 0x07; TRISB = 0x00; PORTB = 0x00;
	while(1) { delay_ms(100); PORTB = ones; ones++; if(ones == 10) ones = 0; }
}'
R2="$(/usr/bin/python3 -I -c 'import json,sys,urllib.request
b={"name":"PaketDeneme.c","code":sys.argv[2],"fosc":4000000}
r=json.load(urllib.request.urlopen(urllib.request.Request(sys.argv[1]+"/api/build",json.dumps(b).encode(),{"Content-Type":"application/json"}),timeout=120))
print("ok" if r.get("ok") and r.get("hex","").startswith(":") else "FAIL "+repr(r.get("messages")))' "$BASE" "$TEST_C")"
[ "$R2" = ok ] && ok "yeni dosya derlendi (kullanıcı klasörüne yazıldı)" || bad "yeni dosya derlemesi: $R2"
ls "$EHOME"/*/PaketDeneme.c >/dev/null 2>&1 && ok "kullanıcı verisi EELAB_HOME altında" || bad "PaketDeneme.c EELAB_HOME altında yok"
ST="$(env -i HOME="$HOMEDIR" PATH=/usr/bin:/bin EELAB_HOME="$EHOME" TMPDIR="$TMP/" "$PY" -I -B "$SERVER" --selftest)"; rc=$?
[ $rc = 0 ] && ok "server.py --selftest (paket içinden) çıkış 0" || bad "--selftest çıkış $rc: ${ST:0:400}"
kill "$SRV" 2>/dev/null; wait "$SRV" 2>/dev/null; SRV=""

step "7) çalıştırma sonrası paket değişmedi"
[ "$(snapshot)" = "$SNAP0" ] && ok "paket içeriği/zamanları aynı" || bad "paket içinde değişiklik var"
[ "$(find "$CA" -name __pycache__ -o -name '*.pyc' | wc -l | tr -d ' ')" != 0 ] && bad "pakette .pyc oluştu" || ok "pakette .pyc yok"
codesign --verify --deep --strict "$CA" 2>&1 && ok "kopya paket imzası geçerli" || bad "kopya paket imzası"

step "8) başlatıcı: sunucuyu başlatır, tek örnek, SIGTERM ile temiz kapanış (tarayıcı açılmadan)"
LH="$TMP/ev2"; mkdir -p "$LH"
LENV=(HOME="$LH" PATH=/usr/bin:/bin EELAB_HOME="$LH/Documents/EELAB" EELAB_NO_BROWSER=1 TMPDIR="$TMP/")
env -i "${LENV[@]}" "$CA/Contents/MacOS/EELAB" >"$TMP/launcher1.out" 2>&1 &
LP=$!
SJ2="$LH/Library/Application Support/EELAB/server.json"; LOG2="$LH/Library/Logs/EELAB/server.log"
for _ in $(seq 1 150); do grep -q "hazır" "$LOG2" 2>/dev/null && break; sleep 0.2; done
if grep -q "hazır" "$LOG2" 2>/dev/null; then
  URL2="$(/usr/bin/python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["url"])' "$SJ2")"
  SPID="$(/usr/bin/python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["pid"])' "$SJ2")"
  curl -fsm 3 "${URL2}api/ping" | grep -q EELAB && ok "başlatıcı sunucuyu başlattı: $URL2 (pid $SPID)" || bad "başlatıcı sunucusu yanıt vermiyor"
  ps -o command= -p "$SPID" | grep -q "EELAB.app/Contents/Resources/python/$HOSTARCH/bin/python3 -I -B .*server.py --launcher --no-open --port" \
    && ok "sunucu komutu: paket içi python -I -B server.py --launcher" || bad "sunucu komutu: $(ps -o command= -p "$SPID")"
  env -i "${LENV[@]}" "$CA/Contents/MacOS/EELAB" >"$TMP/launcher2.out" 2>&1 &
  LP2=$!
  for _ in $(seq 1 50); do kill -0 "$LP2" 2>/dev/null || break; sleep 0.2; done
  if kill -0 "$LP2" 2>/dev/null; then kill "$LP2"; bad "ikinci başlatıcı çıkmadı"
  else wait "$LP2"; rc=$?; [ $rc = 0 ] && grep -q "zaten çalışıyor" "$LOG2" && ok "ikinci örnek mevcut sunucuyu buldu ve çıktı" || bad "ikinci örnek (çıkış $rc)"; fi
  [ "$(pgrep -P "$LP" | wc -l | tr -d ' ')" = 1 ] && ok "tek sunucu süreci (başlatıcının tek çocuğu)" || bad "sunucu süreci sayısı: $(pgrep -P "$LP" | wc -l)"
  kill -TERM "$LP"
  for _ in $(seq 1 50); do kill -0 "$LP" 2>/dev/null || break; sleep 0.1; done
  kill -0 "$LP" 2>/dev/null && { bad "başlatıcı SIGTERM ile kapanmadı"; kill -9 "$LP"; } || ok "başlatıcı SIGTERM ile kapandı"
  for _ in $(seq 1 30); do kill -0 "$SPID" 2>/dev/null || break; sleep 0.1; done
  kill -0 "$SPID" 2>/dev/null && { bad "sunucu başlatıcıyla kapanmadı"; kill "$SPID"; } || ok "sunucu da kapandı"
  [ -f "$SJ2" ] && echo "bilgi server.json kapanıştan sonra duruyor (sunucunun işi; başlatıcı ping ile eskiyi ayıklar)"
else
  bad "başlatıcı 30 sn içinde hazır olmadı"; cat "$LOG2" 2>/dev/null | tail -20; cat "$TMP/launcher1.out"
  kill "$LP" 2>/dev/null
fi
wait "$LP" 2>/dev/null
[ "$(snapshot)" = "$SNAP0" ] && ok "başlatıcı çalıştıktan sonra da paket değişmedi" || bad "başlatıcı sonrası pakette değişiklik"

step "9) karantina + kur.sh"
VOL="$TMP/vol"; mkdir -p "$VOL"
ditto "$APP" "$VOL/EELAB.app"; cp "$ROOT/packaging/kur.sh" "$VOL/kur.sh"
Q="0083;$(printf '%x' "$(date +%s)");Safari;"
find "$VOL/EELAB.app" -print0 | xargs -0 xattr -w com.apple.quarantine "$Q"
xattr -p com.apple.quarantine "$VOL/EELAB.app" >/dev/null 2>&1 && ok "karantina eklendi" || bad "karantina eklenemedi"
env -i HOME="$HOMEDIR" PATH=/usr/bin:/bin:/usr/sbin EELAB_KUR_HEDEF="$TMP/Uygulamalar" EELAB_KUR_ACMA=1 EELAB_KUR_DURDURMA=0 \
  bash "$VOL/kur.sh" >"$TMP/kur.log" 2>&1 && ok "kur.sh çıkış 0" || { bad "kur.sh"; cat "$TMP/kur.log"; }
IA="$TMP/Uygulamalar/EELAB.app"
if [ -d "$IA" ]; then
  [ -z "$(xattr -r "$IA" 2>/dev/null | grep com.apple.quarantine)" ] && ok "kurulan pakette karantina yok" || bad "karantina kalktı değil"
  codesign --verify --deep --strict "$IA" 2>&1 && ok "kurulan paket imzası geçerli" || bad "kurulan paket imzası"
else bad "kurulum hedefi yok"; fi

DMGF="$ROOT/dist/EELAB-$(head -1 "$ROOT/VERSION").dmg"
if ((DMG)) || [ -f "$DMGF" ]; then
  step "DMG"
  if [ -f "$DMGF" ] && [ "$DMGF" -nt "$APP/Contents/Info.plist" ]; then
    MNT="$TMP/mnt"; mkdir -p "$MNT"
    if hdiutil attach -quiet -nobrowse -readonly -mountpoint "$MNT" "$DMGF"; then
      for f in EELAB.app kur.sh Kur.command kaldir.sh OKU-BENI.txt Applications; do [ -e "$MNT/$f" ] && ok "dmg: $f" || bad "dmg: $f yok"; done
      codesign --verify --deep --strict "$MNT/EELAB.app" 2>&1 && ok "dmg: imza geçerli" || bad "dmg: imza"
      env -i HOME="$HOMEDIR" PATH=/usr/bin:/bin:/usr/sbin EELAB_KUR_HEDEF="$TMP/Uyg2" EELAB_KUR_ACMA=1 EELAB_KUR_DURDURMA=0 \
        bash "$MNT/kur.sh" >/dev/null 2>&1 && [ -x "$TMP/Uyg2/EELAB.app/Contents/MacOS/EELAB" ] && ok "dmg: kur.sh salt-okunur birimden kurdu" || bad "dmg: kur.sh"
      hdiutil detach -quiet "$MNT"; MNT=""
    else bad "dmg bağlanamadı"; fi
  else echo "      (dmg yok ya da paketten eski; atlandı)"; fi
fi

echo
echo "SONUÇ: $PASSES geçti, $FAILS başarısız"
[ "$HOSTARCH" = x86_64 ] && echo "NOT: arm64 dilimleri bu makinede çalıştırılamaz; yalnız statik denetlendi (plan R1)."
exit $((FAILS > 0))
