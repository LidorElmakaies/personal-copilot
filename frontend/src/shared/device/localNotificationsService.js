// Phone-scheduled notifications are Android's (localNotificationsService.android.js). Elsewhere —
// Jest's default platform — there's nothing to schedule: every call does nothing.
export const ID_PREFIX = 'rem:';
export const isSupported = () => false;
export const ensureChannel = async () => {};
export const getPermission = async () => 'unsupported';
export const requestPermission = async () => 'unsupported';
export const openSettings = async () => {};
export const schedule = async () => {};
export const cancel = async () => {};
export const listScheduled = async () => [];
export const watchTaps = () => () => {};
