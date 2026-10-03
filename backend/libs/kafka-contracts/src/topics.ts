// This project's Kafka topics, all keyed by user id. Must match devops/kafka's kafka-init list and
// docs/specs/event-schemas.md exactly.
export const KAFKA_TOPICS = {
  /** Compacted: the latest message per user is kept; a null value (tombstone) when deleted. */
  USER_STATE: 'users.user-state',
  USER_DELETED: 'users.user-deleted',
} as const;
