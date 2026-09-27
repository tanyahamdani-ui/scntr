#!/usr/bin/env node
'use strict';

import fs from 'fs';
import { CDP, evalJs } from '/Users/dani/Projects/SCNTR_Projects/tools/upload-tiktok/cdp.mjs';

const VIDEO_PATH = '/Users/dani/Projects/SCNTR_Projects/SCNTR Upload TikTok 29 Okt - 4 Nov/1 Rabu 29 Okt - parfum expired tanda-tandanya.mp4';

async function testBusinessSuite(cdp) {
  console.log('\n=== TEST META BUSINESS SUITE ===');
  
  // Navigate to composer
  await cdp.send('Page.navigate', { 
    url: 'https://business.facebook.com/latest/composer/?asset_type=instagram_reels&business_id=1550799643383762' 
  });
  await new Promise(r => setTimeout(r, 5000));
  
  // Enable file chooser interception
  await cdp.send('Page.setInterceptFileChooserDialog', { enabled: true });
  console.log('✓ File chooser interception enabled');
  
  // Listen for ALL events to see what fires
  const events = [];
  cdp.ws.addEventListener('message', (ev) => {
    try {
      const m = JSON.parse(ev.data);
      if (m.method && (m.method.includes('file') || m.method.includes('dialog'))) {
        events.push(m.method);
        console.log('Event:', m.method, JSON.stringify(m.params).slice(0, 200));
      }
    } catch (e) {
      // Ignore parse errors
    }
  });
  
  // Find and click "Add photo/video" button
  await cdp.send('Runtime.evaluate', { 
    expression: 'document.evaluate("//button[contains(., \\"Add photo/video\\")]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.click(); true',
    awaitPromise: true 
  });
  console.log('✓ Clicked "Add photo/video"');
  
  // Wait and check events
  await new Promise(r => setTimeout(r, 5000));
  console.log('Events captured:', events);
  
  // Try alternative: use DOM.getDocument to find the input that appeared
  const doc = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  console.log('Document root:', doc.root.nodeId);
  
  // Search for file input in DOM after click
  const inputs = await cdp.send('DOM.querySelectorAll', {
    nodeId: doc.root.nodeId,
    selector: 'input[type=file]'
  });
  console.log('File inputs after click:', inputs);
  
  if (inputs.nodeIds && inputs.nodeIds.length > 0) {
    const nodeId = inputs.nodeIds[0];
    await cdp.send('DOM.setFileInputFiles', {
      files: ['/Users/dani/Projects/SCNTR_Projects/SCNTR Upload TikTok 29 Okt - 4 Nov/1 Rabu 29 Okt - parfum expired tanda-tandanya.mp4'],
      nodeId: nodeId
    });
    console.log('✓ File set via nodeId');
    await new Promise(r => setTimeout(r, 5000));
    return true;
  }
  
  return false;
}

async function testInstagramCom(cdp) {
  console.log('\n=== TEST INSTAGRAM.COM (FALLBACK) ===');
  
  await cdp.send('Page.navigate', { url: 'https://www.instagram.com/create/select/' });
  await new Promise(r => setTimeout(r, 5000));
  
  // Get document and find file input
  const doc = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  console.log('Instagram doc root:', doc.root.nodeId);
  
  const inputs = await cdp.send('DOM.querySelectorAll', {
    nodeId: doc.root.nodeId,
    selector: 'input[type=file]'
  });
  console.log('Instagram file inputs:', inputs);
  
  if (inputs.nodeIds && inputs.nodeIds.length > 0) {
    const nodeId = inputs.nodeIds[0];
    await cdp.send('DOM.setFileInputFiles', {
      files: ['/Users/dani/Projects/SCNTR_Projects/SCNTR Upload TikTok 29 Okt - 4 Nov/1 Rabu 29 Okt - parfum expired tanda-tandanya.mp4'],
      nodeId: nodeId
    });
    console.log('✓ File set via nodeId on instagram.com');
    await new Promise(r => setTimeout(r, 5000));
    return true;
  }
  
  return false;
}

async function main() {
  if (!fs.existsSync('/Users/dani/Projects/SCNTR_Projects/SCNTR Upload TikTok 29 Okt - 4 Nov/1 Rabu 29 Okt - parfum expired tanda-tandanya.mp4')) {
    console.error('Video not found');
    process.exit(1);
  }
  
  console.log('Video exists:', true);
  
  // Connect to Chrome
  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  // Prioritize Business Suite tab
  let metaTab = list.find(x => x.url.includes('business.facebook.com'));
  if (!metaTab) metaTab = list.find(x => x.url.includes('instagram.com'));
  
  if (!metaTab) {
    console.error('No Meta/Instagram tab found');
    process.exit(1);
  }
  
  console.log('Found tab:', metaTab.title);
  const cdp = await CDP.attach(metaTab.id);
  
  try {
    // Test 1: Meta Business Suite with DOM query after click
    try {
      const success = await testBusinessSuite(cdp);
      if (success) {
        console.log('\n✅ SUCCESS: Business Suite DOM query worked!');
        return;
      }
    } catch (e) {
      console.log('\n⚠ Business Suite failed:', e.message);
    }
    
    // Test 2: instagram.com fallback with DOM query
    try {
      const success = await testInstagramCom(cdp);
      if (success) {
        console.log('\n✅ SUCCESS: instagram.com DOM query worked!');
        return;
      }
    } catch (e) {
      console.log('\n⚠ instagram.com failed:', e.message);
    }
    
    console.log('\n❌ ALL METHODS FAILED');
  } finally {
    cdp.close();
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });