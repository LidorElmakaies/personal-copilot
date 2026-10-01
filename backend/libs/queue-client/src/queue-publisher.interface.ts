export interface PublishOptions {
  /** A second job with the same id is dropped while the first exists / within `dedupeTtlMs`. */
  dedupeId?: string;
  /** How long the dedupe id blocks repeats; omitted = until the job completes or fails. */
  dedupeTtlMs?: number;
  /** Run the job this long from now instead of immediately (a delayed job). */
  delayMs?: number;
  /** Total tries, including the first (default 1 = no retry). */
  attempts?: number;
  /** First retry delay; doubles on each further retry. */
  backoffMs?: number;
}

/** Implemented by BullmqQueuePublisher — Application code never imports bullmq directly. */
export interface IQueuePublisher {
  publish<T extends object>(
    queue: string,
    data: T,
    options?: PublishOptions,
  ): Promise<void>;
}
