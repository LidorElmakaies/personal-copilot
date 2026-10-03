import { isUserDeletedMessage } from './user-deleted';
import { isUserRegisteredMessage } from './user-registered';
import { isUserStateMessage } from './user-state';

describe('isUserRegisteredMessage', () => {
  const valid = {
    userId: 'u-1',
    email: 'a@b.c',
    registeredAt: '2026-10-03T10:00:00.000Z',
  };

  it('accepts a minimal message and one with every optional field', () => {
    expect(isUserRegisteredMessage(valid)).toBe(true);
    expect(
      isUserRegisteredMessage({
        ...valid,
        firstName: 'Lidor',
        lastName: 'Cohen',
        phone: '+972501234567',
      }),
    ).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', [valid]],
    ['missing userId', { ...valid, userId: undefined }],
    ['empty email', { ...valid, email: '' }],
    ['an empty first name', { ...valid, firstName: '' }],
    ['a first name over 100 chars', { ...valid, firstName: 'a'.repeat(101) }],
    ['a null last name', { ...valid, lastName: null }],
    ['a local phone number', { ...valid, phone: '0501234567' }],
    ['a phone with spaces', { ...valid, phone: '+972 50 123 4567' }],
    ['unparseable registeredAt', { ...valid, registeredAt: 'today' }],
  ])('rejects %s', (_name, value) => {
    expect(isUserRegisteredMessage(value)).toBe(false);
  });
});

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
