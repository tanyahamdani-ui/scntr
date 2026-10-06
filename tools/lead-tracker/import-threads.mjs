#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { importThreadsLeads, parseThreadsExport } from './store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA_FILE = process.env.SCNTR_LEADS_FILE || path.join(ROOT, '_kerja/lead-tracker/leads.json');

export function importFile(inputPath, dataPath = DATA_FILE) {
  if (!inputPath) throw new Error('Berikan path file ekspor Threads atau state lama.');
  const absolutePath = path.resolve(inputPath);
  const contents = fs.readFileSync(absolutePath);
  const items = parseThreadsExport(contents);
  return importThreadsLeads(items, dataPath);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = importFile(process.argv[2]);
    console.log(`Impor Threads selesai: ${result.imported} ditambahkan, ${result.duplicates} duplikat dilewati.`);
  } catch (error) {
    console.error(`Impor gagal: ${error.message}`);
    process.exitCode = 1;
  }
}
