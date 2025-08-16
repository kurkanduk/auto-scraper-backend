#!/usr/bin/env node

/**
 * Debug Chrome/Puppeteer setup
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const { execSync } = require('child_process');

async function debugChrome() {
  console.log('🔍 Debugging Chrome/Puppeteer setup...\n');
  
  // Check if Chrome is installed
  console.log('1. Checking Chrome installations:');
  const chromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium'
  ];
  
  for (const path of chromePaths) {
    if (fs.existsSync(path)) {
      console.log(`  ✅ Found Chrome at: ${path}`);
    }
  }
  
  // Check Puppeteer installation
  console.log('\n2. Checking Puppeteer:');
  try {
    const puppeteerVersion = require('puppeteer/package.json').version;
    console.log(`  ✅ Puppeteer version: ${puppeteerVersion}`);
  } catch (e) {
    console.log(`  ❌ Puppeteer not found: ${e.message}`);
  }
  
  // Try to launch browser
  console.log('\n3. Attempting to launch browser:');
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI'
      ]
    });
    
    console.log('  ✅ Browser launched successfully');
    
    const page = await browser.newPage();
    await page.goto('https://httpbin.org/ip', { waitUntil: 'networkidle2' });
    const content = await page.content();
    console.log('  ✅ Page loaded successfully');
    console.log(`  📄 Content length: ${content.length} characters`);
    
    await browser.close();
    console.log('  ✅ Browser closed successfully');
    
  } catch (error) {
    console.log(`  ❌ Browser launch failed: ${error.message}`);
    
    // Try with bundled Chromium
    console.log('\n4. Trying with bundled Chromium:');
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('  ✅ Bundled Chromium works');
      await browser.close();
    } catch (e) {
      console.log(`  ❌ Bundled Chromium failed: ${e.message}`);
    }
  }
  
  console.log('\n🎯 Debug complete!');
}

debugChrome().catch(console.error);