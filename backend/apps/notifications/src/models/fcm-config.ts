/** The Firebase service-account key FCM messages are sent with (FCM_* env) — see
 * docs/notifications/environment.md. Never logged. */
export interface FcmConfig {
  projectId: string;
  clientEmail: string;
  /** PEM. */
  privateKey: string;
}
