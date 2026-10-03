import {
  isIsoDate,
  isName,
  isNonEmptyString,
  isPhone,
  isRecord,
} from './validators';

/** `auth.user-registered`, keyed by `userId`. See docs/specs/event-schemas.md. */
export interface UserRegisteredMessage {
  /** Auth's user id (the JWT `sub`); every service keys its data about the user by it. */
  userId: string;
  email: string;
  /** Optional profile fields from the register form — Auth passes them on, never stores them. */
  firstName?: string;
  lastName?: string;
  /** E.164, e.g. +972501234567. */
  phone?: string;
  /** ISO 8601. */
  registeredAt: string;
}

export function isUserRegisteredMessage(
  value: unknown,
): value is UserRegisteredMessage {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.userId) &&
    isNonEmptyString(value.email) &&
    (value.firstName === undefined || isName(value.firstName)) &&
    (value.lastName === undefined || isName(value.lastName)) &&
    (value.phone === undefined || isPhone(value.phone)) &&
    isIsoDate(value.registeredAt)
  );
}
