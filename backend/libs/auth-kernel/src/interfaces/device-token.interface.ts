/** Implemented by DeviceTokenService — the anonymous identity of one app install (Gateway's /ws). */
export interface IDeviceTokenService {
  /** A new device id, signed. */
  issue(): string;
  /** The device id, or null if the token is missing or isn't a valid device token. */
  verify(token: string | null | undefined): string | null;
}
