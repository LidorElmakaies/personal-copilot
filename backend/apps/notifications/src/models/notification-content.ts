/** What the user sees; also the Web Push payload, encrypted for the browser (see docs/specs/services.md#notifications). */
export interface NotificationContent {
  notificationId: string;
  title: string;
  body: string;
  url?: string;
}
