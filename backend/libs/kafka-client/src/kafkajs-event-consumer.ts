import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka } from 'kafkajs';
import type { IEventConsumer } from './event-consumer.interface';

// One kafkajs Consumer per subscribe() call (each needs its own groupId) — tracked here so
// onModuleDestroy can disconnect all of them.
@Injectable()
export class KafkajsEventConsumer implements IEventConsumer, OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly consumers: Consumer[] = [];

  constructor(config: ConfigService, clientId: string) {
    const kafkaBrokers = config.get<string>('KAFKA_BROKERS');
    if (!kafkaBrokers) {
      throw new Error('KAFKA_BROKERS is not configured');
    }
    this.kafka = new Kafka({ clientId, brokers: kafkaBrokers.split(',') });
  }

  async subscribe<T extends object>(
    topic: string,
    groupId: string,
    onMessage: (message: T) => Promise<void>,
  ): Promise<void> {
    const consumer = this.kafka.consumer({ groupId });
    this.consumers.push(consumer);
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        await onMessage(JSON.parse(message.value.toString()) as T);
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.consumers.map((c) => c.disconnect()));
  }
}
