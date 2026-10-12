export interface RegisterFcmDeviceInput {
  token: string;
  /** base64 of 32 bytes. */
  key: string;
}

/** Implemented by FcmDeviceService, consumed by FcmDevicesController. */
export interface IFcmDeviceService {
  /** Idempotent; a token already registered moves to this user, with this key (whoever is signed in on that phone now). */
  register(userId: string, input: RegisterFcmDeviceInput): Promise<void>;
  /** Idempotent; only removes the token if this user owns it. */
  unregister(userId: string, token: string): Promise<void>;
}
