import type { Coordinates } from '../../models/user-location';

/** Implemented by TypeOrmUserLocationReader, consumed by ReminderService and ReminderScheduler. Read-only. */
export interface IUserLocationReader {
  /** Null when the user hasn't sent a location yet. */
  findByUserId(userId: string): Promise<Coordinates | null>;
}
