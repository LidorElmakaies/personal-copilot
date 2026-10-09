import { ReminderSweeper, SWEEP_INTERVAL_MS } from './reminder-sweeper';
import type { IReminderScheduler } from '../../application/interfaces/reminder-scheduler.interface';

describe('ReminderSweeper', () => {
  let rescheduleAll: jest.Mock<Promise<number>, []>;
  let sweeper: ReminderSweeper;

  beforeEach(() => {
    jest.useFakeTimers();
    rescheduleAll = jest.fn<Promise<number>, []>().mockResolvedValue(0);
    sweeper = new ReminderSweeper({
      rescheduleAll,
    } as unknown as IReminderScheduler);
  });

  afterEach(() => {
    sweeper.onModuleDestroy();
    jest.useRealTimers();
  });

  it('sweeps at startup and then every 15 minutes', async () => {
    sweeper.onApplicationBootstrap();
    expect(rescheduleAll).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS);
    expect(rescheduleAll).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS);
    expect(rescheduleAll).toHaveBeenCalledTimes(3);
  });

  it('keeps sweeping after a failed sweep', async () => {
    rescheduleAll.mockRejectedValueOnce(new Error('database down'));
    rescheduleAll.mockResolvedValueOnce(2); // two reminders failed
    sweeper.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(2 * SWEEP_INTERVAL_MS);
    expect(rescheduleAll).toHaveBeenCalledTimes(3);
  });

  it("skips a tick while the previous sweep hasn't finished", async () => {
    let finish!: (n: number) => void;
    rescheduleAll.mockReturnValueOnce(new Promise((r) => (finish = r)));
    sweeper.onApplicationBootstrap();

    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS);
    expect(rescheduleAll).toHaveBeenCalledTimes(1);

    finish(0);
    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS);
    expect(rescheduleAll).toHaveBeenCalledTimes(2);
  });

  it('stops on shutdown', async () => {
    sweeper.onApplicationBootstrap();
    sweeper.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(3 * SWEEP_INTERVAL_MS);
    expect(rescheduleAll).toHaveBeenCalledTimes(1);
  });
});
