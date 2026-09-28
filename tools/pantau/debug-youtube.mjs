// Debug script untuk memahami struktur YouTube
import { newTarget, closeTarget, CDP, evalJs } from '../upload-tiktok/cdp.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const channel = 'ISSIndonesia';
console.log(`Debug untuk channel: ${channel}`);

try {
  const t = await newTarget('about:blank');
  const c = await CDP.attach(t.id);
  await c.send('Page.enable');
  await c.send('Page.bringToFront');
  
  await c.send('Page.navigate', { url: `https://www.youtube.com/@${channel}/videos` });
  await sleep(7000);
  
  // Debug: Cek apakah halaman dimuat
  const pageReady = await evalJs(c, 'document.readyState');
  console.log(`Page ready state: ${pageReady}`);
  
  // Debug: Cek judul halaman
  const pageTitle = await evalJs(c, 'document.title');
  console.log(`Page title: ${pageTitle}`);
  
  // Debug: Cek apakah ada elemen yang kita cari
  const subscriberCount = await evalJs(c, `
    const el = document.querySelector('ytd-channel-subscriber-count-renderer');
    console.log('Subscriber count element:', el);
    el ? el.innerText : 'NOT FOUND';
  `);
  console.log(`Subscriber count: ${subscriberCount}`);
  
  const channelName = await evalJs(c, `
    const el = document.querySelector('ytd-channel-name');
    console.log('Channel name element:', el);
    el ? el.innerText : 'NOT FOUND';
  `);
  console.log(`Channel name: ${channelName}`);
  
  // Debug: Cek video items
  const videoItems = await evalJs(c, `
    const items = document.querySelectorAll('ytd-rich-grid-media');
    console.log('Video items found:', items.length);
    items.forEach((item, index) => {
      const title = item.querySelector('#video-title')?.innerText;
      const views = item.querySelector('#metadata-line span:last-child')?.innerText;
      const url = item.querySelector('a.yt-simple-endpoint')?.href;
      console.log(\`Video \${index}: \${title} | Views: \${views} | URL: \${url}\`);
    });
    items.length;
  `);
  console.log(`Total video items: ${videoItems}`);
  
  await closeTarget(t.id);
  
} catch (e) {
  console.log(`Error: ${e.message}`);
}