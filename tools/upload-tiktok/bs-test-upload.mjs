// Tes: masukin 1 video ke composer Reels di Meta Business Suite lewat CDP,
// dengan menangkap dialog pilih file (tanpa klik Publish/Schedule).
import fs from 'fs';
import { targets, CDP, evalJs } from './cdp.mjs';

const VIDEO = process.argv[2];
const OUT = '/Users/dani/Projects/SCNTR_Projects/_kerja/ig-dryrun.png';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const list = await targets();
const t = list.find(x => x.type === 'page' && x.url.includes('business.facebook.com/latest/composer'));
if (!t) { console.log('Tab composer Business Suite tidak ada'); process.exit(1); }
const cdp = await CDP.attach(t.id);
await cdp.send('Page.enable');
await cdp.send('DOM.enable');
await cdp.send('Page.setInterceptFileChooserDialog', { enabled: true });
await cdp.send('Page.bringToFront');

// klik tombol tambah video/foto (klik "asli" lewat Input supaya dialog file terbuka)
const clicked = await evalJs(cdp, `(() => {
  const els = [...document.querySelectorAll('div[role=button],button,span')];
  const b = els.find(e => /^(Add video|Add photo\\/video|Tambahkan video|Tambahkan foto\\/video|Add photo or video)$/i.test((e.innerText||'').trim()));
  if (!b) return null; const el = b.closest('[role=button],button')||b; el.scrollIntoView({block:'center'});
  const r = el.getBoundingClientRect(); return {x: r.x + r.width/2, y: r.y + r.height/2, t: (b.innerText||'').trim()};
})()`);
if (clicked) for (const type of ['mouseMoved','mousePressed','mouseReleased'])
  await cdp.send('Input.dispatchMouseEvent', { type, x: clicked.x, y: clicked.y, button: 'left', clickCount: 1 });
console.log('klik:', clicked);

let ev = null;
for (let i = 0; i < 40 && !ev; i++) { ev = cdp.events.find(e => e.method === 'Page.fileChooserOpened'); if (!ev) await sleep(250); }
if (!ev) { console.log('fileChooserOpened tidak muncul'); process.exit(2); }
console.log('fileChooserOpened, mode:', ev.params.mode);
await cdp.send('DOM.setFileInputFiles', { files: [VIDEO], backendNodeId: ev.params.backendNodeId });
await sleep(12000);
const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
console.log('screenshot:', OUT);
cdp.close();
