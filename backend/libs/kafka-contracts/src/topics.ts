// This project's Kafka topics, all keyed by user id. Must match devops/kafka's kafka-init list and
// docs/specs/event-schemas.md exactly.
export const KAFKA_TOPICS = {
  USER_REGISTERED: 'auth.user-registered',
  USER_DELETED: 'auth.user-deleted',
  /** Compacted: the latest message per user is kept; a null value (tombstone) when deleted. */
  USER_STATE: 'users.user-state',
} as const;
