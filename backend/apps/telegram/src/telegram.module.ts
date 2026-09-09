import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkajsEventConsumer, KafkajsEventPublisher } from '@app/kafka-client';
import { TelegramLinkRequestConsumer } from './api/telegram-link-request.consumer';
import { TelegramSendConsumer } from './api/telegram-send.consumer';
import { TelegramUpdatesListener } from './api/telegram-updates.listener';
import { TelegramInboundService } from './application/telegram-inbound.service';
import { TelegramLinkService } from './application/telegram-link.service';
import { TelegramOutboundService } from './application/telegram-outbound.service';
import { TelegramLinkCodeEntity } from './infrastructure/postgres/entities/telegram-link-code.entity';
import { TelegramLinkEntity } from './infrastructure/postgres/entities/telegram-link.entity';
import { TypeOrmTelegramLinkCodeRepository } from './infrastructure/postgres/typeorm-telegram-link-code.repository';
import { TypeOrmTelegramLinkRepository } from './infrastructure/postgres/typeorm-telegram-link.repository';
import { GrammyTelegramClient } from './infrastructure/telegram/grammy-telegram.client';
import {
  EVENT_CONSUMER,
  EVENT_PUBLISHER,
  TELEGRAM_CLIENT,
  TELEGRAM_INBOUND_SERVICE,
  TELEGRAM_LINK_CODE_REPOSITORY,
  TELEGRAM_LINK_REPOSITORY,
  TELEGRAM_LINK_SERVICE,
  TELEGRAM_OUTBOUND_SERVICE,
} from './tokens';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        entities: [TelegramLinkEntity, TelegramLinkCodeEntity],
        // Simplest thing that works for a single-user personal project — no migration framework,
        // same as apps/auth; revisit before this ever holds data that matters to lose.
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([TelegramLinkEntity, TelegramLinkCodeEntity]),
  ],
  providers: [
    TelegramUpdatesListener,
    TelegramSendConsumer,
    TelegramLinkRequestConsumer,
    { provide: TELEGRAM_CLIENT, useClass: GrammyTelegramClient },
    { provide: TELEGRAM_INBOUND_SERVICE, useClass: TelegramInboundService },
    { provide: TELEGRAM_OUTBOUND_SERVICE, useClass: TelegramOutboundService },
    { provide: TELEGRAM_LINK_SERVICE, useClass: TelegramLinkService },
    { provide: TELEGRAM_LINK_REPOSITORY, useClass: TypeOrmTelegramLinkRepository },
    { provide: TELEGRAM_LINK_CODE_REPOSITORY, useClass: TypeOrmTelegramLinkCodeRepository },
    {
      provide: EVENT_PUBLISHER,
      useFactory: (config: ConfigService) => new KafkajsEventPublisher(config, 'telegram'),
      inject: [ConfigService],
    },
    {
      provide: EVENT_CONSUMER,
      useFactory: (config: ConfigService) => new KafkajsEventConsumer(config, 'telegram'),
      inject: [ConfigService],
    },
  ],
})
export class TelegramModule {}
