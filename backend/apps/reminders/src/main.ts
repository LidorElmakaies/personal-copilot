// OTel first — before ANY other import. See backend/libs/otel/src/start-otel.ts's file header.
import {
  createRequestLoggingMiddleware,
  installGracefulShutdown,
  OtelLogger,
  startOtel,
} from '@app/otel';
startOtel('reminders');

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { RemindersModule } from './reminders.module';

async function bootstrap() {
  const logger = new OtelLogger();
  const app = await NestFactory.create(RemindersModule, { logger });
  app.use(createRequestLoggingMiddleware(logger));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  installGracefulShutdown(app);

  const port = process.env.PORT ?? 8003;
  await app.listen(port);

  console.log(`Reminders Service listening on http://localhost:${port}`);
}
void bootstrap();
