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
    ['empty', null],
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

  it("doesn't connect at all when nothing subscribed", async () => {
    const idle = new KafkajsEventConsumer(config, 'test', 'idle-group');
    const connect = jest.spyOn(
      (idle as unknown as { consumer: { connect: () => Promise<void> } })
        .consumer,
      'connect',
    );
    await idle.onApplicationBootstrap();
    expect(connect).not.toHaveBeenCalled();
  });
});
