import type {
  CustomReminder,
  CustomReminderInput,
} from '../../models/custom-reminder';

/** Implemented by TypeOrmCustomReminderRepository, consumed by CustomReminderService and CustomReminderScheduler. */
export interface ICustomReminderRepository {
  findById(id: string): Promise<CustomReminder | null>;
  /** Every user's (the sweep). */
  findAll(): Promise<CustomReminder[]>;
  findByUserId(userId: string): Promise<CustomReminder[]>;
  /** Null unless it exists and is this user's. */
  findOwned(userId: string, id: string): Promise<CustomReminder | null>;
  countByUserId(userId: string): Promise<number>;
  setNextFireAt(id: string, nextFireAt: Date | null): Promise<void>;
  create(userId: string, input: CustomReminderInput): Promise<CustomReminder>;
  /** Overwrites the given fields of this user's reminder; null if it isn't theirs. */
  update(
    userId: string,
    id: string,
    patch: Partial<CustomReminderInput> & { skipped?: string[] },
  ): Promise<CustomReminder | null>;
  /** False if it isn't this user's. */
  delete(userId: string, id: string): Promise<boolean>;
}
