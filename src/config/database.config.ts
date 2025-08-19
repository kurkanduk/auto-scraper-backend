import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Listing } from '../entities/listing.entity';
import { ContactLog } from '../entities/contact-log.entity';
import { MessagePool } from 'src/entities/message-pull.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'sqlite',
  database: 'car_scraper.db',
  entities: [Listing, ContactLog, MessagePool],
  synchronize: true, // Only for development, set to false in production
  logging: ['error', 'warn'],
};
