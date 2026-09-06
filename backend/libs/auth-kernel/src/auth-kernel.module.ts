import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthTokenService } from './auth-token.service';
import { JsonWebTokenService } from './jsonwebtoken.service';
import { AUTH_TOKEN_SERVICE, JWT_SERVICE } from './tokens';

// Auth Service imports this for JWT_SERVICE (signs); Gateway imports it for
// AUTH_TOKEN_SERVICE/JwtAuthGuard (verifies — its HTTP guard and the WS handshake).
@Module({
  imports: [ConfigModule],
  providers: [
    { provide: JWT_SERVICE, useClass: JsonWebTokenService },
    { provide: AUTH_TOKEN_SERVICE, useClass: AuthTokenService },
  ],
  exports: [JWT_SERVICE, AUTH_TOKEN_SERVICE],
})
export class AuthKernelModule {}
