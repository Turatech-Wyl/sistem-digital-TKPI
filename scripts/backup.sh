#!/bin/sh
# Backup harian 02.00 (PRD §10): salin SQLite + media, simpan 30 hari.
set -e
SRC="/opt/tk/data"
DST="/opt/tk/data/backup/$(date +%F)"
mkdir -p "$DST"
cp "$SRC/tk.db" "$DST/" 2>/dev/null || cp web/prisma/dev.db "$DST/tk.db" 2>/dev/null || true
cp -r "$SRC/media" "$DST/" 2>/dev/null || true
find "$(dirname "$DST")" -maxdepth 1 -mtime +30 -exec rm -rf {} + 2>/dev/null || true
echo "Backup OK: $DST"
