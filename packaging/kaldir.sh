#!/bin/bash
# EELAB'ı kaldırır: uygulama + ~/Library/{Application Support,Logs,Caches}/EELAB.
# ~/Documents/EELAB (projeleriniz) SİLİNMEZ.  -y: onay sormaz.
set -euo pipefail
if [ "${1:-}" != -y ]; then
  read -r -p "EELAB kaldırılsın mı? Projeleriniz (~/Documents/EELAB) korunur. [e/H] " c
  case "$c" in e|E|evet|Evet|y|Y) ;; *) echo "Vazgeçildi."; exit 0;; esac
fi
pkill -x EELAB 2>/dev/null || true
SJ="$HOME/Library/Application Support/EELAB/server.json"
if [ -f "$SJ" ]; then
  pid="$(/usr/bin/sed -n 's/.*"pid": *\([0-9][0-9]*\).*/\1/p' "$SJ")"
  url="$(/usr/bin/sed -n 's/.*"url": *"\([^"]*\)".*/\1/p' "$SJ")"
  if [ -n "$pid" ] && [ -n "$url" ] && /usr/bin/curl -fsm 2 "${url%/}/api/ping" 2>/dev/null | grep -q '"EELAB"'; then kill "$pid" 2>/dev/null || true; fi
fi
for p in /Applications/EELAB.app "$HOME/Applications/EELAB.app" \
         "$HOME/Library/Application Support/EELAB" "$HOME/Library/Logs/EELAB" "$HOME/Library/Caches/EELAB"; do
  if [ -e "$p" ]; then rm -rf "$p" && echo "silindi: $p"; fi
done
echo "EELAB kaldırıldı. Projeleriniz yerinde: ~/Documents/EELAB"
