import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AuthProxyController } from './api/auth-proxy.controller';
import { AuthProxyService } from './application/auth-proxy.service';
import { createServiceHttpClient } from '../proxy/service-http.client';
import { AUTH_PROXY_SERVICE, AUTH_SERVICE_CLIENT } from '../tokens';

// No AuthKernelModule here — register/login/refresh/logout are all unguarded pass-throughs.
@Module({
  imports: [HttpModule],
  controllers: [AuthProxyController],
  providers: [
    { provide: AUTH_PROXY_SERVICE, useClass: AuthProxyService },
    {
      provide: AUTH_SERVICE_CLIENT,
      useFactory: (http: HttpService, config: ConfigService) =>
        createServiceHttpClient(
          http,
          config,
          'USERS_SERVICE_URL',
          'users_service',
        ),
      inject: [HttpService, ConfigService],
    },
  ],
})
export class AuthProxyModule {}
