import { isUserStateMessage, KAFKA_TOPICS } from '@app/kafka-contracts';
import { UserStateConsumer } from './user-state.consumer';
import type { IReminderScheduler } from '../../application/interfaces/reminder-scheduler.interface';

describe('UserStateConsumer', () => {
  let subscribe: jest.Mock;
  let candle: jest.Mock;

  const register = () => {
    subscribe = jest.fn();
    candle = jest.fn().mockResolvedValue(undefined);
    new UserStateConsumer({ subscribe }, {
      rescheduleUser: candle,
    } as unknown as IReminderScheduler).onModuleInit();
    const [topic, guard, handler] = subscribe.mock.calls[0] as [
      string,
      unknown,
      (m: unknown) => Promise<void>,
    ];
    return { topic, guard, handler };
  };

  const message = {
    userId: 'u1',
    version: 3,
    firstName: null,
    lastName: null,
    phone: null,
    location: {
      lat: 32.1782,
      lon: 34.9076,
      updatedAt: '2026-10-20T10:00:00.000Z',
    },
  };

  it('subscribes to users.user-state with its guard', () => {
    const { topic, guard } = register();
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(topic).toBe(KAFKA_TOPICS.USER_STATE);
    expect(guard).toBe(isUserStateMessage);
    expect(isUserStateMessage(message)).toBe(true);
  });

  it('reschedules the user’s candle-lighting reminder (custom ones don’t depend on location)', async () => {
    const { handler } = register();
    await handler(message);
    expect(candle).toHaveBeenCalledWith('u1');
  });

  it('a failure rejects, so kafkajs redelivers the message', async () => {
    const { handler } = register();
    candle.mockRejectedValueOnce(new Error('db down'));
    await expect(handler(message)).rejects.toThrow('db down');
  });
});
