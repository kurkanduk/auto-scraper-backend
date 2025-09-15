import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScrapingService } from '../scraping/services/scraping.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { ListingStatus } from '../../entities/listing.entity';

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

    // ✅ Правильная проверка рабочего времени с выходом
    if (hour < 9 || hour >= 20) {
      this.logger.log(
        '⏸️ Outside working hours (9:00-20:00), skipping messages',
      );
      return;
    }

    // ✅ Получаем только новые объявления (статус PROCESSED)
    const listings = await this.scrapingService.getNewListings(limit);

    if (listings.length === 0) {
      this.logger.log('📭 No new listings to process');
      return;
    }

    this.logger.log(
      `📤 Processing ${listings.length} new listings for messaging`,
    );

    for (const listing of listings) {
      try {
        // ✅ Отправляем без случайных задержек
        const ok = await this.whatsappService.sendMessage(listing);
        if (ok) {
          // ✅ Обновляем статус на CONTACTED
          listing.status = ListingStatus.CONTACTED;
          listing.contactedAt = new Date();
          await this.scrapingService.updateListingStatus(listing);
          this.logger.log(`✅ Message sent for listing: ${listing.title}`);
        } else {
          this.logger.warn(`⚠️ Failed to send message for ${listing.title}`);
        }

        // ✅ Небольшая задержка между сообщениями (5 секунд)
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (error) {
        this.logger.error(
          `❌ Error sending message for ${listing.title}: ${error.message}`,
        );
      }
    }
  }

  // Крон-запуск
  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'messages' })
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
