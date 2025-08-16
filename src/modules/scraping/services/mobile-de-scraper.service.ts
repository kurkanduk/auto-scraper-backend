import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseScraperService } from './base-scraper.service';
import {
  ScrapedListing,
  ScraperInterface,
} from '../interfaces/scraper.interface';
import { ListingSource } from '../../../entities/listing.entity';
import {
  Listing,
  ListingStatus,
  SellerType,
} from '../../../entities/listing.entity';

@Injectable()
export class MobileDeScraperService
  extends BaseScraperService
  implements ScraperInterface
{
  constructor(
    @InjectRepository(Listing)
    private listingRepository: Repository<Listing>,
  ) {
    super();
  }

  getSource(): ListingSource {
    return ListingSource.MOBILE_DE;
  }

  async scrape(): Promise<ScrapedListing[]> {
    this.logger.log('Starting mobile.de scraping...');
    const listings: ScrapedListing[] = [];

    try {
      const page = await this.createPage();

      // Search URL for cars from private sellers
      const searchUrl =
        'https://suchen.mobile.de/fahrzeuge/search.html?dam=false&isSearchRequest=true&ref=quickSearch&s=Car&vc=Car';

      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      await this.delay(3000);
      const pageCont = await page.content();
      console.log(pageCont);

      // Accept cookies if present
      try {
        await page.waitForSelector('[data-testid="cookie-consent-accept"]', {
          timeout: 5000,
        });
        await page.click('[data-testid="cookie-consent-accept"]');
        await this.delay(1000);
      } catch (e) {
        // No cookies banner
      }

      const content = await page.content();
      const $ = this.loadCheerio(content);

      // Find listing items using the correct Otomoto structure
      const listingElements = $('section.ooa-ljs66p.e1fi2t0p0').toArray();

      this.logger.debug(
        `Found ${listingElements.length} listing elements on page`,
      );

      for (const element of listingElements) {
        // Process all listings
        try {
          const $element = $(element);

          // Extract basic info using the correct Otomoto structure
          const titleElement = $element
            .find('h2.etydmma0.ooa-iasyan a[href*="/oferta/"]')
            .first();

          if (!titleElement.length) {
            this.logger.debug(
              `No title element found for listing ${listings.length + 1}`,
            );
            continue;
          }

          const titleText = titleElement.text();
          const relativeUrl = titleElement.attr('href');

          if (!titleText) {
            this.logger.debug(`Skipping listing - title text is empty`);
            continue;
          }

          const title = this.cleanText(titleText);

          this.logger.debug(`Found title: "${title}", URL: "${relativeUrl}"`);

          if (!title || !relativeUrl) {
            this.logger.debug(`Skipping listing - missing title or URL`);
            continue;
          }

          const url = relativeUrl.startsWith('http')
            ? relativeUrl
            : `https://www.otomoto.pl${relativeUrl}`;
          const externalId = this.extractIdFromUrl(url);

          if (!externalId) continue;

          // Extract price from the correct structure
          const priceElement = $element.find('h3.efzkujb1.ooa-1qiba3v');
          const currencyElement = $element.find('p.efzkujb2.ooa-rtm36h');
          const priceText = this.cleanText(priceElement.text());
          const currencyText = this.cleanText(currencyElement.text());
          const priceInfo = this.parsePrice(`${priceText} ${currencyText}`);

          // Extract location and seller info
          const locationElement = $element.find('p.ooa-15v0vci').first();
          const location = this.cleanText(locationElement.text());

          // Extract seller type from location text
          const sellerType = this.determineSellerType(location);

          // Extract specs from the structured data
          const specs = this.extractSpecsFromStructuredData($element);

          // Extract make and model from title
          const carInfo = this.extractMakeModelFromTitle(title);

          // Phone numbers are only revealed after clicking "Zadzwoń" button
          let sellerPhone = null;

          // Extract phone number for all listings
          console.log('scraping detailed listing', url);
          try {
            const detailedInfo = await this.scrapeDetailedListing(url);
            console.log('detailedInfo', detailedInfo);
            sellerPhone = detailedInfo.sellerPhone;
            console.log('sellerPhone', sellerPhone);
          } catch (error) {
            this.logger.debug(
              `Failed to get phone for ${url}: ${error.message}`,
            );
          }

          // Check if listing already exists in database
          const existingListing = await this.listingRepository.findOne({
            where: { externalId, source: ListingSource.OTOMOTO },
          });

          if (existingListing) {
            this.logger.debug(`Listing already exists: ${externalId}`);
            continue;
          }

          // Create and save listing immediately
          const listing = this.listingRepository.create({
            externalId,
            source: ListingSource.OTOMOTO,
            url,
            title,
            price: priceInfo?.price,
            currency: priceInfo?.currency || 'PLN',
            make: carInfo.make,
            model: carInfo.model,
            year: specs.year,
            mileage: specs.mileage,
            fuelType: specs.fuelType,
            location,
            sellerType: this.mapSellerType(sellerType),
            sellerPhone,
            status: ListingStatus.NEW,
            rawData: {
              scrapedAt: new Date(),
              html: $element.html(),
            },
          });

          const savedListing = await this.listingRepository.save(listing);
          this.logger.log(
            `Saved listing: ${savedListing.title} (${savedListing.sellerPhone || 'no phone'})`,
          );

          // Add to return array for compatibility
          listings.push({
            externalId,
            source: ListingSource.OTOMOTO,
            url,
            title,
            price: priceInfo?.price,
            currency: priceInfo?.currency || 'PLN',
            make: carInfo.make,
            model: carInfo.model,
            year: specs.year,
            mileage: specs.mileage,
            fuelType: specs.fuelType,
            location,
            sellerType,
            sellerPhone,
            rawData: {
              scrapedAt: new Date(),
              html: $element.html(),
            },
          });
        } catch (error) {
          this.logger.error(`Error processing listing: ${error.message}`);
          this.logger.error(`Error stack: ${error.stack}`);
        }
      }

      await page.close();
      this.logger.log(`Scraped ${listings.length} listings from otomoto`);
    } catch (error) {
      this.logger.error(`Error scraping otomoto: ${error.message}`);
    }

    return listings;
  }

  private extractIdFromUrl(url: string): string | null {
    const match = url.match(/ID([A-Za-z0-9]+)/);
    return match ? match[1] : null;
  }

  private extractMakeModelFromTitle(title: string): {
    make?: string;
    model?: string;
  } {
    // Check if title is valid
    if (!title || typeof title !== 'string') {
      return { make: undefined, model: undefined };
    }

    // Common car makes to look for in the title
    const carMakes = [
      'BMW',
      'Mercedes',
      'Audi',
      'Volkswagen',
      'VW',
      'Skoda',
      'Škoda',
      'Peugeot',
      'Renault',
      'Citroen',
      'Opel',
      'Ford',
      'Fiat',
      'Toyota',
      'Honda',
      'Nissan',
      'Mazda',
      'Suzuki',
      'Hyundai',
      'Kia',
      'Seat',
      'Volvo',
      'Saab',
      'Alfa Romeo',
      'Lancia',
      'Lada',
      'Dacia',
      'Chevrolet',
      'Dodge',
      'Chrysler',
      'Jeep',
    ];

    const cleanTitle = title.trim();
    let make: string | undefined;
    let model: string | undefined;

    // Find the make in the title
    for (const carMake of carMakes) {
      if (cleanTitle.toLowerCase().includes(carMake.toLowerCase())) {
        make = carMake;
        break;
      }
    }

    // Extract model - usually comes after the make
    if (make) {
      try {
        const makeIndex = cleanTitle.toLowerCase().indexOf(make.toLowerCase());
        if (makeIndex !== -1) {
          const titleAfterMake = cleanTitle.substring(makeIndex + make.length);
          const words = titleAfterMake.trim().split(/\s+/);
          if (words.length > 0) {
            model = words[0];
          }
        }
      } catch (error) {
        this.logger.debug(
          `Error extracting model from title "${title}": ${error.message}`,
        );
      }
    }

    return { make, model };
  }

  private extractSpecsFromStructuredData($element: any): {
    year?: number;
    mileage?: number;
    fuelType?: string;
  } {
    // Extract from structured data in dl elements
    const specsData: any = {};

    $element.find('dl.ooa-x6wpd5.e1gy25k10 dt').each((_, dt) => {
      const $dt = $element.find(dt);
      const $dd = $dt.next('dd');
      const key = this.cleanText($dt.text());
      const value = this.cleanText($dd.text());

      if (key && value) {
        specsData[key] = value;
      }
    });

    // Extract year
    const year = specsData['year'] ? parseInt(specsData['year']) : undefined;

    // Extract mileage (remove 'km' and parse)
    let mileage: number | undefined;
    if (specsData['mileage']) {
      const mileageMatch = specsData['mileage'].match(/(\d[\d\s]*)/);
      mileage = mileageMatch
        ? parseInt(mileageMatch[1].replace(/\s/g, ''))
        : undefined;
    }

    // Extract fuel type
    let fuelType: string | undefined;
    if (specsData['fuel_type']) {
      const fuelMap: { [key: string]: string } = {
        Diesel: 'diesel',
        Benzyna: 'petrol',
        Hybryda: 'hybrid',
        Elektryczny: 'electric',
        LPG: 'lpg',
        CNG: 'cng',
      };
      fuelType =
        fuelMap[specsData['fuel_type']] || specsData['fuel_type'].toLowerCase();
    }

    return { year, mileage, fuelType };
  }

  private isValidPolishPhone(phone: string): boolean {
    if (!phone) return false;

    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');

    // Must be exactly 9 digits for Polish numbers
    if (digits.length !== 9) {
      return false;
    }

    // Polish mobile numbers: 9 digits starting with 5, 6, 7, 8
    if (/^[5-8]/.test(digits)) {
      return true;
    }

    // Polish landline numbers: 9 digits starting with 1, 2, 3, 4
    if (/^[1-4]/.test(digits)) {
      return true;
    }

    return false;
  }

  private determineSellerType(
    locationText: string,
  ): 'private' | 'dealer' | 'unknown' {
    const lowerText = locationText.toLowerCase();

    // Private seller indicators (Polish)
    const privateKeywords = [
      'prywatny sprzedawca',
      'prywatny',
      'osoba prywatna',
      'osobowy',
    ];

    for (const keyword of privateKeywords) {
      if (lowerText.includes(keyword)) {
        return 'private';
      }
    }

    // Dealer indicators (Polish)
    const dealerKeywords = [
      'komis',
      'salon',
      'dealer',
      'autohandel',
      'sprzedaż',
      'firma',
      'sp. z o.o.',
      's.r.o.',
    ];

    for (const keyword of dealerKeywords) {
      if (lowerText.includes(keyword)) {
        return 'dealer';
      }
    }

    // Default to private for Otomoto (most are private)
    return 'private';
  }

  async scrapeDetailedListing(url: string): Promise<Partial<ScrapedListing>> {
    this.logger.debug(`Scraping detailed info from: ${url}`);

    try {
      const page = await this.createPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
      await this.delay(1000);

      // Try to click the "Zadzwoń" button to reveal phone number
      try {
        // Wait for the page to load completely
        await page.waitForSelector('button[data-button-variant="secondary"]', {
          timeout: 5000,
        });

        // Find and click the "Wyświetl numer" (Show number) button
        const buttons = await page.$$(
          'button[data-button-variant="secondary"]',
        );
        let showNumberButton = null;

        // Find the button with "Wyświetl numer" text in its span
        for (const button of buttons) {
          const span = await button.$('span.n-button-text-wrapper');
          if (span) {
            const spanText = await page.evaluate((el) => el.textContent, span);
            if (spanText && spanText.includes('Wyświetl numer')) {
              showNumberButton = button;
              break;
            }
          }
        }

        if (showNumberButton) {
          this.logger.debug('Found "Wyświetl numer" button, clicking...');

          // Click the button using the element we already found
          await showNumberButton.click();
          await this.delay(5000); // Wait 5 seconds for phone number to appear

          // After clicking, look for the tel: link that contains the phone number
          // Look specifically in the div with class ooa-e2su5n ed4qow40
          const phoneDiv = await page.$('div.ooa-e2su5n.ed4qow40');

          // If the button is still showing "Wyświetl numer", try clicking it again
          if (phoneDiv) {
            const buttonInDiv = await phoneDiv.$('button');
            if (buttonInDiv) {
              const buttonText = await page.evaluate(
                (el) => el.textContent,
                buttonInDiv,
              );
              if (buttonText && buttonText.includes('Wyświetl numer')) {
                this.logger.debug(
                  'Button still shows "Wyświetl numer", clicking again...',
                );
                await page.evaluate((el) => el.click(), buttonInDiv);

                await this.delay(3000); // Wait more time after second click
              }
            }
          }
          this.logger.debug(`Phone div found: ${phoneDiv ? 'yes' : 'no'}`);

          if (phoneDiv) {
            // Log ALL content from this div
            const divContent = await page.evaluate(
              (el) => el.innerHTML,
              phoneDiv,
            );
            this.logger.debug(`Phone div content: ${divContent}`);

            // Log all links from this div
            const allLinksInDiv = await phoneDiv.$$('a');
            this.logger.debug(
              `Found ${allLinksInDiv.length} links in phone div`,
            );

            for (const link of allLinksInDiv) {
              const href = await page.evaluate(
                (el) => el.getAttribute('href'),
                link,
              );
              const text = await page.evaluate((el) => el.textContent, link);
              this.logger.debug(
                `Phone div link: href="${href}" text="${text}"`,
              );
            }

            const telLink = await phoneDiv.$('a[href^="tel:"]');
            if (telLink) {
              const href = await page.evaluate(
                (el) => el.getAttribute('href'),
                telLink,
              );
              this.logger.debug(`Found tel link in phone div: "${href}"`);

              if (href && href.startsWith('tel:')) {
                const phoneNumber = href.replace('tel:', '').trim();
                if (phoneNumber && this.isValidPolishPhone(phoneNumber)) {
                  this.logger.debug(`Found phone in tel link: ${phoneNumber}`);
                  return { sellerPhone: phoneNumber };
                }
              }
            }
          }

          // Fallback: also check all tel links on the page
          const telLinks = await page.$$('a[href^="tel:"]');
          this.logger.debug(
            `Found ${telLinks.length} tel links after click (fallback)`,
          );

          for (const telLink of telLinks) {
            const href = await page.evaluate(
              (el) => el.getAttribute('href'),
              telLink,
            );
            this.logger.debug(`Tel link href: "${href}"`);

            if (href && href.startsWith('tel:')) {
              const phoneNumber = href.replace('tel:', '').trim();
              if (phoneNumber && this.isValidPolishPhone(phoneNumber)) {
                this.logger.debug(`Found phone in tel link: ${phoneNumber}`);
                return { sellerPhone: phoneNumber };
              }
            }
          }
        }
      } catch (error) {
        this.logger.debug(`Could not click call button: ${error.message}`);
      }

      const content = await page.content();
      const $ = this.loadCheerio(content);

      // Extract description - try multiple selectors for Otomoto
      let description = '';
      const descriptionSelectors = [
        '[data-testid="ad-description"]',
        '.ad-description',
        '.ooa-1afgq2j0',
        '.description',
        '[data-testid="description"]',
      ];

      for (const selector of descriptionSelectors) {
        const descElement = $(selector);
        if (descElement.length > 0) {
          description = this.cleanText(descElement.text());
          break;
        }
      }

      // Extract seller information
      let sellerName = '';
      const sellerSelectors = [
        '[data-testid="seller-name"]',
        '.seller-name',
        '.ooa-1jb4k0u',
        '.seller-info',
      ];

      for (const selector of sellerSelectors) {
        const sellerElement = $(selector);
        if (sellerElement.length > 0) {
          sellerName = this.cleanText(sellerElement.text());
          break;
        }
      }

      await page.close();

      return {
        description,
        sellerName,
        rawData: {
          scrapedAt: new Date(),
          url,
        },
      };
    } catch (error) {
      this.logger.error(`Error scraping detailed listing: ${error.message}`);
      return {};
    }
  }

  private mapSellerType(sellerType?: string): SellerType {
    switch (sellerType?.toLowerCase()) {
      case 'private':
        return SellerType.PRIVATE;
      case 'dealer':
        return SellerType.DEALER;
      default:
        return SellerType.UNKNOWN;
    }
  }
}
