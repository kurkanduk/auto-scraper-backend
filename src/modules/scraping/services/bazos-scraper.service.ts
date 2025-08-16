import { Injectable } from '@nestjs/common';
import { BaseScraperService } from './base-scraper.service';
import { ScrapedListing, ScraperInterface } from '../interfaces/scraper.interface';
import { ListingSource } from '../../../entities/listing.entity';

@Injectable()
export class BazosScraperService extends BaseScraperService implements ScraperInterface {
  
  getSource(): ListingSource {
    return ListingSource.BAZOS;
  }

  async scrape(): Promise<ScrapedListing[]> {
    this.logger.log('Starting bazos scraping...');
    const listings: ScrapedListing[] = [];

    try {
      const page = await this.createPage();
      
      // Search URL for Slovak Bazos auto section
      const searchUrl = 'https://auto.bazos.sk/';
      
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      await this.delay(3000);

      const content = await page.content();
      const $ = this.loadCheerio(content);

      // Find listing items using the correct structure
      const listingElements = $('.inzeraty.inzeratyflex').toArray();

      for (const element of listingElements.slice(0, 20)) { // Limit to first 20 listings
        try {
          const $element = $(element);
          
          // Extract basic info using the correct Bazos structure
          const titleElement = $element.find('h2.nadpis a[href*="/inzerat/"]').first();
          const title = this.cleanText(titleElement.text());
          const relativeUrl = titleElement.attr('href');
          
          if (!title || !relativeUrl) continue;
          
          const url = relativeUrl.startsWith('http') ? relativeUrl : `https://auto.bazos.sk${relativeUrl}`;
          const externalId = this.extractIdFromUrl(url);
          
          if (!externalId) continue;

          // Extract price from the dedicated price div
          const priceElement = $element.find('.inzeratycena');
          const priceText = priceElement.text();
          const priceInfo = this.parsePrice(priceText);

          // Extract location - try both possible class names
          const locationElement = $element.find('.inzeratylok, .inzeratylokalita');
          const location = this.cleanText(locationElement.text());

          // Extract description from the description div
          const descElement = $element.find('.popis');
          const descText = this.cleanText(descElement.text());

          // Extract basic car info from title
          const carInfo = this.parseCarTitle(title);

          // Extract specs from description text
          const specs = this.extractSpecsFromText(descText);

          // Determine seller type (bazos is mostly private sellers)
          const sellerType = this.determineSellerType(descText);

          const listing: ScrapedListing = {
            externalId,
            source: ListingSource.BAZOS,
            url,
            title,
            price: priceInfo?.price,
            currency: priceInfo?.currency || 'EUR', // Slovak Bazos uses EUR
            make: carInfo.make,
            model: carInfo.model,
            year: specs.year,
            mileage: specs.mileage,
            fuelType: specs.fuelType,
            location,
            sellerType,
            rawData: {
              scrapedAt: new Date(),
              html: $element.html(),
              fullText: descText,
              originalPrice: priceText
            }
          };

          // Only include if it's likely a private seller
          if (sellerType === 'private') {
            listings.push(listing);
          }

        } catch (error) {
          this.logger.error(`Error processing listing: ${error.message}`);
        }
      }

      await page.close();
      this.logger.log(`Scraped ${listings.length} listings from bazos`);

    } catch (error) {
      this.logger.error(`Error scraping bazos: ${error.message}`);
    }

    return listings;
  }

  private extractIdFromUrl(url: string): string | null {
    const match = url.match(/\/inzerat\/(\d+)\//);
    return match ? match[1] : null;
  }

  private parseCarTitle(title: string): { make?: string; model?: string } {
    // Example: "Škoda Octavia 1.9 TDI"
    const parts = title.split(' ');
    const make = parts[0];
    const model = parts.length > 1 ? parts[1] : undefined;

    return { make, model };
  }

  private extractSpecsFromText(text: string): { year?: number; mileage?: number; fuelType?: string } {
    // Extract year
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0]) : undefined;

    // Extract mileage (Slovak/Czech format with various separators)
    const mileageMatch = text.match(/(\d+[\d\s.,]*)\s*km/i);
    const mileage = mileageMatch ? parseInt(mileageMatch[1].replace(/[\s.,]/g, '')) : undefined;

    // Extract fuel type (Slovak and Czech terms)
    let fuelType: string | undefined;
    const fuelKeywords = {
      'benzín': 'petrol',
      'benzin': 'petrol',
      'nafta': 'diesel',
      'diesel': 'diesel',
      'tdi': 'diesel',
      'lpg': 'lpg',
      'cng': 'cng',
      'elektro': 'electric',
      'electric': 'electric',
      'hybrid': 'hybrid',
      'hybridný': 'hybrid'
    };

    const lowerText = text.toLowerCase();
    for (const [local, english] of Object.entries(fuelKeywords)) {
      if (lowerText.includes(local)) {
        fuelType = english;
        break;
      }
    }

    return { year, mileage, fuelType };
  }

  private determineSellerType(text: string): 'private' | 'dealer' | 'unknown' {
    const lowerText = text.toLowerCase();
    
    // Dealer indicators (Slovak and Czech)
    const dealerKeywords = [
      'autosalon', 'salon', 'auto centrum', 'dealer', 'predaj vozidiel',
      's.r.o.', 'spol.', 'company', 'firma', 'obchod', 'autobazár',
      'autocentrum', 'servis', 'dovoz', 'import', 'autodom'
    ];

    for (const keyword of dealerKeywords) {
      if (lowerText.includes(keyword)) {
        return 'dealer';
      }
    }

    // Private seller indicators (Slovak and Czech)
    const privateKeywords = [
      'súkromný', 'soukromý', 'privát', 'private', 'osobné', 'osobní', 
      'predám', 'prodám', 'vlastné', 'vlastní', 'nepotrebuje'
    ];

    for (const keyword of privateKeywords) {
      if (lowerText.includes(keyword)) {
        return 'private';
      }
    }

    // For bazos, if we can't determine, assume private (most are)
    return 'private';
  }

  async scrapeDetailedListing(url: string): Promise<Partial<ScrapedListing>> {
    this.logger.log(`Scraping detailed info from: ${url}`);
    
    try {
      const page = await this.createPage();
      await page.goto(url, { waitUntil: 'networkidle2' });
      await this.delay(2000);

      const content = await page.content();
      const $ = this.loadCheerio(content);

      // Extract description
      const description = this.cleanText($('.popisdetail').text());
      
      // Extract seller information
      const sellerInfo = $('.listadvlevo').text();
      const sellerName = this.extractSellerName(sellerInfo);
      
      // Extract phone number
      let sellerPhone = null;
      const phoneText = $('.teldetail').text() || sellerInfo;
      sellerPhone = this.extractPhoneNumber(phoneText);

      // Extract additional details from the page
      const detailsText = $('.listadvdetail').text();
      const specs = this.extractSpecsFromText(detailsText);

      await page.close();

      return {
        description,
        sellerName,
        sellerPhone,
        year: specs.year,
        mileage: specs.mileage,
        fuelType: specs.fuelType,
        rawData: { detailsText, sellerInfo }
      };

    } catch (error) {
      this.logger.error(`Error scraping detailed listing: ${error.message}`);
      return {};
    }
  }

  private extractSellerName(text: string): string | null {
    // Extract name from seller info text
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    // First non-empty line is usually the name
    for (const line of lines) {
      if (line && !line.includes('tel:') && !line.includes('email:') && line.length > 2) {
        return line;
      }
    }
    
    return null;
  }
}