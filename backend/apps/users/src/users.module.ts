import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthKernelModule } from '@app/auth-kernel';
import { AuthController } from './api/controllers/auth.controller';
import { HealthController } from './api/controllers/health.controller';
import { UsersController } from './api/controllers/users.controller';
import { AdminSeedService } from './application/admin-seed.service';
import { AuthService } from './application/auth.service';
import { ProfileService } from './application/profile.service';
import { SaltPepperSha256Hasher } from './infrastructure/hashing/salt-pepper-sha256.hasher';
import { ProfileEntity } from './entities/profile.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { UserEntity } from './entities/user.entity';
import { TypeOrmProfileRepository } from './infrastructure/postgres/typeorm-profile.repository';
import { TypeOrmRefreshTokenRepository } from './infrastructure/postgres/typeorm-refresh-token.repository';
import { TypeOrmUserRepository } from './infrastructure/postgres/typeorm-user.repository';
import { DropOutboxAndProfileVersion1792800000000 } from './infrastructure/postgres/migrations/1792800000000-drop-outbox-and-profile-version';
import { DropRemindersAndNotificationsSchemas1792900000000 } from './infrastructure/postgres/migrations/1792900000000-drop-reminders-and-notifications-schemas';
import {
  AUTH_SERVICE,
  PASSWORD_HASHER,
  PROFILE_REPOSITORY,
  PROFILE_SERVICE,
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
} from './tokens';

const ENTITIES = [UserEntity, RefreshTokenEntity, ProfileEntity];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthKernelModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        // This service's own schema in the shared database — the only one it writes.
        schema: 'users',
        entities: ENTITIES,
        // See backend/apps/users/README.md's "synchronize: true below production" section.
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        // Applied once on boot, in order, recorded in users.migrations.
        migrations: [
          DropOutboxAndProfileVersion1792800000000,
          DropRemindersAndNotificationsSchemas1792900000000,
        ],
        migrationsRun: true,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  controllers: [HealthController, AuthController, UsersController],
  providers: [
    AdminSeedService,
    { provide: AUTH_SERVICE, useClass: AuthService },
    { provide: PROFILE_SERVICE, useClass: ProfileService },
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: PROFILE_REPOSITORY, useClass: TypeOrmProfileRepository },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: TypeOrmRefreshTokenRepository,
    },
    { provide: PASSWORD_HASHER, useClass: SaltPepperSha256Hasher },
  ],
})
export class UsersModule {}
