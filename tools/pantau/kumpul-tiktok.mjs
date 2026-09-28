// Pengumpul data TikTok (hanya membaca)
import fs from 'fs';
import { newTarget, closeTarget, CDP, evalJs } from '../upload-tiktok/cdp.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const K = '/Users/dani/Projects/SCNTR_Projects/_kerja';
const angka = s => { 
  const m = String(s||'').replace(',', '.').match(/([\d.]+)\s*([KMkm])?/); 
  if (!m) return null; 
  return Math.round(parseFloat(m[1]) * ({k:1e3,m:1e6}[(m[2]||'').toLowerCase()]||1)); 
};

// Baca akun dari file
const akun = fs.readFileSync(process.argv[2] || `${K}/pantau/akun.txt`, 'utf8').split('\n').filter(l => l.trim());
const today = new Date().toISOString().split('T')[0];
const hasil = [];

const t = await newTarget('about:blank');
const c = await CDP.attach(t.id);
await c.send('Page.enable');
await c.send('Page.bringToFront');

for (const a of akun) {
  console.log(`Memproses: ${a}`);
  
  // Buka tab baru dan navigasi ke profil TikTok
  await c.send('Page.navigate', { url: `https://www.tiktok.com/@${a}` });
  await sleep(7000); // Tunggu ±7 detik
  
  let d;
  try {
    d = JSON.parse(await evalJs(c, `JSON.stringify({
      fol: (document.querySelector('[data-e2e=followers-count]')||{}).innerText||'',
      posts: (document.querySelector('[data-e2e=posts-count]')||document.querySelector('[data-e2e=video-count]')||document.querySelector('[data-e2e=user-post-count]')||{}).innerText||'',
      name: (document.querySelector('[data-e2e=user-subtitle],[data-e2e=user-title]')||{}).innerText||'',
      url: window.location.href,
      postsData: [...document.querySelectorAll('[data-e2e=user-post-item]')].slice(0,12).map(e => ({
        url: e.querySelector('a[href*="/video/"]')?.href || '',
        views: (e.querySelector('[data-e2e=video-views]')||{}).innerText||'',
        pinned: /Disematkan|Pinned/i.test(e.innerText)
      }))
    })`));
  } catch (e) {
    console.log(`${a} gagal: ${e.message}`);
    continue;
  }
  
  if (!d) {
    console.log(`${a} gagal`);
    continue;
  }
  
  // Ambil caption untuk setiap video
  const postsWithCaption = [];
  for (const post of d.postsData) {
    if (!post.url) continue;
    
    let caption = null;
    try {
      const oembedResponse = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(post.url)}`);
      const oembedData = await oembedResponse.json();
      caption = oembedData.title || null;
    } catch (e) {
      caption = null;
    }
    
    postsWithCaption.push({
      url: post.url,
      views: angka(post.views),
      caption: caption,
      pinned: post.pinned
    });
  }
  
  const result = {
    platform: 'tiktok',
    handle: a,
    name: d.name,
    url: d.url,
    followers: angka(d.fol),
    posts_count: d.postsData.length,
    posts: postsWithCaption
  };
  
  hasil.push(result);
  console.log(`${a}: ${result.followers} followers, ${result.posts_count} posts`);
  
  // Jeda 5-8 detik antar akun
  await sleep(Math.random() * 3000 + 5000);
}

await closeTarget(t.id).catch(() => {});

// Simpan hasil ke file
const outputFile = `${K}/pantau/hasil-tiktok-${today}.json`;
fs.writeFileSync(outputFile, JSON.stringify(hasil, null, 2));
console.log(`Hasil disimpan ke: ${outputFile}`);

// Ringkasan untuk laporan
const summary = hasil.map(h => `${h.handle}: ${h.followers} followers, ${h.posts_count} posts`).join(', ');
console.log(`Ringkasan: ${summary}`);

// Tambahkan ke laporan qwen
const laporanFile = `${K}/laporan-qwen.md`;
const existingContent = fs.existsSync(laporanFile) ? fs.readFileSync(laporanFile, 'utf8') : '';
const newContent = `# Ringkasan Tugas Pengumpul TikTok - ${today}\n\n${summary}\n\n${existingContent}`;
fs.writeFileSync(laporanFile, newContent);
console.log(`Laporan diperbarui: ${laporanFile}`);

process.exit(0);