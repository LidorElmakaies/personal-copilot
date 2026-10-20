import { isReminderDueMessage, QUEUES } from '@app/queue-contracts';
import { ReminderDueConsumer } from './reminder-due.consumer';
import type { ICustomReminderScheduler } from '../../application/interfaces/custom-reminder-scheduler.interface';
import type { IReminderScheduler } from '../../application/interfaces/reminder-scheduler.interface';

describe('ReminderDueConsumer', () => {
  let process: jest.Mock;
  let candleFire: jest.Mock;
  let customFire: jest.Mock;

  const register = () => {
    process = jest.fn();
    candleFire = jest.fn().mockResolvedValue(undefined);
    customFire = jest.fn().mockResolvedValue(undefined);
    new ReminderDueConsumer(
      { process },
      { fire: candleFire } as unknown as IReminderScheduler,
      { fire: customFire } as unknown as ICustomReminderScheduler,
    ).onModuleInit();
    const [queue, guard, handler] = process.mock.calls[0] as [
      string,
      unknown,
      (m: unknown) => Promise<void>,
    ];
    return { queue, guard, handler };
  };

  const candle = {
    reminderId: 'r-1',
    fireAt: '2026-10-09T13:25:00.000Z',
    candleLighting: '2026-10-09T14:55:00.000Z',
  };
  const custom = {
    kind: 'custom',
    reminderId: 'c-1',
    fireAt: '2026-10-21T05:00:00.000Z',
  };

  it('registers the reminder-due queue with its guard, once', () => {
    const { queue, guard } = register();
    expect(process).toHaveBeenCalledTimes(1);
    expect(queue).toBe(QUEUES.REMINDER_DUE);
    expect(guard).toBe(isReminderDueMessage);
  });

  it('a custom job goes to the custom scheduler only', async () => {
    const { handler } = register();
    await handler(custom);
    expect(customFire).toHaveBeenCalledWith(custom);
    expect(candleFire).not.toHaveBeenCalled();
  });

  it.each([
    ['queued before `kind` existed (none)', candle],
    ['with kind shabbat_candles', { ...candle, kind: 'shabbat_candles' }],
  ])(
    'a candle-lighting job %s goes to the candle scheduler only',
    async (_n, m) => {
      const { handler } = register();
      await handler(m);
      expect(candleFire).toHaveBeenCalledWith(m);
      expect(customFire).not.toHaveBeenCalled();
    },
  );

  it('a scheduler error propagates, so BullMQ retries the job', async () => {
    const { handler } = register();
    customFire.mockRejectedValueOnce(new Error('db down'));
    await expect(handler(custom)).rejects.toThrow('db down');
    candleFire.mockRejectedValueOnce(new Error('redis down'));
    await expect(handler(candle)).rejects.toThrow('redis down');
  });
});
