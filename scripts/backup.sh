#!/bin/sh
# Backup harian 02.00 (PRD §10): salin SQLite (aman saat DB dipakai) + media, simpan 30 hari.
# Pasang di server:  crontab -e  ->  0 2 * * * /opt/tk/scripts/backup.sh >> /opt/tk/data/backup/backup.log 2>&1
# Tujuan sinkron luar server (PRD §12.7) diisi setelah ditentukan — mis. rclone ke Drive.
set -e
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_FILE="$APP_DIR/web/prisma/dev.db"
[ -f /opt/tk/data/tk.db ] && DB_FILE="/opt/tk/data/tk.db"
DST="$APP_DIR/data/backup/$(date +%F)"
mkdir -p "$DST"
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_FILE" ".backup '$DST/tk.db'"
else
  cp "$DB_FILE" "$DST/tk.db"
fi
cp -r "$APP_DIR/data/media" "$DST/" 2>/dev/null || true
find "$APP_DIR/data/backup" -maxdepth 1 -mtime +30 -exec rm -rf {} + 2>/dev/null || true
echo "$(date '+%F %T') Backup OK: $DST"
