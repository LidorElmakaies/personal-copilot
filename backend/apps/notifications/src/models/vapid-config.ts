/** The server's VAPID identity — see docs/specs/services.md#notifications. */
export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}
