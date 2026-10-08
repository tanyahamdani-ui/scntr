import { getStudio } from './studio.mjs';
import { evalJs } from './cdp.mjs';
const c = await getStudio();
const sleep = ms => new Promise(r => setTimeout(r, ms));

const r = await evalJs(c, `(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.innerText.trim() === 'Jadwal');
  if (!b) return { err: 'no Jadwal btn' };
  const rect = b.getBoundingClientRect();
  return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), w: rect.width, dis: b.disabled };
})()`);
console.log('tombol:', JSON.stringify(r));
if (r.err) { console.log(r.err); process.exit(1); }

for (const t of ['mousePressed', 'mouseReleased']) {
  await c.send('Input.dispatchMouseEvent', { type: t, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(180);
}
await sleep(7000);

const after = await evalJs(c, `(() => ({
  url: location.href,
  adaMasalah: document.body.innerText.includes('Ada masalah'),
  konfirm: document.body.innerText.replace(/\\n{2,}/g, ' | ').slice(0, 400)
}))()`);
console.log('SESUDAH:', JSON.stringify(after, null, 1));
c.close();
