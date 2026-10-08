// Jadwalkan postingan FEED IG @scntr.id (karosel 2-10 foto, atau 1 foto) lewat Meta Business Suite (Chrome :9222).
//
// Bahan: /Users/dani/Projects/SCNTR_Projects/SCNTR Feed IG/<YYYY-MM-DD> - <nama>/
//   01.jpg, 02.jpg, ... (jpg/png, maks 10, urut sesuai nama file; 1 file = post foto biasa)
//   caption.txt -> seluruh isinya jadi caption
//
//   node bs-feed-ig.mjs --dry-run      -> isi semua sampai tahap Schedule, TIDAK menekan tombol akhir
//   node bs-feed-ig.mjs                -> jadwalkan beneran (default 3 postingan, jam 11:00 WIB)
//   node bs-feed-ig.mjs --count 5 --jam 11:00
//   node bs-feed-ig.mjs --only 2026-10-03 -> hanya satu posting feed pada tanggal tersebut
//
// Yang sudah terjadwal dicatat di scntr-marketing/.ig-feed-state.json, lalu otomatis dicatat ke Kelola.in.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { targets, CDP, evalJs } from './cdp.mjs';

const ROOT = '/Users/dani/Projects/SCNTR_Projects';
const STATE_FILE = `${ROOT}/scntr-marketing/.ig-feed-state.json`;
const BAHAN = `${ROOT}/SCNTR Feed IG`;
const SHOT_DIR = `${ROOT}/_kerja`;
const TMP = `${ROOT}/_kerja/ig-tmp`;
const COMPOSER = 'https://business.facebook.com/latest/composer/?asset_id=1070296476178169&business_id=1550799643383762';
const YEAR = 2026;
const BULAN = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MEI: 5, JUN: 6, JUL: 7, AGU: 8, AGS: 8, SEP: 9, OKT: 10, NOV: 11, DES: 12 };

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const DRY = args.includes('--dry-run');
const COUNT = Number(opt('--count', 3));
const JAM = opt('--jam', '11:00');
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
  if (!fs.existsSync(BAHAN)) return [];
  return fs.readdirSync(BAHAN).map(dir => {
    const m = dir.match(/^(\d{4}-\d{2}-\d{2})/);
    const full = path.join(BAHAN, dir);
    if (!m || !fs.statSync(full).isDirectory()) return null;
    const foto = fs.readdirSync(full).filter(f => /\.(jpe?g|png)$/i.test(f)).sort().map(f => path.join(full, f));
    const capFile = path.join(full, 'caption.txt');
    return { id: dir, date: m[1], name: dir, foto, file: foto.length && foto.length <= 10 ? foto : null,
      caption: fs.existsSync(capFile) ? fs.readFileSync(capFile, 'utf8').trim() : '' };
  }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
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

  const add = await waitBtn('/^Add photo\\/video$/i', 20);
  if (!add) throw new Error('tombol Add photo/video tidak muncul (cek login Business Suite)');
  await click(add.x, add.y);
  let ev; for (let i = 0; i < 40 && !ev; i++) { ev = cdp.events.find(e => e.method === 'Page.fileChooserOpened'); if (!ev) await sleep(250); }
  if (!ev) throw new Error('dialog pilih file tidak muncul');
  await cdp.send('DOM.setFileInputFiles', { files: k.file, backendNodeId: ev.params.backendNodeId });
  await sleep(4000 + 1500 * k.file.length);

  const cap = await evalJs(cdp, `(() => { const e = [...document.querySelectorAll('[contenteditable=true],textarea')].find(x => x.offsetParent);
    if (!e) return null; e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return {x: r.x + 20, y: r.y + 15}; })()`);
  if (!cap) throw new Error('kolom caption tidak ketemu');
  await click(cap.x, cap.y);
  await cdp.send('Input.insertText', { text: k.caption });
  await pressKey('Escape', 'Escape', 27); // tutup saran hashtag kalau muncul

  const sw = await pos('[aria-label="Set date and time"]');
  if (!sw) throw new Error('tombol "Set date and time" tidak ada');
  await click(sw.x, sw.y); await sleep(1500);

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
const hilang = antre.filter(k => !k.file);  // folder kosong atau lebih dari 10 foto
const jalan = antre.filter(k => k.file).slice(0, ONLY_DATE ? 1 : COUNT);
console.log(`${DRY ? '[DRY-RUN] ' : ''}Mulai ${ONLY_DATE || FROM}, jam ${JAM} WIB. Antre ${antre.length}, dikerjakan ${jalan.length}.`);
if (hilang.length) console.log(`Folder tanpa foto / lebih dari 10 foto (dilewati): ${hilang.map(k => k.name).join(', ')}`);

let sukses = 0;
for (const k of jalan) {
  process.stdout.write(`- ${k.name} (${k.file.length} foto) ... `);
  try {
    const r = await jadwalkan(k);
    if (r.ok && !r.dry) { state.posted.push({ id: k.id, date: k.date, jam: JAM, foto: k.file.length, at: new Date().toISOString() }); saveState(state); sukses++; }
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
