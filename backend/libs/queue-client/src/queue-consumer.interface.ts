export interface JobMeta {
  queue: string;
  jobId: string;
  /** 1 on the first try. */
  attempt: number;
  attemptsAllowed: number;
  /** What earlier attempts of this job saved with `saveProgress` (empty on the first try). */
  progress: Readonly<Record<string, unknown>>;
  /** Merges into the job's progress; kept across retries, so a retry can skip work already done. */
  saveProgress(patch: Record<string, unknown>): Promise<void>;
}

/** Implemented by BullmqQueueConsumer — Application code never imports bullmq directly. */
export interface IQueueConsumer {
  /**
   * Registers a handler; call before the app finishes bootstrapping (e.g. in onModuleInit).
   * A job that fails `isValid` is failed without retry; a handler that throws is retried while the
   * job has attempts left (set by the publisher); resolving completes the job.
   */
  process<T>(
    queue: string,
    isValid: (value: unknown) => value is T,
    handler: (data: T, meta: JobMeta) => Promise<void>,
    options?: { concurrency?: number },
  ): void;
}
