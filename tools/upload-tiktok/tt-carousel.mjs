// Jadwalkan postingan FOTO/KAROSEL TikTok @scntr.id lewat TikTok Studio (Chrome :9222).
//
// Bahan: /Users/dani/Projects/SCNTR_Projects/SCNTR Carousel TikTok/<YYYY-MM-DD> - <nama>/
//   01.jpg, 02.jpg, ... (jpg/png/webp, maks 35, urut sesuai nama file)
//   caption.txt  -> baris 1 = judul (maks 90 huruf), sisanya = deskripsi + hashtag
//
//   node tt-carousel.mjs --dry-run          -> isi semua sampai jadwal, TIDAK menekan "Jadwalkan"
//   node tt-carousel.mjs                    -> jadwalkan beneran (default 3 postingan, jam 11:00 WIB)
//   node tt-carousel.mjs --count 5 --jam 11:00
//
// Yang sudah terjadwal dicatat di scntr-marketing/.tt-carousel-state.json supaya tidak dobel.
import fs from 'fs';
import path from 'path';
import { targets, newTarget, CDP, evalJs } from './cdp.mjs';
import { setCaptionSafe, pilihJadwal } from './studio.mjs';
import { setTanggal, setJam } from './tt-jadwal.mjs';

const ROOT = '/Users/dani/Projects/SCNTR_Projects';
const BAHAN = `${ROOT}/SCNTR Carousel TikTok`;
const STATE_FILE = `${ROOT}/scntr-marketing/.tt-carousel-state.json`;
const SHOT_DIR = `${ROOT}/_kerja`;

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const DRY = args.includes('--dry-run');
const COUNT = Number(opt('--count', 3));
const JAM = opt('--jam', '11:00');
const besok = new Date(Date.now() + 86400000);
const FROM = opt('--from', `${besok.getFullYear()}-${String(besok.getMonth() + 1).padStart(2, '0')}-${String(besok.getDate()).padStart(2, '0')}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function daftarKarosel() {
  if (!fs.existsSync(BAHAN)) return [];
  return fs.readdirSync(BAHAN).map(dir => {
    const m = dir.match(/^(\d{4}-\d{2}-\d{2})/);
    const full = path.join(BAHAN, dir);
    if (!m || !fs.statSync(full).isDirectory()) return null;
    const foto = fs.readdirSync(full).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort().map(f => path.join(full, f));
    const capFile = path.join(full, 'caption.txt');
    const [judul = '', ...sisa] = fs.existsSync(capFile) ? fs.readFileSync(capFile, 'utf8').trim().split('\n') : [];
    return { id: dir, date: m[1], dir, foto, judul: judul.trim().slice(0, 90), deskripsi: sisa.join('\n').trim() };
  }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
}
const loadState = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { posted: [] }; } };
const saveState = s => fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));

// tab TikTok Studio sendiri, supaya tidak mengganggu tab lain
let t = (await targets()).find(x => x.type === 'page' && x.url.includes('tiktokstudio'));
if (!t) t = await newTarget('https://www.tiktok.com/tiktokstudio/upload');
const cdp = await CDP.attach(t.id);
await cdp.send('Page.enable'); await cdp.send('DOM.enable');
const shot = async nama => { const s = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const p = `${SHOT_DIR}/${nama}.png`; fs.writeFileSync(p, Buffer.from(s.data, 'base64')); return p; };
const klikTeks = async teks => { // klik via JS .click() ke leaf-node teks persis (terbukti untuk tab Foto), lalu cek input image
  const diklik = await evalJs(cdp, `(() => { const e = [...document.querySelectorAll('*')]
    .find(x => x.children.length === 0 && (x.innerText||'').trim() === ${JSON.stringify(teks)});
    if (!e) return null; (e.closest('button,[role=tab]') || e).click(); return true; })()`);
  if (!diklik) return false; // tab belum tampil (render lambat setelah navigate), coba lagi
  for (let i = 0; i < 5; i++) { // tunggu input image sampai ~6 detik setelah klik
    if (await evalJs(cdp, `!!document.querySelector('input[type=file][accept*=image]')`)) return true;
    await sleep(1000); }
  return evalJs(cdp, `!!document.querySelector('input[type=file][accept*=image]')`);
};

async function jadwalkan(k) {
  await cdp.send('Page.bringToFront'); // tab di belakang diperlambat Chrome, jadi harus di depan
  await cdp.send('Page.navigate', { url: 'https://www.tiktok.com/tiktokstudio/upload' });
  for (let i = 0; i < 16; i++) { // jawab "tinggalkan halaman?" kalau muncul
    if (cdp.events.some(e => e.method === 'Page.javascriptDialogOpening')) { cdp.events.length = 0;
      await cdp.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); }
    await sleep(500); }
  let adaFoto = false;
  for (let i = 0; i < 30 && !adaFoto; i++) { adaFoto = await klikTeks('Foto'); if (!adaFoto) await sleep(1000); }
  if (!adaFoto) throw new Error('tab "Foto" tidak ada (cek login SCNTR.ID)');
  await sleep(2500);
  const doc = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const q = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file][accept*=image]' });
  if (!q.nodeId) throw new Error('kolom upload foto tidak ketemu');
  await cdp.send('DOM.setFileInputFiles', { files: k.foto, nodeId: q.nodeId });

  let siap = false;
  for (let i = 0; i < 40 && !siap; i++) { await sleep(1500);
    siap = await evalJs(cdp, `!!document.querySelector('[contenteditable=true]') && /${k.foto.length} foto diunggah/.test(document.body.innerText)`); }
  if (!siap) throw new Error('foto belum selesai terunggah');

  if (k.judul) {
    const pos = await evalJs(cdp, `(() => { const e = document.querySelector('input[placeholder*="judul"]'); if (!e) return null;
      e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return {x: r.x + 20, y: r.y + r.height/2}; })()`);
    if (!pos) throw new Error('kolom judul tidak ketemu');
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
      await cdp.send('Input.dispatchMouseEvent', { type, x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
    await cdp.send('Input.insertText', { text: k.judul });
  }
  if (k.deskripsi) await setCaptionSafe(cdp, k.deskripsi);

  await pilihJadwal(cdp);
  await setJam(cdp, JAM);
  await setTanggal(cdp, k.date);
  if (DRY) return { ok: true, dry: true, shot: await shot(`tt-carousel-dryrun-${k.date}`) };

  const klik = await evalJs(cdp, `(() => { const b = [...document.querySelectorAll('button')].filter(b => b.innerText.trim() === 'Jadwal').pop();
    if (!b) return false; b.click(); return true; })()`);
  if (!klik) throw new Error('tombol Jadwal tidak ada');
  k.sudahKlik = true;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    let st; try { st = JSON.parse(await evalJs(cdp, `JSON.stringify({u: location.href, m: document.body ? document.body.innerText.includes('Ada masalah') : false})`)); }
    catch { continue; }
    if (st.m) return { ok: false, err: 'TikTok menampilkan "Ada masalah"', shot: await shot(`tt-carousel-gagal-${k.date}`) };
    if (!st.u.includes('/upload')) return { ok: true };
  }
  return { ok: true, cek: true, shot: await shot(`tt-carousel-cek-${k.date}`) };
}

const state = loadState();
const antre = daftarKarosel().filter(k => k.date >= FROM && !state.posted.some(p => p.id === k.id));
const salah = antre.filter(k => !k.foto.length || k.foto.length > 35);
const jalan = antre.filter(k => k.foto.length && k.foto.length <= 35).slice(0, COUNT);
console.log(`${DRY ? '[DRY-RUN] ' : ''}Karosel TikTok mulai ${FROM}, jam ${JAM} WIB. Antre ${antre.length}, dikerjakan ${jalan.length}.`);
if (salah.length) console.log(`Folder tanpa foto / lebih dari 35 foto (dilewati): ${salah.map(k => k.dir).join(', ')}`);

let sukses = 0;
for (const k of jalan) {
  process.stdout.write(`- ${k.date} ${k.dir} (${k.foto.length} foto) ... `);
  try {
    const r = await jadwalkan(k);
    if (r.ok && !r.dry) { state.posted.push({ id: k.id, date: k.date, jam: JAM, at: new Date().toISOString() }); saveState(state); sukses++; }
    console.log(r.dry ? `siap (tidak ditekan) ${r.shot}` : r.ok ? (r.cek ? `KEMUNGKINAN TERJADWAL (cek) ${r.shot}` : 'TERJADWAL') : `GAGAL: ${r.err} ${r.shot}`);
  } catch (e) {
    if (k.sudahKlik) { state.posted.push({ id: k.id, date: k.date, jam: JAM, at: new Date().toISOString(), cek: true }); saveState(state);
      console.log(`KEMUNGKINAN TERJADWAL (cek manual): ${e.message}`); continue; }
    console.log(`GAGAL: ${e.message} ${await shot(`tt-carousel-gagal-${k.date}`)}`);
  }
}
console.log(DRY ? 'Dry-run selesai.' : `Selesai: ${sukses}/${jalan.length} terjadwal.`);
if (!DRY && sukses) { // catat ke Kelola.in
  const { execFileSync } = await import('child_process');
  try { console.log(execFileSync('node', ['/Users/dani/Projects/content-tracker/scripts/sync-jadwal-ke-kelolain.mjs'], { encoding: 'utf8' }).trim()); }
  catch (e) { console.log('Gagal catat ke Kelola.in:', e.message.slice(0, 200)); }
}
cdp.close();
