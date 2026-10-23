/** The optional details a user can set; null = not set. */
export interface ProfileDetails {
  firstName: string | null;
  lastName: string | null;
  /** E.164, e.g. +972501234567. */
  phone: string | null;
}

/** E.164: `+`, country code, up to 15 digits in all. */
export const PHONE_E164 = /^\+[1-9]\d{6,14}$/;

export const NAME_MAX_LENGTH = 100;

/** English or Hebrew letters only, single spaces between words — the frontend filters to the same. */
export const NAME_PATTERN = /^[A-Za-zא-ת]+(?: [A-Za-zא-ת]+)*$/;

/** Where the phone last opened the app (sent only after a real move). */
export interface UserLocation {
  lat: number;
  lon: number;
  updatedAt: Date;
}

/** Who the user is, keyed by their user id (the JWT `sub`). */
export interface Profile extends ProfileDetails {
  userId: string;
  location: UserLocation | null;
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
