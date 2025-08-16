import { ListingSource } from '../../../entities/listing.entity';

export interface ScrapedListing {
  externalId: string;
  source: ListingSource;
  url: string;
  title: string;
  description?: string;
  price?: number;
  currency?: string;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  fuelType?: string;
  transmission?: string;
  location?: string;
  sellerName?: string;
  sellerPhone?: string;
  sellerType?: 'private' | 'dealer' | 'unknown';
  rawData?: any;
}

export interface ScraperInterface {
  scrape(): Promise<ScrapedListing[]>;
  getSource(): ListingSource;
  scrapeDetailedListing?(url: string): Promise<Partial<ScrapedListing>>;
}
