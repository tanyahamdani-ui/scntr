import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';

export const STATUSES = Object.freeze({
  new: 'Baru',
  reviewed: 'Ditinjau',
  replied: 'Sudah dibalas manual',
  interested: 'Tertarik / klik',
  ordered: 'Memesan',
  no_response: 'Tidak ada respons',
  dismissed: 'Tidak relevan',
});

export const SOURCES = Object.freeze(['Threads', 'TikTok', 'Instagram', 'Facebook', 'Shopee', 'Lainnya']);

const TRANSITIONS = Object.freeze({
  new: ['reviewed', 'dismissed'],
  reviewed: ['replied', 'no_response', 'dismissed'],
  replied: ['interested', 'no_response', 'dismissed'],
  interested: ['ordered', 'no_response', 'dismissed'],
  ordered: [],
  no_response: ['reviewed', 'dismissed'],
  dismissed: [],
});

const MAX_TEXT = 2000;

export function normalizePublicUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('URL harus berupa alamat web HTTPS yang valid.');
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('URL harus berupa alamat web HTTPS yang valid.');
  }
  const hostname = url.hostname.toLowerCase();
  const ipVersion = isIP(hostname.replace(/^\[|\]$/g, ''));
  const blockedHost = hostname === 'localhost' || hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') || hostname.endsWith('.internal') ||
    hostname === '0.0.0.0' || hostname === '::1' ||
    (ipVersion === 4 && (
      hostname.startsWith('10.') || hostname.startsWith('127.') || hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) || hostname.startsWith('169.254.')
    )) || (ipVersion === 6 && (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80:')));
  if (url.protocol !== 'https:' || !hostname.includes('.') || blockedHost || url.username || url.password) {
    throw new Error('Gunakan URL HTTPS publik tanpa kredensial.');
  }
  url.hash = '';
  url.search = '';
  url.hostname = hostname;
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.toString();
}

function requiredText(value, label, maxLength = MAX_TEXT) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} wajib diisi.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} maksimal ${maxLength} karakter.`);
  return text;
}

function validateSource(source) {
  if (!SOURCES.includes(source)) throw new Error('Pilih sumber lead yang valid.');
}

function validateStatus(status) {
  if (!Object.hasOwn(STATUSES, status)) throw new Error('Status lead tidak valid.');
}

function load(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(data)) throw new Error('Isi file tracker harus berupa array.');
    return data;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Data tracker tidak dapat dibaca: ${error.message}`);
  }
}

function save(filePath, leads) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(leads, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    fs.renameSync(tempPath, filePath);
  } finally {
    try { fs.unlinkSync(tempPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

export function createLead(input, filePath) {
  const source = input?.source;
  validateSource(source);
  const url = normalizePublicUrl(input?.url);
  const context = requiredText(input?.context, 'Konteks', 1000);
  const leads = load(filePath);
  const duplicate = leads.find(lead => lead.url === url);
  if (duplicate) throw new Error('URL ini sudah ada di tracker.');
  const timestamp = new Date().toISOString();
  const lead = {
    id: randomUUID(),
    source,
    url,
    context,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: 'new',
    notes: '',
  };
  leads.unshift(lead);
  save(filePath, leads);
  return lead;
}

export function parseThreadsExport(input) {
  const content = Buffer.isBuffer(input) ? input.toString('utf8') : String(input);
  const marker = content.indexOf('LEADS_JSON:');
  let parsed;
  try {
    parsed = JSON.parse(marker >= 0 ? content.slice(marker + 'LEADS_JSON:'.length).trim() : content);
  } catch {
    throw new Error('File bukan ekspor Threads JSON yang valid.');
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.leads)) return parsed.leads;
  if (parsed && Array.isArray(parsed.lapor)) {
    return parsed.lapor.map(url => ({
      url,
      context: 'Konteks tidak tersedia di state lama. Buka posting publik dan tinjau manual.',
      notes: 'Diimpor dari daftar URL lama; isi konteks setelah pemeriksaan manual.',
    }));
  }
  throw new Error('Ekspor harus berisi daftar lead, properti leads, atau daftar lapor lama.');
}

export function importThreadsLeads(items, filePath) {
  if (!Array.isArray(items)) throw new Error('Daftar lead untuk impor tidak valid.');
  const leads = load(filePath);
  const existing = new Set(leads.map(lead => normalizePublicUrl(lead.url)));
  const timestamp = new Date().toISOString();
  const candidates = items.map((item, index) => {
    const url = normalizePublicUrl(item?.url);
    const context = requiredText(item?.context ?? item?.text, `Konteks lead ${index + 1}`, 1000);
    return {
      id: randomUUID(),
      source: 'Threads',
      url,
      context,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'new',
      notes: typeof item?.notes === 'string' && item.notes.trim()
        ? item.notes.slice(0, 2000)
        : 'Impor hasil pencarian Threads; tinjau posting secara manual sebelum tindak lanjut.',
    };
  });
  const additions = candidates.filter(lead => {
    if (existing.has(lead.url)) return false;
    existing.add(lead.url);
    return true;
  });
  if (additions.length) save(filePath, [...additions, ...leads]);
  return { imported: additions.length, duplicates: candidates.length - additions.length, leads: additions };
}

export function updateLead(id, patch, filePath) {
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new Error('ID lead tidak valid.');
  const leads = load(filePath);
  const lead = leads.find(item => item.id === id);
  if (!lead) throw new Error('Lead tidak ditemukan.');
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Perubahan lead tidak valid.');
  const keys = Object.keys(patch);
  if (!keys.length || keys.some(key => !['status', 'notes'].includes(key))) {
    throw new Error('Hanya status dan catatan yang bisa diubah.');
  }
  if (Object.hasOwn(patch, 'status')) {
    validateStatus(patch.status);
    if (!TRANSITIONS[lead.status]?.includes(patch.status)) {
      throw new Error(`Perubahan status ${STATUSES[lead.status]} ke ${STATUSES[patch.status]} tidak diizinkan.`);
    }
    lead.status = patch.status;
  }
  if (Object.hasOwn(patch, 'notes')) {
    lead.notes = patch.notes === '' ? '' : requiredText(patch.notes, 'Catatan', 2000);
  }
  lead.updatedAt = new Date().toISOString();
  save(filePath, leads);
  return lead;
}

export function listLeads(filePath) {
  return load(filePath);
}
