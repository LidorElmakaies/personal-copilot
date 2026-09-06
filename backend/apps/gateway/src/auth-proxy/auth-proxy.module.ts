import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthProxyController } from './api/auth-proxy.controller';
import { AuthProxyService } from './application/auth-proxy.service';
import { AuthServiceHttpClient } from './infrastructure/auth-service-http.client';
import { AUTH_PROXY_SERVICE, AUTH_SERVICE_CLIENT } from '../tokens';

// No AuthKernelModule here — register/login/refresh/logout are all unguarded pass-throughs.
@Module({
  imports: [HttpModule],
  controllers: [AuthProxyController],
  providers: [
    { provide: AUTH_PROXY_SERVICE, useClass: AuthProxyService },
    { provide: AUTH_SERVICE_CLIENT, useClass: AuthServiceHttpClient },
  ],
})
export class AuthProxyModule {}
