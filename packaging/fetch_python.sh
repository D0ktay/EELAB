#!/bin/bash
# python-build-standalone CPython'u (arm64 + x86_64) indirir, sha256 doğrular, budar.
# Çıktı: $EELAB_BUILD_CACHE/python/<arch>/ (bin/python3, lib/...). Ağ yalnız ilk derlemede kullanılır.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CACHE="${EELAB_BUILD_CACHE:-$HOME/Library/Caches/EELAB-build}"
DL="$CACHE/downloads"; OUT="$CACHE/python"; mkdir -p "$DL" "$OUT"
ARCHS="${*:-arm64 x86_64}"
jget() { /usr/bin/python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1]))
for k in sys.argv[2:]: d=d[k]
print(d)' "$HERE/versions.json" "$@"; }
PYVER="$(jget python version)"; PYMM="${PYVER%.*}"; BASE="$(jget python base_url)"

for a in $ARCHS; do
  name="$(jget python assets "$a" name)"; want="$(jget python assets "$a" sha256)"; f="$DL/$name"
  if [ ! -f "$f" ] || [ "$(shasum -a 256 "$f" | cut -d' ' -f1)" != "$want" ]; then
    curl -fL --retry 3 -o "$f.part" "$BASE$name"
    got="$(shasum -a 256 "$f.part" | cut -d' ' -f1)"
    [ "$got" = "$want" ] || { echo "sha256 uyuşmuyor ($a): $got" >&2; rm -f "$f.part"; exit 1; }
    mv "$f.part" "$f"
  fi
  d="$OUT/$a"; rm -rf "$d" "$d.tmp"; mkdir -p "$d.tmp"
  tar -xzf "$f" -C "$d.tmp"; mv "$d.tmp/python" "$d"; rmdir "$d.tmp"
  L="$d/lib/python$PYMM"
  rm -rf "$L"/{test,idlelib,tkinter,turtledemo,ensurepip,lib2to3,pydoc_data,venv,unittest,doctest.py,pydoc.py,turtle.py,sqlite3,curses,dbm,xmlrpc,wsgiref,tomllib,lib-dynload/_tkinter*,lib-dynload/_test*,lib-dynload/xx*,lib-dynload/_ctypes_test*,lib-dynload/_curses*,lib-dynload/_sqlite3*,lib-dynload/_dbm*,lib-dynload/_gdbm*} \
         "$L"/config-* "$L"/site-packages/* \
         "$d"/lib/{tcl*,tk*,itcl*,thread*,Tix*,pkgconfig} "$d"/lib/libtcl* "$d"/lib/libtk* "$d/include" "$d/share"
  rm -f "$d"/bin/{pip*,idle*,pydoc*,2to3*,*-config}
  find "$d" -name __pycache__ -type d -prune -exec rm -rf {} +
  find "$d" -name '*.a' -delete
  otool -L "$d/bin/python3" | grep -q libpython || rm -f "$d"/lib/libpython*.dylib
  "$d/bin/python3" -I -B -c 'import sys' 2>/dev/null || [ "$a" != "$(uname -m)" ] || { echo "python çalışmıyor ($a)" >&2; exit 1; }
  echo "python $PYVER $a: $(du -sh "$d" | cut -f1) → $d"
done
