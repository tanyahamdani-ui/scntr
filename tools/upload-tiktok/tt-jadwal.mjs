// Isi tanggal & jam jadwal di TikTok Studio lewat kalender/timepicker (cara yang terbukti di batch.mjs & setjam.mjs).
import { evalJs } from './cdp.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

async function click(c, x, y) {
  for (const t of ['mousePressed', 'mouseReleased']) {
    await c.send('Input.dispatchMouseEvent', { type: t, x, y, button: 'left', clickCount: 1 });
    await sleep(120);
  }
}
const nilai = (c, re) => evalJs(c, `(() => { const i = [...document.querySelectorAll('input[type=text]')].find(x => ${re}.test(x.value)); return i ? i.value : null; })()`);

export async function setTanggal(c, iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const rect = await evalJs(c, `(() => { const i = [...document.querySelectorAll('input[type=text]')].find(x => /^\\d{4}-/.test(x.value));
    if (!i) return null; const b = i.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }; })()`);
  if (!rect) throw new Error('input tanggal tidak ada');
  await click(c, rect.x, rect.y); await sleep(2200);
  const header = () => evalJs(c, `(() => { const h = document.querySelector('[class*=month-header-wrapper]'); return h ? h.innerText.replace(/\\s+/g, ' ').trim() : null; })()`);
  let j = await header();
  if (!j) throw new Error('kalender tidak terbuka');
  const target = BULAN[m - 1];
  for (let i = 0; i < 6 && !(j.includes(target) && j.includes(String(y))); i++) {
    const p = await evalJs(c, `(() => { const h = document.querySelector('[class*=month-header-wrapper]');
      const a = [...h.querySelectorAll('[class*=arrow]')]; const el = a[a.length - 1]; const r = el.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: r.width }; })()`);
    if (!p.w) throw new Error('panah bulan tidak terlihat');
    await click(c, p.x, p.y); await sleep(900);
    j = await header();
  }
  if (!j || !j.includes(target)) throw new Error('gagal ke bulan ' + target + ': ' + j);
  const p = await evalJs(c, `(() => { const h = document.querySelector('[class*=month-header-wrapper]'); const scope = h.parentElement.parentElement;
    const days = [...scope.querySelectorAll('[class*=day]')].filter(e => e.innerText.trim() === '${d}' && e.getBoundingClientRect().width > 0);
    if (!days.length) return { err: 'tanggal ${d} tidak ada' }; const r = days[days.length - 1].getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
  if (p.err) throw new Error(p.err);
  await click(c, p.x, p.y); await sleep(1500);
  const v = await nilai(c, '/^\\d{4}-/');
  if (v !== iso) throw new Error('tanggal salah: ' + v);
}

async function bukaJam(c) {
  for (let a = 0; a < 3; a++) {
    const terbuka = await evalJs(c, `(() => [...document.querySelectorAll('.tiktok-timepicker-option-list')].some(e => {
      const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0;
    }))()`);
    if (terbuka) return;
    const r = await evalJs(c, `(() => { const i = [...document.querySelectorAll('input[type=text]')].find(x => /^\\d{2}:\\d{2}$/.test(x.value));
      const b = i.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }; })()`);
    await click(c, r.x, r.y); await sleep(2000);
    if (await evalJs(c, `(() => [...document.querySelectorAll('.tiktok-timepicker-option-list')].some(e => {
      const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0;
    }))()`)) return;
  }
  throw new Error('pemilih jam tidak terbuka');
}
async function pilih(c, target, kolom) {
  const p = await evalJs(c, `(async () => { const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const lists = [...document.querySelectorAll('.tiktok-timepicker-option-list')].filter(visible)
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    if (lists.length !== 2) return { err: 'kolom jam/menit tidak dikenali (' + lists.length + ')' };
    const scope = lists[${kolom}]; const h = [...scope.querySelectorAll('.tiktok-timepicker-option-item')].find(e => e.innerText.trim() === ${JSON.stringify(target)});
    if (!h) return { err: 'opsi ${target} tidak ada' }; h.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 600));
    const rb = h.getBoundingClientRect(); return { x: Math.round(rb.x + rb.width / 2), y: Math.round(rb.y + rb.height / 2) }; })()`);
  if (p.err) throw new Error(p.err);
  for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) { // mouseMoved wajib: tanpa hover, klik tidak commit
    await c.send('Input.dispatchMouseEvent', { type: t, x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await sleep(150);
  }
  await sleep(1400);
}
export async function setJam(c, hhmm) {
  const [hh, mm] = hhmm.split(':');
  await bukaJam(c); await pilih(c, hh, 0);
  await bukaJam(c); await pilih(c, mm, 1);
  const v = await nilai(c, '/^\\d{2}:\\d{2}$/');
  if (v !== hhmm) throw new Error('jam salah: ' + v);
}
