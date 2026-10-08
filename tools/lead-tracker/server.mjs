#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createLead, listLeads, updateLead } from './store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA_FILE = process.env.SCNTR_LEADS_FILE || path.join(ROOT, '_kerja/lead-tracker/leads.json');
const UI_FILE = path.join(ROOT, 'tools/lead-tracker/index.html');
const APP_FILE = path.join(ROOT, 'tools/lead-tracker/app.js');
const PORT = Number(process.env.PORT || 4177);
const MAX_BODY = 16 * 1024;

function send(response, status, body, type = 'application/json; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
  });
  response.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > MAX_BODY) throw new Error('Ukuran permintaan terlalu besar.');
  }
  try {
    return JSON.parse(body || '{}');
  } catch {
    throw new Error('Format JSON tidak valid.');
  }
}

function requestHandler(request, response) {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/api/leads' && request.method === 'GET') {
    return send(response, 200, { leads: listLeads(DATA_FILE) });
  }
  if (url.pathname === '/api/leads' && request.method === 'POST') {
    return readBody(request).then(body => send(response, 201, { lead: createLead(body, DATA_FILE) }))
      .catch(error => send(response, 400, { error: error.message }));
  }
  const match = url.pathname.match(/^\/api\/leads\/([0-9a-f-]{36})$/i);
  if (match && request.method === 'PATCH') {
    return readBody(request).then(body => send(response, 200, { lead: updateLead(match[1], body, DATA_FILE) }))
      .catch(error => {
        const status = /tidak ditemukan/.test(error.message) ? 404 : 400;
        send(response, status, { error: error.message });
      });
  }
  if (request.method === 'GET' && url.pathname === '/') {
    return fs.readFile(UI_FILE, 'utf8', (error, html) => {
      if (error) return send(response, 500, { error: 'Halaman tracker tidak dapat dibaca.' });
      send(response, 200, html, 'text/html; charset=utf-8');
    });
  }
  if (request.method === 'GET' && url.pathname === '/app.js') {
    return fs.readFile(APP_FILE, 'utf8', (error, script) => {
      if (error) return send(response, 500, { error: 'Skrip tracker tidak dapat dibaca.' });
      send(response, 200, script, 'text/javascript; charset=utf-8');
    });
  }
  if (url.pathname.startsWith('/api/')) return send(response, 404, { error: 'Endpoint tidak ditemukan.' });
  send(response, 404, { error: 'Halaman tidak ditemukan.' });
}

export function startServer({ port = PORT, host = '127.0.0.1' } = {}) {
  if (host !== '127.0.0.1' && host !== '::1' && host !== 'localhost') {
    throw new Error('Tracker hanya boleh diakses dari perangkat ini (loopback).');
  }
  const server = http.createServer((request, response) => {
    try {
      const result = requestHandler(request, response);
      if (result?.catch) result.catch(error => send(response, 500, { error: error.message }));
    } catch (error) {
      send(response, 500, { error: error.message });
    }
  });
  server.listen(port, host, () => {
    const address = server.address();
    console.log(`SCNTR Lead Tracker: http://${host}:${typeof address === 'object' ? address.port : port} (lokal saja)`);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startServer();
}
