import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TelegramLinkCode } from '../../models/telegram-link';
import type { ITelegramLinkCodeRepository } from '../interfaces/telegram-link-code-repository.interface';
import { TelegramLinkCodeEntity } from './entities/telegram-link-code.entity';

function toDomain(entity: TelegramLinkCodeEntity): TelegramLinkCode {
  return {
    code: entity.code,
    userId: entity.userId,
    expiresAt: entity.expiresAt,
    usedAt: entity.usedAt,
  };
}

@Injectable()
export class TypeOrmTelegramLinkCodeRepository implements ITelegramLinkCodeRepository {
  constructor(
    @InjectRepository(TelegramLinkCodeEntity)
    private readonly repo: Repository<TelegramLinkCodeEntity>,
  ) {}

  async create(code: string, userId: string, expiresAt: Date): Promise<TelegramLinkCode> {
    const entity = this.repo.create({ code, userId, expiresAt, usedAt: null });
    return toDomain(await this.repo.save(entity));
  }

  async findByCode(code: string): Promise<TelegramLinkCode | null> {
    const entity = await this.repo.findOneBy({ code });
    return entity ? toDomain(entity) : null;
  }

  async markUsed(code: string): Promise<void> {
    await this.repo.update({ code }, { usedAt: new Date() });
  }
}
