#!/bin/sh
# Backup harian 02.00 (PRD §10): salin SQLite (aman saat DB dipakai) + media, simpan 30 hari.
# Pasang di server:  crontab -e  ->  0 2 * * * /opt/tk/scripts/backup.sh >> /opt/tk/data/backup/backup.log 2>&1
# Tujuan sinkron luar server (PRD §12.7) diisi setelah ditentukan — mis. rclone ke Drive.
set -e
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# DB_PATH/DATA_DIR ikut dari agent/.env bila dijalankan oleh agent; selain itu tebak lokasi standar
DB_FILE="${DB_PATH:-$APP_DIR/web/prisma/dev.db}"
[ -z "$DB_PATH" ] && [ -f /opt/tk/data/tk.db ] && DB_FILE="/opt/tk/data/tk.db"
case "$DB_FILE" in /*) ;; *) DB_FILE="$APP_DIR/agent/$DB_FILE" ;; esac
DATA="${DATA_DIR:-$APP_DIR/data}"
case "$DATA" in /*) ;; *) DATA="$APP_DIR/agent/$DATA" ;; esac
DST="$DATA/backup/$(date +%F)"
mkdir -p "$DST"
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_FILE" ".backup '$DST/tk.db'"
elif [ -d "$APP_DIR/agent/node_modules/better-sqlite3" ] && command -v node >/dev/null 2>&1; then
  # Tanpa sqlite3 CLI: pakai API backup better-sqlite3 (cp biasa tidak aman untuk DB mode WAL)
  node -e 'require(process.argv[1])(process.argv[2], { readonly: true }).backup(process.argv[3]).catch((e) => { console.error(e.message); process.exit(1); })' \
    "$APP_DIR/agent/node_modules/better-sqlite3" "$DB_FILE" "$DST/tk.db"
else
  cp "$DB_FILE" "$DST/tk.db"
fi
cp -r "$DATA/media" "$DST/" 2>/dev/null || true
find "$DATA/backup" -maxdepth 1 -mtime +30 -exec rm -rf {} + 2>/dev/null || true
echo "$(date '+%F %T') Backup OK: $DST"
