// This project's BullMQ queues. See docs/specs/event-schemas.md.
export const QUEUES = {
  NOTIFICATION_REQUESTED: 'notification-requested',
  /** Reminders → itself: a reminder's delayed next firing. */
  REMINDER_DUE: 'reminder-due',
} as const;
