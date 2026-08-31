#!/bin/sh
# Menghasilkan dist/*.html: foto produk di-inline sebagai data URI, supaya tiap
# file bisa dibuka atau dibagikan tanpa folder assets.
set -e
cd "$(dirname "$0")"
sips -Z 1100 -s format jpeg -s formatOptions 72 assets/velour-night.jpg --out /tmp/scntr-shot.jpg >/dev/null
base64 -i /tmp/scntr-shot.jpg | tr -d '\n' > /tmp/scntr-shot.b64
mkdir -p dist
inline() {
  perl -0pe 'open(my $f,"<","/tmp/scntr-shot.b64"); my $b64=<$f>; s{\.\./assets/velour-night\.jpg}{data:image/jpeg;base64,$b64}g; s{"assets/velour-night\.jpg"}{"data:image/jpeg;base64,$b64"}; open(my $q,"<","/tmp/scntr-qris.b64"); my $qb=<$q>; if(defined $qb && length $qb){ s{src="assets/qris\.png"}{src="data:image/png;base64,$qb"}; }' "$1" > "$2"
  echo "$2 $(du -h "$2" | cut -f1)"
}
# QRIS ikut di-inline kalau filenya sudah ada
if [ -f assets/qris.png ]; then
  base64 -i assets/qris.png | tr -d "\n" > /tmp/scntr-qris.b64
else
  : > /tmp/scntr-qris.b64
fi

inline index.html dist/scntr.html
inline web/index.html dist/scntr-web.html

# Salin orders.html apa adanya (tidak perlu inline foto)
cp orders.html dist/orders.html

# Folder siap-upload: web jadi halaman utama, prototipe HP di /app.html
mkdir -p dist/site
cp dist/scntr-web.html dist/site/index.html
cp dist/scntr.html dist/site/app.html
cp orders.html dist/site/orders.html
echo "dist/site/ siap di-upload (index.html + app.html + orders.html)"
