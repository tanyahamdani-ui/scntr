import { getStudio, upload, setCaptionSafe } from './studio.mjs';
import { evalJs } from './cdp.mjs';

const ROOT = '/Users/dani/Projects/SCNTR_Projects/';
const KUIS = ROOT + 'SCNTR Campaign Kuis Varian/';
const B1521 = ROOT + 'SCNTR Upload TikTok 15 - 21 Okt/';
const B2228 = ROOT + 'SCNTR Upload TikTok 22 - 28 Okt/';

const TUGAS = [
  { tgl: 11, f: KUIS + '2 - Tim Fresh.mp4', cap: 'Hasil kuismu kebanyakan soal aktivitas luar? Kamu tim Fresh. SCNTR Fresh buat parfum yang dipakai pagi sampai aktivitas di luar. Cek kuisnya di link bio, komen hasil kuismu di sini.\n#scntr #parfumpria #kuisparfum #SCNTRFresh' },
  { tgl: 12, f: KUIS + '3 - Tim Clean.mp4', cap: 'Hasil kuismu banyak soal kantor dan kampus? Kamu tim Clean. SCNTR Clean buat kamu yang kerja dan kuliah, wangi bersih yang aman buat ruangan AC. Cek kuisnya di link bio, tulis tim kamu di komentar.\n#scntr #parfumpria #kuisparfum #SCNTRClean' },
  { tgl: 13, f: KUIS + '4 - Tim Bold.mp4', cap: 'Hasil kuismu soal acara dan malam hari? Kamu tim Bold. SCNTR Bold buat acara dan malam hari. Cek kuisnya di link bio, komen hasil kuismu.\n#scntr #parfumpria #kuisparfum #SCNTRBold' },
  { tgl: 14, f: KUIS + '5 - Tim Velour Night.mp4', cap: 'Hasil kuismu santai terus? Kamu tim Velour Night. SCNTR Velour Night buat parfum santai kapan aja. Cek kuisnya di link bio, komen tim kamu di sini.\n#scntr #parfumpria #kuisparfum #VelourNight' },

  { tgl: 15, f: B1521 + '1 Rabu 15 Okt - parfum dekat wajah.mp4', cap: 'Parfum bukan untuk disemprot ke wajah; kabutnya bisa masuk mata atau terhirup. Arahkan ke tubuh dan simpan pengingat ini.\n#tipsparfum #parfumpria #parfumcowok #scntr' },
  { tgl: 16, f: B1521 + '2 Kamis 16 Okt - kalem atau spontan.mp4', cap: 'Kamu tim Fresh buat pagi atau Velour Night buat malam? Pilih A atau B di komentar.\n#parfumpria #parfumlokal #parfumcowok #scntr' },
  { tgl: 17, f: B1521 + '3 Jumat 17 Okt - parfum dan deodoran.mp4', cap: 'Parfum memberi aroma, sedangkan deodoran dirancang membantu mengendalikan bau badan. Simpan pengingat ini atau bagikan ke teman.\n#tipsparfum #parfumpria #parfumcowok #scntr' },
  { tgl: 18, f: B1521 + '4 Sabtu 18 Okt - nyaman atau eksplorasi.mp4', cap: 'Mau tampil rapi pakai Clean atau nongkrong malam pakai Bold? Pilih A atau B di komentar.\n#parfumpria #parfumlokal #parfumcowok #scntr' },
  { tgl: 19, f: B1521 + '5 Minggu 19 Okt - parfum sebelum presentasi.mp4', cap: 'Ada presentasi besok? Siapkan pakaian dan parfum lebih awal agar persiapan pagi terasa lebih tenang. Kamu tim siap malam atau pagi?\n#tipsparfum #parfumkantor #parfumpria #scntr' },
  { tgl: 20, f: B1521 + '6 Senin 20 Okt - teman penasaran.mp4', cap: 'POV: temanmu bertanya soal parfum setelah kalian ngobrol. Tag teman yang suka penasaran soal pilihan wangi orang lain.\n#parfumpria #parfumlokal #parfumviral #scntr' },
  { tgl: 21, f: B1521 + '7 Selasa 21 Okt - semprot ke udara.mp4', cap: 'Menyemprot parfum ke udara lalu berjalan melewatinya bisa membuat banyak kabut tidak mengenai tubuh. Pernah mencoba cara ini? Ceritakan di komentar.\n#tipsparfum #parfumpria #parfumcowok #scntr' },

  { tgl: 24, f: B2228 + '3 Jumat 24 Okt - wangi di botol dan kulit.mp4', cap: 'Wangi di botol bisa berbeda dengan di kulit. Coba dulu di kulit sebelum memutuskan.\n#tipsparfum #parfumpria #parfumcowok #scntr' },
  { tgl: 25, f: B2228 + '4 Sabtu 25 Okt - pakai yang mana ke kondangan.mp4', cap: 'Kondangan pakai Clean atau Bold? Pilih A atau B di komentar.\n#parfumpria #parfumlokal #parfumcowok #scntr' },
  { tgl: 26, f: B2228 + '5 Minggu 26 Okt - first date besok.mp4', cap: 'First date besok? Pilih wangi yang bikin kamu santai. Kamu siapkan dari malam atau pagi?\n#tipsparfum #parfumpria #parfumlokal #scntr' },
  { tgl: 27, f: B2228 + '6 Senin 27 Okt - parfum pas olahraga.mp4', cap: 'Sehabis olahraga, mandi dulu sebelum semprot parfum. Simpan pengingat ini atau bagikan ke teman.\n#tipsparfum #parfumpria #parfumcowok #scntr' },
  { tgl: 28, f: B2228 + '7 Selasa 28 Okt - masuk lift habis semprot.mp4', cap: 'POV: kamu masuk lift habis semprot parfum dan semua orang nengok. Tag teman yang selalu wangi pas naik lift.\n#parfumpria #parfumlokal #parfumviral #scntr' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const FILTER = process.argv[2] ? process.argv[2].split(',').map(Number) : null;


const c = await getStudio();

async function click(x, y) {
  for (const t of ['mousePressed', 'mouseReleased']) {
    await c.send('Input.dispatchMouseEvent', { type: t, x, y, button: 'left', clickCount: 1 });
    await sleep(110);
  }
}

async function aktifkanJadwalkan() {
  return evalJs(c, `(async () => {
    const el = [...document.querySelectorAll('label')].find(l => l.innerText.trim() === 'Jadwalkan');
    if (!el) return { err: 'no label' };
    const inp = el.querySelector('input');
    if (inp && !inp.checked) inp.click();
    await new Promise(r => setTimeout(r, 1500));
    return { checked: inp ? inp.checked : null };
  })()`);
}

async function setTanggalOktober(tgl) {
  // buka picker tanggal
  const rect = await evalJs(c, `(() => {
    const i = [...document.querySelectorAll('input[type=text]')].find(x => /^\\d{4}-/.test(x.value));
    if (!i) return null;
    const b = i.getBoundingClientRect();
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  })()`);
  if (!rect) throw new Error('input tanggal tidak ada');
  await click(rect.x, rect.y);
  await sleep(2200);

  const header = () => evalJs(c, `(() => {
    const h = document.querySelector('[class*=month-header-wrapper]');
    return h ? h.innerText.replace(/\\s+/g, ' ').trim() : null;
  })()`);

  let j = await header();
  if (!j) throw new Error('kalender tidak terbuka');

  // dari September ke Oktober = 1x next
  for (let i = 0; i < 4 && !j.includes('Oktober'); i++) {
    const p = await evalJs(c, `(() => {
      const h = document.querySelector('[class*=month-header-wrapper]');
      const a = [...h.querySelectorAll('[class*=arrow]')];
      const el = a[a.length - 1];
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: r.width };
    })()`);
    if (!p.w) throw new Error('arrow tidak terlihat');
    await click(p.x, p.y);
    await sleep(900);
    j = await header();
    if (!j) throw new Error('header hilang');
  }
  if (!j.includes('Oktober')) throw new Error('gagal ke Oktober: ' + j);

  const p = await evalJs(c, `(() => {
    const h = document.querySelector('[class*=month-header-wrapper]');
    const scope = h.parentElement.parentElement;
    const days = [...scope.querySelectorAll('[class*=day]')].filter(e =>
      e.innerText.trim() === '${tgl}' && e.getBoundingClientRect().width > 0);
    if (!days.length) return { err: 'no day ${tgl}' };
    const r = days[days.length - 1].getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  if (p.err) throw new Error(p.err);
  await click(p.x, p.y);
  await sleep(1500);

  const v = await evalJs(c, `(() => {
    const i = [...document.querySelectorAll('input[type=text]')].find(x => /^\\d{4}-/.test(x.value));
    return i ? i.value : null;
  })()`);
  if (v !== '2026-10-' + String(tgl).padStart(2, '0')) throw new Error('tanggal salah: ' + v);
  return v;
}

async function klikTombolJadwal() {
  const r = await evalJs(c, `(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.innerText.trim() === 'Jadwal');
    if (!b) return { err: 'no btn' };
    const rect = b.getBoundingClientRect();
    return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), dis: b.disabled };
  })()`);
  if (r.err) throw new Error(r.err);
  if (r.dis) throw new Error('tombol disabled');
  await click(r.x, r.y);
  await sleep(6500);
  const after = await evalJs(c, `(() => ({
    url: location.href,
    masalah: document.body.innerText.includes('Ada masalah')
  }))()`);
  if (after.url.includes('/upload') || after.masalah) throw new Error('submit gagal: ' + after.url);
  return after.url;
}

const hasil = [];
const mulai = Date.now();

const DAFTAR = FILTER ? TUGAS.filter(t => FILTER.includes(t.tgl)) : TUGAS;
console.log('Menjalankan ' + DAFTAR.length + ' video: ' + DAFTAR.map(t => t.tgl).join(','));
for (let idx = 0; idx < DAFTAR.length; idx++) {
  const t = DAFTAR[idx];
  const label = t.tgl + ' Okt';
  let sukses = false;
  let catatan = '';
  for (let percobaan = 1; percobaan <= 2 && !sukses; percobaan++) {
    try {
      await upload(c, t.f);
      await setCaptionSafe(c, t.cap);
      const j = await aktifkanJadwalkan();
      if (!j.checked) throw new Error('radio jadwalkan tidak aktif');
      const tgl = await setTanggalOktober(t.tgl);
      await klikTombolJadwal();
      sukses = true;
      catatan = tgl;
    } catch (e) {
      catatan = 'percobaan ' + percobaan + ': ' + e.message;
      await sleep(1500);
    }
  }
  const detik = Math.round((Date.now() - mulai) / 1000);
  hasil.push({ label, sukses, catatan, totalDetik: detik });
  console.log((sukses ? 'OK  ' : 'GAGAL') + ' ' + label + ' | ' + catatan + ' | total ' + detik + 's (' + (idx + 1) + '/' + DAFTAR.length + ')');
}

console.log('\nSELESAI. Durasi total: ' + Math.round((Date.now() - mulai) / 60000) + ' menit');
console.log('Sukses: ' + hasil.filter(h => h.sukses).length + '/' + hasil.length);
c.close();
