import { Injectable, Logger } from '@nestjs/common';
import { Listing, SellerType } from '../../entities/listing.entity';
import { defaultConfig, AppConfig } from '../../config/app.config';

export interface FilterResult {
  shouldContact: boolean;
  reason?: string;
  needsMoreDetails?: boolean;
}

@Injectable()
export class FilteringService {
  private readonly logger = new Logger(FilteringService.name);
  private readonly config: AppConfig = defaultConfig;

  async shouldContact(listing: Listing): Promise<FilterResult> {
    this.logger.debug(`Filtering listing: ${listing.title}`);

    // 1. Check if it's from a private seller
    if (listing.sellerType !== SellerType.PRIVATE) {
      return {
        shouldContact: false,
        reason: 'Not a private seller',
      };
    }

    // 2. Check if we have phone number (required for WhatsApp)
    if (!listing.sellerPhone) {
      return {
        shouldContact: false,
        reason: 'No phone number available',
        needsMoreDetails: true,
      };
    }

    // 3. Price filter
    if (listing.price && listing.price > this.config.filtering.maxPrice) {
      return {
        shouldContact: false,
        reason: `Price too high: ${listing.price} > ${this.config.filtering.maxPrice}`,
      };
    }

    // 4. Year filter
    if (listing.year && listing.year < this.config.filtering.minYear) {
      return {
        shouldContact: false,
        reason: `Year too old: ${listing.year} < ${this.config.filtering.minYear}`,
      };
    }

    // 5. Mileage filter
    if (listing.mileage && listing.mileage > this.config.filtering.maxMileage) {
      return {
        shouldContact: false,
        reason: `Mileage too high: ${listing.mileage} > ${this.config.filtering.maxMileage}`,
      };
    }

    // 6. Fuel type filter
    if (
      listing.fuelType &&
      this.config.filtering.allowedFuelTypes.length > 0 &&
      !this.config.filtering.allowedFuelTypes.includes(
        listing.fuelType.toLowerCase(),
      )
    ) {
      return {
        shouldContact: false,
        reason: `Fuel type not allowed: ${listing.fuelType}`,
      };
    }

    // 7. Exclude keywords filter
    const textToCheck =
      `${listing.title} ${listing.description || ''}`.toLowerCase();
    for (const keyword of this.config.filtering.excludeKeywords) {
      if (textToCheck.includes(keyword.toLowerCase())) {
        return {
          shouldContact: false,
          reason: `Contains excluded keyword: ${keyword}`,
        };
      }
    }

    // 8. Required keywords filter
    if (this.config.filtering.requiredKeywords.length > 0) {
      const hasRequiredKeyword = this.config.filtering.requiredKeywords.some(
        (keyword) => textToCheck.includes(keyword.toLowerCase()),
      );

      if (!hasRequiredKeyword) {
        return {
          shouldContact: false,
          reason: `Missing required keywords: ${this.config.filtering.requiredKeywords.join(', ')}`,
        };
      }
    }

    // 9. Check for obvious dealer indicators in title/description
    const dealerIndicators = [
      'autosalon',
      'dealer',
      'handel',
      'verkauf',
      'auto centrum',
      'car center',
      'motors',
      'automotive',
      'sprzedaż',
      'handel',
      's.r.o.',
      'spol.',
      'gmbh',
      'ltd',
      'inc',
    ];

    for (const indicator of dealerIndicators) {
      if (textToCheck.includes(indicator.toLowerCase())) {
        return {
          shouldContact: false,
          reason: `Contains dealer indicator: ${indicator}`,
        };
      }
    }

    // 10. Additional quality checks
    const qualityCheck = this.performQualityChecks(listing);
    if (!qualityCheck.shouldContact) {
      return qualityCheck;
    }

    // If we need more details but basic criteria are met
    if (!listing.description || !listing.sellerName) {
      return {
        shouldContact: true,
        needsMoreDetails: true,
      };
    }

    return {
      shouldContact: true,
      reason: 'All filters passed',
    };
  }

  private performQualityChecks(listing: Listing): FilterResult {
    // Check for minimum information quality
    if (!listing.title || listing.title.length < 10) {
      return {
        shouldContact: false,
        reason: 'Title too short or missing',
      };
    }

    // Check for suspicious pricing
    if (listing.price && listing.price < 1000) {
      return {
        shouldContact: false,
        reason: 'Price suspiciously low (possible scam)',
      };
    }

    // Check for year consistency
    if (
      listing.year &&
      (listing.year < 1990 || listing.year > new Date().getFullYear() + 1)
    ) {
      return {
        shouldContact: false,
        reason: 'Invalid year',
      };
    }

    // Check for mileage consistency
    if (listing.mileage && listing.mileage < 0) {
      return {
        shouldContact: false,
        reason: 'Invalid mileage',
      };
    }

    return {
      shouldContact: true,
    };
  }

  // Method to update filtering configuration
  updateConfig(newConfig: Partial<AppConfig['filtering']>): void {
    Object.assign(this.config.filtering, newConfig);
    this.logger.log('Filtering configuration updated');
  }

  // Method to get current filtering statistics
  getFilteringStats(): any {
    return {
      maxPrice: this.config.filtering.maxPrice,
      minYear: this.config.filtering.minYear,
      maxMileage: this.config.filtering.maxMileage,
      allowedFuelTypes: this.config.filtering.allowedFuelTypes,
      excludeKeywords: this.config.filtering.excludeKeywords,
      requiredKeywords: this.config.filtering.requiredKeywords,
    };
  }

  // Method to test a listing against filters without saving
  async testListing(listing: Partial<Listing>): Promise<FilterResult> {
    const testListing = new Listing();
    Object.assign(testListing, listing);
    return this.shouldContact(testListing);
  }
}
