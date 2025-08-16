import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '../../entities/listing.entity';
import { ContactLog } from '../../entities/contact-log.entity';
import { ScrapingService } from './services/scraping.service';
import { MobileDeScraperService } from './services/mobile-de-scraper.service';
import { OtomotoScraperService } from './services/otomoto-scraper.service';
import { BazosScraperService } from './services/bazos-scraper.service';
import { FilteringModule } from '../filtering/filtering.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AutoScoutScraperService } from './services/auto-scout.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, ContactLog]),
    FilteringModule,
    WhatsappModule,
  ],
  providers: [
    ScrapingService,
    MobileDeScraperService,
    OtomotoScraperService,
    BazosScraperService,
    AutoScoutScraperService,
  ],
  exports: [
    ScrapingService,
    MobileDeScraperService,
    OtomotoScraperService,
    BazosScraperService,
    AutoScoutScraperService,
  ],
})
export class ScrapingModule {}
