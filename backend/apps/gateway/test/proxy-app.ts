import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { ProxyResponse } from '../src/proxy/proxy.types';

/** Boots one proxy module over real HTTP with its internal-service client replaced by a fake. */
export async function bootProxy(
  module: unknown,
  clientToken: symbol,
  reply: ProxyResponse,
): Promise<{ app: INestApplication; base: string; forward: jest.Mock }> {
  const forward = jest.fn().mockResolvedValue(reply);
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => ({ AUTH_SERVICE_URL: 'x', CALENDAR_SERVICE_URL: 'x' })],
      }),
      module as never,
    ],
  })
    .overrideProvider(clientToken)
    .useValue({ forward })
    .compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); // same as main.ts
  await app.listen(0);
  return { app, base: await app.getUrl(), forward };
}
