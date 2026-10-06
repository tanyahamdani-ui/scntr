import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('serves dashboard and local API with persistent lead data', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scntr-lead-server-'));
  const dataFile = path.join(dir, 'leads.json');
  process.env.SCNTR_LEADS_FILE = dataFile;
  const { startServer } = await import(`./server.mjs?test=${Date.now()}`);
  const server = startServer({ port: 0, host: '127.0.0.1' });
  t.after(async () => {
    delete process.env.SCNTR_LEADS_FILE;
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Lead tracker/);
  assert.match(await (await fetch(`${base}/app.js`)).text(), /lead-form/);

  const created = await fetch(`${base}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'Threads',
      url: 'https://www.threads.com/@public/post/1',
      context: 'Minta saran parfum?',
    }),
  });
  assert.equal(created.status, 201);
  const { lead } = await created.json();
  assert.equal(lead.status, 'new');
  const list = await fetch(`${base}/api/leads`);
  assert.equal((await list.json()).leads[0].id, lead.id);
  assert.equal(fs.existsSync(dataFile), true);
});

test('refuses binding the tracker on a non-loopback interface', async () => {
  const { startServer } = await import('./server.mjs');
  assert.throws(() => startServer({ host: '0.0.0.0' }), /loopback/);
});
