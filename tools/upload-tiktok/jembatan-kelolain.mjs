import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../..');
const TRACKER = '/Users/dani/Projects/content-tracker';
const PROJECT_REF = 'ktltnhtetmkmwezxekac';
const LOCK = path.join(ROOT, '_kerja', 'jembatan-kelolain.lock');
const DRY_RUN = process.argv.includes('--dry-run');
const SCRIPT_BY_ROUTE = {
  'Instagram:reels': 'bs-batch-ig.mjs',
  'Instagram:carousel': 'bs-feed-ig.mjs',
  'TikTok:carousel': 'tt-carousel.mjs',
};

const sqlQuote = value => `'${String(value ?? '').replace(/'/g, "''")}'`;

function dateInJakarta(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = name => parts.find(item => item.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function offsetDate(date, days) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function loadAccessToken() {
  const envPath = path.join(TRACKER, '.env');
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find(item => item.trim().startsWith('SUPABASE_ACCESS_TOKEN='));
  if (!line) throw new Error(`SUPABASE_ACCESS_TOKEN tidak ditemukan di ${envPath}`);
  let token = line.slice(line.indexOf('=') + 1).trim();
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1);
  }
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN kosong');
  return token;
}

async function runSql(token, query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase Management API ${response.status}: ${body.slice(0, 300)}`);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('Respons Management API bukan JSON yang valid');
  }
}

function routeFor(row) {
  const platform = String(row.platform || '').trim();
  const format = String(row.format || '').trim().toLowerCase();
  if (platform === 'TikTok' && (format.includes('video') || format === 'reels')) {
    return { skipped: 'Video TikTok masih lewat batch Mimo' };
  }
  let kind = '';
  if (platform === 'Instagram' && format === 'reels') kind = 'reels';
  if (platform === 'Instagram' && ['carousel', 'foto', 'feed'].includes(format)) kind = 'carousel';
  if (platform === 'TikTok' && ['carousel', 'foto'].includes(format)) kind = 'carousel';
  if (!kind) return { skipped: `Format ${row.format || '(kosong)'} belum didukung autopost` };
  return { script: SCRIPT_BY_ROUTE[`${platform}:${kind}`] };
}

function makeLock() {
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  let fd;
  try {
    fd = fs.openSync(LOCK, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Jembatan lain sedang berjalan (lock: ${LOCK})`);
    throw error;
  }
  fs.writeFileSync(fd, `${process.pid}\n`);
  return () => {
    fs.closeSync(fd);
    fs.unlinkSync(LOCK);
  };
}

async function updateEntry(token, row, note, scheduled) {
  if (!/^[0-9a-f-]{36}$/i.test(String(row.id))) throw new Error(`ID planner tidak valid: ${row.id}`);
  const statusChange = scheduled ? `status = 'Scheduled',` : '';
  const query = `
    UPDATE planner_entries
    SET ${statusChange}
        notes = CASE
          WHEN notes IS NULL OR btrim(notes) = '' THEN ${sqlQuote(note)}
          WHEN position(${sqlQuote(note)} in notes) > 0 THEN notes
          ELSE notes || E'\\n' || ${sqlQuote(note)}
        END,
        updated_at = now()
    WHERE id = ${sqlQuote(row.id)}::uuid
      AND workspace_id = (SELECT id FROM workspaces WHERE name = 'SCNTR')
      AND status = 'Approved'
    RETURNING id, status;`;
  const result = await runSql(token, query);
  const rows = Array.isArray(result) ? result : result?.rows;
  if (Array.isArray(rows) && rows.length === 0) {
    throw new Error(`Baris ${row.id} sudah berubah; tidak ada update yang dilakukan`);
  }
}

function classifyExecution(result) {
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (/KEMUNGKINAN TERJADWAL/i.test(output) || result.error?.code === 'ETIMEDOUT') {
    return { scheduled: true, checked: true, output };
  }
  if (/\bTERJADWAL\b/i.test(output)) return { scheduled: true, checked: false, output };
  const failure = output.match(/GAGAL:\s*([^\r\n]+)/i)?.[1]?.trim();
  return {
    scheduled: false,
    checked: false,
    output,
    reason: failure || result.error?.message || (result.status === 0
      ? 'Skrip tidak menemukan konten yang bisa dijadwalkan pada tanggal ini'
      : `Skrip berhenti dengan kode ${result.status ?? 'tidak diketahui'}`),
  };
}

async function main() {
  const releaseLock = makeLock();
  try {
    const token = loadAccessToken();
    const today = dateInJakarta(new Date());
    const from = offsetDate(today, 1);
    const through = offsetDate(today, 28);
    const query = `
      SELECT p.id, p.date::text AS date, p.time, p.title, p.platform, p.format, p.status, p.notes
      FROM planner_entries p
      JOIN workspaces w ON w.id = p.workspace_id
      WHERE w.name = 'SCNTR'
        AND p.status = 'Approved'
        AND p.date >= ${sqlQuote(from)}::date
        AND p.date <= ${sqlQuote(through)}::date
        AND p.platform IN ('Instagram', 'TikTok')
      ORDER BY p.date, p.time NULLS LAST, p.id;`;
    const fetched = await runSql(token, query);
    const entries = Array.isArray(fetched) ? fetched : fetched?.rows;
    if (!Array.isArray(entries)) throw new Error('Query daftar Approved tidak menghasilkan array baris');

    console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Approved SCNTR ${from} s.d. ${through}: ${entries.length} baris.`);
    if (!entries.length) console.log('Tidak ada rencana autopost.');

    const plans = entries.map(row => ({ row, route: routeFor(row) }));
    const counts = new Map();
    for (const plan of plans) {
      if (!plan.route.script) continue;
      const key = `${plan.route.script}:${plan.row.date}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    for (const { row, route } of plans) {
      const validTime = String(row.time || '').match(/^([01]\d|2[0-3]):([0-5]\d)(?::\d{2}(?:\.\d+)?)?$/);
      const jam = validTime ? `${validTime[1]}:${validTime[2]}` : '';
      const timeArg = jam ? ` --jam ${jam}` : '';
      if (route.skipped) {
        const note = route.skipped;
        console.log(`- ${row.date} ${row.platform}/${row.format} "${row.title || ''}": LEWATI — ${note}${DRY_RUN ? ' [notes akan dicatat]' : ''}`);
        if (!DRY_RUN) await updateEntry(token, row, note, false);
        continue;
      }

      const key = `${route.script}:${row.date}`;
      if (counts.get(key) > 1) {
        const note = `Autopost dilewati: lebih dari satu konten ${row.platform} ${row.format} pada ${row.date}; proses manual diperlukan`;
        console.log(`- ${row.date} ${row.platform}/${row.format} "${row.title || ''}": LEWATI — tanggal ambigu, --only hanya menangani satu posting${DRY_RUN ? '' : '; catatan dicatat'}`);
        if (!DRY_RUN) await updateEntry(token, row, note, false);
        continue;
      }

      const args = [path.join(DIR, route.script), '--only', String(row.date), '--skip-sync'];
      if (jam) args.push('--jam', jam);
      console.log(`- ${row.date} ${row.platform}/${row.format} "${row.title || ''}": node ${route.script} --only ${row.date}${timeArg} --skip-sync${DRY_RUN ? ' [rencana saja; skrip tidak dijalankan]' : ''}`);
      if (DRY_RUN) continue;

      const result = spawnSync(process.execPath, args, {
        cwd: DIR,
        encoding: 'utf8',
        timeout: 15 * 60 * 1000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const outcome = classifyExecution(result);
      if (outcome.output.trim()) process.stdout.write(outcome.output);
      if (outcome.scheduled) {
        const at = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });
        const note = `Terjadwal otomatis ${at} WIB${outcome.checked ? ' (cek manual; jangan retry otomatis)' : ''}`;
        await updateEntry(token, row, note, true);
        console.log(`  Status Kelola.in: Scheduled${outcome.checked ? ' — cek manual, tidak akan diulang' : ''}`);
      } else {
        const reason = outcome.reason.replace(/\s+/g, ' ').slice(0, 240);
        await updateEntry(token, row, `Autopost gagal: ${reason}`, false);
        console.log(`  Status tetap Approved; alasan dicatat: ${reason}`);
      }
    }
    console.log(DRY_RUN ? 'Dry-run selesai; tidak ada perubahan database dan skrip jadwal tidak dijalankan.' : 'Pemrosesan selesai.');
  } finally {
    releaseLock();
  }
}

main().catch(error => {
  console.error(`Jembatan gagal: ${error.message}`);
  process.exitCode = 1;
});
