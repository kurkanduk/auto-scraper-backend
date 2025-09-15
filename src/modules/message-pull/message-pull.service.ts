// message-pool.service.ts
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { MessagePool } from '../../entities/message-pull.entity';
import { CreateMessageDto, UpdateMessageDto } from './message-pull.dto';
import { ListingSource } from '../../entities/listing.entity';

@Injectable()
export class MessagePoolService {
  constructor(
    @InjectRepository(MessagePool)
    private readonly repo: Repository<MessagePool>,
  ) {}

  findAll() {
    return this.repo.find();
  }

  findBySource(source: ListingSource) {
    return this.repo.find({
      where: { source, isActive: true },
    });
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  create(dto: CreateMessageDto) {
    const message = this.repo.create(dto);
    return this.repo.save(message);
  }

  async update(id: number, dto: UpdateMessageDto) {
    const message = await this.repo.findOneBy({ id });
    if (!message) return null;
    Object.assign(message, dto);
    return this.repo.save(message);
  }

  async remove(id: number) {
    const result = await this.repo.delete(id);
    return result.affected > 0;
  }

  async getMessagesForSource(source: ListingSource): Promise<string[]> {
    const messages = await this.repo.find({
      where: { source, isActive: true },
      select: ['content'],
    });
    return messages.map((m) => m.content);
  }
}
