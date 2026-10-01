import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePushSubscriptionDto } from './push-subscription.dto';

// Boundaries of the key-size rule: p256dh decodes to exactly 65 bytes, auth to exactly 16, and only
// base64url characters count — Buffer.from(…, 'base64url') silently skips or accepts others.
describe('CreatePushSubscriptionDto keys', () => {
  const p256dh = Buffer.alloc(65, 0x04).toString('base64url'); // 87 chars
  const auth = Buffer.alloc(16, 0xab).toString('base64url'); // 22 chars
  const endpoint = 'https://fcm.googleapis.com/fcm/send/abc';

  const errorsFor = async (keys: Record<string, unknown>) => {
    const dto = plainToInstance(CreatePushSubscriptionDto, {
      endpoint,
      keys: { p256dh, auth, ...keys },
    });
    const errors = await validate(dto, { whitelist: true });
    return errors.flatMap((e) =>
      (e.children ?? []).map((c) => c.property).concat(e.property),
    );
  };

  it('accepts a 65-byte p256dh and a 16-byte auth, unpadded or padded', async () => {
    expect(await errorsFor({})).toEqual([]);
    expect(
      await errorsFor({ p256dh: `${p256dh}=`, auth: `${auth}==` }),
    ).toEqual([]);
  });

  it.each([
    ['64 bytes', Buffer.alloc(64, 4).toString('base64url')],
    ['66 bytes', Buffer.alloc(66, 4).toString('base64url')],
    ['65 bytes plus one stray char (decodes to 66)', `${p256dh}A`],
    ['a "." Buffer would skip', `${p256dh.slice(0, 40)}.${p256dh.slice(40)}`],
    ['standard-base64 "+/"', `${p256dh.slice(0, 40)}+/${p256dh.slice(42)}`],
    ['embedded padding', `${p256dh.slice(0, 40)}=${p256dh.slice(40)}`],
    ['three padding chars', `${p256dh}===`],
    ['whitespace', ` ${p256dh}`],
    ['an empty string', ''],
    ['a number', 65],
  ])('refuses a p256dh of %s', async (_name, value) => {
    expect(await errorsFor({ p256dh: value })).toContain('p256dh');
  });

  it.each([
    ['15 bytes', Buffer.alloc(15, 1).toString('base64url')],
    ['17 bytes', Buffer.alloc(17, 1).toString('base64url')],
    ['16 bytes plus one stray char (decodes to 17)', `${auth}A`],
    ['a "." Buffer would skip', `${auth.slice(0, 10)}.${auth.slice(10)}`],
    ['standard-base64 "+/"', `${auth.slice(0, 10)}+/${auth.slice(12)}`],
    ['a newline', `${auth}\n`],
  ])('refuses an auth of %s', async (_name, value) => {
    expect(await errorsFor({ auth: value })).toContain('auth');
  });
});
