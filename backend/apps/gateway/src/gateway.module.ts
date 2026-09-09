import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthProxyModule } from './auth-proxy/auth-proxy.module';
import { RealtimeModule } from './realtime/realtime.module';
import { TelegramProxyModule } from './telegram-proxy/telegram-proxy.module';

// Composes the self-contained modules below; owns no providers of its own.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthProxyModule,
    RealtimeModule,
    TelegramProxyModule,
  ],
})
export class GatewayModule {}
