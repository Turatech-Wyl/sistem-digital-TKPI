#!/bin/sh
# Jalankan web (produksi) + agent di server (PRD §9). Panduan: docs/deploy.md
# Pasang sekali:  crontab -e  ->  @reboot /opt/tk/scripts/start.sh
# Prasyarat: `npm run build` di web/ sudah dijalankan setelah setiap pembaruan.
set -e
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${LOG_DIR:-$APP_DIR/data/logs}"
mkdir -p "$LOG_DIR"
# Cron tidak memuat profil shell; muat nvm bila ada agar `npm` ditemukan
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"

# Web di port internal (Cloudflare Tunnel meneruskan ke sini); samakan dengan WEB_URL agent
(cd "$APP_DIR/web" && PORT="${PORT:-3001}" npm run start >> "$LOG_DIR/web.log" 2>&1) &
# Agent lewat supervisor run.sh (restart otomatis bila crash)
LOG_DIR="$LOG_DIR" sh "$APP_DIR/agent/run.sh" &
wait
