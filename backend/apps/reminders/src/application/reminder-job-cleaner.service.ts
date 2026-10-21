import { Inject, Injectable } from '@nestjs/common';
import type { DelayedJob, IQueuePublisher } from '@app/queue-client';
import {
  isReminderDueMessage,
  QUEUES,
  type ReminderDueMessage,
} from '@app/queue-contracts';
import {
  CUSTOM_REMINDER_REPOSITORY,
  QUEUE_PUBLISHER,
  REMINDER_REPOSITORY,
} from '../tokens';
import type { ICustomReminderRepository } from '../infrastructure/interfaces/custom-reminder-repository.interface';
import type { IReminderRepository } from '../infrastructure/interfaces/reminder-repository.interface';
import type { IReminderJobCleaner } from './interfaces/reminder-job-cleaner.interface';

type ReminderJob = DelayedJob & { data: ReminderDueMessage };

// Only a missing row makes a job an orphan. A row is saved before its job is queued, so a reminder
// being created right now is never taken for one; a job left by a moved fire time is removed by
// the save itself (and does nothing if it fires).
@Injectable()
export class ReminderJobCleaner implements IReminderJobCleaner {
  constructor(
    @Inject(QUEUE_PUBLISHER) private readonly queue: IQueuePublisher,
    @Inject(REMINDER_REPOSITORY)
    private readonly reminders: IReminderRepository,
    @Inject(CUSTOM_REMINDER_REPOSITORY)
    private readonly customReminders: ICustomReminderRepository,
  ) {}

  async removeOrphans(): Promise<number> {
    const jobs = (await this.queue.delayed(QUEUES.REMINDER_DUE)).filter(
      (j): j is ReminderJob => isReminderDueMessage(j.data),
    );
    const custom = jobs.filter((j) => j.data.kind === 'custom');
    const candles = jobs.filter((j) => j.data.kind !== 'custom');
    const orphans = [
      ...(await this.orphansAmong(custom, this.customReminders)),
      ...(await this.orphansAmong(candles, this.reminders)),
    ];
    for (const job of orphans) {
      await this.queue.remove(QUEUES.REMINDER_DUE, job.jobId);
    }
    return orphans.length;
  }

  private async orphansAmong(
    jobs: ReminderJob[],
    repo: { existingIds(ids: string[]): Promise<Set<string>> },
  ): Promise<ReminderJob[]> {
    if (jobs.length === 0) return [];
    const existing = await repo.existingIds(jobs.map((j) => j.data.reminderId));
    return jobs.filter((j) => !existing.has(j.data.reminderId));
  }
}
