/** Where a user last opened the app — owned by the Users Service, read from `users.profiles`. */
export interface Coordinates {
  lat: number;
  lon: number;
  /** IANA time zone. */
  tz: string;
}
