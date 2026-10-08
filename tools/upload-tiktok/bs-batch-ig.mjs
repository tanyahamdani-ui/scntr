// Jadwalkan Reels IG @scntr.id lewat Meta Business Suite (Chrome :9222).
// Sekali jalan: N video (default 3), tiap video dijadwalkan di tanggal kontennya sendiri jam 19:00 WIB.
//
//   node bs-batch-ig.mjs --dry-run      -> isi semua sampai tahap Schedule, TIDAK menekan tombol akhir
//   node bs-batch-ig.mjs                -> jadwalkan beneran
//   node bs-batch-ig.mjs --count 5 --jam 19:00 --from 2026-10-03
//   node bs-batch-ig.mjs --only 2026-10-03 -> hanya satu Reels pada tanggal tersebut
//
// Caption & tanggal diambil dari "CAPTION & JADWAL.txt" di tiap folder "SCNTR Upload TikTok *".
// Yang sudah terjadwal dicatat di scntr-marketing/.ig-post-state.json supaya tidak dobel.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { targets, CDP, evalJs } from './cdp.mjs';

const ROOT = '/Users/dani/Projects/SCNTR_Projects';
const STATE_FILE = `${ROOT}/scntr-marketing/.ig-post-state.json`;
const SHOT_DIR = `${ROOT}/_kerja`;
const TMP = `${ROOT}/_kerja/ig-tmp`;
const COMPOSER = 'https://business.facebook.com/latest/reels_composer/?asset_id=1070296476178169&business_id=1550799643383762';
const YEAR = 2026;
const BULAN = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MEI: 5, JUN: 6, JUL: 7, AGU: 8, AGS: 8, SEP: 9, OKT: 10, NOV: 11, DES: 12 };

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const DRY = args.includes('--dry-run');
const COUNT = Number(opt('--count', 3));
const JAM = opt('--jam', '19:00');
const ONLY_INDEX = args.indexOf('--only');
const ONLY_DATE = ONLY_INDEX >= 0 ? args[ONLY_INDEX + 1] : '';
if (ONLY_INDEX >= 0 && (!ONLY_DATE || !/^\d{4}-\d{2}-\d{2}$/.test(ONLY_DATE) || new Date(`${ONLY_DATE}T00:00:00Z`).toISOString().slice(0, 10) !== ONLY_DATE)) {
  throw new Error('--only harus berisi tanggal valid berformat YYYY-MM-DD');
}
const besok = new Date(Date.now() + 86400000);
const FROM = opt('--from', `${besok.getFullYear()}-${String(besok.getMonth() + 1).padStart(2, '0')}-${String(besok.getDate()).padStart(2, '0')}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- data konten ----------
function daftarKonten() {
  const out = [];
  for (const dir of fs.readdirSync(ROOT).filter(d => d.startsWith('SCNTR Upload TikTok'))) {
    const capFile = path.join(ROOT, dir, 'CAPTION & JADWAL.txt');
    if (!fs.existsSync(capFile)) continue;
    for (const sec of fs.readFileSync(capFile, 'utf8').split(/={20,}/)) {
      const head = sec.match(/^\s*\d+\.\s+\S+\s+(\d{1,2})\s+([A-Z]{3})/m);
      const file = sec.match(/^File\s*:\s*(.+\.mp4)\s*$/m);
      const cap = sec.split(/^Caption:\s*$/m)[1];
      if (!head || !file || !cap) continue;
      const bln = BULAN[head[2]];
      if (!bln) continue;
      const date = `${YEAR}-${String(bln).padStart(2, '0')}-${head[1].padStart(2, '0')}`;
      const name = file[1].trim();
      const lokasi = [path.join(ROOT, dir, name)].find(p => fs.existsSync(p)); // yang sudah di Tong Sampah tidak bisa dibaca (diblok macOS)
      out.push({ id: `${date}|${name}`, date, name, file: lokasi, caption: cap.trim().replace(/klik keranjang kuning/gi, 'cek link di bio').replace(/keranjang kuning/gi, 'link di bio') });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
const loadState = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { posted: [] }; } };
const saveState = s => fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));

// ---------- browser ----------
const bsTabs = (await targets()).filter(x => x.type === 'page' && x.url.includes('business.facebook.com'));
const t = bsTabs.find(x => x.url.includes('composer')) || bsTabs[0]; // utamakan tab composer, jangan ganggu tab lain
if (!t) { console.log('Buka dulu tab business.facebook.com di Chrome :9222 (akun scntr.id).'); process.exit(1); }
const cdp = await CDP.attach(t.id);
await cdp.send('Page.enable'); await cdp.send('DOM.enable');

const click = async (x, y, n = 1) => { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
  await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: n }); };
const typeKeys = async s => { for (const ch of s) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }); } };
const pressKey = async (key, code, vk, modifiers = 0) => {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, modifiers });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers }); };
const findBtn = (re, sel = '[role=button],button') => evalJs(cdp, `(() => {
  const re = ${re};
  const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.offsetParent && re.test((e.innerText||'').trim())
    && e.getAttribute('aria-disabled') !== 'true' && !e.disabled);
  if (!b) return null; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect();
  return {x: r.x + r.width/2, y: r.y + r.height/2};
})()`);
const waitBtn = async (re, detik, sel) => { for (let i = 0; i < detik; i++) { const b = await findBtn(re, sel); if (b) return b; await sleep(1000); } return null; };
const pos = sel => evalJs(cdp, `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
  e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return {x: r.x + r.width/2, y: r.y + r.height/2}; })()`);
const shot = async nama => { const s = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const p = `${SHOT_DIR}/${nama}.png`; fs.writeFileSync(p, Buffer.from(s.data, 'base64')); return p; };

async function jadwalkan(k) {
  await cdp.send('Page.bringToFront');
  await cdp.send('Page.navigate', { url: COMPOSER });
  await sleep(6000);
  cdp.events.length = 0;
  await cdp.send('Page.setInterceptFileChooserDialog', { enabled: true });

  const add = await waitBtn('/^Add Video$/i', 20);
  if (!add) throw new Error('tombol Add Video tidak muncul (cek login Business Suite)');
  await click(add.x, add.y);
  let ev; for (let i = 0; i < 40 && !ev; i++) { ev = cdp.events.find(e => e.method === 'Page.fileChooserOpened'); if (!ev) await sleep(250); }
  if (!ev) throw new Error('dialog pilih file tidak muncul');
  // Chrome tidak boleh baca Tong Sampah -> salin dulu ke folder sementara
  let file = k.file;
  if (file.includes('/.Trash/')) { fs.mkdirSync(TMP, { recursive: true }); file = path.join(TMP, k.name); fs.copyFileSync(k.file, file); }
  await cdp.send('DOM.setFileInputFiles', { files: [file], backendNodeId: ev.params.backendNodeId });
  await sleep(15000);

  const cap = await evalJs(cdp, `(() => { const e = [...document.querySelectorAll('[contenteditable=true],textarea')].find(x => x.offsetParent);
    if (!e) return null; e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return {x: r.x + 20, y: r.y + 15}; })()`);
  if (!cap) throw new Error('kolom caption tidak ketemu');
  await click(cap.x, cap.y);
  await cdp.send('Input.insertText', { text: k.caption });
  await pressKey('Escape', 'Escape', 27); // tutup saran hashtag kalau muncul

  for (let step = 1; step <= 2; step++) {
    const nx = await waitBtn('/^Next$/', 90);
    if (!nx) throw new Error(`tombol Next tidak aktif (langkah ${step}) — video mungkin masih diproses/ditolak`);
    await click(nx.x, nx.y); await sleep(4000);
  }

  const opsi = await waitBtn('/^Schedule$/', 15);
  if (!opsi) throw new Error('pilihan Schedule tidak ada');
  await click(opsi.x, opsi.y); await sleep(1500);

  const [y, m, d] = k.date.split('-');
  let p = await pos('input[placeholder="mm/dd/yyyy"]');
  if (!p) throw new Error('kolom tanggal tidak ketemu');
  await click(p.x, p.y, 3);
  await pressKey('a', 'KeyA', 65, 4);
  await cdp.send('Input.insertText', { text: `${m}/${d}/${y}` });
  await pressKey('Enter', 'Enter', 13); await sleep(800);

  let [hh, mm] = JAM.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM'; hh = hh % 12 || 12;
  for (const [lab, val] of [['hours', String(hh).padStart(2, '0')], ['minutes', String(mm).padStart(2, '0')], ['meridiem', ampm]]) {
    p = await pos(`input[aria-label="${lab}"]`);
    if (!p) throw new Error(`kolom ${lab} tidak ketemu`);
    await click(p.x, p.y); await sleep(200); await typeKeys(val); await sleep(300);
  }
  await pressKey('Tab', 'Tab', 9); await sleep(800);

  const tgl = await evalJs(cdp, `document.querySelector('input[placeholder="mm/dd/yyyy"]').value`);
  const bulanEN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m) - 1];
  if (tgl !== `${bulanEN} ${Number(d)}, ${y}`) throw new Error(`tanggal tidak sesuai: tertulis "${tgl}"`);

  if (DRY) return { ok: true, dry: true, shot: await shot(`ig-dryrun-${k.date}`) };

  const akhir = await findBtn('/^Schedule$/', 'div[role=button],button');
  // tombol akhir = tombol "Schedule" paling bawah (bukan pilihan di atas)
  const semua = await evalJs(cdp, `JSON.stringify([...document.querySelectorAll('[role=button],button')].filter(e => e.offsetParent && (e.innerText||'').trim()==='Schedule')
    .map(e => { const r = e.getBoundingClientRect(); return {x: r.x + r.width/2, y: r.y + r.height/2}; }))`);
  const btn = JSON.parse(semua).sort((a, b) => b.y - a.y)[0] || akhir;
  if (!btn) throw new Error('tombol Schedule akhir tidak ada');
  const urlAwal = await evalJs(cdp, 'location.href');
  await click(btn.x, btn.y);
  k.sudahKlik = true;
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    // setelah klik, halaman pindah; selama pindah document.body bisa kosong -> anggap sudah terkirim
    let s;
    try { s = JSON.parse(await evalJs(cdp, `JSON.stringify({u: location.href, t: /scheduled|dijadwalkan/i.test(document.body ? document.body.innerText : '')})`)); }
    catch { s = { u: 'pindah', t: false }; }
    if (s.u !== urlAwal || s.t) return { ok: true, shot: await shot(`ig-ok-${k.date}`) };
  }
  return { ok: false, err: 'tidak ada tanda berhasil setelah 60 detik', shot: await shot(`ig-cek-${k.date}`) };
}

// ---------- jalan ----------
const state = loadState();
const semua = daftarKonten();
// Meta cuma bisa menjadwalkan maksimal ~29 hari ke depan; sisanya menunggu jalan berikutnya
const batas = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10);
const antre = semua.filter(k => (ONLY_DATE ? k.date === ONLY_DATE && k.date >= FROM && k.date <= batas : k.date >= FROM && k.date <= batas) && !state.posted.some(p => p.id === k.id));
const hilang = antre.filter(k => !k.file);
const jalan = antre.filter(k => k.file).slice(0, ONLY_DATE ? 1 : COUNT);
console.log(`${DRY ? '[DRY-RUN] ' : ''}Mulai ${ONLY_DATE || FROM}, jam ${JAM} WIB. Antre ${antre.length}, dikerjakan ${jalan.length}.`);
if (hilang.length) console.log(`Video tidak ketemu (dilewati): ${hilang.map(k => k.date).join(', ')}`);

let sukses = 0;
for (const k of jalan) {
  process.stdout.write(`- ${k.date} ${k.name} ... `);
  try {
    const r = await jadwalkan(k);
    if (r.ok && !r.dry) { state.posted.push({ id: k.id, date: k.date, jam: JAM, at: new Date().toISOString() }); saveState(state); sukses++; }
    console.log(r.ok ? (r.dry ? `siap (tidak ditekan) ${r.shot}` : 'TERJADWAL') : `GAGAL: ${r.err} ${r.shot}`);
  } catch (e) {
    if (k.sudahKlik) { state.posted.push({ id: k.id, date: k.date, jam: JAM, at: new Date().toISOString(), cek: true }); saveState(state);
      console.log(`KEMUNGKINAN TERJADWAL (cek manual): ${e.message}`); continue; }
    console.log(`GAGAL: ${e.message} ${await shot(`ig-gagal-${k.date}`)}`);
  }
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log(DRY ? 'Dry-run selesai.' : `Selesai: ${sukses}/${jalan.length} terjadwal.`);
if (!DRY && sukses && !args.includes('--skip-sync')) { // catat ke Kelola.in
  const { execFileSync } = await import('child_process');
  try { console.log(execFileSync('node', ['/Users/dani/Projects/content-tracker/scripts/sync-jadwal-ke-kelolain.mjs'], { encoding: 'utf8' }).trim()); }
  catch (e) { console.log('Gagal catat ke Kelola.in:', e.message.slice(0, 200)); }
}
cdp.close();
