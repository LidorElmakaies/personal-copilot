import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { REMINDER_SCHEDULER } from '../../tokens';
import type { IReminderScheduler } from '../../application/interfaces/reminder-scheduler.interface';

export const SWEEP_INTERVAL_MS = 15 * 60_000;

// Clock entry point: at startup and every 15 min, makes Redis match the database — every enabled
// reminder gets exactly its job (idempotent: same job ids). The safety net behind the immediate
// rescheduling on save, profile change and firing; whatever failed there is fixed by the next sweep.
@Injectable()
export class ReminderSweeper
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ReminderSweeper.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    @Inject(REMINDER_SCHEDULER) private readonly scheduler: IReminderScheduler,
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
      const failed = await this.scheduler.rescheduleAll();
      if (failed > 0) {
        this.logger.warn(
          `${failed} reminder(s) not scheduled; next sweep in 15 min`,
        );
      }
    } catch (err) {
      this.logger.warn(`Sweep failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }
}
