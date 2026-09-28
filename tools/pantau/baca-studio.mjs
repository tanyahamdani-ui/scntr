// Baca daftar postingan TikTok Studio (hanya membaca web)
import fs from 'fs';
import { newTarget, closeTarget, CDP, evalJs } from '../upload-tiktok/cdp.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const K = '/Users/dani/Projects/SCNTR_Projects/_kerja';

// Fungsi untuk mengubah format angka (1.2K -> 1200, dll.)
const angka = s => {
  const m = String(s||'').replace(',', '.').match(/([\d.]+)\s*([KMkm])?/);
  if (!m) return 0;
  return Math.round(parseFloat(m[1]) * ({k:1e3,m:1e6}[(m[2]||'').toLowerCase()]||1));
};

const main = async () => {
  console.log('Membuka TikTok Studio...');

  // Buka tab baru
  const t = await newTarget('about:blank');
  const c = await CDP.attach(t.id);
  await c.send('Page.enable');
  await c.send('Page.bringToFront');

  // Navigasi ke TikTok Studio
  await c.send('Page.navigate', { url: 'https://www.tiktok.com/tiktokstudio/content' });
  await sleep(8000); // Tunggu 8 detik

  // Ambil screenshot dan cetak konten halaman untuk debugging
  console.log('Mengambil screenshot dan konten halaman untuk debugging...');
  const screenshot = await c.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(`${K}/tiktok-studio-screenshot.png`, Buffer.from(screenshot.data, 'base64'));
  
  const pageText = await evalJs(c, 'document.body.innerText');
  fs.writeFileSync(`${K}/tiktok-studio-content.txt`, pageText.substring(0, 3000));
  
  const pageHtml = await evalJs(c, 'document.body.outerHTML');
  const dataE2eAttributes = await evalJs(c, `
    const elements = document.querySelectorAll('[data-e2e]');
    const attrs = [];
    elements.forEach(el => {
      attrs.push({
        tag: el.tagName,
        dataE2e: el.getAttribute('data-e2e'),
        text: el.textContent ? el.textContent.substring(0, 100) : '',
        className: el.className
      });
    });
    attrs;
  `);
  fs.writeFileSync(`${K}/tiktok-studio-attributes.json`, JSON.stringify(dataE2eAttributes, null, 2));

  console.log('Debug info tersimpan ke _kerja/');

  // Scroll untuk memuat lebih banyak postingan
  let scrollCount = 0;
  const maxScroll = 15;
  const postings = [];

  console.log('Mulai mengumpulkan data postingan...');

  while (scrollCount < maxScroll) {
    // Scroll ke bawah
    await evalJs(c, 'window.scrollBy(0, 800)');
    await sleep(2000); // Tunggu konten dimuat

    // Coba berbagai pendekatan untuk menemukan postingan
    const pageText = await evalJs(c, 'document.body.innerText');
    const lines = pageText.split('\n');
    let foundNewPosts = false;

    // Pendekatan 1: Cari baris dengan status
    for (let line of lines) {
      // Cek apakah baris mengandung status yang kita cari
      if (line.includes('Terjadwal') || line.includes('Publik') || line.includes('Semua orang') || line.includes('Privasi')) {
        // Cek apakah sudah ada di daftar
        const exists = postings.some(p => p.fullText === line);
        if (!exists) {
          // Ekstrak informasi
          const captionMatch = line.match(/.{0,60}/);
          const caption = captionMatch ? captionMatch[0].trim() : '';

          let status = '';
          if (line.includes('Terjadwal')) status = 'Terjadwal';
          else if (line.includes('Publik')) status = 'Publik';
          else if (line.includes('Semua orang')) status = 'Semua orang';
          else if (line.includes('Privasi')) status = 'Privasi';

          // Cek tanggal (format Indonesia)
          const tanggalMatch = line.match(/\d{1,2}\s+(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)/);
          const tanggal = tanggalMatch ? tanggalMatch[0] : '';

          // Cek waktu
          const timeMatch = line.match(/\d{1,2}:\d{2}/);
          const jam = timeMatch ? timeMatch[0] : '';

          // Cek views
          const viewsMatch = line.match(/([\d.]+\s*[KMkm]?|\d+)\s*(views|tonton)/i);
          const views = viewsMatch ? viewsMatch[1] : '';

          if (status && (tanggal || jam)) {
            postings.push({
              caption: caption.length > 60 ? caption.substring(0, 60) + '...' : caption,
              status: status,
              tanggal: tanggal,
              jam: jam,
              views: views ? angka(views) : null,
              fullText: line
            });
            foundNewPosts = true;
          }
        }
      }
    }

    // Pendekatan 2: Coba ekstrak data dari struktur HTML yang lebih spesifik
    if (!foundNewPosts && postings.length < 10) {
      try {
        const htmlData = await evalJs(c, `
          // Cari elemen dengan data-e2e attribute yang mungkin berisi postingan
          const e2eElements = document.querySelectorAll('[data-e2e]');
          const results = [];
          
          for (let i = 0; i < e2eElements.length; i++) {
            const element = e2eElements[i];
            const text = element.textContent || '';
            const dataE2e = element.getAttribute('data-e2e') || '';
            
            // Cek apakah elemen ini berisi informasi postingan
            if (text.includes('Terjadwal') || text.includes('Publik') || text.includes('Semua orang') || text.includes('Privasi')) {
              results.push({
                text: text.trim(),
                dataE2e: dataE2e,
                className: element.className || '',
                tagName: element.tagName
              });
            }
          }
          
          // Cari juga di elemen dengan class yang relevan
          const postElements = document.querySelectorAll('.post, .tiktok-post, .content-item, .video-item');
          for (let i = 0; i < postElements.length; i++) {
            const element = postElements[i];
            const text = element.textContent || '';
            
            if (text.includes('Terjadwal') || text.includes('Publik') || text.includes('Semua orang') || text.includes('Privasi')) {
              // Cek apakah sudah ada di results
              const exists = results.some(r => r.text === text.trim());
              if (!exists) {
                results.push({
                  text: text.trim(),
                  dataE2e: '',
                  className: element.className || '',
                  tagName: element.tagName
                });
              }
            }
          }
          
          results;
        `);

        if (htmlData && htmlData.length > 0) {
          console.log(`Menemukan ${htmlData.length} potensi postingan melalui HTML parsing`);
          
          // Proses hasil HTML parsing
          for (const item of htmlData) {
            const text = item.text;
            
            // Cek apakah baris mengandung status yang kita cari
            if (text.includes('Terjadwal') || text.includes('Publik') || text.includes('Semua orang') || text.includes('Privasi')) {
              // Cek apakah sudah ada di daftar
              const exists = postings.some(p => p.fullText === text);
              if (!exists) {
                // Ekstrak informasi
                const captionMatch = text.match(/.{0,60}/);
                const caption = captionMatch ? captionMatch[0].trim() : '';

                let status = '';
                if (text.includes('Terjadwal')) status = 'Terjadwal';
                else if (text.includes('Publik')) status = 'Publik';
                else if (text.includes('Semua orang')) status = 'Semua orang';
                else if (text.includes('Privasi')) status = 'Privasi';

                // Cek tanggal (format Indonesia)
                const tanggalMatch = text.match(/\\d{1,2}\\s+(Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)/);
                const tanggal = tanggalMatch ? tanggalMatch[0] : '';

                // Cek waktu
                const timeMatch = text.match(/\\d{1,2}:\\d{2}/);
                const jam = timeMatch ? timeMatch[0] : '';

                // Cek views
                const viewsMatch = text.match(/([\\d.]+\\s*[KMkm]?|\\d+)\\s*(views|tonton)/i);
                const views = viewsMatch ? viewsMatch[1] : '';

                if (status && (tanggal || jam)) {
                  postings.push({
                    caption: caption.length > 60 ? caption.substring(0, 60) + '...' : caption,
                    status: status,
                    tanggal: tanggal,
                    jam: jam,
                    views: views ? angka(views) : null,
                    fullText: text
                  });
                  foundNewPosts = true;
                }
              }
            }
          }
        }
      } catch (e) {
        console.log('Pendekatan HTML parsing gagal:', e.message);
      }
    }

    if (foundNewPosts) {
      console.log(`Menemukan ${postings.length} postingan unik (scroll ${scrollCount + 1}/${maxScroll})`);

      // Cek apakah sudah mencapai postingan lama
      const hasOldPosts = postings.some(post => {
        return post.tanggal && post.tanggal.includes('20 Sep');
      });

      if (hasOldPosts) {
        console.log('Mencapai postingan sebelum 20 Sep 2026, berhenti scrolling');
        break;
      }
    }

    scrollCount++;
  }

  console.log(`Total postingan terdeteksi: ${postings.length}`);

  // Filter postingan yang memiliki tanggal
  const postWithDates = postings.filter(p => p.tanggal && p.tanggal !== '');
  console.log(`Postingan dengan tanggal: ${postWithDates.length}`);

  // Simpan ke file
  fs.writeFileSync(`${K}/tiktok-studio-daftar.json`, JSON.stringify(postings, null, 2));
  console.log('Data tersimpan ke _kerja/tiktok-studio-daftar.json');

  // Tutup tab
  await closeTarget(t.id).catch(() => {});

  // Hitung statistik
  const stats = {
    total: postings.length,
    denganTanggal: postWithDates.length,
    terjadwal: postings.filter(p => p.status === 'Terjadwal').length,
    publik: postings.filter(p => p.status === 'Publik').length,
    semuaorang: postings.filter(p => p.status === 'Semua orang').length,
    privasi: postings.filter(p => p.status === 'Privasi').length
  };

  console.log('Statistik:');
  console.log(`- Total: ${stats.total}`);
  console.log(`- Dengan tanggal: ${stats.denganTanggal}`);
  console.log(`- Terjadwal: ${stats.terjadwal}`);
  console.log(`- Publik: ${stats.publik}`);
  console.log(`- Semua orang: ${stats.semuaorang}`);
  console.log(`- Privasi: ${stats.privasi}`);

  if (stats.denganTanggal < 20) {
    console.log('PERINGATAN: Kurang dari 20 postingan dengan tanggal terdeteksi');
  }

  return stats;
};

main().then(stats => {
  console.log('Selesai!');
  process.exit(0);
}).catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});