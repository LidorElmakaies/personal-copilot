import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import type { IEventPublisher } from './event-publisher.interface';

// Raw kafkajs Producer, not @nestjs/microservices' ClientKafka — that's built around request/reply
// topics, which fire-and-forget `emit` has no use for.
@Injectable()
export class KafkajsEventPublisher
  implements IEventPublisher, OnModuleInit, OnModuleDestroy
{
  private readonly kafka: Kafka;
  private readonly producer: Producer;

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
  }

  async onModuleInit(): Promise<void> {
    await this.producer.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
  }

  async publish(
    topic: string,
    key: string,
    message: object | null,
  ): Promise<void> {
    await this.producer.send({
      topic,
      messages: [
        { key, value: message === null ? null : JSON.stringify(message) },
      ],
    });
  }
}
