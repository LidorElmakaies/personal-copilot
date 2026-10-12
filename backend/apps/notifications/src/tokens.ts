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
export const FCM_DEVICE_SERVICE = Symbol('IFcmDeviceService');
export const FCM_DEVICE_REPOSITORY = Symbol('IFcmDeviceRepository');
export const FCM_SENDER = Symbol('IFcmSender');
/** FcmConfig, or null when FCM_* isn't set (the FCM channel is then off). */
export const FCM_CONFIG = Symbol('FcmConfig');
