import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './api/controllers/health.controller';
import { RemindersController } from './api/controllers/reminders.controller';
import { ReminderService } from './application/reminder.service';
import { ReminderEntity } from './entities/reminder.entity';
import { TypeOrmReminderRepository } from './infrastructure/postgres/typeorm-reminder.repository';
import { REMINDER_REPOSITORY, REMINDER_SERVICE } from './tokens';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('REMINDERS_DATABASE_URL'),
        entities: [ReminderEntity],
        // Same policy as Auth — see backend/apps/auth/README.md's "synchronize: true below production".
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([ReminderEntity]),
  ],
  controllers: [HealthController, RemindersController],
  providers: [
    { provide: REMINDER_SERVICE, useClass: ReminderService },
    { provide: REMINDER_REPOSITORY, useClass: TypeOrmReminderRepository },
  ],
})
export class RemindersModule {}
