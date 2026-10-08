// Pengumpul data YouTube (hanya membaca halaman publik, tanpa kunci API).
//   node tools/pantau/kumpul-youtube.mjs <file-daftar-channel.txt> [file-keluaran.json]
// Output formatnya sama dengan pengumpul TikTok: [{platform, handle, name, url, followers, posts_count, posts:[{url, views, caption, pinned}]}]
import fs from 'fs';

const daftar = fs.readFileSync(process.argv[2], 'utf8').split('\n').map(s => s.trim().replace(/^@/, '')).filter(Boolean);
const hari = new Date().toISOString().slice(0, 10);
const OUT = process.argv[3] || `/Users/dani/Projects/SCNTR_Projects/_kerja/pantau/hasil-youtube-${hari}.json`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// "11,4 rb" / "1,2 jt" / "3.4K" / "12.345" -> angka
function angka(t) {
  if (!t) return null;
  const m = String(t).match(/([\d.,]+)\s*(rb|jt|mln|k|m)?/i);
  if (!m) return null;
  const satuan = (m[2] || '').toLowerCase();
  const n = satuan ? m[1].replace(/\./g, '').replace(',', '.') : m[1].replace(/[.,]/g, '');
  const x = parseFloat(n) * ({ rb: 1e3, k: 1e3, jt: 1e6, m: 1e6, mln: 1e6 }[satuan] || 1);
  return Number.isFinite(x) ? Math.round(x) : null;
}

function cariSemua(o, kunci, hasil = []) {
  if (Array.isArray(o)) o.forEach(v => cariSemua(v, kunci, hasil));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === kunci) hasil.push(v); cariSemua(v, kunci, hasil); }
  return hasil;
}

async function ambil(handle) {
  const kosong = { platform: 'youtube', handle, name: null, url: `https://www.youtube.com/@${handle}`, followers: null, posts_count: null, posts: [] };
  const html = await (await fetch(`https://www.youtube.com/@${handle}/videos`, { headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9' } })).text();
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) return kosong;
  const d = JSON.parse(m[1]);
  const sub = (JSON.stringify(d).match(/"content":"([^"]*?(?:subscriber|pelanggan)[^"]*)"/i) || [])[1];
  const nama = (cariSemua(d, 'channelMetadataRenderer')[0] || {}).title || null;
  const posts = cariSemua(d, 'lockupViewModel').slice(0, 12).map(v => {
    const meta = JSON.stringify(v.metadata || {});
    const judul = ((cariSemua(v, 'lockupMetadataViewModel')[0] || {}).title || {}).content || null;
    const ditonton = (meta.match(/"accessibilityLabel":"([^"]*?(?:ditonton|views|tayangan)[^"]*)"/i) || [])[1];
    return { url: v.contentId ? `https://www.youtube.com/watch?v=${v.contentId}` : null, views: angka(ditonton), caption: judul, pinned: false };
  }).filter(p => p.url);
  return { ...kosong, name: nama, followers: angka(sub), posts_count: posts.length, posts };
}

const hasil = [];
for (const h of daftar) {
  try {
    const a = await ambil(h);
    hasil.push(a);
    console.log(`${h}: subscriber=${a.followers} video=${a.posts.length}`);
  } catch (e) { console.log(`${h}: gagal (${e.message})`); }
  await sleep(3000 + Math.random() * 2000);
}
fs.writeFileSync(OUT, JSON.stringify(hasil, null, 2));
console.log('tersimpan:', OUT);
