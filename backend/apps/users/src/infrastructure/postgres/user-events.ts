import type { EntityManager } from 'typeorm';
import { addOutboxEvent } from '@app/kafka-client';
import {
  KAFKA_TOPICS,
  type UserDeletedMessage,
  type UserStateMessage,
} from '@app/kafka-contracts';
import type { Profile } from '../../models/profile';

// Called inside the write's own transaction, so the event commits with it — see OutboxRelay.

export function toUserStateMessage(p: Profile): UserStateMessage {
  return {
    userId: p.userId,
    version: p.version,
    firstName: p.firstName,
    lastName: p.lastName,
    phone: p.phone,
    location: p.location && {
      lat: p.location.lat,
      lon: p.location.lon,
      tz: p.location.tz,
      updatedAt: p.location.updatedAt.toISOString(),
    },
  };
}

export function addUserStateEvent(
  manager: EntityManager,
  profile: Profile,
): Promise<void> {
  return addOutboxEvent(
    manager,
    KAFKA_TOPICS.USER_STATE,
    profile.userId,
    toUserStateMessage(profile),
  );
}

/** `users.user-deleted`, plus a tombstone so compaction drops the user from `users.user-state`. */
export async function addUserDeletedEvents(
  manager: EntityManager,
  userId: string,
  deletedAt: Date,
): Promise<void> {
  const message: UserDeletedMessage = {
    userId,
    deletedAt: deletedAt.toISOString(),
  };
  await addOutboxEvent(manager, KAFKA_TOPICS.USER_DELETED, userId, message);
  await addOutboxEvent(manager, KAFKA_TOPICS.USER_STATE, userId, null);
}
