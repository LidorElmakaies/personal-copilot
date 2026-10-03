import type { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Kafka, type Admin } from 'kafkajs';
import { KafkajsEventConsumer } from '../src/kafkajs-event-consumer';
import { KafkajsEventPublisher } from '../src/kafkajs-event-publisher';

// Opt-in: needs a real broker. KAFKA_IT_BROKERS=localhost:9092 npx jest kafka-roundtrip
const brokers = process.env.KAFKA_IT_BROKERS;
const maybe = brokers ? describe : describe.skip;

maybe('publisher → broker → consumer (real Kafka)', () => {
  const topic = `it-roundtrip-${randomUUID()}`; // own topic, never a real one
  const config = { get: () => brokers } as unknown as ConfigService;
  let admin: Admin;
  let publisher: KafkajsEventPublisher;
  let consumer: KafkajsEventConsumer;

  beforeAll(async () => {
    admin = new Kafka({
      clientId: 'it-admin',
      brokers: brokers!.split(','),
    }).admin();
    await admin.connect();
    await admin.createTopics({
      topics: [{ topic, numPartitions: 1 }],
      waitForLeaders: true,
    });
  }, 30_000);

  afterAll(async () => {
    await consumer?.onModuleDestroy();
    await publisher?.onModuleDestroy();
    await admin.deleteTopics({ topics: [topic] });
    await admin.disconnect();
  }, 30_000);

  it('delivers a published message to the subscribed handler, keyed and intact', async () => {
    const received = new Promise<{ message: unknown; key: string | null }>(
      (resolve) => {
        consumer = new KafkajsEventConsumer(
          config,
          'it-consumer',
          `it-${randomUUID()}`,
        );
        consumer.subscribe(
          topic,
          (v): v is { hello: string } =>
            typeof (v as { hello?: unknown })?.hello === 'string',
          (message, meta) => {
            resolve({ message, key: meta.key });
            return Promise.resolve();
          },
        );
      },
    );
    consumer.onApplicationBootstrap(); // starts in the background; fromBeginning catches the message

    publisher = new KafkajsEventPublisher(config, 'it-publisher');
    await publisher.publish(topic, 'user-42', { hello: 'world' });

    await expect(received).resolves.toEqual({
      message: { hello: 'world' },
      key: 'user-42',
    });
  }, 60_000);
});
