// Domain layer — where the user is. timeZone is an IANA name (e.g. 'Asia/Jerusalem').
export interface GeoLocation {
  latitude: number;
  longitude: number;
  timeZone: string;
}
