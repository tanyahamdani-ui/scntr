#!/usr/bin/env node
// Public Threads buyer-intent search; reporting only, no contact actions.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { SEARCH_QUERIES, buildLeadDigest, normalizePostUrl, selectNewLeads } from './threads-leads.mjs';

const ROOT = process.env.SCNTR_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const STATE = path.join(ROOT, '_kerja/threads-lead.json');
const TOOL = path.join(ROOT, 'tools/threads-scntr.mjs');
const TELEGRAM = path.join(ROOT, 'tools/lapor-telegram.mjs');
const LOCK = `${STATE}.lock`;

function loadState() {
  try {
    const data = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    return { lapor: Array.isArray(data.lapor) ? data.lapor.map(normalizePostUrl).filter(Boolean) : [] };
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`State lead tidak bisa dibaca: ${error.message}`);
    return { lapor: [] };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  const temp = `${STATE}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(state, null, 1)}\n`, { mode: 0o600 });
  fs.renameSync(temp, STATE);
}

function extractPosts(output) {
  const marker = output.indexOf('LEADS_JSON:');
  if (marker < 0) throw new Error('Hasil pencarian tidak memuat data lead terstruktur.');
  const data = JSON.parse(output.slice(marker + 'LEADS_JSON:'.length).trim());
  if (!Array.isArray(data)) throw new Error('Format data lead tidak valid.');
  return data;
}

function acquireLock() {
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  const fd = fs.openSync(LOCK, 'wx', 0o600);
  fs.writeFileSync(fd, `${process.pid}\n`);
  return fd;
}

function run() {
  if (!fs.existsSync(TOOL)) throw new Error(`Skrip pencarian tidak ditemukan: ${TOOL}`);
  if (!fs.existsSync(TELEGRAM)) throw new Error(`Pelapor Telegram tidak ditemukan: ${TELEGRAM}`);
  let lockFd;
  try {
    lockFd = acquireLock();
  } catch (error) {
    if (error.code === 'EEXIST') {
      let owner = '';
      try { owner = fs.readFileSync(LOCK, 'utf8').trim(); } catch {}
      throw new Error(`Pencarian lain sedang berjalan${owner ? ` (PID ${owner})` : ''}; state deduplikasi tidak disentuh.`);
    }
    throw error;
  }
  try {
    const state = loadState();
    const posts = [];
    const failedQueries = [];
    for (const query of SEARCH_QUERIES) {
      try {
        const output = execFileSync(process.execPath, [TOOL, 'cari', query, '--json'], {
          cwd: ROOT, encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'],
        });
        posts.push(...extractPosts(output));
      } catch (error) {
        failedQueries.push(query);
        console.error(`Gagal mencari "${query}": ${(error.stderr || error.message).toString().trim().slice(0, 240)}`);
      }
    }
    const leads = selectNewLeads(posts, state.lapor);
    if (!leads.length) {
      console.log(`Tidak ada lead baru${failedQueries.length ? `; ${failedQueries.length} pencarian gagal` : ''}.`);
      return;
    }
    const digest = buildLeadDigest(leads);
    if (!digest.text) throw new Error('Digest terlalu panjang; tidak ada lead yang dapat dilaporkan.');
    execFileSync(process.execPath, [TELEGRAM, digest.text], { cwd: ROOT, encoding: 'utf8', timeout: 30000, stdio: 'inherit' });
    state.lapor = [...new Set([...state.lapor, ...digest.included.map(lead => lead.url)])];
    saveState(state);
    console.log(`Lapor ${digest.included.length} lead ke Telegram; ${failedQueries.length} pencarian gagal.`);
  } finally {
    if (lockFd !== undefined) fs.closeSync(lockFd);
    try { fs.unlinkSync(LOCK); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    run();
  } catch (error) {
    console.error(`Gagal: ${error.message}`);
    process.exitCode = 1;
  }
}
