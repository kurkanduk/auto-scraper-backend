import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return `
🤖 Car Scraper Bot is running!

Available endpoints:
- GET /health - Health check
- GET /scraping/status - Bot status and statistics
- POST /scraping/start?source=[mobile.de|otomoto|bazos] - Start manual scraping
- GET /scraping/listings?limit=10 - Get recent listings
- GET /scraping/contacts?limit=10 - Get recent contact logs
- GET /scraping/test-filter?title=...&price=...&year=... - Test filtering logic

The bot automatically scrapes car listings every 15 minutes and sends WhatsApp messages to private sellers.
    `;
  }
}
