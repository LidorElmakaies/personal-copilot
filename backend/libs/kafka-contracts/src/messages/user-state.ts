import {
  isIsoDate,
  isName,
  isNonEmptyString,
  isPhone,
  isRecord,
} from './validators';

export interface UserLocation {
  lat: number;
  lon: number;
  /** ISO 8601 — when the phone sent it. */
  updatedAt: string;
}

/**
 * `users.user-state`, keyed by `userId`: the user's full current state, never a partial change.
 * A consumer keeps the highest `version` it has seen and ignores older ones.
 */
export interface UserStateMessage {
  userId: string;
  /** Goes up by one on every change. */
  version: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  /** Null until the phone first sends one. */
  location: UserLocation | null;
}

const inRange = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max;

function isUserLocation(value: unknown): value is UserLocation {
  if (!isRecord(value)) return false;
  return (
    inRange(value.lat, 90) &&
    inRange(value.lon, 180) &&
    isIsoDate(value.updatedAt)
  );
}

export function isUserStateMessage(value: unknown): value is UserStateMessage {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.userId) &&
    Number.isInteger(value.version) &&
    (value.version as number) >= 1 &&
    (value.firstName === null || isName(value.firstName)) &&
    (value.lastName === null || isName(value.lastName)) &&
    (value.phone === null || isPhone(value.phone)) &&
    (value.location === null || isUserLocation(value.location))
  );
}
