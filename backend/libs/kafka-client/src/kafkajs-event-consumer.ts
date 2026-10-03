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

// Starts on onApplicationBootstrap, after every module's onModuleInit has had a chance to subscribe.
@Injectable()
export class KafkajsEventConsumer
  implements IEventConsumer, OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(KafkajsEventConsumer.name);
  private readonly consumer: Consumer;
  private readonly routes = new Map<string, Route>();

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

  async onApplicationBootstrap(): Promise<void> {
    if (this.routes.size === 0) return;
    await this.consumer.connect();
    // fromBeginning only applies to a group with no committed offset yet — don't lose what was
    // published before this service's first start.
    await this.consumer.subscribe({
      topics: [...this.routes.keys()],
      fromBeginning: true,
    });
    await this.consumer.run({ eachMessage: (p) => this.dispatch(p) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
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

    // A tombstone on a compacted topic — the matching delete event is what consumers act on.
    if (message.value === null) return;

    let value: unknown;
    try {
      value = JSON.parse(message.value?.toString() ?? '');
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
