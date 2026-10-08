# SCNTR

Situs statis untuk SCNTR — parfum cowok yang ga drama.

- `index.html` — toko versi web (desktop dan mobile).
- `app.html` — prototipe aplikasi mobile: onboarding, home, detail produk, keranjang, riwayat pesanan.
- `assets/velour-night.jpg` — foto produk yang dipakai kedua halaman.

Tidak ada build step dan tidak ada dependensi selain Google Fonts. Buka `index.html`
langsung di browser, atau taruh seluruh folder ini di hosting statis mana pun.

## Lead tracker lokal

Jalankan `node tools/lead-tracker/server.mjs`, lalu buka `http://127.0.0.1:4177`.
Tracker hanya bind ke loopback dan menyimpan data di `_kerja/lead-tracker/leads.json`
(file lokal, tidak untuk di-commit). Tambahkan URL posting publik, konteks seperlunya,
lalu perbarui status hanya setelah tindakan manual. Tidak ada scraping atau pesan otomatis.

Untuk mengimpor hasil pencarian Threads secara eksplisit, simpan hasil JSON pencarian lalu jalankan:

```sh
mkdir -p _kerja/lead-tracker && node tools/threads-scntr.mjs cari "minta rekomendasi parfum" --json > _kerja/lead-tracker/threads-hasil.json
node tools/lead-tracker/import-threads.mjs _kerja/lead-tracker/threads-hasil.json
```

File state lama `_kerja/threads-lead.json` hanya berisi URL tanpa konteks; bisa diimpor dengan `node tools/lead-tracker/import-threads.mjs _kerja/threads-lead.json`. URL duplikat dilewati. Impor tidak membuka atau menghubungi akun mana pun.

## Deploy ke GitHub Pages

1. Buat repo baru di GitHub (boleh public atau private).
2. `git remote add origin <url-repo>` lalu `git push -u origin main`.
3. Di repo: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
4. Situs terbit di `https://<username>.github.io/<nama-repo>/`.
