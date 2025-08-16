import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScrapingService } from '../scraping/services/scraping.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class MessagingCronService {
  private readonly logger = new Logger(MessagingCronService.name);

  constructor(
    private readonly scrapingService: ScrapingService,
    private readonly whatsappService: WhatsappService,
  ) {}

  // Вынесенная логика отправки сообщений
  private async sendMessagesFromListings(limit = 10) {
    const now = new Date();
    const hour = now.getHours();

    if (hour < 9 || hour >= 18) {
      this.logger.log('⏸️ Outside working hours, skipping messages');
      return;
    }

    const listings = await this.scrapingService.getRecentListings(limit);

    for (const listing of listings) {
      const delay = Math.floor(Math.random() * 10 * 60 * 1000);

      setTimeout(async () => {
        const ok = await this.whatsappService.sendMessage(listing);
        if (ok) {
          this.logger.log(`✅ Message sent for listing: ${listing.title}`);
        } else {
          this.logger.warn(`⚠️ Failed to send message for ${listing.title}`);
        }
      }, delay);
    }
  }

  // Крон-запуск
  @Cron(CronExpression.EVERY_HOUR, { name: 'messages' })
  async handleCron() {
    await this.sendMessagesFromListings(10);
  }

  // Ручной запуск
  async startManualSending(limit = 10) {
    this.logger.log(
      `▶️ Manual trigger: sending messages for last ${limit} listings`,
    );
    await this.sendMessagesFromListings(limit);
  }
}
