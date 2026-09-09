import { Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { TELEGRAM_CLIENT, TELEGRAM_LINK_CODE_REPOSITORY, TELEGRAM_LINK_REPOSITORY } from '../tokens';
import type { ITelegramClient } from '../infrastructure/interfaces/telegram-client.interface';
import type { ITelegramLinkCodeRepository } from '../infrastructure/interfaces/telegram-link-code-repository.interface';
import type { ITelegramLinkRepository } from '../infrastructure/interfaces/telegram-link-repository.interface';
import type {
  GeneratedLinkCode,
  ITelegramLinkService,
} from './interfaces/telegram-link-service.interface';

const CODE_TTL_MS = 5 * 60 * 1000;
const CODE_LENGTH = 8;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — easy to misread when typed

@Injectable()
export class TelegramLinkService implements ITelegramLinkService {
  constructor(
    @Inject(TELEGRAM_LINK_CODE_REPOSITORY)
    private readonly linkCodes: ITelegramLinkCodeRepository,
    @Inject(TELEGRAM_LINK_REPOSITORY) private readonly links: ITelegramLinkRepository,
    @Inject(TELEGRAM_CLIENT) private readonly client: ITelegramClient,
  ) {}

  async generateCode(userId: string): Promise<GeneratedLinkCode> {
    const code = this.randomCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    await this.linkCodes.create(code, userId, expiresAt);
    const username = await this.client.getBotUsername();
    return { code, url: `https://t.me/${username}?start=${code}`, expiresAt };
  }

  async redeemCode(code: string, chatId: string): Promise<string | null> {
    const record = await this.linkCodes.findByCode(code.toUpperCase());
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return null;
    }
    await this.linkCodes.markUsed(record.code);
    await this.links.upsert(record.userId, chatId);
    return record.userId;
  }

  async findUserIdByChatId(chatId: string): Promise<string | null> {
    const link = await this.links.findByChatId(chatId);
    return link?.userId ?? null;
  }

  async findChatIdByUserId(userId: string): Promise<string | null> {
    const link = await this.links.findByUserId(userId);
    return link?.chatId ?? null;
  }

  async allLinkedChatIds(): Promise<string[]> {
    return (await this.links.listAll()).map((link) => link.chatId);
  }

  private randomCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    return code;
  }
}
