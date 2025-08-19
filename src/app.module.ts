import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScrapingController } from './controllers/scraping.controller';
import { databaseConfig } from './config/database.config';
import { ScrapingModule } from './modules/scraping/scraping.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { FilteringModule } from './modules/filtering/filtering.module';
import { MessagePoolModule } from './modules/message-pull/message-pull.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(databaseConfig),
    ScheduleModule.forRoot(),
    ScrapingModule,
    WhatsappModule,
    FilteringModule,
    MessagePoolModule,
  ],
  controllers: [AppController, ScrapingController],
  providers: [AppService],
})
export class AppModule {}
