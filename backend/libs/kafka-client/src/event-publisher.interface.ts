/** Implemented by KafkajsEventPublisher — Application code never imports kafkajs directly. */
export interface IEventPublisher {
  /** `null` publishes a tombstone: on a compacted topic, Kafka eventually drops the key. */
  publish(topic: string, key: string, message: object | null): Promise<void>;
}
