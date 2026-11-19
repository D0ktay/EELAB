#!/bin/bash
# dist/EELAB.app üretir (ad-hoc imzalı).
# Kullanım: packaging/build_app.sh [--arch universal|arm64|x86_64] [--include-solutions] [--out DIR]
#   EELAB_SIGN_ID verilirse ad-hoc yerine bu kimlikle imzalar (Developer ID; notarization ayrı adımdır).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/.." && pwd)"
CACHE="${EELAB_BUILD_CACHE:-$HOME/Library/Caches/EELAB-build}"
ARCH=universal; SOL=0; DIST="$ROOT/dist"
while (($#)); do case "$1" in
  --arch) ARCH="$2"; shift 2;; --include-solutions) SOL=1; shift;; --out) DIST="$2"; shift 2;;
  *) echo "bilinmeyen seçenek: $1" >&2; exit 2;; esac; done
case "$ARCH" in universal) ARCHS="x86_64 arm64";; x86_64|arm64) ARCHS="$ARCH";; *) echo "--arch universal|arm64|x86_64" >&2; exit 2;; esac
VERSION="$(head -1 "$ROOT/VERSION" | tr -d '[:space:]')"; [ -n "$VERSION" ] || { echo "VERSION boş" >&2; exit 1; }
SIGN="${EELAB_SIGN_ID:--}"

for a in $ARCHS; do
  [ -x "$CACHE/python/$a/bin/python3" ] || "$HERE/fetch_python.sh" "$a"
  for t in bin/sdcc bin/gpasm bin/gplink cpp/cpp cpp/cc1; do
    lipo -archs "$ROOT/toolchain/$t" | tr ' ' '\n' | grep -qx "$a" || { echo "toolchain/$t içinde $a dilimi yok (önce packaging/build_toolchain.sh)" >&2; exit 1; }
  done
done

BUILD="$DIST/.build"; APP="$BUILD/EELAB.app"; C="$APP/Contents"; R="$C/Resources"
rm -rf "$BUILD"; mkdir -p "$C/MacOS" "$R/app" "$R/toolchain" "$R/python" "$R/selftest" "$R/LICENSES"

sed "s/__VERSION__/$VERSION/g" "$HERE/Info.plist" > "$C/Info.plist"
plutil -lint "$C/Info.plist" >/dev/null
printf 'APPL????' > "$C/PkgInfo"

ARCHFLAGS=(); for a in $ARCHS; do ARCHFLAGS+=(-arch "$a"); done
clang "${ARCHFLAGS[@]}" -mmacosx-version-min=11.0 -fobjc-arc -O2 -Wall -Wno-unused-parameter \
  "$HERE/launcher/main.m" -framework Cocoa -o "$C/MacOS/EELAB"
strip -S -x "$C/MacOS/EELAB"

ICONTMP="$BUILD/icon"; mkdir -p "$ICONTMP/EELAB.iconset"
swiftc -O -o "$ICONTMP/make_icon" "$HERE/make_icon.swift" 2>/dev/null || true
if [ -x "$ICONTMP/make_icon" ]; then "$ICONTMP/make_icon" "$ICONTMP/icon1024.png"; else swift "$HERE/make_icon.swift" "$ICONTMP/icon1024.png"; fi
for s in 16 32 128 256 512; do
  sips -z $s $s "$ICONTMP/icon1024.png" --out "$ICONTMP/EELAB.iconset/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2)); sips -z $d $d "$ICONTMP/icon1024.png" --out "$ICONTMP/EELAB.iconset/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONTMP/EELAB.iconset" -o "$R/EELAB.icns"
rm -rf "$ICONTMP"

APPFILES=(server.py pdsprj.py eelab_paths.py index.html VERSION)
APPDIRS=(js css shim circuits projeler templates img)
for f in "${APPFILES[@]}"; do [ -f "$ROOT/$f" ] && cp "$ROOT/$f" "$R/app/$f"; done
for d in "${APPDIRS[@]}"; do
  [ -d "$ROOT/$d" ] || continue
  (cd "$ROOT" && tar cf - --exclude __pycache__ --exclude '*.pyc' --exclude .DS_Store --exclude '*.hex' \
     --exclude '*.o' --exclude '*.lst' --exclude '*.map' --exclude '*.cod' "$d") | (cd "$R/app" && tar xf -)
done
[ -f "$R/app/server.py" ] || { echo "server.py yok" >&2; exit 1; }
if ((!SOL)); then rm -f "$R/app/projeler/"Task1.* "$R/app/projeler/"Task2.*; fi

for d in bin cpp include lib nonfree lkr gpheader; do cp -R "$ROOT/toolchain/$d" "$R/toolchain/"; done
[ -f "$ROOT/toolchain/VERSION.json" ] && cp "$ROOT/toolchain/VERSION.json" "$R/toolchain/"
if [ "$ARCH" != universal ]; then
  for t in bin/sdcc bin/gpasm bin/gplink cpp/cpp cpp/cc1; do
    [ "$(lipo -archs "$R/toolchain/$t")" = "$ARCH" ] && continue
    lipo "$R/toolchain/$t" -thin "$ARCH" -output "$R/toolchain/$t.thin"; mv "$R/toolchain/$t.thin" "$R/toolchain/$t"
  done
fi
chmod 755 "$R/toolchain/bin/"* "$R/toolchain/cpp/"*

for a in $ARCHS; do ditto "$CACHE/python/$a" "$R/python/$a"; done
cp "$HERE/selftest/golden.json" "$R/selftest/golden.json"
cp "$HERE/LICENSES/"* "$R/LICENSES/"

find "$APP" \( -name .DS_Store -o -name __pycache__ \) -prune -exec rm -rf {} +
chmod -R u+rwX,go+rX,go-w "$APP"
xattr -cr "$APP"

while IFS= read -r -d '' f; do
  if file -b "$f" | grep -q '^Mach-O'; then codesign --force --timestamp=none -s "$SIGN" "$f"; fi
done < <(find "$R" -type f -perm -u+x -print0)
codesign --force --deep --timestamp=none -s "$SIGN" "$APP"
codesign --verify --deep --strict "$APP"

rm -rf "$DIST/EELAB.app"; mv "$APP" "$DIST/EELAB.app"; rmdir "$BUILD" 2>/dev/null || true
echo "EELAB $VERSION ($ARCH) → $DIST/EELAB.app ($(du -sh "$DIST/EELAB.app" | cut -f1))"
