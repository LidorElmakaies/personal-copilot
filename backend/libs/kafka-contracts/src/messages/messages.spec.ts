import { isUserDeletedMessage } from './user-deleted';
import { isUserStateMessage } from './user-state';

describe('isUserDeletedMessage', () => {
  it('accepts a valid message', () => {
    expect(
      isUserDeletedMessage({
        userId: 'u-1',
        deletedAt: '2026-10-03T10:00:00.000Z',
      }),
    ).toBe(true);
  });

  it.each([
    ['null', null],
    ['missing userId', { deletedAt: '2026-10-03T10:00:00.000Z' }],
    ['missing deletedAt', { userId: 'u-1' }],
  ])('rejects %s', (_name, value) => {
    expect(isUserDeletedMessage(value)).toBe(false);
  });
});

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
