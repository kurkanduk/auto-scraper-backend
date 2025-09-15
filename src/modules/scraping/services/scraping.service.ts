import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Listing,
  ListingStatus,
  SellerType,
} from '../../../entities/listing.entity';
import { MobileDeScraperService } from './mobile-de-scraper.service';
import { OtomotoScraperService } from './otomoto-scraper.service';
import { BazosScraperService } from './bazos-scraper.service';
import {
  ScraperInterface,
  ScrapedListing,
} from '../interfaces/scraper.interface';
import { FilteringService } from '../../filtering/filtering.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { AutoScoutScraperService } from './auto-scout.service';

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);
  private readonly scrapers: ScraperInterface[];

  constructor(
    @InjectRepository(Listing)
    private listingRepository: Repository<Listing>,
    private mobileDeScraperService: MobileDeScraperService,
    private autoscoutScraperService: AutoScoutScraperService,
    private otomotoScraperService: OtomotoScraperService,
    private bazosScraperService: BazosScraperService,
    private filteringService: FilteringService,
    private whatsappService: WhatsappService,
  ) {
    this.scrapers = [
      this.otomotoScraperService,
      this.bazosScraperService,
      this.autoscoutScraperService,
    ];
  }

  // Run every 15 minutes
  @Cron(CronExpression.EVERY_HOUR, { name: 'scraping' })
  async scheduledScraping() {
    this.logger.log('Starting scheduled scraping...');
    await this.scrapeAllSources();
  }

  async scrapeAllSources(): Promise<void> {
    for (const scraper of this.scrapers) {
      try {
        this.logger.log(`Starting scraping for ${scraper.getSource()}`);
        const scrapedListings = await scraper.scrape();
        await this.processListings(scrapedListings);
      } catch (error) {
        this.logger.error(
          `Error scraping ${scraper.getSource()}: ${error.message}`,
        );
      }
    }
  }

  private async processListings(
    scrapedListings: ScrapedListing[],
  ): Promise<void> {
    for (const scrapedListing of scrapedListings) {
      try {
        // Check if listing already exists
        const existingListing = await this.listingRepository.findOne({
          where: {
            externalId: scrapedListing.externalId,
            source: scrapedListing.source,
          },
        });

        if (existingListing) {
          this.logger.debug(
            `Listing already exists: ${scrapedListing.externalId}`,
          );
          continue;
        }

        // Create new listing
        const listing = this.listingRepository.create({
          ...scrapedListing,
          sellerType: this.mapSellerType(scrapedListing.sellerType),
          status: ListingStatus.NEW,
        });

        const savedListing = await this.listingRepository.save(listing);
        this.logger.log(`Saved new listing: ${savedListing.title}`);

        // Process the listing through filtering and WhatsApp
        await this.processNewListing(savedListing);
      } catch (error) {
        this.logger.error(
          `Error processing listing ${scrapedListing.externalId}: ${error.message}`,
        );
      }
    }
  }

  private async processNewListing(listing: Listing): Promise<void> {
    try {
      // Apply filtering logic
      const filterResult = await this.filteringService.shouldContact(listing);

      if (!filterResult.shouldContact) {
        // Mark as rejected with reason
        listing.status = ListingStatus.REJECTED;
        listing.rejectionReason = filterResult.reason;
        await this.listingRepository.save(listing);
        this.logger.debug(
          `Listing rejected: ${listing.title} - ${filterResult.reason}`,
        );
        return;
      }

      // If we need more details, scrape them
      if (filterResult.needsMoreDetails) {
        await this.enrichListingDetails(listing);

        // Re-evaluate after getting more details
        const reFilterResult =
          await this.filteringService.shouldContact(listing);
        if (!reFilterResult.shouldContact) {
          listing.status = ListingStatus.REJECTED;
          listing.rejectionReason = reFilterResult.reason;
          await this.listingRepository.save(listing);
          this.logger.debug(
            `Listing rejected after enrichment: ${listing.title} - ${reFilterResult.reason}`,
          );
          return;
        }
      }

      // Mark as ready for messaging (will be sent by cron)
      listing.status = ListingStatus.PROCESSED;
      await this.listingRepository.save(listing);
      this.logger.log(`Listing ready for messaging: ${listing.title}`);
    } catch (error) {
      this.logger.error(
        `Error processing new listing ${listing.id}: ${error.message}`,
      );
    }
  }

  private async enrichListingDetails(listing: Listing): Promise<void> {
    try {
      const scraper = this.scrapers.find(
        (s) => s.getSource() === listing.source,
      );
      if (!scraper || !scraper.scrapeDetailedListing) {
        return;
      }

      const detailedInfo = await scraper.scrapeDetailedListing(listing.url);

      // Update listing with detailed information
      Object.assign(listing, detailedInfo);
      await this.listingRepository.save(listing);

      this.logger.debug(`Enriched listing details for: ${listing.title}`);
    } catch (error) {
      this.logger.error(
        `Error enriching listing ${listing.id}: ${error.message}`,
      );
    }
  }

  private mapSellerType(sellerType?: string): SellerType {
    switch (sellerType) {
      case 'private':
        return SellerType.PRIVATE;
      case 'dealer':
        return SellerType.DEALER;
      default:
        return SellerType.UNKNOWN;
    }
  }

  // Manual trigger for testing
  async manualScrape(source?: string): Promise<string> {
    if (source) {
      const scraper = this.scrapers.find(
        (s) => s.getSource().toLowerCase() === source.toLowerCase(),
      );
      if (!scraper) {
        return `Scraper not found for source: ${source}`;
      }

      const listings = await scraper.scrape();
      await this.processListings(listings);
      return `Scraped ${listings.length} listings from ${source}`;
    } else {
      await this.scrapeAllSources();
      return 'Scraped all sources';
    }
  }

  async getRecentListings(limit: number = 10): Promise<Listing[]> {
    return this.listingRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getNewListings(limit: number = 10): Promise<Listing[]> {
    return this.listingRepository.find({
      where: { status: ListingStatus.PROCESSED },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async updateListingStatus(listing: Listing): Promise<void> {
    await this.listingRepository.save(listing);
  }

  async getAllListings(): Promise<Listing[]> {
    try {
      return await this.listingRepository.find({
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error(`Error fetching all listings: ${error.message}`);
      throw error;
    }
  }

  async getStatistics(): Promise<any> {
    const total = await this.listingRepository.count();
    const contacted = await this.listingRepository.count({
      where: { status: ListingStatus.CONTACTED },
    });
    const rejected = await this.listingRepository.count({
      where: { status: ListingStatus.REJECTED },
    });
    const pending = await this.listingRepository.count({
      where: { status: ListingStatus.NEW },
    });

    return {
      total,
      contacted,
      rejected,
      pending,
      contactRate: total > 0 ? ((contacted / total) * 100).toFixed(2) : 0,
    };
  }
}
