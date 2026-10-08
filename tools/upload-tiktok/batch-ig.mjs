#!/usr/bin/env node
'use strict';

import fs from 'fs';
import path from 'path';
import { CDP, evalJs } from '/Users/dani/Projects/SCNTR_Projects/tools/upload-tiktok/cdp.mjs';

const STATE_FILE = '/Users/dani/Projects/SCNTR_Projects/scntr-marketing/.ig-post-state.json';
const ROOT_DIR = '/Users/dani/Projects/SCNTR_Projects/';
const MAX_POSTS_PER_RUN = 3;
const SCREENSHOT_DIR = '/Users/dani/Projects/SCNTR_Projects/_kerja';

const MONTH_MAP = {
  'Januari': 1, 'Jan': 1, 'Februari': 2, 'Feb': 2, 'Maret': 3, 'Mar': 3,
  'April': 4, 'Apr': 4, 'Mei': 5, 'Jun': 6, 'Juni': 6, 'Juli': 7, 'Jul': 7,
  'Agustus': 8, 'Agu': 8, 'September': 9, 'Sep': 9, 'Oktober': 10, 'Okt': 10, 'Ok': 10,
  'November': 11, 'Nov': 11, 'Desember': 12, 'Des': 12
};

function parseDateFromFilename(filename) {
  const match = filename.match(/^(\d+)\s+\w+\s+(\d+)\s+(\w+)/);
  if (!match) return null;
  const day = parseInt(match[2]);
  const monthName = match[3];
  const month = MONTH_MAP[monthName];
  if (!month) return null;
  const year = 2026;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
  return { posted: [] };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function isPosted(state, videoId) {
  return state.posted.some(p => p.id === videoId);
}

async function waitForEvent(cdp, method, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${method}`)), timeout);
    cdp.ws.addEventListener('message', function handler(ev) {
      const m = JSON.parse(ev.data);
      if (m.method === method) {
        clearTimeout(timer);
        cdp.ws.removeEventListener('message', handler);
        resolve(m.params);
      }
    });
  });
}

async function uploadVideo(cdp, videoPath, caption, scheduledDate, dryRun = false) {
  console.log(`
--- Processing: ${path.basename(videoPath)} ---`);
  console.log(`Date: ${scheduledDate} 19:00`);
  
  await cdp.send('Page.navigate', { 
    url: 'https://business.facebook.com/latest/composer/?asset_type=instagram_reels&business_id=1550799643383762' 
  });
  await new Promise(r => setTimeout(r, 8000));
  
  const pageText = await evalJs(cdp, 'document.body.innerText.slice(0, 500)');
  console.log('Page loaded:', pageText.result?.value?.slice(0, 200));
  
  const buttons = await cdp.send('Runtime.evaluate', {
    expression: 'JSON.stringify([...document.querySelectorAll("button, [role=button]"]).map(b => b.innerText.trim()).filter(Boolean).filter(x => x.length < 50))',
    awaitPromise: true
  });
  console.log('Buttons found:', buttons.result?.value);
  
  await cdp.send('Page.setInterceptFileChooserDialog', { enabled: true });
  console.log('✓ File chooser interception enabled');
  
  const btnCheck = await cdp.send('Runtime.evaluate', {
    expression: 'document.evaluate("//button[contains(., "Add photo/video")]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue ? "found" : "not found"',
    awaitPromise: true
  });
  console.log('Button check:', btnCheck.result?.value);
  
  await cdp.send('Runtime.evaluate', { 
    expression: 'document.evaluate("//button[contains(., "Add photo/video")]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.click(); true',
    awaitPromise: true 
  });
  console.log('✓ Clicked "Add photo/video"');
  
  await new Promise(r => setTimeout(r, 4000));
  
  const doc = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const inputs = await cdp.send('DOM.querySelectorAll', {
    nodeId: doc.root.nodeId,
    selector: 'input[type=file]'
  });
  console.log('File inputs in DOM after click:', inputs.nodeIds?.length || 0);
  
  if (inputs.nodeIds && inputs.nodeIds.length > 0) {
    console.log('✓ File input found in DOM, using nodeId directly');
    const nodeId = inputs.nodeIds[0];
    await cdp.send('DOM.setFileInputFiles', {
      files: [videoPath],
      nodeId: nodeId
    });
    console.log('✓ File set via nodeId');
    await new Promise(r => setTimeout(r, 5000));
    
    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'ig-dryrun.png'), Buffer.from(screenshot.result.data, 'base64'));
    console.log('✓ Screenshot saved to _kerja/ig-dryrun.png');
    
    return true;
  }
  
  console.log('No DOM input found, waiting for fileChooserOpened event...');
  try {
    const fileChooserEvent = await waitForEvent(cdp, 'Page.fileChooserOpened', 10000);
    console.log('✓ fileChooserOpened event received');
    
    const backendNodeId = fileChooserEvent.backendNodeId;
    if (!backendNodeId) {
      throw new Error('No backendNodeId in fileChooserOpened event');
    }
    
    await cdp.send('DOM.setFileInputFiles', {
      files: [videoPath],
      backendNodeId: backendNodeId
    });
    console.log('✓ File set via backendNodeId');
    await new Promise(r => setTimeout(r, 5000));
    return true;
  } catch (e) {
    console.log('fileChooserOpened timeout:', e.message);
    throw new Error('Both DOM input and fileChooserOpened failed');
  }
}

async function waitForEvent(cdp, method, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${method}`)), timeout);
    cdp.ws.addEventListener('message', function handler(ev) {
      const m = JSON.parse(ev.data);
      if (m.method === method) {
        clearTimeout(timer);
        cdp.ws.removeEventListener('message', handler);
        resolve(m.params);
      }
    });
  });
}

function parseDateFromFilename(filename) {
  const match = filename.match(/^(\d+)\s+\w+\s+(\d+)\s+(\w+)/);
  if (!match) return null;
  const day = parseInt(match[2]);
  const monthName = match[3];
  const month = MONTH_MAP[monthName];
  if (!month) return null;
  const year = 2026;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
  return { posted: [] };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function isPosted(state, videoId) {
  return state.posted.some(p => p.id === videoId);
}

function parseDateFromFilename(filename) {
  const match = filename.match(/^(\d+)\s+\w+\s+(\d+)\s+(\w+)/);
  if (!match) return null;
  const day = parseInt(match[2]);
  const monthName = match[3];
  const month = MONTH_MAP[monthName];
  if (!month) return null;
  const year = 2026;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getAllVideos() {
  const videos = [];
  const dirs = fs.readdirSync(ROOT_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('SCNTR Upload TikTok '))
    .map(entry => path.join(ROOT_DIR, entry.name));
  
  for (const dir of dirs) {
    const mp4s = fs.readdirSync(dir)
      .filter(f => f.endsWith('.mp4'))
      .map(f => ({ filename: f, path: path.join(dir, f) }));
    
    const captionPath = path.join(dir, 'CAPTION & JADWAL.txt');
    const captionContent = fs.existsSync(captionPath) ? fs.readFileSync(captionPath, 'utf8') : '';
    
    for (const mp4 of mp4s) {
      const date = parseDateFromFilename(mp4.filename);
      if (!date) continue;
      
      let caption = '';
      const sections = captionContent.split(/={50,}/);
      for (const section of sections) {
        if (section.includes(mp4.filename.split(' - ')[0].trim())) {
          const lines = section.trim().split('
');
          let inCaption = false;
          const captionLines = [];
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === 'Caption:') {
              inCaption = true;
              continue;
            }
            if (inCaption && trimmed) captionLines.push(trimmed);
          }
          caption = captionLines.join('
');
          break;
        }
      }
      
      videos.push({
        date,
        filename: mp4.filename,
        path: mp4.path,
        caption: caption || `SCNTR ${mp4.filename.replace('.mp4', '')}`,
        id: mp4.path
      });
    }
  }
  
  videos.sort((a, b) => a.date.localeCompare(b.date));
  return videos;
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
  return { posted: [] };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function isPosted(state, videoId) {
  return state.posted.some(p => p.id === videoId);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  if (dryRun) console.log('🔍 DRY RUN MODE');
  
  const state = loadState();
  const allVideos = getAllVideos();
  
  console.log(`Total videos found: ${allVideos.length}`);
  console.log(`Already posted: ${state.posted.length}`);
  
  const unposted = allVideos.filter(v => 
    !isPosted(state, v.id) && v.date >= '2026-10-01'
  );
  
  console.log(`Unposted from Oct 1: ${unposted.length}`);
  
  if (unposted.length === 0) {
    console.log('No videos to upload');
    return;
  }
  
  const toUpload = unposted.slice(0, MAX_POSTS_PER_RUN);
  console.log(`Will upload ${toUpload.length} videos:`);
  toUpload.forEach(v => console.log(`  - ${v.date}: ${v.filename}`));
  
  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const bsTab = list.find(x => x.url.includes('business.facebook.com'));
  
  if (!bsTab) {
    console.error('No Meta Business Suite tab found. Open business.facebook.com first.');
    process.exit(1);
  }
  
  console.log('Found tab:', bsTab.title);
  const cdp = await CDP.attach(bsTab.id);
  
  let successCount = 0;
  let failCount = 0;
  
  try {
    for (const video of toUpload) {
      try {
        const success = await uploadVideo(cdp, video.path, video.caption, video.date, dryRun);
        if (success) {
          successCount++;
          if (!dryRun) {
            state.posted.push({
              id: video.id,
              date: video.date,
              filename: video.filename,
              postedAt: new Date().toISOString()
            });
            saveState(state);
          }
        } else {
          failCount++;
        }
      } catch (e) {
        console.error(`Failed ${video.filename}:`, e.message);
        failCount++;
      }
      
      await new Promise(r => setTimeout(r, 3000));
    }
  } finally {
    cdp.close();
  }
  
  console.log('
=== SUMMARY ===');
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`State saved to ${STATE_FILE}`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
