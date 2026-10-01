import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  UnrecoverableError,
  Worker,
  type ConnectionOptions,
  type Job,
} from 'bullmq';
import { redisConnectionFromUrl } from './redis-connection';
import type { IQueueConsumer, JobMeta } from './queue-consumer.interface';

type Route = {
  isValid: (value: unknown) => boolean;
  handler: (data: unknown, meta: JobMeta) => Promise<void>;
  concurrency: number;
};

// Workers start on onApplicationBootstrap, after every module's onModuleInit has had a chance to register.
@Injectable()
export class BullmqQueueConsumer
  implements IQueueConsumer, OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(BullmqQueueConsumer.name);
  private readonly connection: ConnectionOptions;
  private readonly routes = new Map<string, Route>();
  private readonly workers: Worker[] = [];

  constructor(config: ConfigService) {
    this.connection = redisConnectionFromUrl(
      config.getOrThrow<string>('REDIS_URL'),
    );
  }

  process<T>(
    queue: string,
    isValid: (value: unknown) => value is T,
    handler: (data: T, meta: JobMeta) => Promise<void>,
    options: { concurrency?: number } = {},
  ): void {
    this.routes.set(queue, {
      isValid,
      handler,
      concurrency: options.concurrency ?? 1,
    });
  }

  onApplicationBootstrap(): void {
    for (const [queue, route] of this.routes) {
      const worker = new Worker(queue, (job) => this.run(route, job), {
        connection: this.connection,
        concurrency: route.concurrency,
      });
      worker.on('failed', (job, err) => {
        const final = !job || job.attemptsMade >= (job.opts.attempts ?? 1);
        this.logger.warn(
          `Job ${job?.id} on ${queue} failed (attempt ${job?.attemptsMade}, ${final ? 'giving up' : 'will retry'}): ${err.message}`,
        );
      });
      worker.on('error', (err) =>
        this.logger.warn(`Worker ${queue}: ${err.message}`),
      );
      this.workers.push(worker);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
  }

  /** Public for tests. Invalid data → UnrecoverableError (no retry); handler errors propagate (retry). */
  async run(route: Route, job: Job): Promise<void> {
    if (!route.isValid(job.data)) {
      throw new UnrecoverableError(`Malformed job on ${job.queueName}`);
    }
    const progress: Record<string, unknown> =
      typeof job.progress === 'object' && job.progress !== null
        ? { ...(job.progress as Record<string, unknown>) }
        : {};
    await route.handler(job.data, {
      queue: job.queueName,
      jobId: job.id ?? '',
      attempt: job.attemptsMade + 1,
      attemptsAllowed: job.opts.attempts ?? 1,
      progress,
      saveProgress: async (patch) => {
        Object.assign(progress, patch);
        await job.updateProgress({ ...progress });
      },
    });
  }
}
