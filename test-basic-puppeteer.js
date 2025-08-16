#!/usr/bin/env node

/**
 * Basic Puppeteer test to verify our configuration works
 */

const puppeteer = require('puppeteer');

async function testBasicPuppeteer() {
  console.log('🔧 Testing basic Puppeteer configuration...');
  
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
        '--disable-features=TranslateUI',
        '--disable-web-security',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
    });
    
    console.log('✅ Browser launched successfully');
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // Test with a simple page first
    console.log('📡 Testing with httpbin.org...');
    await page.goto('https://httpbin.org/ip', { waitUntil: 'networkidle2' });
    const content = await page.content();
    console.log(`✅ HTTP test successful (${content.length} chars)`);
    
    // Now test with mobile.de
    console.log('📡 Testing with mobile.de...');
    const searchUrl = 'https://suchen.mobile.de/fahrzeuge/search.html?dam=false&isSearchRequest=true&ref=quickSearch&s=Car&vc=Car';
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    
    // Check for basic elements
    const hasListings = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="fahrzeuge/details.html"]');
      const articles = document.querySelectorAll('article');
      const buttons = document.querySelectorAll('button');
      
      return {
        detailLinks: links.length,
        articles: articles.length,
        buttons: buttons.length,
        hasContent: document.body.textContent.length > 1000
      };
    });
    
    console.log('🔍 Page analysis:');
    console.log(`  Detail links: ${hasListings.detailLinks}`);
    console.log(`  Articles: ${hasListings.articles}`);
    console.log(`  Buttons: ${hasListings.buttons}`);
    console.log(`  Has content: ${hasListings.hasContent}`);
    
    await browser.close();
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testBasicPuppeteer().catch(console.error);