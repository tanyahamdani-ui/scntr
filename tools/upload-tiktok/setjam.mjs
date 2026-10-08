import { getStudio } from './studio.mjs';
import { evalJs } from './cdp.mjs';

const c = await getStudio();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function click(x, y) {
  for (const t of ['mousePressed', 'mouseReleased']) {
    await c.send('Input.dispatchMouseEvent', { type: t, x, y, button: 'left', clickCount: 1 });
    await sleep(120);
  }
}

const jamValue = () => evalJs(c, `(() => {
  const i = [...document.querySelectorAll('input[type=text]')].find(x => /^\\d{2}:\\d{2}$/.test(x.value));
  return i ? i.value : null;
})()`);

async function bukaTimepicker() {
  for (let a = 0; a < 3; a++) {
    const r = await evalJs(c, `(() => {
      const i = [...document.querySelectorAll('input[type=text]')].find(x => /^\\d{2}:\\d{2}$/.test(x.value));
      const b = i.getBoundingClientRect();
      return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
    })()`);
    await click(r.x, r.y);
    await sleep(2000);
    const ada = await evalJs(c, `(() =>
      [...document.querySelectorAll('.tiktok-timepicker-option-item')].some(e => e.innerText.trim() !== '')
    )()`);
    if (ada) return true;
  }
  return false;
}

async function pilihOpsi(target) {
  const p = await evalJs(c, `(async () => {
    const target = ${JSON.stringify(target)};
    const items = [...document.querySelectorAll('.tiktok-timepicker-option-item')];
    const h = items.find(e => e.innerText.trim() === target);
    if (!h) return { err: 'no ' + target, n: items.length };
    h.scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 600));
    const rb = h.getBoundingClientRect();
    const cx = Math.round(rb.x + rb.width / 2);
    const cy = Math.round(rb.y + rb.height / 2);
    const at = document.elementFromPoint(cx, cy);
    return { cx, cy, ok: h.contains(at) };
  })()`);
  if (p.err) return p;
  await click(p.cx, p.cy);
  await sleep(1400);
  return { ok: p.ok, blocked: !p.ok, jam: await jamValue() };
}

console.log('buka:', await bukaTimepicker());
console.log('19:', JSON.stringify(await pilihOpsi('19')));
console.log('buka lagi:', await bukaTimepicker());
console.log('00:', JSON.stringify(await pilihOpsi('00')));
console.log('FINAL jam:', await jamValue());
console.log('tgl:', await evalJs(c, `(() => {
  const i = [...document.querySelectorAll('input[type=text]')].find(x => /^\\d{4}-/.test(x.value));
  return i ? i.value : null;
})()`));
c.close();
