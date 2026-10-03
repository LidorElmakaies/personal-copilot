import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AuthKernelModule } from '@app/auth-kernel';
import { UsersProxyController } from './api/users-proxy.controller';
import { UsersProxyService } from './application/users-proxy.service';
import { createServiceHttpClient } from '../proxy/service-http.client';
import { USERS_PROXY_SERVICE, USERS_SERVICE_CLIENT } from '../tokens';

// Every route is JwtAuthGuard-gated: your own profile. /auth/* is auth-proxy's, same service.
@Module({
  imports: [HttpModule, AuthKernelModule],
  controllers: [UsersProxyController],
  providers: [
    { provide: USERS_PROXY_SERVICE, useClass: UsersProxyService },
    {
      provide: USERS_SERVICE_CLIENT,
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
export class UsersProxyModule {}
