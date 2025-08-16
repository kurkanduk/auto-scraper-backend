import { Module } from '@nestjs/common';
import { FilteringService } from './filtering.service';

@Module({
  providers: [FilteringService],
  exports: [FilteringService],
})
export class FilteringModule {}
