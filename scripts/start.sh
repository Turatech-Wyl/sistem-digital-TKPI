#!/bin/sh
# Jalankan web (prod) + agent via cron @reboot di server (PRD §9).
# Contoh crontab: @reboot /opt/tk/scripts/start.sh
set -e
cd "$(dirname "$0")/.."
cd web && npm run start &
cd ../agent && npm run start &
wait
