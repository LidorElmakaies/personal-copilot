// DI injection tokens for the Notification Service app.
export const PUSH_SUBSCRIPTION_SERVICE = Symbol('IPushSubscriptionService');
export const PUSH_SUBSCRIPTION_REPOSITORY = Symbol(
  'IPushSubscriptionRepository',
);
export const VAPID_CONFIG = Symbol('VapidConfig');
export const NOTIFICATION_DELIVERY_SERVICE = Symbol(
  'INotificationDeliveryService',
);
/** INotificationChannel[] — every channel this service can deliver on. */
export const NOTIFICATION_CHANNELS = Symbol('INotificationChannel[]');
export const PUSH_SENDER = Symbol('IPushSender');
export const QUEUE_CONSUMER = Symbol('IQueueConsumer');
