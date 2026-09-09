import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InlineKeyboard } from 'grammy';
import type { TelegramButton } from '@app/kafka-contracts';
import type { ITelegramClient } from '../interfaces/telegram-client.interface';
import type { TelegramUpdate } from '../../models/telegram-update';

// Long-polling only — no inbound webhook, so this service never needs a published port. Accepts
// updates from any chat; whether a chat is allowed to *do* anything is an application-layer
// decision (TelegramInboundService — is it linked, or is this a link-code attempt), not this
// class's job.
@Injectable()
export class GrammyTelegramClient implements ITelegramClient, OnModuleDestroy {
  private readonly bot: Bot;
  private handler: ((update: TelegramUpdate) => Promise<void>) | null = null;
  private botUsername: Promise<string> | null = null;

  constructor(config: ConfigService) {
    const token = config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    this.bot = new Bot(token);
    this.registerHandlers();
  }

  // A bot's username never changes at runtime — fetch once, reuse the same in-flight/resolved
  // promise for every caller after that.
  getBotUsername(): Promise<string> {
    if (!this.botUsername) {
      this.botUsername = this.bot.api.getMe().then((me) => me.username);
    }
    return this.botUsername;
  }

  async sendText(chatId: string, text: string): Promise<void> {
    await this.bot.api.sendMessage(chatId, text);
  }

  async sendMenu(chatId: string, text: string, buttons: TelegramButton[]): Promise<void> {
    const keyboard = buttons.reduce(
      (kb, b) => kb.text(b.label, b.data).row(),
      new InlineKeyboard(),
    );
    await this.bot.api.sendMessage(chatId, text, { reply_markup: keyboard });
  }

  onUpdate(handler: (update: TelegramUpdate) => Promise<void>): void {
    this.handler = handler;
  }

  start(): void {
    // Fire-and-forget — bot.start() only resolves once bot.stop() is called (long-polling loop).
    void this.bot.start();
  }

  async stop(): Promise<void> {
    await this.bot.stop();
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  private registerHandlers(): void {
    this.bot.on('callback_query:data', async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.handler?.({
        kind: 'button',
        chatId: String(ctx.chat?.id),
        data: ctx.callbackQuery.data,
        languageCode: ctx.from?.language_code,
      });
    });

    this.bot.on('message:text', async (ctx) => {
      await this.handler?.({
        kind: 'text',
        chatId: String(ctx.chat.id),
        text: ctx.message.text,
        languageCode: ctx.from?.language_code,
      });
    });
  }
}
