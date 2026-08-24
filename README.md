# SCNTR

Situs statis untuk SCNTR — parfum cowok yang ga drama.

- `index.html` — toko versi web (desktop dan mobile).
- `app.html` — prototipe aplikasi mobile: onboarding, home, detail produk, keranjang, riwayat pesanan.
- `assets/velour-night.jpg` — foto produk yang dipakai kedua halaman.

Tidak ada build step dan tidak ada dependensi selain Google Fonts. Buka `index.html`
langsung di browser, atau taruh seluruh folder ini di hosting statis mana pun.

## Deploy ke GitHub Pages

1. Buat repo baru di GitHub (boleh public atau private).
2. `git remote add origin <url-repo>` lalu `git push -u origin main`.
3. Di repo: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
4. Situs terbit di `https://<username>.github.io/<nama-repo>/`.
