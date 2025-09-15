// message-pool.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { MessagePoolService } from '../modules/message-pull/message-pull.service';
import {
  CreateMessageDto,
  UpdateMessageDto,
} from '../modules/message-pull/message-pull.dto';
import { ListingSource } from '../entities/listing.entity';

@Controller('message-pool')
export class MessagePoolController {
  constructor(private readonly service: MessagePoolService) {}

  @Get()
  findAll(@Query('source') source?: ListingSource) {
    if (source) {
      return this.service.findBySource(source);
    }
    return this.service.findAll();
  }

  @Get('source/:source')
  async findBySource(@Param('source') source: ListingSource) {
    return this.service.findBySource(source);
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    const message = await this.service.findOne(id);
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  @Post()
  create(@Body() dto: CreateMessageDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: number, @Body() dto: UpdateMessageDto) {
    const updated = await this.service.update(id, dto);
    if (!updated) throw new NotFoundException('Message not found');
    return updated;
  }

  @Delete(':id')
  async remove(@Param('id') id: number) {
    const deleted = await this.service.remove(id);
    if (!deleted) throw new NotFoundException('Message not found');
    return { success: true };
  }
}
