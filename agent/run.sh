#!/bin/sh
# Jalankan agent dengan restart otomatis bila crash (PRD §10 ketersediaan).
# Dipakai lokal (mis. di screen) dan di server lewat scripts/start.sh.
cd "$(dirname "$0")"
LOG_DIR="${LOG_DIR:-../data/logs}"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/agent.log"
while true; do
  npm run start >> "$LOG" 2>&1
  echo "$(date '+%F %T') AGENT EXIT $? — restart 5 dtk" >> "$LOG"
  sleep 5
done
