import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLead, listLeads, normalizePublicUrl, updateLead } from './store.mjs';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scntr-leads-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'leads.json');
}

const sample = {
  source: 'Threads',
  url: 'https://www.threads.com/@public/post/abc123',
  context: 'Minta rekomendasi parfum buat kantor?',
};

test('creates a lead in the new stage and persists minimum public context', t => {
  const file = fixture(t);
  const lead = createLead(sample, file);
  assert.equal(lead.status, 'new');
  assert.equal(lead.source, sample.source);
  assert.equal(lead.url, sample.url);
  assert.equal(lead.context, sample.context);
  assert.equal(lead.notes, '');
  assert.equal(listLeads(file)[0].id, lead.id);
  assert.match(fs.readFileSync(file, 'utf8'), /createdAt/);
});

test('prevents duplicate public URLs after canonicalizing fragments and trailing slash', t => {
  const file = fixture(t);
  createLead(sample, file);
  assert.throws(
    () => createLead({ ...sample, url: `${sample.url}/?utm_source=thread#reply` }, file),
    /sudah ada/,
  );
  assert.equal(listLeads(file).length, 1);
});

test('validates source, URL protocol/public host, and required public context', t => {
  const file = fixture(t);
  assert.throws(() => createLead({ ...sample, source: 'Email' }, file), /sumber/);
  assert.throws(() => createLead({ ...sample, url: 'http://threads.com/@a/post/1' }, file), /HTTPS/);
  assert.throws(() => normalizePublicUrl('https://localhost/path'), /HTTPS/);
  assert.throws(() => normalizePublicUrl('https://127.0.0.1/path'), /HTTPS/);
  assert.throws(() => createLead({ ...sample, context: '  ' }, file), /Konteks/);
});

test('enforces stage transitions, permits outcome notes, and persists updates', t => {
  const file = fixture(t);
  let lead = createLead(sample, file);
  assert.throws(() => updateLead(lead.id, { status: 'ordered' }, file), /tidak diizinkan/);
  lead = updateLead(lead.id, { status: 'reviewed' }, file);
  lead = updateLead(lead.id, { status: 'replied', notes: 'Dijawab manual; minta info ukuran mini.' }, file);
  lead = updateLead(lead.id, { status: 'interested' }, file);
  lead = updateLead(lead.id, { status: 'ordered' }, file);
  assert.equal(lead.status, 'ordered');
  assert.equal(lead.notes, 'Dijawab manual; minta info ukuran mini.');
  assert.equal(listLeads(file)[0].status, 'ordered');
  assert.throws(() => updateLead(lead.id, { status: 'new' }, file), /tidak diizinkan/);
});

test('only status and notes may change; notes can be cleared', t => {
  const file = fixture(t);
  const lead = createLead(sample, file);
  updateLead(lead.id, { notes: 'Follow-up nanti' }, file);
  const updated = updateLead(lead.id, { notes: '' }, file);
  assert.equal(updated.notes, '');
  assert.throws(() => updateLead(lead.id, { url: 'https://other.com' }, file), /Hanya status dan catatan/);
  assert.throws(() => updateLead('missing', { notes: 'x' }, file), /ID lead tidak valid/);
});
