import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthKernelModule } from '@app/auth-kernel';
import {
  KafkajsEventPublisher,
  OutboxEventEntity,
  OutboxRelay,
  TypeOrmOutboxStore,
  type IEventPublisher,
} from '@app/kafka-client';
import { AuthController } from './api/controllers/auth.controller';
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
import {
  AUTH_SERVICE,
  EVENT_PUBLISHER,
  OUTBOX_RELAY,
  PASSWORD_HASHER,
  PROFILE_REPOSITORY,
  PROFILE_SERVICE,
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
} from './tokens';

const ENTITIES = [
  UserEntity,
  RefreshTokenEntity,
  ProfileEntity,
  OutboxEventEntity,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthKernelModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        entities: ENTITIES,
        // See backend/apps/users/README.md's "synchronize: true below production" section.
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  controllers: [AuthController, UsersController],
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
    {
      provide: EVENT_PUBLISHER,
      useFactory: (config: ConfigService) =>
        new KafkajsEventPublisher(config, 'users'),
      inject: [ConfigService],
    },
    {
      provide: OUTBOX_RELAY,
      useFactory: (dataSource: DataSource, publisher: IEventPublisher) =>
        new OutboxRelay(new TypeOrmOutboxStore(dataSource), publisher),
      inject: [DataSource, EVENT_PUBLISHER],
    },
  ],
})
export class UsersModule {}
