#!/bin/bash
# EELAB evrensel toolchain: sdcc (+sdcpp cpp/cc1) ve gputils (gpasm/gplink), x86_64 + arm64, minos 11.0.
# Kullanım: packaging/build_toolchain.sh [--arch x86_64|arm64|universal] [--jobs N] [--no-install] [--reuse]
#   EELAB_SRC=<tarball klasörü>  yerel kaynak tarball'ları (yoksa versions.json'daki adreslerden indirilir)
#   EELAB_BUILD_CACHE            varsayılan ~/Library/Caches/EELAB-build (kaynaklar + çıktılar)
#   EELAB_BUILD_WORK             derleme ağacı, varsayılan /private/tmp/eelab-build-<uid>
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/.." && pwd)"
CACHE="${EELAB_BUILD_CACHE:-$HOME/Library/Caches/EELAB-build}"
SRC="$CACHE/src"; OUT="$CACHE/out"
# Derleme ağacı /Users dışında: sdcpp sürücüsü configure satırını ikiliye gömer (cpp -v).
WORK="${EELAB_BUILD_WORK:-/private/tmp/eelab-build-$(id -u)}"
ARCH=universal; JOBS="$(sysctl -n hw.ncpu)"; INSTALL=1; REUSE=0
while (($#)); do case "$1" in
  --arch) ARCH="$2"; shift 2;; --jobs) JOBS="$2"; shift 2;; --no-install) INSTALL=0; shift;; --reuse) REUSE=1; shift;;
  *) echo "bilinmeyen seçenek: $1" >&2; exit 2;; esac; done
case "$ARCH" in universal) ARCHS="x86_64 arm64";; x86_64|arm64) ARCHS="$ARCH";; *) echo "--arch x86_64|arm64|universal" >&2; exit 2;; esac
HOSTARCH="$(uname -m)"
TOOLS="bin/sdcc bin/gpasm bin/gplink cpp/cpp cpp/cc1"
SDCC_CONF=(--prefix=/opt/eelab-toolchain
  --disable-mcs51-port --disable-z80-port --disable-z180-port --disable-r2k-port --disable-r2ka-port
  --disable-r3ka-port --disable-r4k-port --disable-r5-port --disable-r6-port --disable-sm83-port
  --disable-tlcs90-port --disable-ez80-port --disable-z80n-port --disable-r800-port --disable-ds390-port
  --disable-ds400-port --disable-hc08-port --disable-s08-port --disable-stm8-port --disable-pdk13-port
  --disable-pdk14-port --disable-pdk15-port --disable-pdk16-port --disable-mos6502-port --disable-mos65c02-port
  --disable-f8-port --disable-f8l-port --disable-pic16-port --disable-ucsim --disable-sdcdb --enable-non-free --disable-device-lib)

jget() { /usr/bin/python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1]))
for k in sys.argv[2:]: d=d[k]
print(d)' "$HERE/versions.json" "$@"; }
sha() { shasum -a 256 "$1" | cut -d' ' -f1; }

fetch_sources() {
  mkdir -p "$SRC"
  for f in sdcc-src.tar.bz2 gputils.tar.bz2 boost.tar.bz2; do
    want="$(jget sources "$f" sha256)"
    if [ ! -f "$SRC/$f" ] || [ "$(sha "$SRC/$f")" != "$want" ]; then
      if [ -n "${EELAB_SRC:-}" ] && [ -f "$EELAB_SRC/$f" ]; then cp "$EELAB_SRC/$f" "$SRC/$f.part"
      else curl -fL --retry 3 -o "$SRC/$f.part" "$(jget sources "$f" url)"; fi
      [ "$(sha "$SRC/$f.part")" = "$want" ] || { echo "sha256 uyuşmuyor: $f" >&2; rm -f "$SRC/$f.part"; exit 1; }
      mv "$SRC/$f.part" "$SRC/$f"
    fi
  done
  mkdir -p "$WORK"
  if [ ! -d "$WORK/boost_1_86_0/boost" ]; then rm -rf "$WORK/boost_1_86_0"; tar -xjf "$SRC/boost.tar.bz2" -C "$WORK" boost_1_86_0/boost; fi
  echo "kaynaklar önbellekte: $SRC"
}

prep_tree() {
  local a="$1"; rm -rf "$WORK/$a"; mkdir -p "$WORK/$a"
  tar -xjf "$SRC/sdcc-src.tar.bz2" -C "$WORK/$a"
  tar -xjf "$SRC/gputils.tar.bz2" -C "$WORK/$a"
}

# build_tree <ad> <mimari...>: tek mimari = yerel derleme; birden çok = tek geçişte evrensel (plan §2.4 yedek a).
# Çapraz derleme (--host) kullanılmaz: sdcpp'nin üreteç araçları ana makine libiberty'sine bağlanır.
build_tree() {
  local name="$1"; shift
  if ((REUSE)) && [ -x "$OUT/$name/bin/sdcc" ] && [ -x "$OUT/$name/cpp/cc1" ]; then echo "[$name] önceki çıktı kullanılıyor"; return 0; fi
  local log="$WORK/build-$name.log" archflags="" dep=()
  for a in "$@"; do archflags="$archflags -arch $a"; done
  local mk=()
  (($# > 1)) && { dep=(--disable-dependency-tracking); mk=(MAKEDEP="clang -MM" MAKEDEP_CXX="clang++ -MM"); }
  local pm="-ffile-prefix-map=$WORK=/eelab-src -fdebug-prefix-map=$WORK=/eelab-src -fmacro-prefix-map=$WORK=/eelab-src"
  local cc="clang$archflags -mmacosx-version-min=11.0 $pm" cxx="clang++$archflags -mmacosx-version-min=11.0 $pm"
  local boost="$WORK/boost_1_86_0"
  prep_tree "$name"
  echo "[$name] derleniyor:$archflags (günlük: $log)"
  export MACOSX_DEPLOYMENT_TARGET=11.0
  ( export CPP="clang -E" CXXCPP="clang++ -E"
    cd "$WORK/$name/sdcc-4.5.0" &&
    env CC="$cc" CXX="$cxx" CPPFLAGS="-I$boost" CXXFLAGS="-O2 -I$boost" \
      ./configure ${dep[@]+"${dep[@]}"} "${SDCC_CONF[@]}" &&
    make -j"$JOBS" -C support/sdbinutils all-libiberty &&
    make -j"$JOBS" -C support/cpp &&
    make -j"$JOBS" -C src ${mk[@]+"${mk[@]}"} &&
    cd "$WORK/$name/gputils-1.5.2" &&
    env CC="$cc" ./configure ${dep[@]+"${dep[@]}"} --prefix=/opt/eelab-toolchain &&
    make -j"$JOBS"
  ) >"$log" 2>&1 || { echo "[$name] derleme başarısız; son satırlar:" >&2; tail -30 "$log" >&2; return 1; }
  local o="$OUT/$name"; rm -rf "$o"; mkdir -p "$o/bin" "$o/cpp"
  cp "$WORK/$name/sdcc-4.5.0/src/sdcc" "$o/bin/sdcc"
  cp "$WORK/$name/sdcc-4.5.0/support/cpp/gcc/cpp" "$o/cpp/cpp"
  cp "$WORK/$name/sdcc-4.5.0/support/cpp/gcc/cc1" "$o/cpp/cc1"
  cp "$WORK/$name/gputils-1.5.2/gpasm/gpasm" "$o/bin/gpasm"
  cp "$WORK/$name/gputils-1.5.2/gplink/gplink" "$o/bin/gplink"
  for t in $TOOLS; do
    strip -S -x "$o/$t"
    for a in "$@"; do lipo -archs "$o/$t" | tr ' ' '\n' | grep -qx "$a" || { echo "[$name] $a dilimi yok: $t" >&2; return 1; }; done
    if [ "$(strings -a "$o/$t" | grep -c -e '/Users/' -e "$(id -un)")" != 0 ]; then echo "[$name] gömülü /Users yolu ya da kullanıcı adı: $t" >&2; return 1; fi
  done
  echo "[$name] tamam → $o"
}

thin_from() {
  local from="$1" a="$2" o="$OUT/$2"; rm -rf "$o"; mkdir -p "$o/bin" "$o/cpp"
  for t in $TOOLS; do lipo "$OUT/$from/$t" -thin "$a" -output "$o/$t"; done
}

stage_toolchain() {
  local dest="$1"; shift; rm -rf "$dest"; mkdir -p "$dest"
  (cd "$ROOT/toolchain" && tar cf - --exclude bin --exclude cpp --exclude VERSION.json .) | (cd "$dest" && tar xf -)
  mkdir -p "$dest/bin" "$dest/cpp"; cp "$ROOT/toolchain/bin/sdcpp" "$dest/bin/sdcpp"
  for t in $TOOLS; do
    local srcs=(); for a in "$@"; do srcs+=("$OUT/$a/$t"); done
    if ((${#srcs[@]} > 1)); then lipo -create "${srcs[@]}" -output "$dest/$t"; else cp "${srcs[0]}" "$dest/$t"; fi
    chmod 755 "$dest/$t"; codesign --force --timestamp=none -s - "$dest/$t" 2>/dev/null
  done
}

verify_slice() {
  local st="$WORK/stage-$1"; stage_toolchain "$st" "$1"; verify_hex "$st"
}

verify_hex() {
  echo "HEX doğrulaması (Ek B): $1"
  /usr/bin/python3 -I -B "$HERE/verify_hex.py" --root "$ROOT" --toolchain "$1"
}

write_manifest() {
  /usr/bin/python3 -I -B - "$ROOT/toolchain" "$HERE/versions.json" <<'PY'
import hashlib, json, os, subprocess, sys
tc, vers = sys.argv[1], json.load(open(sys.argv[2]))
def h(p): return hashlib.sha256(open(p, "rb").read()).hexdigest()
fixed = {}
for d in ("include", "lib", "nonfree", "lkr", "gpheader"):
    for r, _, fs in os.walk(os.path.join(tc, d)):
        for f in fs:
            if f == ".DS_Store": continue
            p = os.path.join(r, f); fixed[os.path.relpath(p, tc)] = h(p)
tools = {}
for t in ("bin/sdcc", "bin/gpasm", "bin/gplink", "bin/sdcpp", "cpp/cpp", "cpp/cc1"):
    p = os.path.join(tc, t)
    archs = subprocess.run(["lipo", "-archs", p], capture_output=True, text=True).stdout.split() if t != "bin/sdcpp" else []
    tools[t] = {"archs": archs}
out = {"schema": 1, "sdcc": "4.5.0", "gputils": "1.5.2", "minos": "11.0", "prefix": "/opt/eelab-toolchain",
       "sources": {k: v["sha256"] for k, v in vers["sources"].items()}, "tools": tools,
       "fixed": dict(sorted(fixed.items()))}
json.dump(out, open(os.path.join(tc, "VERSION.json"), "w"), indent=1, sort_keys=False)
open(os.path.join(tc, "VERSION.json"), "a").write("\n")
print("manifest: %d sabit dosya" % len(fixed))
PY
}

fetch_sources
OTHER=""; for a in $ARCHS; do [ "$a" = "$HOSTARCH" ] || OTHER="$a"; done
BG=""
if [ -n "$OTHER" ]; then build_tree fat x86_64 arm64 & BG=$!; fi
case " $ARCHS " in *" $HOSTARCH "*) build_tree "$HOSTARCH" "$HOSTARCH";; esac
if [ -n "$BG" ]; then wait "$BG" || exit 1; thin_from fat "$OTHER"; fi

if [ -d "$OUT/$HOSTARCH" ]; then verify_slice "$HOSTARCH"; fi
if [ -n "$OTHER" ]; then
  rm -rf "$OUT/fat-$HOSTARCH"; mkdir -p "$OUT/fat-$HOSTARCH/bin" "$OUT/fat-$HOSTARCH/cpp"
  for t in $TOOLS; do lipo "$OUT/fat/$t" -thin "$HOSTARCH" -output "$OUT/fat-$HOSTARCH/$t"; done
  echo "evrensel geçişin $HOSTARCH dilimi (arm64 dilimiyle aynı derleme yapılandırması):"
  verify_slice "fat-$HOSTARCH"
fi

if ((INSTALL)); then
  STAGE="$WORK/stage"; stage_toolchain "$STAGE" $ARCHS
  for t in $TOOLS; do cp "$STAGE/$t" "$ROOT/toolchain/$t.new" && mv -f "$ROOT/toolchain/$t.new" "$ROOT/toolchain/$t"; done
  verify_hex "$ROOT/toolchain"
  write_manifest
  for t in $TOOLS; do printf '%-12s %s\n' "$t" "$(lipo -archs "$ROOT/toolchain/$t")"; done
fi
