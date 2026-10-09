// This project's Kafka topics. Must match devops/kafka's kafka-init list and
// docs/specs/event-schemas.md exactly.
export const KAFKA_TOPICS = {
  /** Compacted: the latest message per user is kept; a null value (tombstone) when deleted. */
  USER_STATE: 'users.user-state',
  /** Compacted, keyed by platform: the newest published app release (apk.js publish). */
  FRONTEND_RELEASES: 'frontend.releases',
} as const;
