#!/usr/bin/env node

/**
 * Simple mobile.de test to check what we can actually access
 */

const puppeteer = require('puppeteer');

async function testMobileDeSimple() {
  console.log('🚀 Testing mobile.de access...');
  
  const browser = await puppeteer.launch({ 
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 720 }
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('📡 Navigating to mobile.de...');
    const searchUrl = 'https://suchen.mobile.de/fahrzeuge/search.html?dam=false&isSearchRequest=true&ref=quickSearch&s=Car&vc=Car';
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(3000);

    console.log('🔍 Checking page title...');
    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Check if we can find any listings at all
    console.log('🔍 Looking for any listing links...');
    const allLinks = await page.$$eval('a', links => 
      links
        .filter(link => link.href.includes('fahrzeuge') || link.href.includes('details'))
        .slice(0, 10)
        .map(link => ({
          href: link.href,
          text: link.textContent?.trim().substring(0, 50)
        }))
    );
    
    console.log(`Found ${allLinks.length} potential listing links:`);
    allLinks.forEach((link, i) => {
      console.log(`  ${i + 1}. ${link.text} -> ${link.href}`);
    });

    // Check for private seller filter
    console.log('\n🔍 Looking for seller type filters...');
    const sellerFilters = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="radio"]'));
      return inputs
        .filter(input => input.name && (input.name.includes('seller') || input.value.includes('FSBO')))
        .map(input => ({
          name: input.name,
          value: input.value,
          id: input.id,
          testId: input.getAttribute('data-testid'),
          label: input.closest('label')?.textContent?.trim()
        }));
    });
    
    console.log(`Found ${sellerFilters.length} seller filters:`);
    sellerFilters.forEach((filter, i) => {
      console.log(`  ${i + 1}. ${filter.label} (${filter.value}) - testId: ${filter.testId}`);
    });

    // Take a screenshot for debugging
    await page.screenshot({ path: 'mobile-de-debug.png', fullPage: true });
    console.log('📸 Screenshot saved as mobile-de-debug.png');

    // Wait a bit before closing so we can see the page
    console.log('⏳ Waiting 10 seconds before closing (check the browser window)...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('✅ Browser closed');
  }
}

testMobileDeSimple().catch(console.error);