import test from 'node:test';
import assert from 'node:assert/strict';
import { SEARCH_QUERIES, buildLeadDigest, classifyLead, formatLeadDigest, normalizePostUrl, selectNewLeads } from './threads-leads.mjs';

test('search terms cover direct requests, occasions, affordability, and mini sizes', () => {
  for (const phrase of [
    'minta rekomendasi parfum',
    'parfum buat ngantor',
    'parfum buat kuliah',
    'parfum buat date',
    'parfum cowok murah',
    'parfum mini atau sample',
  ]) assert.ok(SEARCH_QUERIES.includes(phrase), `missing search phrase: ${phrase}`);
});

test('accepts explicit buyer questions and marks dynamic facts for human verification', () => {
  const lead = classifyLead({
    url: '/@publicuser/post/abc123',
    text: '@publicuser 2h | Minta rekomendasi parfum cowok buat ngantor? Budget berapa ya?',
    age: '2h',
  });
  assert.equal(lead.intent, 'kantor');
  assert.equal(lead.needsFactCheck, true);
  assert.equal(lead.context, 'Minta rekomendasi parfum cowok buat ngantor? Budget berapa ya?');
  assert.equal(lead.url, 'https://www.threads.com/@publicuser/post/abc123');
});

test('rejects non-buyer posts, unrelated questions, and stale results', () => {
  const url = 'https://www.threads.com/@someone/post/abc';
  assert.equal(classifyLead({ url, text: 'Aku rekomen parfum ini, cek bio ya!' }), null);
  assert.equal(classifyLead({ url, text: 'Ada rekomendasi laptop buat kuliah?' }), null);
  assert.equal(classifyLead({ url, text: 'Minta rekomendasi parfum cowok?', age: '3w' }), null);
  assert.equal(classifyLead({ url, text: 'Minta rekomendasi parfum cowok?', age: '3 minggu yang lalu' }), null);
});

test('canonicalizes valid public post links and rejects other hosts', () => {
  assert.equal(normalizePostUrl('https://www.threads.com/@u/post/id/media?x=1'), 'https://www.threads.com/@u/post/id');
  assert.equal(normalizePostUrl('https://example.com/@u/post/id'), null);
  assert.equal(normalizePostUrl('/@u/post/id#reply'), 'https://www.threads.com/@u/post/id');
});

test('deduplicates normalized URLs across query results and prior reports, then ranks leads', () => {
  const posts = [
    { url: '/@u/post/one?x=1', text: 'Ada parfum buat kantor yang cocok?' },
    { url: 'https://www.threads.com/@u/post/one', text: 'Ada parfum buat kantor yang cocok?' },
    { url: '/@u/post/two', text: 'Minta rekomendasi parfum cowok buat date? Budget berapa?' },
    { url: '/@u/post/old', text: 'Minta rekomendasi parfum cowok?', age: '2d' },
  ];
  const fresh = selectNewLeads(posts, ['https://www.threads.com/@u/post/old/media']);
  assert.deepEqual(fresh.map(item => item.url), [
    'https://www.threads.com/@u/post/two',
    'https://www.threads.com/@u/post/one',
  ]);
});

test('digest includes public context, URLs, human fact-check flag, and safe-response reminders', () => {
  const leads = selectNewLeads([
    { url: '/@u/post/one', text: 'Harga parfum mini berapa ya?' },
    { url: '/@u/post/two', text: 'Rekomendasi parfum buat kuliah?' },
  ]);
  const digest = formatLeadDigest(leads);
  assert.match(digest, /https:\/\/www\.threads\.com\/@u\/post\/one/);
  assert.match(digest, /cek harga\/stok ke Dani/);
  assert.match(digest, /Balas manual, bantu dulu/);
  assert.doesNotMatch(digest, /tahan \d+ jam|Rp ?\d|shopee|kompetitor/i);
});

test('digest only returns the leads actually included within its limit', () => {
  const leads = selectNewLeads([
    { url: '/@u/post/one', text: 'Minta rekomendasi parfum buat kantor?' },
    { url: '/@u/post/two', text: 'Minta rekomendasi parfum buat kampus?' },
  ]);
  const digest = buildLeadDigest(leads, { maxChars: 240 });
  assert.equal(digest.included.length, 1);
  assert.ok(digest.text.includes(digest.included[0].url));
});
