#!/bin/bash
# EELAB — tüm test paketlerini çalıştırır.
#   tests/run_all.sh            birim + entegrasyon + uçtan uca
#   tests/run_all.sh --package  ayrıca tests/package_test.sh (dist/EELAB.app gerekir)
#   tests/run_all.sh --no-e2e   uçtan uca testleri atla
# Ortam: PYTHON (varsayılan python3), NODE (varsayılan node).
set -u
cd "$(dirname "$0")/.." || exit 2
PY=${PYTHON:-python3}
NODE=${NODE:-node}
PKG=0; E2E=1
for a in "$@"; do
  case "$a" in
    --package) PKG=1 ;;
    --no-e2e) E2E=0 ;;
    -h|--help) sed -n '2,6p' "$0"; exit 0 ;;
    *) echo "bilinmeyen seçenek: $a" >&2; exit 2 ;;
  esac
done

LOG=$(mktemp -d "${TMPDIR:-/tmp}/eelab_runall.XXXXXX")
trap 'rm -rf "$LOG"' EXIT
names=(); results=(); times=(); fails=0

run() {
  local name=$1; shift
  local t0=$SECONDS f="$LOG/$(echo "$name" | tr '/ ' '__').log"
  printf '%-28s ' "$name"
  if "$@" >"$f" 2>&1; then
    printf 'OK    %3ss  %s\n' $((SECONDS - t0)) "$(grep -v '^\s*$' "$f" | tail -1 | cut -c1-90)"
    results+=(OK)
  else
    printf 'FAIL  %3ss\n' $((SECONDS - t0))
    grep -E 'FAIL|Error|error|assert' "$f" | head -20 | sed 's/^/    /'
    echo "    (tam çıktı: son 15 satır)"; tail -15 "$f" | sed 's/^/    /'
    results+=(FAIL); fails=$((fails + 1))
  fi
  names+=("$name")
}

echo "EELAB test matrisi — $(date '+%Y-%m-%d %H:%M') — $($PY --version 2>&1), node $($NODE --version 2>&1)"
for t in tests/*_test.js; do run "$(basename "$t")" "$NODE" "$t"; done
for t in tests/*_test.py; do run "$(basename "$t")" "$PY" "$t"; done
if [ "$E2E" = 1 ]; then
  run "e2e/cross_test.py" "$PY" tests/e2e/cross_test.py
  run "e2e/e2e_test.js" env EELAB_PY="$PY" "$NODE" tests/e2e/e2e_test.js
fi
if [ "$PKG" = 1 ]; then
  if [ -d dist/EELAB.app ] && [ -f tests/package_test.sh ]; then run "package_test.sh" bash tests/package_test.sh
  else echo "package_test.sh            ATLANDI (dist/EELAB.app yok)"; fi
fi

echo
echo "${#names[@]} paket, $fails başarısız"
exit $((fails > 0))
