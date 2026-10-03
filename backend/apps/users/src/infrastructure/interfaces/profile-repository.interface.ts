import type { Profile, ProfileChange } from '../../models/profile';

/** Implemented by TypeOrmProfileRepository, consumed by ProfileService. */
export interface IProfileRepository {
  /** Null when the user has no profile row yet (an account from before profiles existed). */
  findByUserId(userId: string): Promise<Profile | null>;
  /**
   * Applies the change, bumps `version`, and publishes the full state — atomically. Creates the
   * profile if missing. Null when the user doesn't exist (e.g. deleted while a token is still valid).
   */
  update(userId: string, change: ProfileChange): Promise<Profile | null>;
}
