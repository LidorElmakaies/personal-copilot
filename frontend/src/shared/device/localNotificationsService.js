// Phone-scheduled notifications are the Android app's only (localNotificationsService.android.js).
// Everywhere else — the web build — there's nothing to schedule: every call does nothing.
export const ID_PREFIX = 'rem:';
export const isSupported = () => false;
export const ensureChannel = async () => {};
export const schedule = async () => {};
export const cancel = async () => {};
export const listScheduled = async () => [];
export const watchTaps = () => () => {};
