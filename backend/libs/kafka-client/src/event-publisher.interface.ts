/** Implemented by KafkajsEventPublisher — Application code never imports kafkajs directly. */
export interface IEventPublisher {
  publish<T extends object>(
    topic: string,
    key: string,
    message: T,
  ): Promise<void>;
}
