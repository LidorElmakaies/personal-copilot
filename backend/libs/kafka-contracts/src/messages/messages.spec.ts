import { isFrontendReleaseMessage } from './frontend-release';
import { isUserStateMessage } from './user-state';

describe('isUserStateMessage', () => {
  const location = {
    lat: 32.1782,
    lon: 34.9076,
    tz: 'Asia/Jerusalem',
    updatedAt: '2026-10-03T10:00:00.000Z',
  };
  const valid = {
    userId: 'u-1',
    version: 3,
    firstName: 'Lidor',
    lastName: null,
    phone: '+972501234567',
    location,
  };

  it('accepts a full state and one with nothing set yet', () => {
    expect(isUserStateMessage(valid)).toBe(true);
    expect(
      isUserStateMessage({
        userId: 'u-1',
        version: 1,
        firstName: null,
        lastName: null,
        phone: null,
        location: null,
      }),
    ).toBe(true);
  });

  it.each([
    ['null (a tombstone)', null],
    ['a version of 0', { ...valid, version: 0 }],
    ['a fractional version', { ...valid, version: 1.5 }],
    ['a missing field instead of null', { ...valid, phone: undefined }],
    ['an empty first name', { ...valid, firstName: '' }],
    ['a last name over 100 chars', { ...valid, lastName: 'a'.repeat(101) }],
    ['a local phone number', { ...valid, phone: '0501234567' }],
    ['a phone with spaces', { ...valid, phone: '+972 50 123 4567' }],
    [
      'a latitude out of range',
      { ...valid, location: { ...location, lat: 91 } },
    ],
    [
      'a longitude as a string',
      { ...valid, location: { ...location, lon: '34.9' } },
    ],
    [
      'an unknown time zone',
      { ...valid, location: { ...location, tz: 'Mars/Base' } },
    ],
    [
      'a location without updatedAt',
      { ...valid, location: { ...location, updatedAt: undefined } },
    ],
  ])('rejects %s', (_name, value) => {
    expect(isUserStateMessage(value)).toBe(false);
  });
});

describe('isFrontendReleaseMessage', () => {
  const valid = {
    version: '0.4.0',
    versionCode: 40099,
    publishedAt: '2026-10-09T12:00:00Z',
  };

  it('accepts a release', () => {
    expect(isFrontendReleaseMessage(valid)).toBe(true);
  });

  it.each([
    ['null', null],
    ['no version', { ...valid, version: '' }],
    ['a fractional versionCode', { ...valid, versionCode: 1.5 }],
    ['a versionCode of 0', { ...valid, versionCode: 0 }],
    ['a versionCode as a string', { ...valid, versionCode: '40099' }],
    ['no publishedAt', { ...valid, publishedAt: undefined }],
  ])('rejects %s', (_name, value) => {
    expect(isFrontendReleaseMessage(value)).toBe(false);
  });
});
