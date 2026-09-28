# Aturan tetap untuk semua agen (OpenCode, Copilot, dll.) di proyek SCNTR

## Setiap selesai membuat konten, WAJIB masukkan ke Kelola.in

Konten TikTok/IG SCNTR dikelola di sistem Kelola.in (workspace **SCNTR**).
Konten yang hanya ada di folder laptop dianggap BELUM selesai.

Langkah setelah konten jadi (naskah + video + `CAPTION & JADWAL.txt` di folder `SCNTR Upload TikTok <tanggal>`):

1. Jalankan generator:
   `node /Users/dani/Projects/content-tracker/scripts/import-scntr-content.mjs --skip-caption` (WAJIB pakai --skip-caption supaya tidak dobel)
   Generator membaca semua folder `SCNTR Upload TikTok *` dan menulis
   `/Users/dani/Projects/content-tracker/supabase/import-scntr-content.sql`.
   Generator otomatis melewati konten yang sudah ada (tanggal + judul sama), jadi aman dijalankan ulang.
2. Laporkan ke manajer (Claude) / pemilik: "SQL siap dijalankan, N konten baru".
   SQL dijalankan di Supabase SQL Editor (project `ktltnhtetmkmwezxekac`).
3. Cek hasil: `select count(*) from planner_entries where workspace_id = (select id from workspaces where name = 'SCNTR');`

## Aturan konten (ringkas)
- Ikuti `BRIEF-TIKTOK-OKT.md` dan `SOP-UPLOAD-TIKTOK.md`.
- Jangan tulis notes aroma selain yang dikunci di `KEPUTUSAN-DIBUTUHKAN.md` bagian 6, jangan klaim ketahanan jam, jangan sebut nama parfum/brand lain, jangan tulis angka harga di TikTok (boleh "di bawah 100 ribu").
- Video yang sudah terunggah/terjadwal dipindah ke Tong Sampah (bukan dihapus permanen).

## Struktur tim marketing & sosial media SCNTR
- **CEO/Direktur: Dani** — keputusan bisnis (harga, produk, pengeluaran, publikasi, login/izin akun).
- **Manager: Claude** — strategi, riset, analisa data, menulis brief, membagi tugas, memeriksa hasil staf.
- **Staf (agen)** — mengerjakan eksekusi sesuai brief, lalu melapor:
  - OpenCode `--agent tiktok-strategist` — strategi & riset TikTok
  - OpenCode `--agent content-creator` — naskah, caption
  - OpenCode `--agent carousel-growth` — carousel / photo mode
  - OpenCode `--agent video-editing-coach` — rencana edit & render (mesin `scntr-marketing/video-tulisan.js`)
  - OpenCode `--agent social-media-strategist` — rencana lintas platform
  - OpenCode `--agent paid-social` / `paid-creative` — iklan TikTok, Shopee, Meta
  - OpenCode `--agent livestream-coach` — jualan live
  - Copilot — kode, website Kelola.in/scntr.pages.dev, pekerjaan teknis cepat
  - ChatGPT — gambar & desain visual
- WAJIB baca `BRAND-SCNTR.md` (visual hitam-putih, nada bicara) dan `_kerja/PANDUAN-STAF.md` (aturan jujur + resep yang terbukti) sebelum mengerjakan tugas.
- Pembagian beban: OpenCode untuk tugas ringan & jelas (jalankan skrip jadi, rapikan file, teks pendek). Tugas berlapis, debugging, dan kode → Copilot. Urutan eskalasi: Qwen / Copilot / Codex → Claude (manajer, paling akhir). OpenCode = cadangan TERAKHIR, hanya tugas gampang, lewat `tools/staf-opencode.sh` (otomatis berhenti 15 menit). Qwen Code (`qwen --yolo -i "..."`) dan Gemini CLI (`gemini --yolo -i "..."`, kunci AI Studio gratis) dipakai setara Copilot, terutama saat kuota Copilot habis.
- Definisi peran ada di `~/.config/opencode/agent/*.md`. Jangan membuat peran baru yang namanya sama.
- Cara lapor: tulis hasil ke `_kerja/laporan-<nama-staf>.md` (apa yang selesai, apa yang gagal, di langkah mana).

## Menjadwalkan postingan (skrip siap pakai, Chrome :9222 harus terbuka & login)
Folder skrip: `tools/upload-tiktok/`. Selalu tes dulu dengan `--dry-run`. Hasil terjadwal otomatis tercatat ke Kelola.in.
- Reels IG (dari video TikTok): `node bs-batch-ig.mjs --count 3` — jalan otomatis tiap tgl 14 jam 10.00. Meta hanya bisa ±28 hari ke depan.
- Karosel / foto feed IG: taruh foto di `SCNTR Feed IG/<YYYY-MM-DD> - <nama>/01.jpg…` (maks 10) + `caption.txt`, lalu `node bs-feed-ig.mjs --count 3` (jam 11:00).
- Karosel TikTok: taruh foto di `SCNTR Carousel TikTok/<YYYY-MM-DD> - <nama>/01.jpg…` (maks 35) + `caption.txt` (baris 1 judul, sisanya deskripsi), lalu `node tt-carousel.mjs --count 3` (jam 11:00). Jangan ada angka harga di foto/caption TikTok.
- Kalau hasilnya "KEMUNGKINAN TERJADWAL", JANGAN diulang (bisa dobel) — laporkan.
