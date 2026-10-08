#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(__dirname, 'keluaran');
const W = 1080;
const H = 1350;

const BG = '#0e0e11';
const EMAS = '#c8a96a';
const TEKS = '#eceaf0';
const REDUP = '#6f6c79';

const TOPICS = [
  // Edukasi
  {
    type: 'edukasi',
    title: 'Parfum Bukan Deodoran',
    slides: [
      { kicker: 'Edukasi parfum', head: 'Parfum dan deodoran<br><em>beda fungsi.</em>', sub: 'Keduanya punya kegunaan berbeda.<br>Jangan tertukar saat menyiapkan rutinitas.', foot: 'Geser →' },
      { kicker: 'Parfum', head: 'Parfum dipakai<br>untuk <em>menambah aroma.</em>', sub: 'Gunakan sesuai arahan produk.<br>Pilih aroma yang kamu sukai.', foot: '02 / 06' },
      { kicker: 'Deodoran', head: 'Deodoran membantu<br><em>mengelola bau badan.</em>', sub: 'Pilih dan gunakan sesuai informasi<br>pada kemasannya.', foot: '03 / 06' },
      { kicker: 'Cara pakai', head: 'Baca petunjuk<br><em>sebelum digunakan.</em>', sub: 'Pastikan produk digunakan sesuai<br>peruntukannya.', foot: '04 / 06' },
      { kicker: 'Ingat', head: 'Parfum bukan pengganti<br><em>kebersihan diri.</em>', sub: 'Rutinitas bersih tetap jadi dasar.<br>Parfum melengkapi gaya personalmu.', foot: '05 / 06' },
      { kicker: 'Edukasi parfum', head: 'Dua produk,<br><em>fungsi berbeda.</em>', sub: 'Simpan postingan ini biar nggak tertukar.<br>Follow @scntr.id untuk tips lainnya.', foot: 'scntr.id' },
    ]
  },
  {
    type: 'edukasi',
    title: 'Titik Semprot Parfum',
    slides: [
      { kicker: 'Edukasi parfum', head: 'Mau pakai parfum?<br><em>Mulai dari titik semprot.</em>', sub: 'Pilih area yang nyaman dan ikuti petunjuk<br>penggunaan pada produk.', foot: 'Geser →' },
      { kicker: 'Titik semprot', head: 'Pergelangan tangan<br><em>salah satu pilihan.</em>', sub: 'Semprot secukupnya pada kulit yang bersih.<br>Biarkan mengering tanpa digosok.', foot: '02 / 06' },
      { kicker: 'Titik semprot', head: 'Leher juga bisa<br><em>jadi pilihan.</em>', sub: 'Hindari area sensitif dan kulit yang sedang<br>iritasi atau terluka.', foot: '03 / 06' },
      { kicker: 'Perhatikan', head: 'Jangan semprot<br><em>dekat mata.</em>', sub: 'Hindari wajah dan area sensitif.<br>Gunakan hanya sesuai petunjuk.', foot: '04 / 06' },
      { kicker: 'Perhatikan', head: 'Kulit sensitif?<br><em>Uji dengan hati-hati.</em>', sub: 'Hentikan pemakaian bila terasa tidak nyaman.<br>Ikuti anjuran pada kemasan.', foot: '05 / 06' },
      { kicker: 'Edukasi parfum', head: 'Pilih titik semprot<br><em>yang nyaman buatmu.</em>', sub: 'Simpan sebagai pengingat.<br>Follow @scntr.id untuk tips lainnya.', foot: 'scntr.id' },
    ]
  },
  {
    type: 'edukasi',
    title: 'Cara Pilih Parfum Harian',
    slides: [
      { kicker: 'Edukasi parfum', head: 'Bingung pilih parfum<br><em>buat harian?</em>', sub: 'Mulai dari aktivitas, suasana, dan<br>preferensi pribadimu.', foot: 'Geser →' },
      { kicker: 'Langkah 01', head: 'Pikirkan<br><em>aktivitasmu.</em>', sub: 'Kantor, kampus, atau waktu santai?<br>Situasi bisa membantu menentukan pilihan.', foot: '02 / 06' },
      { kicker: 'Langkah 02', head: 'Pilih kesan<br><em>yang kamu suka.</em>', sub: 'Misalnya ingin terasa santai, rapi,<br>atau lebih berani.', foot: '03 / 06' },
      { kicker: 'Langkah 03', head: 'Coba dulu<br><em>sebelum memutuskan.</em>', sub: 'Uji pada kulit sesuai petunjuk produk.<br>Beri waktu untuk menilai kenyamanannya.', foot: '04 / 06' },
      { kicker: 'Langkah 04', head: 'Pertimbangkan<br><em>orang di sekitarmu.</em>', sub: 'Gunakan secukupnya terutama di ruang bersama.<br>Kenyamanan itu penting.', foot: '05 / 06' },
      { kicker: 'Edukasi parfum', head: 'Parfum harian<br><em>pilihan personal.</em>', sub: 'Simpan panduan ini saat memilih.<br>Follow @scntr.id untuk tips lainnya.', foot: 'scntr.id' },
    ]
  },
  {
    type: 'edukasi',
    title: 'Etika Pakai Parfum',
    slides: [
      { kicker: 'Edukasi parfum', head: 'Pakai parfum<br><em>tetap perhatikan sekitar.</em>', sub: 'Wangi adalah bagian dari gaya.<br>Etika membuatnya nyaman untuk bersama.', foot: 'Geser →' },
      { kicker: 'Etika 01', head: 'Gunakan<br><em>secukupnya.</em>', sub: 'Mulai sedikit dan ikuti petunjuk produk.<br>Sesuaikan dengan tempat dan aktivitas.', foot: '02 / 06' },
      { kicker: 'Etika 02', head: 'Ruang bersama<br><em>perlu pertimbangan.</em>', sub: 'Kantor, kelas, dan kendaraan punya<br>ruang yang digunakan bersama.', foot: '03 / 06' },
      { kicker: 'Etika 03', head: 'Tanya sebelum<br><em>menyemprot di ruang tertutup.</em>', sub: 'Tidak semua orang nyaman dengan aroma.<br>Hormati kebutuhan orang lain.', foot: '04 / 06' },
      { kicker: 'Etika 04', head: 'Jangan semprot<br><em>ke orang lain.</em>', sub: 'Parfum adalah pilihan personal.<br>Biarkan setiap orang menentukan sendiri.', foot: '05 / 06' },
      { kicker: 'Edukasi parfum', head: 'Wangi nyaman,<br><em>semua ikut nyaman.</em>', sub: 'Bagikan ke temanmu.<br>Follow @scntr.id untuk tips lainnya.', foot: 'scntr.id' },
    ]
  },
  {
    type: 'edukasi',
    title: '5 Kesalahan Pakai Parfum',
    slides: [
      { kicker: 'Edukasi parfum', head: '5 kesalahan pakai parfum<br>yang <em>gampang dihindari.</em>', sub: 'Cara pakai ikut menentukan pengalamanmu.<br>Cek kebiasaanmu satu per satu.', foot: 'Geser →' },
      { kicker: 'Kesalahan 01', head: 'Semprot ke <em>baju</em><br>dulu, baru ke kulit.', sub: 'Coba aplikasikan ke kulit yang bersih lebih dulu.<br>Kalau mau ke kain, cek petunjuk produk dan<br>uji di area kecil yang tersembunyi.', foot: '02 / 10' },
      { kicker: 'Kesalahan 02', head: 'Botolnya dikocok<br><em>sebelum dipakai.</em>', sub: 'Parfum tidak perlu dikocok.<br>Buka tutupnya, lalu semprot sesuai kebutuhan.', foot: '03 / 10' },
      { kicker: 'Kesalahan 03', head: 'Habis semprot,<br><em>digosok-gosok.</em>', sub: 'Biarkan parfum mengering dengan sendirinya.<br>Kalau mau, aplikasikan di titik nadi seperti<br>pergelangan atau leher.', foot: '04 / 10' },
      { kicker: 'Kesalahan 04', head: 'Disimpan<br>di <em>kamar mandi.</em>', sub: 'Pilih tempat yang kering dan teduh.<br>Simpan di lemari atau laci, jauh dari panas<br>dan cahaya langsung.', foot: '05 / 10' },
      { kicker: 'Kesalahan 05', head: 'Menyemprot<br><em>terlalu dekat.</em>', sub: 'Jaga jarak yang nyaman agar semprotan<br>tersebar merata. Ikuti petunjuk pada produk.', foot: '06 / 10' },
      { kicker: 'Yang benar', head: 'Pakai <em>secukupnya</em><br>untuk aktivitasmu.', sub: 'Mulai sedikit, lalu sesuaikan dengan situasi.<br>Kenyamanan orang di sekitarmu juga penting.', foot: '07 / 10' },
      { kicker: 'Yang benar', head: 'Kadang kamu<br><em>terbiasa dengan wangimu.</em>', sub: 'Kalau ragu, jangan langsung semprot ulang.<br>Minta pendapat teman yang kamu percaya.', foot: '08 / 10' },
      { kicker: 'Yang benar', head: 'Pilih parfum<br><em>sesuai preferensimu.</em>', sub: 'EDT dan EDP adalah kategori konsentrasi.<br>Cari tahu karakter produk dan pilih yang terasa<br>pas buat kamu.', foot: '09 / 10' },
      { kicker: 'Tips parfum', head: 'Simpan dulu.<br>Sebelum lo <em>lupa lagi.</em>', sub: 'Parfumnya bener, cara pakainya juga harus bener.<br>Follow @scntr.id buat tips sisanya.', foot: 'scntr.id' },
    ]
  },
  {
    type: 'edukasi',
    title: 'Layering Parfum SCNTR',
    slides: [
      { kicker: 'Layering parfum', head: 'Mau coba layering?<br><em>Mulai dari dua pilihan.</em>', sub: 'Padukan parfum yang sudah kamu punya.<br>Catat kombinasi yang paling kamu suka.', foot: 'Geser →' },
      { kicker: 'Layering parfum', head: 'Fresh + Bold<br><em>coba dan rasakan sendiri.</em>', sub: 'Gunakan sesuai preferensimu.<br>Tak ada satu kombinasi yang cocok untuk semua.', foot: '02 / 06' },
      { kicker: 'Aturan layering', head: 'Coba satu parfum<br><em>lebih dulu.</em>', sub: 'Kenali karakter masing-masing sebelum<br>mencoba memadukannya.', foot: '03 / 06' },
      { kicker: 'Aturan layering', head: 'Mulai <em>secukupnya.</em>', sub: 'Aplikasikan satu per satu, beri jeda,<br>lalu nilai apakah perpaduannya nyaman.', foot: '04 / 06' },
      { kicker: 'Coba combo', head: 'Clean + Velour Night<br><em>gimana menurutmu?</em>', sub: 'Uji di area kecil dan tentukan sendiri<br>kombinasi yang paling kamu suka.', foot: '05 / 06' },
      { kicker: 'Layering parfum', head: 'Simpan combo favoritmu.<br>Follow @scntr.id buat inspirasi lain.', sub: '', foot: 'scntr.id' },
    ]
  },
  {
    type: 'edukasi',
    title: 'Simpan Parfum Benar',
    slides: [
      { kicker: 'Simpan parfum', head: 'Jauhkan parfum<br>dari <em>panas dan cahaya.</em>', sub: 'Hindari tempat yang terkena matahari langsung<br>atau berubah suhu secara ekstrem.', foot: 'Geser →' },
      { kicker: 'Simpan parfum', head: 'Pilih tempat<br>yang <em>kering dan teduh.</em>', sub: 'Lemari atau laci bisa jadi pilihan.<br>Simpan sesuai petunjuk pada kemasan.', foot: '02 / 07' },
      { kicker: 'Simpan parfum', head: 'Tutup botol<br><em>setelah digunakan.</em>', sub: 'Pastikan tutup terpasang dengan baik.<br>Jangan biarkan botol terbuka.', foot: '03 / 07' },
      { kicker: 'Simpan parfum', head: 'Hindari area<br><em>lembap dan panas.</em>', sub: 'Kamar mandi biasanya sering berubah suhu<br>dan kelembapannya.', foot: '04 / 07' },
      { kicker: 'Perhatikan produk', head: 'Ikuti petunjuk<br><em>pada kemasan.</em>', sub: 'Setiap produk bisa punya arahan penyimpanan<br>yang berbeda.', foot: '05 / 07' },
      { kicker: 'Perhatikan produk', head: 'Ada perubahan<br><em>yang tidak biasa?</em>', sub: 'Cek kondisi produk dan hubungi penjual<br>jika kamu merasa ada yang janggal.', foot: '06 / 07' },
      { kicker: 'Simpan parfum', head: 'Simpan dengan<br><em>cara yang tepat.</em>', sub: '', foot: 'scntr.id' },
    ]
  },
  // Persona
  {
    type: 'persona',
    title: 'Fresh vs Clean — Pagi Mana?',
    slides: [
      { kicker: 'Pagi ini pakai apa?', head: 'Fresh: <em>kesan bersemangat.</em><br>Clean: <em>rapi dan tenang.</em>', sub: 'Pilih suasana yang paling mewakili gayamu.<br>Kamu lebih dekat ke yang mana?', foot: 'Geser →' },
      { kicker: 'Fresh', head: 'Untuk hari yang<br><em>aktif dan dinamis.</em>', sub: 'Coba saat kamu ingin tampil dengan kesan segar.<br>Pasangkan dengan gaya pilihanmu.', foot: '02 / 06' },
      { kicker: 'Clean', head: 'Untuk kesan<br><em>rapi dan sederhana.</em>', sub: 'Bisa jadi pilihan saat kamu ingin tampil<br>lebih tenang dan tertata.', foot: '03 / 06' },
      { kicker: 'Combo', head: 'Fresh + Clean<br><em>berani coba?</em>', sub: 'Coba di area kecil lebih dulu.<br>Menurutmu cocok atau lebih suka sendiri-sendiri?', foot: '04 / 06' },
      { kicker: 'Kamu tim apa?', head: 'A: Fresh buat semangat.<br>B: Clean buat rapi.', sub: 'Tulis A/B di komentar.', foot: '05 / 06' },
      { kicker: 'Pagi ini pakai apa?', head: 'Coba kuis di link bio.<br>Follow @scntr.id', sub: '', foot: 'scntr.id' },
    ]
  },
  {
    type: 'persona',
    title: 'Bold vs Velour Night — Malam Mana?',
    slides: [
      { kicker: 'Malam nongkrong pakai apa?', head: 'Bold: <em>percaya diri.</em><br>Velour Night: <em>kalem.</em>', sub: 'Dua pilihan gaya untuk suasana berbeda.<br>Kamu lebih suka tampil seperti apa?', foot: 'Geser →' },
      { kicker: 'Bold', head: 'Saat ingin tampil<br><em>lebih berani.</em>', sub: 'Pilih gaya yang terasa paling mewakili dirimu<br>untuk agenda malam ini.', foot: '02 / 06' },
      { kicker: 'Velour Night', head: 'Saat ingin tampil<br><em>lebih santai.</em>', sub: 'Gaya sederhana yang terasa pas untuk<br>momen bersama teman.', foot: '03 / 06' },
      { kicker: 'Combo', head: 'Bold + Velour Night<br><em>coba atau pilih satu?</em>', sub: 'Kalau penasaran, uji perpaduannya sedikit dulu.<br>Kamu tim layering atau satu parfum?', foot: '04 / 06' },
      { kicker: 'Kamu tim apa?', head: 'A: Bold buat statement.<br>B: Velour Night buat santai.', sub: 'Tulis A/B di komentar.', foot: '05 / 06' },
      { kicker: 'Malam nongkrong pakai apa?', head: 'Coba kuis di link bio.<br>Follow @scntr.id', sub: '', foot: 'scntr.id' },
    ]
  },
  // Momen
  {
    type: 'momen',
    title: 'Hujan Deras — Pilih Parfum Apa?',
    slides: [
      { kicker: 'Cuaca hujan', head: 'Hujan di luar,<br><em>tetap siap beraktivitas.</em>', sub: 'Pilih parfum berdasarkan preferensimu.<br>Jangan lupa simpan botol di tempat kering.', foot: 'Geser →' },
      { kicker: 'Persiapan', head: 'Bawa parfum<br><em>dengan aman.</em>', sub: 'Pastikan tutup botol rapat dan simpan<br>agar tidak terkena air.', foot: '02 / 06' },
      { kicker: 'Persiapan', head: 'Pilih gaya<br>yang <em>kamu suka.</em>', sub: 'Bold atau Velour Night?<br>Sesuaikan dengan selera dan suasana.', foot: '03 / 06' },
      { kicker: 'Jaga produk', head: 'Botol basah?<br><em>Keringkan bagian luarnya.</em>', sub: 'Simpan kembali di tempat yang teduh<br>dan tidak lembap.', foot: '04 / 06' },
      { kicker: 'Tips', head: 'Jangan semprot<br><em>ke pakaian basah.</em>', sub: 'Tunggu sampai pakaian kering dan ikuti<br>petunjuk penggunaan di kemasan.', foot: '05 / 06' },
      { kicker: 'Cuaca ekstrem', head: 'Simpan buat musim hujan.<br>Follow @scntr.id', sub: '', foot: 'scntr.id' },
    ]
  },
  {
    type: 'momen',
    title: 'Presentasi Besok — Parfum Apa?',
    slides: [
      { kicker: 'Presentasi besar', head: 'Besok presentasi,<br><em>pilih gaya yang nyaman.</em>', sub: 'Persiapkan pakaian, materi, dan parfum<br>yang sesuai preferensimu.', foot: 'Geser →' },
      { kicker: 'Rekomendasi', head: 'Clean — <em>kesan rapi.</em>', sub: 'Pilihan untuk gaya yang sederhana dan tertata.<br>Gunakan secukupnya sesuai petunjuk.', foot: '02 / 06' },
      { kicker: 'Alternatif', head: 'Velour Night — <em>gaya yang tenang.</em>', sub: 'Pertimbangkan pilihan yang terasa cocok<br>dengan dirimu dan suasana acara.', foot: '03 / 06' },
      { kicker: 'Tips', head: 'Siapkan pakaian<br><em>sebelum hari H.</em>', sub: 'Kalau parfum akan terkena kain, baca<br>petunjuk produk dan coba di area tersembunyi.', foot: '04 / 06' },
      { kicker: 'Tips', head: 'Jangan berlebihan<br><em>di ruang bersama.</em>', sub: 'Pakai secukupnya dan pertimbangkan<br>kenyamanan orang lain.', foot: '05 / 06' },
      { kicker: 'Presentasi besar', head: 'Simpan buat hari H.<br>Follow @scntr.id', sub: '', foot: 'scntr.id' },
    ]
  },
  // Efek ke orang lain
  {
    type: 'efek',
    title: 'POV: Crush Bilang Wangi',
    slides: [
      { kicker: 'POV', head: 'Crush/ortu/teman bilang:<br><em>"Kamu wangi banget."</em>', sub: 'Momen sederhana yang bikin senyum.<br>Siapa yang pernah bilang begitu ke kamu?', foot: 'Geser →' },
      { kicker: 'POV', head: 'Kamu senyum pelan<br>mikir <em>"ini SCNTR tadi pagi."</em>', sub: 'Fresh / Clean / Bold / Velour Night.<br>Setiap orang punya pilihan favorit.', foot: '02 / 05' },
      { kicker: 'Efek', head: 'Teman nanya:<br><em>"Lo pake parfum apa?"</em>', sub: 'Obrolan kecil soal pilihan wangimu.<br>Tag teman yang suka bahas parfum.', foot: '03 / 05' },
      { kicker: 'Efek', head: 'Masuk lift,<br><em>ketemu teman lama.</em>', sub: 'Mulai obrolan dari pilihan parfum masing-masing.<br>Tag teman yang selalu punya cerita.', foot: '04 / 05' },
      { kicker: 'POV', head: 'Ceritakan pengalamanmu<br>di komentar.<br>Follow @scntr.id', sub: '', foot: 'scntr.id' },
    ]
  },
  // Soft-sell
  {
    type: 'softsell',
    title: 'SCNTR EDP 99rb — Harga Jujur',
    slides: [
      { kicker: 'SCNTR', head: 'EDP 50 ml,<br><em>harga launching 99rb.</em>', sub: 'Bukan EDT, bukan kolongan. EDP asli.<br>Batch kecil, diracik & dibotolkan sendiri di Jakarta.', foot: 'Geser →' },
      { kicker: 'Kenapa murah?', head: 'Nggak ada biaya marketing gede,<br><em>nggak ada middleman.</em>', sub: 'Dari lab → botol → tangan kamu.<br>Harga jujur, kualitas jujur.', foot: '02 / 06' },
      { kicker: 'Varian', head: 'Fresh / Clean / Bold / Velour Night<br><em>semua EDP, semua 99rb.</em>', sub: 'Pilih sesuai karakter, nggak sesuai budget.', foot: '03 / 06' },
      { kicker: 'Review', head: 'Cek review pembeli di Shopee/Tokopedia<br><em>rating 4.9/5.</em>', sub: 'Asli pembeli, nggak dibayar.', foot: '04 / 06' },
      { kicker: 'Beli', head: 'Klik keranjang kuning di TikTok Shop @scntr.id<br>atau <em>scntr.pages.dev</em>', sub: 'Gratis ongkir min. belanja 198rb.', foot: '05 / 06' },
      { kicker: 'SCNTR', head: 'Less noise.<br><em>More presence.</em>', sub: '', foot: 'scntr.id' },
    ]
  },
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&').replace(/</g, '<')
    .replace(/>/g, '>').replace(/"/g, '"');
}

function html(slide, index, total) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{background:${BG};color:${TEKS};font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;
display:flex;flex-direction:column;padding:88px 84px 76px}
.mid{margin-top:auto;margin-bottom:auto}
.top{display:flex;justify-content:space-between;align-items:center}
.wm{font-size:30px;font-weight:700;letter-spacing:.42em;color:${EMAS}}
.kicker{font-size:22px;letter-spacing:.16em;text-transform:uppercase;color:${REDUP}}
.garis{height:4px;width:120px;background:${EMAS};margin-bottom:48px}
.head{font-size:96px;line-height:1.14;font-weight:700;letter-spacing:-.02em}
.head em{font-style:normal;color:${EMAS}}
.sub{margin-top:56px;font-size:36px;line-height:1.62;color:#a8a5b4;max-width:860px}
.bot{display:flex;justify-content:space-between;align-items:flex-end}
.foot{font-size:26px;letter-spacing:.1em;color:${REDUP};text-transform:uppercase}
.hint{font-size:26px;color:${EMAS};letter-spacing:.06em}
.dots{display:flex;gap:12px}
.dot{width:11px;height:11px;border-radius:50%;background:#2b2a33}
.dot.on{background:${EMAS}}
</style></head><body>
<div class="top"><div class="wm">SCNTR</div><div class="kicker">${escapeHtml(slide.kicker)}</div></div>
<div class="mid">
  <div class="garis"></div>
  <div class="head">${slide.head}</div>
  <div class="sub">${slide.sub}</div>
</div>
<div class="bot">
  <div class="dots">${TOPICS.flatMap(t => t.slides).map((_, i) => `<div class="dot${i === index ? ' on' : ''}"></div>`).join('')}</div>
  <div class="${index === 0 || index === total - 1 ? 'hint' : 'foot'}">${slide.foot}</div>
</div>
</body></html>`;
}

function generateCarousel(topic) {
  const topicDir = path.join(OUT, topic.type + '-' + topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  fs.mkdirSync(topicDir, { recursive: true });

  topic.slides.forEach((slide, i) => {
    const nama = `slide-${i + 1}`;
    const htmlPath = path.join(topicDir, nama + '.html');
    const pngPath = path.join(topicDir, nama + '.png');
    fs.writeFileSync(htmlPath, html(slide, i, topic.slides.length));
    execFileSync(CHROME, [
      '--headless', '--disable-gpu', '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${W},${H}`,
      `--screenshot=${pngPath}`,
      'file://' + htmlPath,
    ], { stdio: 'ignore' });
    const ukuran = fs.existsSync(pngPath) ? fs.statSync(pngPath).size : 0;
    console.log((ukuran ? 'OK  ' : 'GAGAL') + ' ' + topic.title + ' → ' + nama + '.png (' + Math.round(ukuran / 1024) + ' KB)');
  });

  console.log('  Output: ' + topicDir);
}

fs.mkdirSync(OUT, { recursive: true });

TOPICS.forEach(generateCarousel);

console.log('\nSelesai. Total carousel:', TOPICS.length);