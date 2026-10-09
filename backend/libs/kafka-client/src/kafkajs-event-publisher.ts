import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import type { IEventPublisher } from './event-publisher.interface';

// Connects on first publish, not at boot, so a service still starts while Kafka is down.
@Injectable()
export class KafkajsEventPublisher implements IEventPublisher, OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private connecting: Promise<void> | null = null;

  constructor(config: ConfigService, clientId: string) {
    const kafkaBrokers = config.get<string>('KAFKA_BROKERS');
    if (!kafkaBrokers) {
      throw new Error('KAFKA_BROKERS is not configured');
    }
    this.kafka = new Kafka({ clientId, brokers: kafkaBrokers.split(',') });
    // Idempotent + one request in flight: a retried send can't duplicate or reorder a key's messages.
    this.producer = this.kafka.producer({
      idempotent: true,
      maxInFlightRequests: 1,
    });
    this.producer.on(this.producer.events.DISCONNECT, () => {
      this.connecting = null;
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connecting) await this.producer.disconnect();
  }

  async publish(
    topic: string,
    key: string,
    message: object | null,
  ): Promise<void> {
    await this.ensureConnected();
    await this.producer.send({
      topic,
      messages: [
        { key, value: message === null ? null : JSON.stringify(message) },
      ],
    });
  }

  /** A failed connect is forgotten, so the next publish (an outbox retry) tries again. */
  private ensureConnected(): Promise<void> {
    this.connecting ??= this.producer.connect().catch((err: unknown) => {
      this.connecting = null;
      throw err;
    });
    return this.connecting;
  }
}
