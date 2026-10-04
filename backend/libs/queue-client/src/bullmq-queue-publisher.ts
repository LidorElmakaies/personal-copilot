import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Queue, type ConnectionOptions } from 'bullmq';
import { redisConnectionFromUrl } from './redis-connection';
import type {
  IQueuePublisher,
  PublishOptions,
} from './queue-publisher.interface';

// Finished jobs are kept a while for inspection, then Redis drops them.
const KEEP_COMPLETED_S = 24 * 60 * 60;
const KEEP_FAILED_S = 7 * 24 * 60 * 60;

@Injectable()
export class BullmqQueuePublisher
  implements IQueuePublisher, OnApplicationShutdown
{
  private readonly connection: ConnectionOptions;
  private readonly queues = new Map<string, Queue>();

  constructor(config: ConfigService) {
    this.connection = redisConnectionFromUrl(
      config.getOrThrow<string>('REDIS_URL'),
    );
  }

  async publish<T extends object>(
    queue: string,
    data: T,
    options: PublishOptions = {},
  ): Promise<void> {
    await this.queue(queue).add(queue, data, {
      jobId: options.jobId,
      deduplication: options.dedupeId
        ? { id: options.dedupeId, ttl: options.dedupeTtlMs }
        : undefined,
      delay: options.delayMs,
      attempts: options.attempts ?? 1,
      backoff: options.backoffMs
        ? { type: 'exponential', delay: options.backoffMs }
        : undefined,
      removeOnComplete: { age: KEEP_COMPLETED_S },
      removeOnFail: { age: KEEP_FAILED_S },
    });
  }

  async remove(queue: string, jobId: string): Promise<void> {
    await this.queue(queue).remove(jobId);
  }

  // After onModuleDestroy, i.e. once every Worker has finished its in-flight job (which may still publish).
  async onApplicationShutdown(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }

  private queue(name: string): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, { connection: this.connection });
      this.queues.set(name, q);
    }
    return q;
  }
}
