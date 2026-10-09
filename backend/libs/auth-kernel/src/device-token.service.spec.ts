import type { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { AuthTokenService } from './auth-token.service';
import { DeviceTokenService } from './device-token.service';
import { JsonWebTokenService } from './jsonwebtoken.service';

const SECRET = 'test-secret';
const jwtService = new JsonWebTokenService({
  get: () => SECRET,
} as unknown as ConfigService);
const devices = new DeviceTokenService(jwtService);
const users = new AuthTokenService(jwtService);

describe('DeviceTokenService', () => {
  it('issues a token that verifies back to a new device id each time', () => {
    const first = devices.verify(devices.issue());
    const second = devices.verify(devices.issue());
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toMatch(/^[0-9a-f-]{36}$/);
    expect(first).not.toBe(second);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['made up', 'IMFAKEUSER'],
    [
      'signed with another secret',
      jwt.sign({ sub: 'd-1', typ: 'device' }, 'not-the-secret'),
    ],
    ['without the device type', jwt.sign({ sub: 'd-1' }, SECRET)],
  ])('refuses a %s token', (_label, token) => {
    expect(devices.verify(token)).toBeNull();
  });

  it("refuses a user's access token as a device token", () => {
    const access = jwtService.sign(
      { sub: 'u-1', role: 'user', email: 'a@b.c' },
      '15m',
    );
    expect(devices.verify(access)).toBeNull();
  });

  it('a device token is never accepted as a user token', async () => {
    expect(await users.verify(devices.issue())).toBeNull();
  });
});
