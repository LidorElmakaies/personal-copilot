// OTel first — before ANY other import. See backend/libs/otel/src/start-otel.ts's file header.
import { installGracefulShutdown, OtelLogger, startOtel } from '@app/otel';
startOtel('telegram');

import { NestFactory } from '@nestjs/core';
import { TelegramModule } from './telegram.module';

// No HTTP surface at all — the bot talks to Telegram via outbound long-polling, and both the
// link-code request/response and message send/receive round trips go through Kafka. Nothing here
// is, or needs to be, reachable by anything (see .claude/agents/devops.md).
async function bootstrap() {
  const logger = new OtelLogger();
  const app = await NestFactory.createApplicationContext(TelegramModule, { logger });
  installGracefulShutdown(app);
  console.log('Telegram service running (long-polling + Kafka)');
}
void bootstrap();
