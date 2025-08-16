#!/usr/bin/env node

/**
 * Simple test script for mobile.de scraper
 */

const puppeteer = require('puppeteer');

async function testMobileDeScraper() {
  console.log('🚀 Testing mobile.de scraper...');
  
  const browser = await puppeteer.launch({ 
    headless: false, // Set to true for production
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to mobile.de search
    const searchUrl = 'https://suchen.mobile.de/fahrzeuge/search.html?dam=false&isSearchRequest=true&ref=quickSearch&s=Car&vc=Car';
    console.log(`📡 Navigating to: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(3000);

    // Handle cookie consent
    try {
      await page.click('button[data-testid="accept-all-cookies"]', { timeout: 3000 });
      console.log('✅ Cookie consent handled');
      await page.waitForTimeout(1000);
    } catch (e) {
      console.log('ℹ️ No cookie consent found');
    }

    // Try to apply private seller filter
    try {
      console.log('🔍 Looking for private seller filter...');
      await page.waitForSelector('input[data-testid="seller-type-filter-FSBO"]', { timeout: 10000 });
      await page.click('input[data-testid="seller-type-filter-FSBO"]');
      console.log('✅ Private seller filter applied');
      await page.waitForTimeout(3000);
    } catch (error) {
      console.log('⚠️ Could not apply private seller filter');
    }

    // Extract listing URLs
    console.log('📋 Extracting listing URLs...');
    const listingUrls = await page.$$eval(
      'a[href*="/fahrzeuge/details.html"]',
      (links) =>
        links.slice(0, 5).map((link) => ({
          url: link.href,
          id: new URL(link.href).searchParams.get('id'),
        }))
    );

    console.log(`📊 Found ${listingUrls.length} listings:`);
    listingUrls.forEach((listing, index) => {
      console.log(`  ${index + 1}. ID: ${listing.id} - ${listing.url}`);
    });

    // Test extracting basic info from search results
    if (listingUrls.length > 0) {
      const firstListing = listingUrls[0];
      console.log(`\n🔍 Testing basic info extraction for listing ${firstListing.id}...`);
      
      const basicInfo = await page.evaluate((id) => {
        const listingElement = document.querySelector(`a[href*="id=${id}"]`)?.closest('article');
        if (!listingElement) return null;

        const titleElement = listingElement.querySelector('h2[id*="result-listing"]');
        const priceElement = listingElement.querySelector('[data-testid="price-label"]');
        
        return {
          title: titleElement?.textContent?.trim() || '',
          price: priceElement?.textContent?.trim() || '',
          found: !!listingElement
        };
      }, firstListing.id);

      if (basicInfo) {
        console.log('✅ Basic info extracted:');
        console.log(`  Title: ${basicInfo.title}`);
        console.log(`  Price: ${basicInfo.price}`);
      } else {
        console.log('❌ Could not extract basic info');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ Test completed');
  }
}

// Run the test
testMobileDeScraper().catch(console.error);