#!/bin/bash
# EELAB kurulumu: bash /Volumes/EELAB/kur.sh
# Uygulamayı /Applications'a (yazılamıyorsa ~/Applications'a) kopyalar, karantina özniteliğini kaldırır,
# imzayı doğrular ve açar. Kullanıcı verisine (~/Documents/EELAB) dokunmaz.
#   EELAB_KUR_HEDEF=<klasör>  hedef klasörü zorlar      EELAB_KUR_ACMA=1  kurulumdan sonra açmaz
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/EELAB.app"
[ -d "$SRC" ] || { echo "Hata: EELAB.app bu betiğin yanında bulunamadı ($HERE)." >&2; exit 1; }

dur() {
  local sj="$HOME/Library/Application Support/EELAB/server.json" pid url
  pkill -x EELAB 2>/dev/null || true
  if [ -f "$sj" ]; then
    pid="$(/usr/bin/sed -n 's/.*"pid": *\([0-9][0-9]*\).*/\1/p' "$sj")"
    url="$(/usr/bin/sed -n 's/.*"url": *"\([^"]*\)".*/\1/p' "$sj")"
    if [ -n "$pid" ] && [ -n "$url" ] && /usr/bin/curl -fsm 2 "${url%/}/api/ping" 2>/dev/null | grep -q '"EELAB"'; then
      kill "$pid" 2>/dev/null || true
    fi
  fi
}

if [ -n "${EELAB_KUR_HEDEF:-}" ]; then TARGET="$EELAB_KUR_HEDEF"; mkdir -p "$TARGET"
elif [ -w /Applications ]; then TARGET=/Applications
else TARGET="$HOME/Applications"; mkdir -p "$TARGET"; fi
DEST="$TARGET/EELAB.app"

echo "EELAB kuruluyor → $DEST"
[ "${EELAB_KUR_DURDURMA:-1}" = 0 ] || dur
if [ -e "$DEST" ]; then rm -rf "$DEST"; fi
ditto "$SRC" "$DEST"
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true
if ! codesign --verify --deep --strict "$DEST" 2>/dev/null; then
  echo "İmza doğrulanamadı; yerel (ad-hoc) olarak yeniden imzalanıyor."
  xattr -cr "$DEST"
  codesign --force --deep --timestamp=none -s - "$DEST"
fi
echo "Kurulum tamam: $DEST"
echo "Projeleriniz: ~/Documents/EELAB"
if [ "${EELAB_KUR_ACMA:-0}" != 1 ]; then open "$DEST"; fi
