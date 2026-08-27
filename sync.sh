#!/bin/sh
# Menyalin sumber dari worktree ini ke repo situs (/Users/dani/Projects/scntr),
# sekaligus membetulkan path aset. Setelah ini tinggal push dari GitHub Desktop.
set -e
cd "$(dirname "$0")"
SITE=/Users/dani/Projects/scntr
perl -0pe 's{\.\./assets/velour-night\.jpg}{assets/velour-night.jpg}g' web/index.html > "$SITE/index.html"
cp index.html "$SITE/app.html"
echo "tersalin ke $SITE (index.html + app.html)"
