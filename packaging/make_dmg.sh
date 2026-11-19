#!/bin/bash
# dist/EELAB-<sürüm>.dmg ve dist/EELAB-<sürüm>.zip üretir (dist/EELAB.dmg, dist/EELAB.zip aynı dosyaya bağlantıdır).
# Kullanım: packaging/make_dmg.sh [--skip-build] [build_app.sh seçenekleri…]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/.." && pwd)"; DIST="$ROOT/dist"
BUILD=1; if [ "${1:-}" = --skip-build ]; then BUILD=0; shift; fi
((BUILD)) && "$HERE/build_app.sh" "$@"
[ -d "$DIST/EELAB.app" ] || { echo "dist/EELAB.app yok" >&2; exit 1; }
VERSION="$(head -1 "$ROOT/VERSION" | tr -d '[:space:]')"
codesign --verify --deep --strict "$DIST/EELAB.app"

STAGE="$DIST/.dmg"; rm -rf "$STAGE"; mkdir -p "$STAGE/EELAB"
S="$STAGE/EELAB"
ditto "$DIST/EELAB.app" "$S/EELAB.app"
for f in kur.sh Kur.command kaldir.sh OKU-BENI.txt; do cp "$HERE/$f" "$S/$f"; done
chmod 755 "$S/kur.sh" "$S/Kur.command" "$S/kaldir.sh"
xattr -cr "$S"

DMG="$DIST/EELAB-$VERSION.dmg"; ZIP="$DIST/EELAB-$VERSION.zip"
rm -f "$DMG" "$ZIP" "$DIST/EELAB.dmg" "$DIST/EELAB.zip"

ZDIR="$STAGE/EELAB-$VERSION"; mv "$S" "$ZDIR"
(cd "$STAGE" && ditto -c -k --norsrc --noextattr --noacl --keepParent "EELAB-$VERSION" "$ZIP")
mv "$ZDIR" "$S"

ln -s /Applications "$S/Applications"
hdiutil create -quiet -volname EELAB -srcfolder "$S" -fs HFS+ -format UDZO -imagekey zlib-level=9 -ov "$DMG"
hdiutil verify -quiet "$DMG"
rm -rf "$STAGE"

ln "$DMG" "$DIST/EELAB.dmg"; ln "$ZIP" "$DIST/EELAB.zip"
for f in "$DMG" "$ZIP"; do printf '%s  %s  %s\n' "$(du -h "$f" | cut -f1)" "$(shasum -a 256 "$f" | cut -d' ' -f1)" "$f"; done
