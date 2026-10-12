import { createCipheriv, randomBytes } from 'crypto';

/** AES-256-GCM with the device's own key: base64 of iv (12 bytes) | ciphertext | tag (16 bytes) —
 * the layout the Android app decrypts (see docs/specs/services.md#notifications). */
export function encryptForDevice(plain: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) throw new Error('device key is not 32 bytes');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64');
}
