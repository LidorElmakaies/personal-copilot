/** The optional details a user can set; null = not set. */
export interface ProfileDetails {
  firstName: string | null;
  lastName: string | null;
  /** E.164, e.g. +972501234567. */
  phone: string | null;
}

/** Where the phone last opened the app (sent only after a real move). */
export interface UserLocation {
  lat: number;
  lon: number;
  tz: string;
  updatedAt: Date;
}

/** Who the user is, keyed by their user id (the JWT `sub`). */
export interface Profile extends ProfileDetails {
  userId: string;
  location: UserLocation | null;
  /** +1 on every change; published with the state so consumers can drop older ones. 0 = never set. */
  version: number;
}

/** A partial update: only the fields present change; null clears a detail. */
export type ProfileChange = Partial<ProfileDetails> & {
  location?: UserLocation;
};

export const EMPTY_PROFILE_DETAILS: ProfileDetails = {
  firstName: null,
  lastName: null,
  phone: null,
};
