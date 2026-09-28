#!/usr/bin/env node

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Baca environment variables
const supabaseUrl = 'https://ktltnhtetmkmwezxekac.supabase.co';
const supabaseKey = process.env.SUPABASE_ACCESS_TOKEN || '';

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_ACCESS_TOKEN environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Workspace SCNTR
const WORKSPACE_NAME = 'SCNTR';

async function getWorkspaceId() {
  if (global.workspaceId) return global.workspaceId;
  
  const { data, error } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', WORKSPACE_NAME)
    .single();
  
  if (error) {
    console.error(`❌ Error finding workspace ${WORKSPACE_NAME}:`, error.message);
    throw error;
  }
  
  global.workspaceId = data.id;
  console.log(`✅ Found workspace ${WORKSPACE_NAME} with ID: ${global.workspaceId}`);
  return global.workspaceId;
}

// Escape HTML entities untuk teks dari web
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function processFile(filePath) {
  try {
    console.log(`📁 Processing file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return;
    }

    const rawData = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(rawData);
    
    console.log(`📊 Found ${data.length} competitor accounts in file`);

    const workspaceId = await getWorkspaceId();
    const today = new Date().toISOString().split('T')[0];
    
    let totalAccounts = 0;
    let totalSnapshots = 0;
    let totalPosts = 0;
    let skippedPosts = 0;

    for (const account of data) {
      try {
        console.log(`\n🔄 Processing account: ${account.handle} (${account.platform})`);
        
        // Upsert account
        const { data: accountData, error: accountError } = await supabase
          .from('competitor_accounts')
          .upsert({
            workspace_id: workspaceId,
            platform: account.platform,
            handle: account.handle,
            name: account.name,
            url: account.url,
            active: true
          })
          .select()
          .single();

        if (accountError) {
          console.error(`❌ Error upserting account ${account.handle}:`, accountError.message);
          continue;
        }
        
        totalAccounts++;
        console.log(`✅ Account ${account.handle} upserted successfully`);
        
        // Upsert snapshot
        const { data: snapshotData, error: snapshotError } = await supabase
          .from('competitor_snapshots')
          .upsert({
            account_id: accountData.id,
            taken_at: today,
            followers: account.followers || 0,
            posts_count: account.posts_count || 0,
            avg_views_10: 0,
            median_views_10: 0,
            avg_likes_10: 0,
            engagement_rate: 0.00
          })
          .select()
          .single();

        if (snapshotError) {
          console.error(`❌ Error upserting snapshot for account ${accountData.id}:`, snapshotError.message);
          continue;
        }
        
        totalSnapshots++;
        console.log(`✅ Snapshot for account ${accountData.id} on ${today} upserted successfully`);
        
        // Upsert posts
        for (const post of account.posts || []) {
          try {
            const { data: postData, error: postError } = await supabase
              .from('competitor_posts')
              .upsert({
                account_id: accountData.id,
                url: post.url,
                posted_at: post.posted_at || new Date().toISOString(),
                views: post.views || 0,
                likes: post.likes || 0,
                comments: post.comments || 0,
                caption: escapeHtml(post.caption),
                format: post.format || 'video'
              })
              .select()
              .single();

            if (postError) {
              if (postError.code === '23505') {
                // Unique constraint violation - post already exists
                skippedPosts++;
                continue;
              }
              console.error(`❌ Error upserting post ${post.url}:`, postError.message);
              skippedPosts++;
            } else {
              totalPosts++;
            }
          } catch (err) {
            console.error(`❌ Error processing post ${post.url}:`, err.message);
            skippedPosts++;
          }
        }
        
        console.log(`✅ Account ${account.handle} processed: ${totalPosts - skippedPosts} posts upserted, ${skippedPosts} skipped`);
        
      } catch (err) {
        console.error(`❌ Error processing account ${account.handle}:`, err.message);
      }
    }

    // Print summary
    console.log('\n📊 SUMMARY');
    console.log('=====================================');
    console.log(`Total accounts processed: ${totalAccounts}`);
    console.log(`Total snapshots created: ${totalSnapshots}`);
    console.log(`Total posts upserted: ${totalPosts}`);
    console.log(`Total posts skipped (duplicates): ${skippedPosts}`);
    console.log('=====================================');

    return {
      totalAccounts,
      totalSnapshots,
      totalPosts,
      skippedPosts
    };

  } catch (error) {
    console.error('❌ Fatal error processing file:', error.message);
    throw error;
  }
}

// Main execution
const args = process.argv.slice(2);
const filePath = args[0] || '/Users/dani/Projects/SCNTR_Projects/_kerja/pantau/hasil-tiktok-2026-09-28.json';

console.log('🚀 Starting competitor data upload...');

processFile(filePath)
  .then(summary => {
    console.log('\n✅ Upload completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Upload failed:', error.message);
    process.exit(1);
  });