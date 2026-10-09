// OTel first — before ANY other import. See backend/libs/otel/src/start-otel.ts's file header for
// why this ordering is load-bearing; do not let a formatter move it.
import {
  createRequestLoggingMiddleware,
  installGracefulShutdown,
  OtelLogger,
  startOtel,
} from '@app/otel';
startOtel('gateway');

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { GatewayModule } from './gateway.module';
import { TRUST_PROXY } from './trust-proxy';

async function bootstrap() {
  const logger = new OtelLogger();
  const app = await NestFactory.create<NestExpressApplication>(GatewayModule, {
    logger,
  });
  app.use(createRequestLoggingMiddleware(logger));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Permissive CORS — see docs/specs/services.md#gateway.
  app.enableCors({ origin: true });
  // Who may forward the client's IP: trust-proxy.ts, docs/specs/architecture.md#system-topology.
  app.set('trust proxy', TRUST_PROXY);
  app.useWebSocketAdapter(new IoAdapter(app));

  installGracefulShutdown(app);

  const port = process.env.PORT ?? 8000;
  await app.listen(port);

  console.log(
    `Gateway listening on http://localhost:${port} (Socket.IO path: /ws)`,
  );
}
void bootstrap();
