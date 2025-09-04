// message-pool.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagePool } from '../../entities/message-pull.entity';
import { MessagePoolService } from './message-pull.service';
import { MessagePoolController } from '../../controllers/message-pull.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MessagePool])],
  providers: [MessagePoolService],
  controllers: [MessagePoolController],
  exports: [MessagePoolService, TypeOrmModule],
})
export class MessagePoolModule {}
