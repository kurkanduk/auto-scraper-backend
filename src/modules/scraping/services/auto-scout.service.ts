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
export class AutoScoutScraperService
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
    return ListingSource.OTOMOTO;
  }

  async scrape(): Promise<ScrapedListing[]> {
    this.logger.log('Starting autoscout scraping...');
    const listings: ScrapedListing[] = [];

    try {
      const page = await this.createPage();

      // Search URL for cars from private sellers
      const searchUrl =
        'https://www.autoscout24.com/lst?atype=C&cy=D%2CA%2CI%2CB%2CNL%2CE%2CL%2CF&desc=0&page=3&search_id=nj7v8repfy&sort=standard&source=listpage_pagination&ustate=N%2CU';
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      await this.delay(3000);

      // Accept cookies if present
      try {
        await page.waitForSelector(
          '[data-testid="as24-cmp-accept-all-button"]',
          { timeout: 5000 },
        );
        await page.click('[data-testid="as24-cmp-accept-all-button"]');
        await this.delay(1000);
      } catch (e) {
        // No cookies banner
      }

      const content = await page.content();
      const $ = this.loadCheerio(content);

      // Updated selector for AutoScout24 articles
      const listingElements = $('article[data-testid="list-item"]').toArray();

      this.logger.debug(
        `Found ${listingElements.length} listing elements on page`,
      );

      for (const element of listingElements) {
        try {
          const $element = $(element);

          // Extract data from data attributes (more reliable than text parsing)
          const externalId = $element.attr('data-guid');
          if (!externalId) {
            this.logger.debug('No GUID found for listing');
            continue;
          }

          // Extract price from data attribute
          const priceAttr = $element.attr('data-price');
          const price = priceAttr ? parseInt(priceAttr, 10) : undefined;

          // Extract make and model from data attributes
          const make = $element.attr('data-make');
          const model = $element.attr('data-model');

          // Extract mileage from data attribute
          const mileageAttr = $element.attr('data-mileage');
          const mileage = mileageAttr ? parseInt(mileageAttr, 10) : undefined;

          // Extract year from data attribute
          const yearAttr = $element.attr('data-first-registration');
          let year = undefined;
          if (yearAttr) {
            const yearMatch = yearAttr.match(/(\d{4})/);
            year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
          }

          // Extract fuel type from data attribute
          const fuelTypeAttr = $element.attr('data-fuel-type');
          const fuelTypeMap = {
            b: 'Бензин',
            d: 'Дизель',
            e: 'Электро',
            h: 'Гибрид',
            g: 'Газ',
            cng: 'CNG',
            lpg: 'LPG',
          };
          const fuelType = fuelTypeMap[fuelTypeAttr] || fuelTypeAttr;

          // Extract title from DOM elements
          const titleBold = this.cleanText(
            $element.find('.ListItem_title_bold__iQJRq').text(),
          );
          const titleVersion = this.cleanText(
            $element.find('.ListItem_version__5EWfi').text(),
          );
          const title = `${titleBold} ${titleVersion}`.trim();

          // Extract seller information
          const sellerName = this.cleanText(
            $element.find('[data-testid="sellerinfo-company-name"]').text(),
          );
          const location = this.cleanText(
            $element.find('[data-testid="sellerinfo-address"]').text(),
          );

          // Extract location from data attribute as fallback
          const zipCode = $element.attr('data-listing-zip-code');
          const finalLocation = location || zipCode || undefined;

          // Determine seller type from data attribute
          const sellerTypeAttr = $element.attr('data-seller-type');
          const sellerType =
            sellerTypeAttr === 'p'
              ? SellerType.PRIVATE
              : sellerTypeAttr === 'd'
                ? SellerType.DEALER
                : SellerType.UNKNOWN;

          // Get detail URL by clicking on title (since it uses JS routing)
          let detailUrl = null;
          try {
            // Try to find existing href first
            const existingHref = $element
              .find('.ListItem_title__ndA4s')
              .attr('href');
            if (existingHref) {
              detailUrl = existingHref.startsWith('http')
                ? existingHref
                : `https://www.autoscout24.com${existingHref}`;
            } else {
              // If no href, construct URL from data attributes
              detailUrl = `https://www.autoscout24.com/offers/${make}-${model}-${externalId}`;
            }
          } catch (error) {
            this.logger.debug(
              `Could not extract detail URL for ${externalId}: ${error.message}`,
            );
            // Fallback URL construction
            detailUrl = `https://www.autoscout24.com/offers/${make}-${model}-${externalId}`;
          }

          // Check if listing already exists in database
          const existingListing = await this.listingRepository.findOne({
            where: { externalId, source: ListingSource.AUTOSCOUT },
          });

          if (existingListing) {
            this.logger.debug(`Listing already exists: ${externalId}`);
            continue;
          }

          // Get phone number from detail page
          let sellerPhone = null;
          try {
            const detailedInfo = await this.scrapeDetailedListing(detailUrl);
            sellerPhone = detailedInfo.sellerPhone;
          } catch (error) {
            this.logger.debug(
              `Failed to get phone for ${detailUrl}: ${error.message}`,
            );
          }

          // Create and save listing
          const listing = this.listingRepository.create({
            externalId,
            source: ListingSource.AUTOSCOUT,
            url: detailUrl,
            title: title || `${make} ${model}`.trim(),
            price: price !== undefined ? Number(price) : undefined,
            currency: 'EUR',
            make: make ? this.capitalizeFirst(make) : undefined,
            model: model ? this.capitalizeFirst(model) : undefined,
            year,
            mileage,
            fuelType,
            location: finalLocation,
            sellerType,
            sellerName,
            sellerPhone,
            status: ListingStatus.NEW,
            rawData: {
              scrapedAt: new Date(),
              html: $element.html(),
              dataAttributes: {
                guid: externalId,
                price: priceAttr,
                make,
                model,
                mileage: mileageAttr,
                year: yearAttr,
                fuelType: fuelTypeAttr,
                sellerType: sellerTypeAttr,
                zipCode,
              },
            },
          });

          const savedListing = await this.listingRepository.save(listing);
          this.logger.log(
            `Saved listing: ${savedListing.title} (€${savedListing.price || 'N/A'}) - ${savedListing.sellerPhone || 'no phone'}`,
          );

          listings.push({
            externalId,
            source: ListingSource.AUTOSCOUT,
            url: detailUrl,
            title: title || `${make} ${model}`.trim(),
            price: price !== undefined ? Number(price) : undefined,
            currency: 'EUR',
            make: make ? this.capitalizeFirst(make) : undefined,
            model: model ? this.capitalizeFirst(model) : undefined,
            year,
            mileage,
            fuelType,
            location: finalLocation,
            sellerType,
            sellerName,
            sellerPhone,
            rawData: {
              scrapedAt: new Date(),
              html: $element.html(),
              dataAttributes: {
                guid: externalId,
                price: priceAttr,
                make,
                model,
                mileage: mileageAttr,
                year: yearAttr,
                fuelType: fuelTypeAttr,
                sellerType: sellerTypeAttr,
                zipCode,
              },
            },
          });
          if (page && !page.isClosed()) {
            await page.close();
            this.logger.debug('Page closed in finally block');
          }
        } catch (error) {
          this.logger.error(`Error processing listing: ${error.message}`);
          this.logger.error(`Error stack: ${error.stack}`);
          if (page && !page.isClosed()) {
            await page.close();
            this.logger.debug('Page closed in finally block');
          }
        }
      }

      await page.close();
      this.logger.log(`Scraped ${listings.length} listings from AutoScout24`);
    } catch (processingError) {
      this.logger.error(
        `Error during scraping process: ${processingError.message}`,
      );
      throw processingError;
    } finally {
      // Ensure page is always closed, even if there was an error
    }

    return listings;
  }

  // Helper method to add to your class
  private capitalizeFirst(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
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
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      await this.delay(1000);

      // 1. Check if phone is already revealed as <a href="tel:...">
      let telLink = await page.$('a[href^="tel:"]');
      if (telLink) {
        const href = await page.evaluate(
          (el) => el.getAttribute('href'),
          telLink,
        );
        if (href && href.startsWith('tel:')) {
          const phoneNumber = href.replace('tel:', '').trim();
          this.logger.debug(
            `Found phone in tel link (no click needed): ${phoneNumber}`,
          );
          await page.close();
          return { sellerPhone: phoneNumber };
        }
      }

      // 2. Find and click the "Показати номер" button
      try {
        // Find all buttons with id="call-desktop-button"
        const buttons = await page.$$('button#call-desktop-button');
        let showNumberButton = null;

        for (const button of buttons) {
          const span = await button.$('span');
          if (span) {
            const spanText = await page.evaluate((el) => el.textContent, span);
            if (spanText && spanText.includes('Show number')) {
              showNumberButton = button;
              break;
            }
          }
        }

        if (showNumberButton) {
          this.logger.debug('Found "Показати номер" button, clicking...');
          await page.evaluate((el) => el.scrollIntoView(), showNumberButton);
          await showNumberButton.click();
          await this.delay(5000); // Wait for phone number to appear

          // If the button is still present, try clicking again
          const stillButton = await page.$('button#call-desktop-button');
          if (stillButton) {
            const stillSpan = await stillButton.$('span');
            if (stillSpan) {
              const stillText = await page.evaluate(
                (el) => el.textContent,
                stillSpan,
              );
              if (stillText && stillText.includes('Показати номер')) {
                this.logger.debug(
                  'Button still shows "Показати номер", clicking again...',
                );
                await page.evaluate(
                  (el) => (el as HTMLElement).click(),
                  stillButton,
                );
                await this.delay(3000);
              }
            }
          }

          // Wait for phone link to appear
          telLink = await page.$('a[href^="tel:"]');
          if (telLink) {
            const href = await page.evaluate(
              (el) => el.getAttribute('href'),
              telLink,
            );
            if (href && href.startsWith('tel:')) {
              const phoneNumber = href.replace('tel:', '').trim();
              this.logger.debug(
                `Found phone in tel link (after click): ${phoneNumber}`,
              );
              await page.close();
              return { sellerPhone: phoneNumber };
            }
          }
        } else {
          this.logger.debug('Call button not found on detail page');
        }
      } catch (error) {
        this.logger.debug(
          `Could not click call button or find phone: ${error.message}`,
        );
      }

      // 3. Fallback: check all tel links on the page
      const telLinks = await page.$$('a[href^="tel:"]');
      for (const link of telLinks) {
        const href = await page.evaluate((el) => el.getAttribute('href'), link);
        if (href && href.startsWith('tel:')) {
          const phoneNumber = href.replace('tel:', '').trim();
          this.logger.debug(
            `Found phone in tel link (fallback): ${phoneNumber}`,
          );
          await page.close();
          return { sellerPhone: phoneNumber };
        }
      }

      await page.close();
      return {};
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
