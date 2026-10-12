/** One install of the Android app, owned by one user: its FCM registration token and the 256-bit
 * key (base64) it decrypts its notifications with. Neither is ever logged. */
export interface FcmDevice {
  id: string;
  userId: string;
  token: string;
  key: string;
  createdAt: Date;
  updatedAt: Date;
}
