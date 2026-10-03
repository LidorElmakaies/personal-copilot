import type { ConfigService } from '@nestjs/config';
import type { EachMessagePayload } from 'kafkajs';
import { KafkajsEventConsumer } from './kafkajs-event-consumer';

const config = { get: () => 'localhost:9092' } as unknown as ConfigService;
const isNamed = (v: unknown): v is { name: string } =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as { name?: unknown }).name === 'string';

function payload(
  topic: string,
  value: string | null,
  key = 'user-1',
): EachMessagePayload {
  return {
    topic,
    partition: 2,
    message: {
      key: Buffer.from(key),
      value: value === null ? null : Buffer.from(value),
      offset: '7',
    },
  } as unknown as EachMessagePayload;
}

describe('KafkajsEventConsumer.dispatch', () => {
  let consumer: KafkajsEventConsumer;
  let handler: jest.Mock;

  beforeEach(() => {
    consumer = new KafkajsEventConsumer(config, 'test', 'test-group');
    handler = jest.fn().mockResolvedValue(undefined);
    consumer.subscribe('greetings', isNamed, handler);
  });

  it('passes a valid message and its metadata to the handler', async () => {
    await consumer.dispatch(payload('greetings', '{"name":"Lidor"}'));
    expect(handler).toHaveBeenCalledWith(
      { name: 'Lidor' },
      { topic: 'greetings', key: 'user-1', partition: 2, offset: '7' },
    );
  });

  it.each([
    ['non-JSON', 'not json{'],
    ['tombstone (null value)', null],
    ['empty', ''],
    ['wrong shape', '{"nome":"x"}'],
  ])('skips a %s message without throwing', async (_name, value) => {
    await expect(
      consumer.dispatch(payload('greetings', value)),
    ).resolves.toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores a topic it has no handler for', async () => {
    await consumer.dispatch(payload('other', '{"name":"x"}'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('rethrows a handler error so kafkajs retries the message', async () => {
    handler.mockRejectedValueOnce(new Error('push service down'));
    await expect(
      consumer.dispatch(payload('greetings', '{"name":"x"}')),
    ).rejects.toThrow('push service down');
  });

  type Inner = {
    consumer: {
      connect: () => Promise<void>;
      disconnect: () => Promise<void>;
    };
  };
  const inner = (c: KafkajsEventConsumer) => (c as unknown as Inner).consumer;

  it("doesn't connect at all when nothing subscribed", () => {
    const idle = new KafkajsEventConsumer(config, 'test', 'idle-group');
    const connect = jest.spyOn(inner(idle), 'connect');
    idle.onApplicationBootstrap();
    expect(connect).not.toHaveBeenCalled();
  });

  it("doesn't block startup while Kafka is down, and keeps retrying with a growing delay", async () => {
    jest.useFakeTimers();
    try {
      const connect = jest
        .spyOn(inner(consumer), 'connect')
        .mockRejectedValue(new Error('broker down'));
      jest.spyOn(inner(consumer), 'disconnect').mockResolvedValue();

      expect(consumer.onApplicationBootstrap()).toBeUndefined(); // returns at once
      await jest.advanceTimersByTimeAsync(0);
      expect(connect).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1_000);
      expect(connect).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(1_999); // next delay is 2 s
      expect(connect).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(1);
      expect(connect).toHaveBeenCalledTimes(3);

      await consumer.onModuleDestroy();
      await jest.advanceTimersByTimeAsync(60_000);
      expect(connect).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });
});
