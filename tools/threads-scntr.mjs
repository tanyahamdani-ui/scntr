#!/usr/bin/env node
// Public Threads search and manually invoked replies for the SCNTR account.
//   node tools/threads-scntr.mjs cari ["kata kunci"] [--json]
//   node tools/threads-scntr.mjs balas <URL> "<teks>"
// Cari is read-only. Balas is a separate, human-invoked command with safety limits.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { CDP, evalJs, newTarget, closeTarget } from './upload-tiktok/cdp.mjs';
import { normalizePostUrl, selectNewLeads } from './pantau/threads-leads.mjs';

const ROOT = process.env.SCNTR_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG = path.join(ROOT, '_kerja/threads-scntr/LOG-BALAS-PROAKTIF.md');
const MAKS = 10;
const HATI = /[❤\u{1F90D}\u{1F90E}\u{1F499}-\u{1F49F}\u{1F5A4}\u{1F9E1}\u{1F49D}\u{1F498}\u{1F496}\u{1F497}\u{1F495}\u{1F493}]/u;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const hariIni = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
const sekarang = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).slice(0, 16);
const log = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8') : '';
const sudah = new Set([...log.matchAll(/threads\.com(\/@[^/\s]+\/post\/[\w-]+)/g)].map(match => normalizePostUrl(`https://www.threads.com${match[1]}`)).filter(Boolean));
const hariIniCount = log.split('\n').filter(line => line.startsWith(hariIni) && /TAYANG/.test(line)).length;
const [cmd, ...args] = process.argv.slice(2);

function parseSearchArgs(values) {
  const json = values.includes('--json');
  const query = values.filter(value => value !== '--json').join(' ').trim();
  if (!query) throw new Error('kata kunci pencarian wajib diisi');
  return { query, json };
}

async function cari(cdp, query, json) {
  const url = `https://www.threads.com/search?q=${encodeURIComponent(query)}&serp_type=default&filter=recent`;
  await cdp.send('Page.navigate', { url });
  await sleep(8000);
  const posts = await evalJs(cdp, `([...document.querySelectorAll('a[href*="/post/"]')].map(a => {
    const href = (a.getAttribute('href') || '').replace(/\\/media\\/?$/, '');
    let node = a;
    for (let i = 0; i < 8 && node.parentElement; i++) {
      node = node.parentElement;
      if (node.matches('article,[role="article"]')) break;
    }
    const time = node.querySelector('time');
    const body = node.cloneNode(true);
    body.querySelectorAll('a[href^="/@"],time').forEach(item => item.remove());
    const raw = (body.innerText || '').replace(/\\s+/g, ' ').trim();
    const age = time?.dateTime || time?.getAttribute('aria-label') || time?.innerText || '';
    return { url: href, text: raw.slice(0, 1000), age };
  }))`);
  const leads = selectNewLeads(posts, [...sudah]);
  if (json) {
    console.log(`LEADS_JSON:${JSON.stringify(leads)}`);
    return;
  }
  console.log(`Kata kunci: "${query}" — ${leads.length} calon relevan`);
  for (const lead of leads.slice(0, 10)) {
    console.log(`- ${lead.intent}${lead.needsFactCheck ? ' [cek harga/stok]' : ''} | ${lead.context} | ${lead.url}`);
  }
}

async function balas(cdp, url, text) {
  const postUrl = normalizePostUrl(url);
  if (!postUrl || !text) throw new Error('URL Threads atau teks balasan kosong/tidak valid');
  const postPath = new URL(postUrl).pathname;
  if (sudah.has(postUrl)) throw new Error('Postingan ini sudah pernah dibalas.');
  if (hariIniCount >= MAKS) throw new Error(`Batas ${MAKS} balasan hari ini tercapai.`);
  if (/https?:\/\/|www\./i.test(text) || HATI.test(text) || text.length > 220) {
    throw new Error('Teks melanggar aturan (link / emoji hati / > 220 huruf).');
  }

  await cdp.send('Page.navigate', { url: postUrl });
  await sleep(8000);
  const click = async (x, y) => {
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    }
  };
  const pos = await evalJs(cdp, `(() => {
    const icon = [...document.querySelectorAll('svg[aria-label="Reply"],svg[aria-label="Balas"]')][0];
    if (!icon) return null;
    const button = icon.closest('[role=button]') || icon;
    button.scrollIntoView({ block: 'center' });
    const rect = button.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`);
  if (!pos) throw new Error('tombol balas tidak ketemu');
  await click(pos.x, pos.y);
  await sleep(3000);
  const box = await evalJs(cdp, `(() => {
    const element = [...document.querySelectorAll('[role=dialog] [contenteditable=true],[contenteditable=true]')].find(item => item.offsetParent);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.x + 30, y: rect.y + 12 };
  })()`);
  if (!box) throw new Error('kotak balas tidak terbuka');
  await click(box.x, box.y);
  await sleep(500);
  await cdp.send('Input.insertText', { text });
  await sleep(1500);
  const sendPosition = await evalJs(cdp, `(() => {
    const button = [...document.querySelectorAll('[role=dialog] [role=button],[role=button]')].find(item =>
      /^(Post|Posting|Reply|Balas|Kirim)$/i.test((item.innerText || '').trim()) &&
      item.getAttribute('aria-disabled') !== 'true' && item.offsetParent);
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`);
  if (!sendPosition) throw new Error('tombol kirim tidak aktif');
  await click(sendPosition.x, sendPosition.y);
  await sleep(7000);
  await cdp.send('Page.navigate', { url: postUrl });
  await sleep(8000);
  const shown = await evalJs(cdp, `document.body.innerText.includes(${JSON.stringify(text.slice(0, 35))})`);
  const line = `${sekarang()} | Threads SCNTR (proaktif) | https://www.threads.com${postPath} | ${shown ? 'TAYANG' : 'BELUM TERLIHAT'} | ${text}`;
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, `${line}\n`);
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools/lapor-telegram.mjs'), shown
      ? `SCNTR: balasan manual ke postingan Threads sudah tayang (ke-${hariIniCount + 1} hari ini).`
      : 'SCNTR: balasan manual ke postingan Threads belum terlihat, perlu dicek.'], { stdio: 'ignore' });
  } catch (error) {
    console.error(`Balasan dicatat tetapi notifikasi Telegram gagal: ${error.message}`);
  }
  console.log(line);
  return shown ? 0 : 1;
}

async function main() {
  if (cmd === 'cari') {
    const { query, json } = parseSearchArgs(args);
    const target = await newTarget('https://www.threads.com/');
    const id = target.id || target.targetId;
    try {
      await sleep(8000);
      const cdp = await CDP.attach(id);
      try {
        await cdp.send('Page.enable');
        const account = await evalJs(cdp, `([...document.querySelectorAll('a[href^="/@"]')].find(a =>
          a.querySelector('svg[aria-label="Profile"],svg[aria-label="Profil"]')) || { getAttribute: () => '' }).getAttribute('href')`);
        if (!/scntr/i.test(account || '')) throw new Error(`Akun Threads di Chrome bukan SCNTR (${account || 'tidak terbaca'}).`);
        await cari(cdp, query, json);
      } finally {
        cdp.close();
      }
    } finally {
      await closeTarget(id);
    }
    return 0;
  }
  if (cmd === 'balas') {
    const [url, ...textParts] = args;
    const text = textParts.join(' ').trim();
    const target = await newTarget('https://www.threads.com/');
    const id = target.id || target.targetId;
    try {
      await sleep(8000);
      const cdp = await CDP.attach(id);
      try {
        await cdp.send('Page.enable');
        const account = await evalJs(cdp, `([...document.querySelectorAll('a[href^="/@"]')].find(a =>
          a.querySelector('svg[aria-label="Profile"],svg[aria-label="Profil"]')) || { getAttribute: () => '' }).getAttribute('href')`);
        if (!/scntr/i.test(account || '')) throw new Error(`Akun Threads di Chrome bukan SCNTR (${account || 'tidak terbaca'}).`);
        return await balas(cdp, url, text);
      } finally {
        cdp.close();
      }
    } finally {
      await closeTarget(id);
    }
  }
  console.error('pakai: cari "<kata kunci>" [--json] | balas <URL> "<teks>"');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error(`Gagal: ${error.message}`);
    process.exitCode = 3;
  }
}
