import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './api/controllers/health.controller';
import { RemindersController } from './api/controllers/reminders.controller';
import { ReminderService } from './application/reminder.service';
import { ReminderEntity } from './entities/reminder.entity';
import { UsersProfileEntity, UsersUserEntity } from '@app/users-schema';
import { TypeOrmReminderRepository } from './infrastructure/postgres/typeorm-reminder.repository';
import { TypeOrmUserLocationReader } from './infrastructure/postgres/typeorm-user-location.reader';
import {
  REMINDER_REPOSITORY,
  REMINDER_SERVICE,
  USER_LOCATION_READER,
} from './tokens';

// UsersUserEntity/UsersProfileEntity map the Users Service's tables read-only (synchronize: false).
const ENTITIES = [ReminderEntity, UsersUserEntity, UsersProfileEntity];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        // This service's own schema in the shared database — the only one it writes.
        schema: 'reminders',
        entities: ENTITIES,
        // Same policy as Users — see backend/apps/users/README.md's "synchronize: true below production".
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  controllers: [HealthController, RemindersController],
  providers: [
    { provide: REMINDER_SERVICE, useClass: ReminderService },
    { provide: REMINDER_REPOSITORY, useClass: TypeOrmReminderRepository },
    { provide: USER_LOCATION_READER, useClass: TypeOrmUserLocationReader },
  ],
})
export class RemindersModule {}
