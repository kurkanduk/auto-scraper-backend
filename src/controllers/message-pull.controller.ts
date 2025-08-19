// message-pool.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { MessagePoolService } from '../modules/message-pull/message-pull.service';
import {
  CreateMessageDto,
  UpdateMessageDto,
} from '../modules/message-pull/message-pull.dto';

@Controller('message-pool')
export class MessagePoolController {
  constructor(private readonly service: MessagePoolService) {}

  @Get()
  findAll() {
    return this.service.findAll();
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
