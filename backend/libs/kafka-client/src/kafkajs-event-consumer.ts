import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, EachMessagePayload, Kafka } from 'kafkajs';
import type { IEventConsumer, MessageMeta } from './event-consumer.interface';

type Route = {
  isValid: (value: unknown) => boolean;
  handler: (message: unknown, meta: MessageMeta) => Promise<void>;
};

const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 60_000;

// Starts on onApplicationBootstrap, after every module's onModuleInit has had a chance to subscribe.
// Connects in the background, retrying, so a service still starts (and serves HTTP) while Kafka is down.
@Injectable()
export class KafkajsEventConsumer
  implements IEventConsumer, OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(KafkajsEventConsumer.name);
  private readonly consumer: Consumer;
  private readonly routes = new Map<string, Route>();
  private stopped = false;
  private retryTimer: NodeJS.Timeout | undefined;

  constructor(config: ConfigService, clientId: string, groupId: string) {
    const kafkaBrokers = config.get<string>('KAFKA_BROKERS');
    if (!kafkaBrokers) {
      throw new Error('KAFKA_BROKERS is not configured');
    }
    const kafka = new Kafka({ clientId, brokers: kafkaBrokers.split(',') });
    this.consumer = kafka.consumer({ groupId });
  }

  subscribe<T>(
    topic: string,
    isValid: (value: unknown) => value is T,
    handler: (message: T, meta: MessageMeta) => Promise<void>,
  ): void {
    this.routes.set(topic, { isValid, handler });
  }

  onApplicationBootstrap(): void {
    if (this.routes.size === 0) return;
    void this.start(MIN_RETRY_MS);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    await this.consumer.disconnect();
  }

  private async start(retryMs: number): Promise<void> {
    try {
      await this.consumer.connect();
      // fromBeginning only applies to a group with no committed offset yet — don't lose what was
      // published before this service's first start.
      await this.consumer.subscribe({
        topics: [...this.routes.keys()],
        fromBeginning: true,
      });
      await this.consumer.run({ eachMessage: (p) => this.dispatch(p) });
    } catch (err) {
      if (this.stopped) return;
      this.logger.warn(
        `Kafka consumer failed to start, retrying in ${retryMs} ms: ${(err as Error).message}`,
      );
      await this.consumer.disconnect().catch(() => undefined);
      this.retryTimer = setTimeout(
        () => void this.start(Math.min(retryMs * 2, MAX_RETRY_MS)),
        retryMs,
      );
    }
  }

  /** Public for tests. Invalid messages resolve (offset commits); handler errors reject (kafkajs retries). */
  async dispatch({ topic, partition, message }: EachMessagePayload) {
    const route = this.routes.get(topic);
    if (!route) return;
    const meta: MessageMeta = {
      topic,
      key: message.key?.toString() ?? null,
      partition,
      offset: message.offset,
    };

    // A tombstone on a compacted topic: the key's data is gone, nothing to handle.
    if (message.value === null) return;

    let value: unknown;
    try {
      value = JSON.parse(message.value.toString());
    } catch {
      this.logger.warn(`Skipping non-JSON message on ${topic} @${meta.offset}`);
      return;
    }
    if (!route.isValid(value)) {
      this.logger.warn(
        `Skipping malformed message on ${topic} @${meta.offset}`,
      );
      return;
    }
    await route.handler(value, meta);
  }
}
