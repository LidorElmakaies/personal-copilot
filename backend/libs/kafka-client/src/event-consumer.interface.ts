export interface MessageMeta {
  topic: string;
  key: string | null;
  partition: number;
  offset: string;
}

/** Implemented by KafkajsEventConsumer — Application code never imports kafkajs directly. */
export interface IEventConsumer {
  /**
   * Registers a handler; call before the app finishes bootstrapping (e.g. in onModuleInit).
   * Messages that aren't JSON or fail `isValid` are logged and skipped, tombstones (null value)
   * skipped silently; a handler that throws is retried by kafkajs.
   */
  subscribe<T>(
    topic: string,
    isValid: (value: unknown) => value is T,
    handler: (message: T, meta: MessageMeta) => Promise<void>,
  ): void;
}
