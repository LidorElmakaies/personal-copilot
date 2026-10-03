import { isIsoDate, isNonEmptyString, isRecord } from './validators';

/** `auth.user-deleted`, keyed by `userId`: every service deletes its data about the user. */
export interface UserDeletedMessage {
  userId: string;
  /** ISO 8601. */
  deletedAt: string;
}

export function isUserDeletedMessage(
  value: unknown,
): value is UserDeletedMessage {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.userId) && isIsoDate(value.deletedAt);
}
