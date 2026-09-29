import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './api/controllers/health.controller';

// Skeleton (plan task 1.5): boots, connects to its own database, answers /health.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('NOTIFICATIONS_DATABASE_URL'),
        entities: [],
        // Same policy as Auth — see backend/apps/auth/README.md's "synchronize: true below production".
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [HealthController],
})
export class NotificationsModule {}
