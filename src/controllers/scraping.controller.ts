import { Controller, Get, Post, Query, Param } from '@nestjs/common';
import { ScrapingService } from '../modules/scraping/services/scraping.service';
import { WhatsappService } from '../modules/whatsapp/whatsapp.service';
import { FilteringService } from '../modules/filtering/filtering.service';
import { MobileDeScraperService } from '../modules/scraping/services/mobile-de-scraper.service';
import { BazosScraperService } from '../modules/scraping/services/bazos-scraper.service';
import { OtomotoScraperService } from '../modules/scraping/services/otomoto-scraper.service';
import { MessagingCronService } from 'src/modules/whatsapp/whatsapp-messaging-cron.service';
import { AutoScoutScraperService } from 'src/modules/scraping/services/auto-scout.service';
import { SchedulerRegistry } from '@nestjs/schedule';

@Controller('scraping')
export class ScrapingController {
  constructor(
    private readonly scrapingService: ScrapingService,
    private readonly whatsappService: WhatsappService,
    private readonly filteringService: FilteringService,
    private readonly mobileDeScraperService: MobileDeScraperService,
    private readonly bazosScraperService: BazosScraperService,
    private readonly otomotoScraperService: OtomotoScraperService,
    private readonly autoscoutScraperService: AutoScoutScraperService,
    private readonly MessagingCronService: MessagingCronService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  @Get('status')
  async getStatus() {
    const scrapingStats = await this.scrapingService.getStatistics();
    // const whatsappInfo = await this.whatsappService.getClientInfo();
    // const contactStats = await this.whatsappService.getContactStatistics();
    const filteringConfig = this.filteringService.getFilteringStats();

    return {
      scraping: scrapingStats,
      // whatsapp: whatsappInfo,
      // contacts: contactStats,
      filtering: filteringConfig,
      timestamp: new Date(),
    };
  }

  @Post('send')
  async send(@Query('limit') limit = 1) {
    await this.MessagingCronService.startManualSending(Number(limit));
    return {
      success: true,
      message: `Started sending for last ${limit} listings`,
    };
  }

  @Get('listings')
  async getRecentListings(@Query('limit') limit?: string) {
    if (limit === 'all') {
      const listings = await this.scrapingService.getAllListings();
      return {
        listings,
        count: listings.length,
      };
    }
    const limitNum = limit ? parseInt(limit) : 10;
    const listings = await this.scrapingService.getRecentListings(limitNum);
    return {
      listings,
      count: listings.length,
    };
  }

  @Get('contacts')
  async getContactLogs(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 10;
    const contacts = await this.whatsappService.getContactLogs(limitNum);
    return {
      contacts,
      count: contacts.length,
    };
  }

  @Post('stop/:name')
  stopCron(@Param('name') name: string) {
    const job = this.schedulerRegistry.getCronJob(name);
    job.stop();
    return { message: `Cron ${name} stopped` };
  }

  @Post('start/:name')
  startCron(@Param('name') name: string) {
    const job = this.schedulerRegistry.getCronJob(name);
    job.start();
    return { message: `Cron ${name} started` };
  }
  @Post('status/:name')
  statusCron(@Param('name') name: string) {
    const job = this.schedulerRegistry.getCronJob(name);
    return { name, running: job.running };
  }

  @Get('test-message')
  async sendTestMessage() {
    const res = await this.whatsappService.sendTestMessage();
    return res;
  }

  @Get('test-filter')
  async testFilter(
    @Query('title') title: string,
    @Query('price') price?: string,
    @Query('year') year?: string,
    @Query('mileage') mileage?: string,
    @Query('sellerType') sellerType?: string,
  ) {
    const testListing = {
      title,
      price: price ? parseFloat(price) : undefined,
      year: year ? parseInt(year) : undefined,
      mileage: mileage ? parseInt(mileage) : undefined,
      sellerType: sellerType as any,
      sellerPhone: '+1234567890', // Mock phone for testing
    };

    const result = await this.filteringService.testListing(testListing);
    return {
      input: testListing,
      result,
    };
  }

  @Get('test-mobile-de')
  async testMobileDe(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 3;

    try {
      const listings = await this.mobileDeScraperService.scrape();
      const limitedListings = listings.slice(0, limitNum);

      return {
        message: `Successfully scraped ${limitedListings.length} listings from mobile.de`,
        totalFound: listings.length,
        limitedTo: limitNum,
        listings: limitedListings,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        error: 'Failed to scrape mobile.de',
        message: error.message,
        timestamp: new Date(),
      };
    }
  }

  @Get('test-mobile-de-detail/:url')
  async testMobileDeDetail(@Param('url') url: string) {
    try {
      // Decode the URL parameter
      const decodedUrl = decodeURIComponent(url);
      const detailInfo =
        await this.mobileDeScraperService.scrapeDetailedListing(decodedUrl);

      return {
        message: 'Successfully scraped detailed listing',
        url: decodedUrl,
        details: detailInfo,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        error: 'Failed to scrape mobile.de detail page',
        message: error.message,
        timestamp: new Date(),
      };
    }
  }

  @Get('test-bazos')
  async testBazos(@Query('limit') limit: string = '5') {
    try {
      const listings = await this.bazosScraperService.scrape();
      const limitedListings = listings.slice(0, parseInt(limit));

      return {
        message: `Successfully scraped ${limitedListings.length} listings from bazos.sk`,
        totalFound: listings.length,
        limitedTo: parseInt(limit),
        listings: limitedListings,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        message: 'Error scraping bazos.sk',
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  @Get('test-otomoto')
  async testOtomoto(@Query('limit') limit: string = '5') {
    try {
      const listings = await this.otomotoScraperService.scrape();
      const limitedListings = listings.slice(0, parseInt(limit));

      return {
        message: `Successfully scraped ${limitedListings.length} listings from otomoto.pl`,
        totalFound: listings.length,
        limitedTo: parseInt(limit),
        listings: limitedListings,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        message: 'Error scraping otomoto.pl',
        error: error.message,
        timestamp: new Date(),
      };
    }
  }
  @Get('test-autoscout')
  async testAutoscout(@Query('limit') limit: string = '1') {
    try {
      const listings = await this.autoscoutScraperService.scrape();
      const limitedListings = listings.slice(0, parseInt(limit));

      return {
        message: `Successfully scraped ${limitedListings.length} listings from autoscout`,
        totalFound: listings.length,
        limitedTo: parseInt(limit),
        listings: limitedListings,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        message: 'Error scraping autoscout.pl',
        error: error.message,
        timestamp: new Date(),
      };
    }
  }
}
