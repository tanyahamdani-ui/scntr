export const SEARCH_QUERIES = [
  'minta rekomendasi parfum',
  'rekomendasi parfum cowok',
  'saranin parfum',
  'rekomen parfum dong',
  'parfum apa ya',
  'cari parfum buat kerja',
  'parfum buat ngantor',
  'parfum buat kuliah',
  'parfum buat date',
  'parfum cowok murah',
  'parfum lokal recommended',
  'parfum mini atau sample',
];

const EXCLUDE = /\b(?:aku rekomen|inspired|shopee\.co|s\.shopee|tokopedia\.link|affiliate|racun|ready stock|open po|ready ya|cek bio|link di bio|dm aja|giveaway|politik)\b|#/i;
const RELEVANT = /\b(?:parfum|perfume|wewangian|pewangi|wangi|edp)\b/i;
const DIRECT_ASK = /\b(?:minta|butuh|cari|nyari|pengen|mau|beli|rekomendasi|rekomen(?:dasi)?|saran(?:in)?|bantu (?:pilih|cari)|ada (?:yang tahu|yang tau|saran|rekomendasi))\b/i;
const QUESTION = /[?]|\b(?:berapa|apa|gimana|bagaimana|di mana|dimana|yang bagus|cocok|ada nggak|ada enggak)\b/i;
const PRICE_STOCK = /\b(?:harga|berapa|budget|murah|di bawah|stok|stock|ready|tersedia|beli di mana|beli dimana|order|pesan|sample|sampel|mini)\b/i;
const CONTEXTS = [
  ['kantor', /\b(?:kerja|kantor|ngantor|office|interview|presentasi)\b/i],
  ['kencan', /\b(?:date|kencan|ketemu gebetan)\b/i],
  ['kampus', /\b(?:kuliah|kampus|sekolah)\b/i],
  ['harga/nilai', /\b(?:harga|berapa|budget|murah|di bawah|value)\b/i],
  ['sample/ukuran mini', /\b(?:sample|sampel|mini|travel size|decant)\b/i],
  ['rekomendasi', /\b(?:rekomendasi|rekomen|saran|pilih)\b/i],
];

export function normalizePostUrl(value) {
  if (typeof value !== 'string') return null;
  let url;
  try {
    url = new URL(value, 'https://www.threads.com');
  } catch {
    return null;
  }
  if (!['threads.com', 'www.threads.com'].includes(url.hostname.toLowerCase())) return null;
  const path = url.pathname.replace(/\/media\/?$/, '').replace(/\/+$/, '');
  if (!/^\/@[^/]+\/post\/[\w-]+$/.test(path)) return null;
  return `https://www.threads.com${path}`;
}

function ageInDays(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) return Math.max(0, (Date.now() - timestamp) / 86400000);
  const match = value.match(/^\s*(\d+)\s*(s|m|h|d|w)\s*(?:ago|yang lalu)?\s*$/i)
    || value.match(/\b(\d+)\s*(?:second|minute|hour|day|week|detik|menit|jam|hari|minggu)s?\b/i);
  if (!match) return null;
  const unit = value.toLowerCase().match(/second|minute|hour|day|week|detik|menit|jam|hari|minggu|[smhdw]/)?.[0];
  const scale = { s: 1 / 86400, second: 1 / 86400, detik: 1 / 86400, m: 1 / 1440, minute: 1 / 1440, menit: 1 / 1440, h: 1 / 24, hour: 1 / 24, jam: 1 / 24, d: 1, day: 1, hari: 1, w: 7, week: 7, minggu: 7 };
  return Number(match[1]) * scale[unit];
}

function contentWithoutHeader(text) {
  let content = String(text || '').replace(/\s+/g, ' ').trim();
  content = content.replace(/^[^\s|]+\s+\d+\s*[smhdw]\s*(?:\|\s*)?/i, '');
  return content.slice(0, 1000);
}

export function classifyLead(post) {
  const url = normalizePostUrl(post?.url);
  const text = contentWithoutHeader(post?.text ?? post?.context);
  if (!url || !text || !RELEVANT.test(text) || EXCLUDE.test(text)) return null;
  if (/replying to|membalas/i.test(text)) return null;
  if (!(DIRECT_ASK.test(text) || QUESTION.test(text))) return null;
  if (ageInDays(post?.age) > 14) return null;

  const matched = CONTEXTS.find(([, pattern]) => pattern.test(text));
  const dynamic = PRICE_STOCK.test(text);
  const direct = DIRECT_ASK.test(text);
  const score = (direct ? 3 : 0) + (QUESTION.test(text) ? 2 : 0) + (matched ? 2 : 0) + (dynamic ? 1 : 0);
  return {
    url,
    context: text.slice(0, 240),
    intent: matched?.[0] || 'pertanyaan parfum',
    needsFactCheck: dynamic,
    score,
  };
}

export function selectNewLeads(posts, reported = []) {
  const seen = new Set(reported.map(normalizePostUrl).filter(Boolean));
  const result = [];
  for (const post of posts || []) {
    const lead = classifyLead(post);
    if (!lead || seen.has(lead.url)) continue;
    seen.add(lead.url);
    result.push(lead);
  }
  return result.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
}

export function buildLeadDigest(leads, { maxChars = 3800, maxLeads = 8 } = {}) {
  const lines = ['LEAD THREADS — cek manual sebelum membalas'];
  const footer = '\n\nBalas manual, bantu dulu; jangan klaim ketahanan atau mengarang harga/stok. Link toko hanya jika diminta.';
  const included = [];
  for (const lead of leads.slice(0, maxLeads)) {
    const factNote = lead.needsFactCheck ? ' | cek harga/stok ke Dani' : '';
    const block = `\n\n${included.length + 1}. ${lead.intent}${factNote}\n${lead.context}\n${lead.url}`;
    if (lines.join('').length + block.length + footer.length > maxChars) break;
    lines.push(block);
    included.push(lead);
  }
  if (!included.length) return { text: '', included };
  lines.push(footer);
  return { text: lines.join(''), included };
}

export function formatLeadDigest(leads, options) {
  return buildLeadDigest(leads, options).text;
}
