// Tes 1 reel di Meta Business Suite: video + caption -> Next -> Next -> screenshot tahap Share.
// TIDAK menekan Schedule/Share.
import fs from 'fs';
import { targets, CDP, evalJs } from './cdp.mjs';
const [VIDEO, CAPTION = 'tes caption'] = process.argv.slice(2);
const OUT = '/Users/dani/Projects/SCNTR_Projects/_kerja/ig-dryrun.png';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t = (await targets()).find(x => x.type === 'page' && x.url.includes('business.facebook.com'));
const cdp = await CDP.attach(t.id);
await cdp.send('Page.enable'); await cdp.send('DOM.enable');
await cdp.send('Page.bringToFront');
await cdp.send('Page.setInterceptFileChooserDialog', { enabled: true });
const click = async (x, y) => { for (const type of ['mouseMoved','mousePressed','mouseReleased'])
  await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); };
const findBtn = re => evalJs(cdp, `(() => {
  const re = ${re};
  const b = [...document.querySelectorAll('[role=button],button')].find(e => re.test((e.innerText||'').trim()) && e.getAttribute('aria-disabled')!=='true' && !e.disabled);
  if (!b) return null; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect();
  return {x: r.x + r.width/2, y: r.y + r.height/2};
})()`);

const add = await findBtn('/^Add Video$/i');
if (!add) { console.log('tombol Add Video tidak ada'); process.exit(1); }
await click(add.x, add.y);
let ev; for (let i = 0; i < 40 && !ev; i++) { ev = cdp.events.find(e => e.method === 'Page.fileChooserOpened'); if (!ev) await sleep(250); }
if (!ev) { console.log('dialog file tidak muncul'); process.exit(2); }
await cdp.send('DOM.setFileInputFiles', { files: [VIDEO], backendNodeId: ev.params.backendNodeId });
console.log('video masuk, tunggu upload...');
await sleep(15000);

// caption
const cap = await evalJs(cdp, `(() => { const e = [...document.querySelectorAll('[contenteditable=true],textarea')].find(x => x.offsetParent);
  if (!e) return null; e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return {x:r.x+20,y:r.y+15}; })()`);
if (cap) { await click(cap.x, cap.y); await cdp.send('Input.insertText', { text: CAPTION }); console.log('caption diisi'); }
else console.log('kolom caption tidak ketemu');

for (let step = 1; step <= 2; step++) {
  let nx; for (let i = 0; i < 60 && !nx; i++) { nx = await findBtn('/^Next$/'); if (!nx) await sleep(1000); }
  if (!nx) { console.log('tombol Next belum aktif (step', step, ')'); break; }
  await click(nx.x, nx.y); console.log('Next', step); await sleep(4000);
}
const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
console.log('screenshot:', OUT); cdp.close();
