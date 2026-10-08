import { targets, CDP, evalJs } from './cdp.mjs';

export async function getStudio() {
  const list = await targets();
  const t = list.find(x => x.url.includes('tiktokstudio'));
  if (!t) throw new Error('studio tab not found');
  return CDP.attach(t.id);
}

export async function goto(cdp, url) {
  await cdp.send('Page.enable');
  await cdp.send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 8000));
}

export async function upload(cdp, filepath) {
  await goto(cdp, 'https://www.tiktok.com/tiktokstudio/upload');
  const doc = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const find = (n) => {
    if (!n) return null;
    if (n.nodeName === 'INPUT' && n.attributes) {
      const a = n.attributes;
      if (a[a.indexOf('type') + 1] === 'file') return n;
    }
    for (const ch of (n.children || [])) { const r = find(ch); if (r) return r; }
    for (const sh of (n.shadowRoots || [])) { const r = find(sh); if (r) return r; }
    return null;
  };
  const inp = find(doc.root);
  if (!inp) throw new Error('file input not found');
  await cdp.send('DOM.setFileInputFiles', { files: [filepath], nodeId: inp.nodeId });
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const ready = await evalJs(cdp, `(() => {
      const ed = document.querySelector('[contenteditable=true]');
      return !!ed && /Diunggah/.test(document.body.innerText);
    })()`);
    if (ready) return true;
  }
  throw new Error('upload timeout');
}

const norm = s => s.replace(/\s+/g, '');

export async function setCaption(cdp, caption) {
  const r = await evalJs(cdp, `(async () => {
    const ed = document.querySelector('[contenteditable=true]');
    if (!ed) return { err: 'no editor' };
    ed.focus();
    await new Promise(r => setTimeout(r, 300));
    document.execCommand('selectAll');
    await new Promise(r => setTimeout(r, 300));
    return { sel: String(window.getSelection()) };
  })()`);
  if (r.err) throw new Error(r.err);
  await cdp.send('Input.insertText', { text: caption });
  await new Promise(r => setTimeout(r, 1500));
  const post = await evalJs(cdp, `(() => {
    const ed = document.querySelector('[contenteditable=true]');
    return { isi: ed ? ed.innerText : '' };
  })()`);
  if (norm(post.isi) !== norm(caption)) throw new Error('caption mismatch');
  return post;
}

export async function state(cdp) {
  return evalJs(cdp, `(() => {
    const ed = document.querySelector('[contenteditable=true]');
    return {
      url: location.href,
      ed: !!ed,
      isi: ed ? ed.innerText.slice(0, 80) : null,
      adaMasalah: document.body.innerText.includes('Ada masalah'),
      tombol: [...document.querySelectorAll('button')].map(b => b.innerText.trim().replace(/\\n/g, ' ')).filter(Boolean).slice(-6)
    };
  })()`);
}

export async function setCaptionSafe(cdp, caption) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await evalJs(cdp, `(async () => {
      const ed = document.querySelector('[contenteditable=true]');
      if (!ed) return { err: 'no editor' };
      ed.focus();
      await new Promise(r => setTimeout(r, 350));
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(ed);
      sel.removeAllRanges();
      sel.addRange(range);
      await new Promise(r => setTimeout(r, 350));
      if (!sel.containsNode(ed, true)) return { err: 'selection not in editor' };
      return { ok: true, len: String(sel).length };
    })()`);
    if (r.err) { await new Promise(x => setTimeout(x, 600)); continue; }
    await cdp.send('Input.insertText', { text: caption });
    await new Promise(r => setTimeout(r, 1500));
    const post = await evalJs(cdp, `(() => {
      const ed = document.querySelector('[contenteditable=true]');
      return { isi: ed ? ed.innerText : '' };
    })()`);
    if (norm(post.isi) === norm(caption)) return post;
  }
  throw new Error('caption mismatch after retries');
}

export async function pilihJadwal(cdp) {
  const r = await evalJs(cdp, `(async () => {
    const el = [...document.querySelectorAll('label')].find(l => l.innerText.trim() === 'Jadwalkan');
    if (!el) return { err: 'no label' };
    const inp = el.querySelector('input');
    if (inp && !inp.checked) inp.click();
    el.click();
    await new Promise(r => setTimeout(r, 2000));
    return { checked: inp ? inp.checked : null };
  })()`);
  if (r.err) throw new Error(r.err);
  return r;
}

export async function isiTanggalJam(cdp, isoDate, jam) {
  const r = await evalJs(cdp, `(async () => {
    function setVal(el, v) {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      s.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.blur();
    }
    const ins = [...document.querySelectorAll('input[type=text]')];
    const tgl = ins.find(i => /^\\d{4}-\\d{2}-\\d{2}$/.test(i.value));
    const j = ins.find(i => /^\\d{2}:\\d{2}$/.test(i.value));
    if (!tgl || !j) return { err: 'inputs not found', vals: ins.map(i => i.value) };
    tgl.focus(); setVal(tgl, ${JSON.stringify(isoDate)}); await new Promise(r => setTimeout(r, 800));
    j.focus(); setVal(j, ${JSON.stringify(jam)}); await new Promise(r => setTimeout(r, 800));
    return { tgl: tgl.value, jam: j.value };
  })()`);
  if (r.err) throw new Error(r.err);
  if (r.tgl !== isoDate || r.jam !== jam) throw new Error('date/time not applied: ' + JSON.stringify(r));
  return r;
}

export async function klikJadwalkan(cdp) {
  const r = await evalJs(cdp, `(() => {
    const btns = [...document.querySelectorAll('button')].filter(b => b.innerText.trim() === 'Jadwalkan');
    if (!btns.length) return { err: 'no button' };
    const b = btns[btns.length - 1];
    b.click();
    return { clicked: true, cls: (b.className || '').toString().slice(0, 40) };
  })()`);
  if (r.err) throw new Error(r.err);
  await new Promise(r => setTimeout(r, 4000));
  const after = await evalJs(cdp, `(() => ({
    url: location.href,
    adaMasalah: document.body.innerText.includes('Ada masalah'),
    txt: document.body.innerText.replace(/\\n{2,}/g,' | ').slice(0, 300)
  }))()`);
  return after;
}
