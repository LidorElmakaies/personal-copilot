import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  CUSTOM_REMINDER_SCHEDULER,
  REMINDER_JOB_CLEANER,
  REMINDER_SCHEDULER,
} from '../../tokens';
import type { ICustomReminderScheduler } from '../../application/interfaces/custom-reminder-scheduler.interface';
import type { IReminderJobCleaner } from '../../application/interfaces/reminder-job-cleaner.interface';
import type { IReminderScheduler } from '../../application/interfaces/reminder-scheduler.interface';

export const SWEEP_INTERVAL_MS = 15 * 60_000;

// Clock entry point: at startup and every 15 min, queues every reminder's next job (same job ids, so
// idempotent) and removes deleted reminders' jobs — the safety net, see docs/specs/services.md#reminders.
@Injectable()
export class ReminderSweeper
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ReminderSweeper.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    @Inject(REMINDER_SCHEDULER) private readonly scheduler: IReminderScheduler,
    @Inject(CUSTOM_REMINDER_SCHEDULER)
    private readonly custom: ICustomReminderScheduler,
    @Inject(REMINDER_JOB_CLEANER)
    private readonly cleaner: IReminderJobCleaner,
  ) {}

  onApplicationBootstrap(): void {
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /** Public for tests. Skips a tick while the previous sweep is still going. */
  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const failed =
        (await this.scheduler.rescheduleAll()) +
        (await this.custom.rescheduleAll());
      if (failed > 0) {
        this.logger.warn(
          `${failed} reminder(s) not scheduled; next sweep in 15 min`,
        );
      }
      const removed = await this.cleaner.removeOrphans();
      if (removed > 0) {
        this.logger.log(`Removed ${removed} job(s) of deleted reminders`);
      }
    } catch (err) {
      this.logger.warn(`Sweep failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }
}
