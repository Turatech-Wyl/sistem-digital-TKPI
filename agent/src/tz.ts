// Diimpor PERTAMA oleh index.ts: jam pengingat, cron, dan tanggal lokal mengikuti WIB
// meski zona waktu server UTC. Bisa ditimpa lewat TZ di agent/.env.
process.env.TZ ||= "Asia/Jakarta";
