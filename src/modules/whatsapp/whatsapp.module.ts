import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactLog } from '../../entities/contact-log.entity';
import { WhatsappService } from './whatsapp.service';
import { MessagingCronService } from './whatsapp-messaging-cron.service';
import { ScrapingModule } from '../scraping/scraping.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContactLog]),
    forwardRef(() => ScrapingModule),
  ],
  providers: [WhatsappService, MessagingCronService],
  exports: [WhatsappService, MessagingCronService],
})
export class WhatsappModule {}
