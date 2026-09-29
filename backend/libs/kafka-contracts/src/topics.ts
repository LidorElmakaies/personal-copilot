// This project's Kafka topics. Must match devops/kafka's kafka-init list and
// docs/specs/event-schemas.md exactly.
export const KAFKA_TOPICS = {
  NOTIFICATION_REQUESTED: 'notification.requested',
} as const;
