// message-pool.service.ts
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { MessagePool } from '../../entities/message-pull.entity';
import { CreateMessageDto, UpdateMessageDto } from './message-pull.dto';

@Injectable()
export class MessagePoolService {
  constructor(
    @InjectRepository(MessagePool)
    private readonly repo: Repository<MessagePool>,
  ) {}

  findAll() {
    return this.repo.find();
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
}
