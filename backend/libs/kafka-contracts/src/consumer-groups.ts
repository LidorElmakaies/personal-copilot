// One id per consuming service — avoids a typo in a module silently creating a second group.
export const KAFKA_CONSUMER_GROUPS = {
  USERS: 'users',
  REMINDERS: 'reminders',
  NOTIFICATIONS: 'notifications',
} as const;
