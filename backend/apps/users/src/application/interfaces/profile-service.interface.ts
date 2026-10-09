import type { Profile, ProfileDetails } from '../../models/profile';

/** Only the fields present change; null clears a detail. `location` gets its `updatedAt` here. */
export type ProfileUpdate = Partial<ProfileDetails> & {
  location?: { lat: number; lon: number; tz: string };
};

/** Implemented by ProfileService, consumed by UsersController. 404 for a user that no longer exists. */
export interface IProfileService {
  get(userId: string): Promise<Profile>;
  /** 400 if nothing is set. */
  update(userId: string, change: ProfileUpdate): Promise<Profile>;
}
