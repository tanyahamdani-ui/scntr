#!/usr/bin/env node

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { exec } = require('child_process');

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
  const { data, error } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', WORKSPACE_NAME)
    .single();
  
  if (error) {
    console.error(`❌ Error finding workspace ${WORKSPACE_NAME}:`, error.message);
    throw error;
  }
  
  return data.id;
}

// Format tanggal untuk laporan
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Format angka dengan titik sebagai pemisah ribuan
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

async function generateWeeklyReport() {
  try {
    const workspaceId = await getWorkspaceId();
    const today = new Date().toISOString().split('T')[0];
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`📊 Generating weekly report for ${WORKSPACE_NAME}`);
    console.log(`Period: ${formatDate(oneWeekAgo)} - ${formatDate(today)}`);
    
    // Get all competitor accounts for this workspace
    const { data: accounts, error: accountsError } = await supabase
      .from('competitor_accounts')
      .select('id, handle, name, platform')
      .eq('workspace_id', workspaceId);
    
    if (accountsError) {
      console.error('❌ Error fetching accounts:', accountsError.message);
      throw accountsError;
    }
    
    if (!accounts || accounts.length === 0) {
      return "📊 Tidak ada akun kompetitor yang terdaftar untuk SCNTR.";
    }
    
    let report = `📊 Laporan Mingguan Pantau Kompetitor - ${WORKSPACE_NAME}\n`;
    report += `Periode: ${formatDate(oneWeekAgo)} - ${formatDate(today)}\n`;
    report += `${'='.repeat(50)}\n\n`;
    
    for (const account of accounts) {
      try {
        // Get latest snapshot
        const { data: latestSnapshot, error: snapshotError } = await supabase
          .from('competitor_snapshots')
          .select('*')
          .eq('account_id', account.id)
          .order('taken_at', { ascending: false })
          .limit(1)
          .single();
        
        if (snapshotError) {
          console.warn(`⚠️ No snapshot found for ${account.handle}`);
          continue;
        }
        
        // Get snapshot from one week ago
        const { data: weekAgoSnapshot, error: weekAgoError } = await supabase
          .from('competitor_snapshots')
          .select('*')
          .eq('account_id', account.id)
          .eq('taken_at', oneWeekAgo)
          .single();
        
        // Calculate follower change
        const followerChange = weekAgoSnapshot 
          ? latestSnapshot.followers - weekAgoSnapshot.followers
          : 0;
        
        const followerChangeText = followerChange > 0 
          ? `📈 +${formatNumber(followerChange)}`
          : followerChange < 0 
          ? `📈 ${formatNumber(followerChange)}`
          : '➡️ 0';
        
        // Get posts from this week
        const { data: weeklyPosts, error: postsError } = await supabase
          .from('competitor_posts')
          .select('*')
          .eq('account_id', account.id)
          .gte('posted_at', oneWeekAgo + 'T00:00:00.000Z')
          .lte('posted_at', today + 'T23:59:59.999Z');
        
        if (postsError) {
          console.warn(`⚠️ Error fetching posts for ${account.handle}:`, postsError.message);
          continue;
        }
        
        // Get top 3 posts by views
        const topPosts = weeklyPosts
          ? weeklyPosts
              .sort((a, b) => (b.views || 0) - (a.views || 0))
              .slice(0, 3)
              .map(post => `• ${formatNumber(post.views || 0)} views: ${post.url}`)
              .join('\n')
          : 'Tidak ada data postingan';
        
        // Get median views from latest snapshot
        const medianViews = latestSnapshot.median_views_10 || 0;
        
        report += `📱 ${account.name} (@${account.handle})\n`;
        report += `   Platform: ${account.platform.toUpperCase()}\n`;
        report += `   Followers: ${formatNumber(latestSnapshot.followers)} ${followerChangeText}\n`;
        report += `   Postingan minggu ini: ${weeklyPosts ? weeklyPosts.length : 0}\n`;
        report += `   Median views (10 terbaru): ${formatNumber(medianViews)}\n`;
        report += `   3 Postingan terbaik:\n${topPosts}\n\n`;
        
      } catch (err) {
        console.error(`❌ Error processing account ${account.handle}:`, err.message);
      }
    }
    
    // Add summary
    const totalAccounts = accounts.length;
    const totalFollowers = accounts.reduce((sum, acc) => {
      const latestSnapshot = accounts.find(a => a.id === acc.id)?.latestSnapshot;
      return sum + (latestSnapshot?.followers || 0);
    }, 0);
    
    report += `${'='.repeat(50)}\n`;
    report += `📈 Ringkasan:\n`;
    report += `• Total akun dipantau: ${totalAccounts}\n`;
    report += `• Total followers: ${formatNumber(totalFollowers)}\n`;
    report += `• Dilaporkan pada: ${formatDate(today)}\n`;
    
    return report;
    
  } catch (error) {
    console.error('❌ Error generating report:', error.message);
    throw error;
  }
}

async function sendToTelegram(message) {
  try {
    // Import the telegram reporter
    const telegramPath = '/Users/dani/Projects/SCNTR_Projects/tools/lapor-telegram.mjs';
    
    if (!fs.existsSync(telegramPath)) {
      console.error('❌ Telegram reporter not found:', telegramPath);
      return false;
    }
    
    // Create a temporary file with the message
    const tempFile = '/tmp/telegram-report.txt';
    fs.writeFileSync(tempFile, message);
    
    // Execute the telegram script
    const { exec } = await import('child_process');
    return new Promise((resolve, reject) => {
      exec(`node ${telegramPath} "${message.replace(/"/g, '\\"')}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Telegram send error:', stderr);
          reject(error);
        } else {
          console.log('✅ Report sent to Telegram:', stdout.trim());
          resolve(true);
        }
      });
    });
    
  } catch (error) {
    console.error('❌ Error sending to Telegram:', error.message);
    return false;
  }
}

async function main() {
  try {
    console.log('🚀 Starting weekly competitor monitoring report...');
    
    // Generate report
    const report = await generateWeeklyReport();
    
    console.log('\n📄 Generated Report:');
    console.log(report);
    console.log('\n' + '='.repeat(50));
    
    // Send to Telegram
    console.log('\n📱 Sending report to Telegram...');
    const sent = await sendToTelegram(report);
    
    if (sent) {
      console.log('✅ Report successfully sent to Telegram!');
      
      // Also save to local file
      const reportFile = '/Users/dani/Projects/SCNTR_Projects/_kerja/laporan-qwen.md';
      const timestamp = new Date().toISOString();
      const localReport = `# Laporan Pantau Kompetitor - ${WORKSPACE_NAME}\n\n`;
      localReport += `**Waktu:** ${timestamp}\n\n`;
      localReport += report;
      
      fs.writeFileSync(reportFile, localReport);
      console.log(`✅ Report saved to: ${reportFile}`);
      
    } else {
      console.log('❌ Failed to send report to Telegram');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error in main process:', error.message);
    process.exit(1);
  }
}

// Handle execution
if (require.main === module) {
  main();
}