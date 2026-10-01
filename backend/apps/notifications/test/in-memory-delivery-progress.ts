import type { IDeliveryProgress } from '../src/application/interfaces/delivery-progress.interface';

/** Same contract as the job-progress adapter in NotificationRequestedConsumer. */
export class InMemoryDeliveryProgress implements IDeliveryProgress {
  readonly done = new Set<string>();

  isDone(key: string): boolean {
    return this.done.has(key);
  }

  markDone(key: string): Promise<void> {
    this.done.add(key);
    return Promise.resolve();
  }
}
