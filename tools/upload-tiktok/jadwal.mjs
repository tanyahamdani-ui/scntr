import { evalJs } from './cdp.mjs';

export async function setTanggal(cdp, namaBulan, tanggal) {
  await evalJs(cdp, `(async () => {
    const i = [...document.querySelectorAll('input[type=text]')].find(x => /^\\d{4}-/.test(x.value));
    i.focus();
    await new Promise(r => setTimeout(r, 300));
    i.click();
    await new Promise(r => setTimeout(r, 2500));
    return 1;
  })()`);

  const judul = async () => evalJs(cdp, `(() => {
    const el = document.querySelector('[class*=month-header-wrapper] .title-wrapper, [class*=month-header-wrapper]');
    return el ? el.innerText.replace(/\\s+/g, ' ').trim() : null;
  })()`);

  let j = await judul();
  if (!j) throw new Error('kalender tidak terbuka');

  for (let i = 0; i < 14 && !j.includes(namaBulan); i++) {
    const r = await evalJs(cdp, `(async () => {
      const hdr = document.querySelector('[class*=month-header-wrapper]');
      if (!hdr) return { err: 'no hdr' };
      const arrows = [...hdr.querySelectorAll('[class*=arrow]')];
      if (arrows.length < 2) return { err: 'arrows ' + arrows.length };
      const next = arrows[arrows.length - 1];
      next.click();
      await new Promise(r => setTimeout(r, 900));
      return { ok: 1 };
    })()`);
    if (r.err) throw new Error(r.err);
    j = await judul();
    if (!j) throw new Error('judul hilang');
  }
  if (!j.includes(namaBulan)) throw new Error('gagal ke ' + namaBulan + ' (' + j + ')');

  const klik = await evalJs(cdp, `(async () => {
    const hdr = document.querySelector('[class*=month-header-wrapper]');
    const wrap = hdr ? hdr.parentElement.parentElement : null;
    const scope = wrap || document;
    const days = [...scope.querySelectorAll('[class*=day]')].filter(e =>
      e.innerText.trim() === String(${tanggal}) && e.getBoundingClientRect().width > 0);
    if (!days.length) return { err: 'no day ' + ${tanggal} };
    days[days.length - 1].click();
    await new Promise(r => setTimeout(r, 1500));
    return { ok: 1 };
  })()`);
  if (klik.err) throw new Error(klik.err);
  return true;
}

export async function setJam(cdp, jam, menit) {
  await evalJs(cdp, `(async () => {
    const i = [...document.querySelectorAll('input[type=text]')].find(x => /^\\d{2}:\\d{2}$/.test(x.value));
    i.focus();
    await new Promise(r => setTimeout(r, 300));
    i.click();
    await new Promise(r => setTimeout(r, 2200));
    return 1;
  })()`);

  const klik = await evalJs(cdp, `(async () => {
    const jam = String(${jam}), menit = String(${menit});
    const left = [...document.querySelectorAll('.tiktok-timepicker-option-text.tiktok-timepicker-left')];
    const right = [...document.querySelectorAll('.tiktok-timepicker-option-text.tiktok-timepicker-right')];
    if (!left.length || !right.length) return { err: 'no picker', l: left.length, r: right.length };
    const h = left.find(e => e.innerText.trim() === jam);
    const m = right.find(e => e.innerText.trim() === menit);
    if (!h) return { err: 'no jam ' + jam };
    if (!m) return { err: 'no menit ' + menit };
    h.click();
    await new Promise(r => setTimeout(r, 700));
    m.click();
    await new Promise(r => setTimeout(r, 900));
    return { ok: 1 };
  })()`);
  if (klik.err) throw new Error(klik.err);

  const v = await evalJs(cdp, `(() => {
    const ins = [...document.querySelectorAll('input[type=text]')];
    return {
      tgl: (ins.find(i => /^\\d{4}-/.test(i.value)) || {}).value,
      jam: (ins.find(i => /^\\d{2}:\\d{2}$/.test(i.value)) || {}).value
    };
  })()`);
  return v;
}

export async function submitJadwal(cdp) {
  const r = await evalJs(cdp, `(() => {
    const b = [...document.querySelectorAll('button')].filter(x => x.innerText.trim() === 'Jadwalkan');
    if (!b.length) return { err: 'no btn' };
    b[b.length - 1].click();
    return { ok: 1, n: b.length };
  })()`);
  if (r.err) throw new Error(r.err);
  await new Promise(x => setTimeout(x, 5000));
  return evalJs(cdp, `(() => ({
    url: location.href,
    adaMasalah: document.body.innerText.includes('Ada masalah'),
    head: document.body.innerText.replace(/\\n{2,}/g, ' | ').slice(0, 260)
  }))()`);
}
