import { Injectable, Logger } from '@nestjs/common';
import puppeteer, { Browser, Page } from 'puppeteer';

import * as cheerio from 'cheerio';

@Injectable()
export abstract class BaseScraperService {
  protected readonly logger = new Logger(this.constructor.name);
  protected browser: Browser;
  protected async initBrowser(): Promise<void> {
    if (!this.browser) {
      const executablePath = this.getChromePath();

      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-web-security',
          '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ],
      });
    }
  }
  protected async createPage(): Promise<Page> {
    await this.initBrowser();
    const page = await this.browser.newPage();

    // Set user agent to avoid bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    return page;
  }

  private getChromePath(): string | undefined {
    // Prioritize Linux paths for production, then macOS for development
    const possiblePaths = [
      process.env.CHROME_PATH, // Custom path from environment (highest priority)
      '/usr/bin/chromium-browser', // Linux Chromium (production)
      '/usr/bin/google-chrome', // Linux Chrome (production)
      '/usr/bin/chromium', // Alternative Linux path
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS (dev)
      '/Applications/Chromium.app/Contents/MacOS/Chromium', // macOS Chromium (dev)
    ];

    const fs = require('fs');
    for (const path of possiblePaths) {
      if (path && fs.existsSync(path)) {
        this.logger.log(`Using Chrome at: ${path}`);
        return path;
      }
    }

    this.logger.log('Using Puppeteer bundled Chrome');
    return undefined; // Let Puppeteer use its bundled Chrome
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected loadCheerio(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  protected extractPhoneNumber(text: string): string | null {
    // Common phone number patterns for European numbers
    const phonePatterns = [
      /(\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/g,
      /(\+\d{1,3}[\s-]?)?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/g,
      /(\+\d{1,3})?\s?\d{2,4}\s?\d{3,4}\s?\d{3,4}/g,
    ];

    for (const pattern of phonePatterns) {
      const match = text.match(pattern);
      if (match) {
        // Clean the phone number
        return match[0].replace(/[\s-()]/g, '');
      }
    }

    return null;
  }

  protected cleanText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }

  protected parsePrice(
    priceText: string,
  ): { price: number; currency: string } | null {
    if (!priceText) return null;

    // Remove all non-numeric characters except comma and dot
    const cleanPrice = priceText.replace(/[^\d,.]/g, '');

    // Extract currency
    const currencyMatch = priceText.match(/([€$£¥₽]|EUR|USD|GBP|PLN|CZK)/i);
    const currency = currencyMatch ? currencyMatch[1] : 'EUR';

    // Parse price
    const price = parseFloat(cleanPrice.replace(/,/g, ''));

    return isNaN(price) ? null : { price, currency };
  }

  protected async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async onModuleDestroy() {
    await this.closeBrowser();
  }
}
