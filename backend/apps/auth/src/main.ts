// OTel first — before ANY other import. See backend/libs/otel/src/start-otel.ts's file header.
import {
  createRequestLoggingMiddleware,
  installGracefulShutdown,
  OtelLogger,
  startOtel,
} from '@app/otel';
startOtel('auth');

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AuthModule } from './auth.module';

async function bootstrap() {
  const logger = new OtelLogger();
  const app = await NestFactory.create(AuthModule, { logger });
  app.use(createRequestLoggingMiddleware(logger));
  // Only the Gateway calls this in practice (never the frontend directly), but CORS stays
  // permissive for the Docker Compose dev phase, same rationale as Gateway's own main.ts.
  app.enableCors({ origin: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  installGracefulShutdown(app);

  const port = process.env.PORT ?? 8001;
  await app.listen(port);

  console.log(`Auth Service listening on http://localhost:${port}`);
}
void bootstrap();
