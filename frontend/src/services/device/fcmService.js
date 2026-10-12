// FCM is the Android app's only (fcmService.android.js). Everywhere else — the web build — there's
// nothing to register: browsers use pushService (Web Push).
export const isSupported = () => false;
export const watchPermission = () => () => {};
export const watchToken = () => () => {};
