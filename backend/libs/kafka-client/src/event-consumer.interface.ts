/** Implemented by KafkajsEventConsumer — Application code never imports kafkajs directly. */
export interface IEventConsumer {
  /** Subscribes `groupId` to `topic`; `onMessage` receives each value, already JSON-parsed. */
  subscribe<T extends object>(
    topic: string,
    groupId: string,
    onMessage: (message: T) => Promise<void>,
  ): Promise<void>;
}
