import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type {
  ProxyResponse,
  ServiceClients,
} from '../src/proxy/application/interfaces/service-client.interface';
import { ProxyModule } from '../src/proxy/proxy.module';
import { SERVICE_CLIENTS } from '../src/tokens';

export const TEST_JWT_SECRET = 'test-secret';

export type FakeClients = Record<keyof ServiceClients, { forward: jest.Mock }>;

/**
 * Boots ProxyModule over real HTTP with the app's rate limiting. `urls` points it at real
 * internal-service stand-ins; without them every service is a fake answering `reply`.
 */
export async function bootProxy(
  options: { reply?: ProxyResponse; urls?: Record<string, string> } = {},
): Promise<{ app: INestApplication; base: string; clients: FakeClients }> {
  const fake = () => ({
    forward: jest
      .fn()
      .mockResolvedValue(options.reply ?? { status: 200, body: { ok: true } }),
  });
  const clients = {
    users: fake(),
    reminders: fake(),
    notifications: fake(),
  };
  let builder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            USERS_SERVICE_URL: 'x',
            NOTIFICATIONS_SERVICE_URL: 'x',
            REMINDERS_SERVICE_URL: 'x',
            ...options.urls,
            JWT_SECRET: TEST_JWT_SECRET,
          }),
        ],
      }),
      ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 100 }] }),
      ProxyModule,
    ],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }], // same as gateway.module.ts
  });
  if (!options.urls) {
    builder = builder.overrideProvider(SERVICE_CLIENTS).useValue(clients);
  }
  const app = (await builder.compile()).createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); // same as main.ts
  await app.listen(0);
  return { app, base: await app.getUrl(), clients };
}
