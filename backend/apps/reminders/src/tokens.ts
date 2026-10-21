// DI injection tokens for the Reminders Service app.
export const REMINDER_SERVICE = Symbol('IReminderService');
export const REMINDER_REPOSITORY = Symbol('IReminderRepository');
export const USER_LOCATION_READER = Symbol('IUserLocationReader');
export const REMINDER_SCHEDULER = Symbol('IReminderScheduler');
export const CUSTOM_REMINDER_SERVICE = Symbol('ICustomReminderService');
export const CUSTOM_REMINDER_SCHEDULER = Symbol('ICustomReminderScheduler');
export const CUSTOM_REMINDER_REPOSITORY = Symbol('ICustomReminderRepository');
export const REMINDER_JOB_CLEANER = Symbol('IReminderJobCleaner');
export const REMINDER_OCCURRENCES = Symbol('IReminderOccurrences');
export const CANDLE_LIGHTING_SOURCE = Symbol('ICandleLightingSource');
export const SHABBAT_CALENDAR = Symbol('IShabbatCalendar');
export const QUEUE_PUBLISHER = Symbol('IQueuePublisher');
export const QUEUE_CONSUMER = Symbol('IQueueConsumer');
export const EVENT_CONSUMER = Symbol('IEventConsumer');
