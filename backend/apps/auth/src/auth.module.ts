import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthKernelModule } from '@app/auth-kernel';
import { AuthController } from './api/controllers/auth.controller';
import { AuthService } from './application/auth.service';
import { SaltPepperSha256Hasher } from './infrastructure/hashing/salt-pepper-sha256.hasher';
import { RefreshTokenEntity } from './infrastructure/postgres/entities/refresh-token.entity';
import { UserEntity } from './infrastructure/postgres/entities/user.entity';
import { TypeOrmRefreshTokenRepository } from './infrastructure/postgres/typeorm-refresh-token.repository';
import { TypeOrmUserRepository } from './infrastructure/postgres/typeorm-user.repository';
import {
  AUTH_SERVICE,
  PASSWORD_HASHER,
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
} from './tokens';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthKernelModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        entities: [UserEntity, RefreshTokenEntity],
        // Simplest thing that works for a single-user personal project — no migration
        // framework, revisit before this ever holds data that matters to lose.
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([UserEntity, RefreshTokenEntity]),
  ],
  controllers: [AuthController],
  providers: [
    { provide: AUTH_SERVICE, useClass: AuthService },
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: TypeOrmRefreshTokenRepository,
    },
    { provide: PASSWORD_HASHER, useClass: SaltPepperSha256Hasher },
  ],
})
export class AuthModule {}
