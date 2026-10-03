import {
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { IEventPublisher } from '../event-publisher.interface';
import type { IOutboxStore } from './outbox-store.interface';

export interface OutboxRelayOptions {
  batchSize: number;
  /** First retry delay after a failed publish, doubling up to maxRetryMs. */
  minRetryMs: number;
  maxRetryMs: number;
}

const DEFAULTS: OutboxRelayOptions = {
  batchSize: 100,
  minRetryMs: 1_000,
  maxRetryMs: 60_000,
};

/**
 * Publishes saved outbox events in order, deleting each once Kafka has it (at-least-once). Runs on
 * startup (leftovers from a crash) and whenever notify() is called after a commit — no polling.
 */
export class OutboxRelay implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private readonly options: OutboxRelayOptions;
  private running: Promise<void> | null = null;
  private again = false;
  private stopped = false;
  private retryTimer: NodeJS.Timeout | undefined;
  private retryDelayMs: number;

  constructor(
    private readonly store: IOutboxStore,
    private readonly publisher: IEventPublisher,
    options: Partial<OutboxRelayOptions> = {},
  ) {
    this.options = { ...DEFAULTS, ...options };
    this.retryDelayMs = this.options.minRetryMs;
  }

  onApplicationBootstrap(): void {
    this.notify();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    clearTimeout(this.retryTimer);
  }

  /** Call after committing a transaction that added events. Never throws. */
  notify(): void {
    if (this.stopped) return;
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = this.drain().finally(() => {
      this.running = null;
      if (this.again) {
        this.again = false;
        this.notify();
      }
    });
  }

  /** Resolves once no drain is running. For tests. */
  async idle(): Promise<void> {
    while (this.running) await this.running;
  }

  private async drain(): Promise<void> {
    clearTimeout(this.retryTimer);
    try {
      for (;;) {
        const batch = await this.store.next(this.options.batchSize);
        if (batch.length === 0) break;
        for (const event of batch) {
          await this.publisher.publish(event.topic, event.key, event.payload);
          await this.store.remove(event.id);
        }
      }
      this.retryDelayMs = this.options.minRetryMs;
    } catch (err) {
      this.logger.warn(
        `Publishing outbox events failed, retrying in ${this.retryDelayMs} ms: ${(err as Error).message}`,
      );
      if (this.stopped) return;
      this.retryTimer = setTimeout(() => this.notify(), this.retryDelayMs);
      this.retryDelayMs = Math.min(
        this.retryDelayMs * 2,
        this.options.maxRetryMs,
      );
    }
  }
}
