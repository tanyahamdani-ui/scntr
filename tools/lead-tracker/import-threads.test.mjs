import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('import command explicitly imports a saved Threads search export idempotently', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scntr-import-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'search.json');
  const store = path.join(dir, 'leads.json');
  fs.writeFileSync(input, `LEADS_JSON:${JSON.stringify([
    { url: 'https://www.threads.com/@public/post/id', context: 'Minta rekomendasi parfum?' },
  ])}`);
  const script = fileURLToPath(new URL('./import-threads.mjs', import.meta.url));
  const env = { ...process.env, SCNTR_LEADS_FILE: store };
  assert.match(execFileSync(process.execPath, [script, input], { encoding: 'utf8', env }), /1 ditambahkan, 0 duplikat/);
  assert.match(execFileSync(process.execPath, [script, input], { encoding: 'utf8', env }), /0 ditambahkan, 1 duplikat/);
  const saved = JSON.parse(fs.readFileSync(store, 'utf8'));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].context, 'Minta rekomendasi parfum?');
  assert.equal(saved[0].source, 'Threads');
});
