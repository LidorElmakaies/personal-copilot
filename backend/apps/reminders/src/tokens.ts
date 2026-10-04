// DI injection tokens for the Reminders Service app.
export const REMINDER_SERVICE = Symbol('IReminderService');
export const REMINDER_REPOSITORY = Symbol('IReminderRepository');
export const USER_LOCATION_READER = Symbol('IUserLocationReader');
export const REMINDER_SCHEDULER = Symbol('IReminderScheduler');
export const CANDLE_LIGHTING_SOURCE = Symbol('ICandleLightingSource');
export const SHABBAT_CALENDAR = Symbol('IShabbatCalendar');
export const QUEUE_PUBLISHER = Symbol('IQueuePublisher');
export const QUEUE_CONSUMER = Symbol('IQueueConsumer');
export const EVENT_CONSUMER = Symbol('IEventConsumer');
