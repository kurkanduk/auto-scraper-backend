import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactLog } from '../../entities/contact-log.entity';
import { WhatsappService } from './whatsapp.service';
import { MessagingCronService } from './whatsapp-messaging-cron.service';
import { ScrapingModule } from '../scraping/scraping.module';
import { MessagePoolModule } from '../message-pull/message-pull.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContactLog]),
    MessagePoolModule,
    forwardRef(() => ScrapingModule),
  ],
  providers: [WhatsappService, MessagingCronService],
  exports: [WhatsappService, MessagingCronService],
})
export class WhatsappModule {}
