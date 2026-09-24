#!/bin/sh
# Menyalin halaman toko ke folder siap-upload (default: ./dist/site).
# Bisa override target: ./sync.sh /path/ke/repo-situs
set -e
cd "$(dirname "$0")"
SITE=${1:-"$PWD/dist/site"}
mkdir -p "$SITE"
cp index.html "$SITE/index.html"
cp app.html "$SITE/app.html"
cp katalog.html "$SITE/katalog.html"
# orders.html SENGAJA tidak ikut: halaman operasional internal (data toko).
# Bukanya dari file lokal / repo, bukan dari web publik.
echo "tersalin ke $SITE (index.html + app.html + katalog.html)"
