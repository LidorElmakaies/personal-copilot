import type {
  DelayedJob,
  IQueuePublisher,
  PublishOptions,
} from '@app/queue-client';
import {
  QUEUES,
  type NotificationRequestedMessage,
  type ReminderDueMessage,
} from '@app/queue-contracts';

/**
 * Behaves like BullMQ for what the schedulers rely on: job ids, dedupe ids, delays, remove.
 * `M` is the kind of `reminder-due` job a spec queues.
 */
export class FakeQueue<
  M extends ReminderDueMessage = ReminderDueMessage,
> implements IQueuePublisher {
  readonly jobs = new Map<
    string,
    { queue: string; data: object; runAt: number; done: boolean }
  >();
  readonly notifications: NotificationRequestedMessage[] = [];
  private readonly dedupeUntil = new Map<string, number>();
  private seq = 0;

  publish<T extends object>(
    queue: string,
    data: T,
    o: PublishOptions = {},
  ): Promise<void> {
    const t = Date.now();
    if (o.dedupeId && (this.dedupeUntil.get(o.dedupeId) ?? 0) > t) {
      return Promise.resolve();
    }
    if (o.dedupeId) this.dedupeUntil.set(o.dedupeId, t + (o.dedupeTtlMs ?? 0));
    const id = o.jobId ?? `auto-${++this.seq}`;
    if (this.jobs.has(id)) return Promise.resolve(); // same id: a no-op, even when finished
    this.jobs.set(id, {
      queue,
      data,
      runAt: t + (o.delayMs ?? 0),
      done: false,
    });
    if (queue === QUEUES.NOTIFICATION_REQUESTED) {
      this.notifications.push(data as unknown as NotificationRequestedMessage);
    }
    return Promise.resolve();
  }

  remove(_queue: string, jobId: string): Promise<void> {
    if (!this.jobs.get(jobId)?.done) this.jobs.delete(jobId);
    return Promise.resolve();
  }

  delayed(queue: string): Promise<DelayedJob[]> {
    const now = Date.now();
    return Promise.resolve(
      [...this.jobs]
        .filter(([, j]) => j.queue === queue && !j.done && j.runAt > now)
        .map(([jobId, j]) => ({ jobId, data: j.data })),
    );
  }

  pending(): Array<{ id: string; runAt: number; data: M }> {
    return [...this.jobs]
      .filter(([, j]) => j.queue === QUEUES.REMINDER_DUE && !j.done)
      .map(([id, j]) => ({
        id,
        runAt: j.runAt,
        data: j.data as M,
      }));
  }
}
