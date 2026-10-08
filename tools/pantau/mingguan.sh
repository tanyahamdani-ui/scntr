#!/bin/zsh
# Pantau kompetitor mingguan (dijalankan otomatis tiap Senin 07:00).
# Chrome khusus skrip (port 9222) harus terbuka untuk TikTok.
cd /Users/dani/Projects/SCNTR_Projects
P=_kerja/pantau; A=_kerja/pantau-aini; H=$(date +%F); CT=/Users/dani/Projects/content-tracker
SCNTR_WS=cf946158-f168-473e-a195-35d3cfed26a9
AINI_WS=5e3a55b2-2243-4b9a-beb9-de384e58b705
lapor() { node tools/lapor-telegram.mjs "$1"; }

# SCNTR: TikTok 11 akun
node tools/pantau/kumpul-tiktok.mjs $P/akun-final.txt && mv $P/hasil-tiktok-$H.json $P/scntr-tiktok-$H.json
# Aini: TikTok ISS + YouTube ISS/ALSOK
node tools/pantau/kumpul-tiktok.mjs $A/tiktok.txt && mv $P/hasil-tiktok-$H.json $A/tiktok-$H.json
node tools/pantau/kumpul-youtube.mjs $A/youtube.txt $A/youtube-$H.json

ok=0
[ -f $P/scntr-tiktok-$H.json ] && node $CT/scripts/unggah-pantau-kompetitor.mjs $P/scntr-tiktok-$H.json $SCNTR_WS >/dev/null && ok=$((ok+1))
[ -f $A/tiktok-$H.json ] && node $CT/scripts/unggah-pantau-kompetitor.mjs $A/tiktok-$H.json $AINI_WS >/dev/null && ok=$((ok+1))
[ -f $A/youtube-$H.json ] && node $CT/scripts/unggah-pantau-kompetitor.mjs $A/youtube-$H.json $AINI_WS >/dev/null && ok=$((ok+1))
if [ $ok = 3 ]; then lapor "📊 Pantau kompetitor mingguan ($H) beres: SCNTR (TikTok) + Aini (TikTok & YouTube). Cek tab Competitors di Kelola.in."
else lapor "⚠️ Pantau kompetitor mingguan ($H) cuma $ok/3 berhasil. Cek _kerja/pantau/mingguan.log (Chrome 9222 kebuka?)."; fi
