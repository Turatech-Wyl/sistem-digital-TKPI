#!/bin/sh
# Jalankan agent dengan restart otomatis bila crash (PRD §10 ketersediaan).
# Dipakai lokal via screen dan di server via cron @reboot (lihat scripts/start.sh).
cd "$(dirname "$0")"
while true; do
  npm run start >> /tmp/tkpi-agent.log 2>&1
  echo "$(date '+%F %T') AGENT EXIT $? — restart 5 dtk" >> /tmp/tkpi-agent.log
  sleep 5
done
