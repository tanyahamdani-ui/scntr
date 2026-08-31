#!/bin/bash
# Cetak katalog diffuser jadi PDF.
# Foto diambil dari ~/Projects/scntr/assets/diffuser.jpg kalau ada.
# Kalau belum ada, sampulnya pakai panel gelap — PDF tetap jadi.

set -e

DIR="$HOME/Projects/scntr/b2b"
SRC="$DIR/sumber/katalog-diffuser-sumber.html"
# terima diffuser.jpg / .jpeg / .png / .webp — pilih yang pertama ketemu
# cocokkan berkas apa pun yang namanya diawali "diffuser", ekstensi bebas
FOTO="$(ls -t "$HOME"/Projects/scntr/assets/diffuser* 2>/dev/null | head -1)"
OUT="$DIR/SCNTR-Katalog-Diffuser.pdf"
TMP="$(mktemp -d)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ -n "$FOTO" ]; then
  echo "Foto ditemukan — menyisipkan ke sampul."
  sips -Z 1100 "$FOTO" --out "$TMP/f.jpg" >/dev/null 2>&1
  base64 -i "$TMP/f.jpg" | tr -d '\n' > "$TMP/f.b64"
  perl -pe 'BEGIN{open(F,"'"$TMP"'/f.b64"); $b=<F>; close F; chomp $b}
            s/__PHOTOSTYLE__/style="background-image:url(\x27data:image\/jpeg;base64,$b\x27)"/;
            s/__FALLBACK__//' "$SRC" > "$TMP/out.html"
else
  echo "Belum ada assets/diffuser.(jpg|png) — sampul pakai panel gelap."
  perl -pe 's/__PHOTOSTYLE__//;
            s/__FALLBACK__/<div class="fallback">SCNTR<\/div>/' "$SRC" > "$TMP/out.html"
fi

"$CHROME" --headless --disable-gpu --no-sandbox \
  --virtual-time-budget=9000 --no-pdf-header-footer \
  --print-to-pdf="$OUT" "file://$TMP/out.html" 2>/dev/null

rm -rf "$TMP"
echo "Selesai: $OUT"
echo "Halaman: $(LC_ALL=C grep -ac '/Type /Page$' "$OUT")"
