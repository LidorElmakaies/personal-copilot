import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthKernelModule } from '@app/auth-kernel';
import { KafkajsEventConsumer, KafkajsEventPublisher } from '@app/kafka-client';
import { TelegramLinkCreatedConsumer } from './api/telegram-link-created.consumer';
import { TelegramProxyController } from './api/telegram-proxy.controller';
import { TelegramProxyService } from './application/telegram-proxy.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { EVENT_CONSUMER, EVENT_PUBLISHER, TELEGRAM_PROXY_SERVICE } from '../tokens';

// AuthKernelModule (unlike AuthProxyModule) — link-code requests need to know who's asking, so
// this is the first guarded route in this app (JwtAuthGuard). RealtimeModule for the WS push that
// eventually delivers the code — see TelegramLinkCreatedConsumer.
@Module({
  imports: [AuthKernelModule, RealtimeModule],
  controllers: [TelegramProxyController],
  providers: [
    TelegramLinkCreatedConsumer,
    { provide: TELEGRAM_PROXY_SERVICE, useClass: TelegramProxyService },
    {
      provide: EVENT_PUBLISHER,
      useFactory: (config: ConfigService) => new KafkajsEventPublisher(config, 'gateway'),
      inject: [ConfigService],
    },
    {
      provide: EVENT_CONSUMER,
      useFactory: (config: ConfigService) => new KafkajsEventConsumer(config, 'gateway'),
      inject: [ConfigService],
    },
  ],
})
export class TelegramProxyModule {}
