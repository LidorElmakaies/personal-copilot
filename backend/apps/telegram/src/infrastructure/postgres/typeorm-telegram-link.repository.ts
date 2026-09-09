import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TelegramLink } from '../../models/telegram-link';
import type { ITelegramLinkRepository } from '../interfaces/telegram-link-repository.interface';
import { TelegramLinkEntity } from './entities/telegram-link.entity';

function toDomain(entity: TelegramLinkEntity): TelegramLink {
  return { userId: entity.userId, chatId: entity.chatId, linkedAt: entity.linkedAt };
}

@Injectable()
export class TypeOrmTelegramLinkRepository implements ITelegramLinkRepository {
  constructor(
    @InjectRepository(TelegramLinkEntity)
    private readonly repo: Repository<TelegramLinkEntity>,
  ) {}

  async upsert(userId: string, chatId: string): Promise<TelegramLink> {
    // A user re-linking (new device/chat) replaces their old link rather than erroring — same for
    // a chat that was previously linked to someone else (e.g. a shared/reused Telegram account).
    await this.repo.delete({ userId });
    await this.repo.delete({ chatId });
    const entity = this.repo.create({ userId, chatId });
    return toDomain(await this.repo.save(entity));
  }

  async findByChatId(chatId: string): Promise<TelegramLink | null> {
    const entity = await this.repo.findOneBy({ chatId });
    return entity ? toDomain(entity) : null;
  }

  async findByUserId(userId: string): Promise<TelegramLink | null> {
    const entity = await this.repo.findOneBy({ userId });
    return entity ? toDomain(entity) : null;
  }

  async listAll(): Promise<TelegramLink[]> {
    return (await this.repo.find()).map(toDomain);
  }
}
