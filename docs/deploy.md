# Deploy ke server

Target: Ubuntu 22.04, 2 GB RAM, tanpa Docker, aplikasi di `/opt/tk`, data di `/opt/tk/data`. Arsitektur: PRD §9.

## 1. Prasyarat (sekali)

```sh
sudo apt install -y git sqlite3 curl build-essential
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
. ~/.nvm/nvm.sh && nvm install 22
sudo mkdir -p /opt/tk && sudo chown "$USER" /opt/tk
git clone <repo> /opt/tk
mkdir -p /opt/tk/data/media /opt/tk/data/backup /opt/tk/data/logs
```

## 2. Konfigurasi

```sh
cp /opt/tk/web/.env.example   /opt/tk/web/.env
cp /opt/tk/agent/.env.example /opt/tk/agent/.env
openssl rand -hex 32   # → SESSION_SECRET
openssl rand -hex 16   # → AGENT_TOKEN (isi sama di kedua file)
```

| File | Kunci | Nilai server |
|---|---|---|
| `web/.env` | `DATABASE_URL` | `file:/opt/tk/data/tk.db` |
| | `DATA_DIR` | `/opt/tk/data` |
| | `NEXT_PUBLIC_BASE` | `https://tk.willieputra.dev` |
| | `SESSION_SECRET` | hasil `openssl rand -hex 32` |
| | `AGENT_TOKEN` | hasil `openssl rand -hex 16` |
| | `SEED_PASSWORD` | password kuat (ganti lagi setelah login pertama) |
| `agent/.env` | `DB_PATH` | `/opt/tk/data/tk.db` |
| | `DATA_DIR` | `/opt/tk/data` |
| | `WEB_URL` | `http://localhost:3001` |
| | `AGENT_TOKEN` | sama dengan web |

## 3. Instal dan build

```sh
cd /opt/tk/web
npm ci
npx prisma migrate deploy
npx prisma db seed        # hanya sekali, pada instalasi baru
npm run build
cd /opt/tk/agent && npm ci
```

## 4. Jalankan otomatis

```sh
crontab -e
# tambahkan:
@reboot /opt/tk/scripts/start.sh
0 2 * * * /opt/tk/scripts/backup.sh >> /opt/tk/data/logs/backup.log 2>&1
```

> Agent juga menjalankan backup pukul 02.00 lewat node-cron. Pilih **salah satu**: pakai baris crontab di atas *atau* andalkan agent, jangan keduanya.

Jalankan sekarang tanpa reboot: `nohup /opt/tk/scripts/start.sh >/dev/null 2>&1 &`

Web berjalan di `localhost:3001`. Log ada di `/opt/tk/data/logs/{web,agent}.log`.

## 5. Cloudflare Tunnel

```sh
cloudflared tunnel login
cloudflared tunnel create tk
cloudflared tunnel route dns tk tk.willieputra.dev
# ~/.cloudflared/config.yml → ingress: hostname tk.willieputra.dev → service http://localhost:3001
sudo cloudflared service install
```

## 6. Hubungkan WhatsApp

Login sebagai admin → **Pengaturan → WhatsApp** → scan QR dari HP sekolah (WhatsApp → Perangkat tertaut). Sesi tersimpan di `agent/auth/`. Jangan hapus folder ini kecuali ingin scan ulang.

## 7. Pembaruan

```sh
cd /opt/tk && git pull
cd web && npm ci && npx prisma migrate deploy && npm run build
cd ../agent && npm ci
pkill -f "next start"; pkill -f "agent/run.sh"; pkill -f "tsx.*src/index.ts"
nohup /opt/tk/scripts/start.sh >/dev/null 2>&1 &
```

## 8. Backup dan restore

Backup harian ada di `/opt/tk/data/backup/YYYY-MM-DD/` (berisi `tk.db` dan `media/`) dan disimpan 30 hari.

Restore:

```sh
pkill -f "next start"; pkill -f "agent/run.sh"; pkill -f "tsx.*src/index.ts"
cp /opt/tk/data/tk.db /opt/tk/data/tk.db.sebelum-restore
cp /opt/tk/data/backup/2026-11-01/tk.db /opt/tk/data/tk.db
rm -f /opt/tk/data/tk.db-wal /opt/tk/data/tk.db-shm
cp -r /opt/tk/data/backup/2026-11-01/media/. /opt/tk/data/media/
nohup /opt/tk/scripts/start.sh >/dev/null 2>&1 &
```

Uji restore ini minimal sekali sebelum go-live (lihat `PLAN.md`).
