export interface LocalizedName {
  en: string;
  he: string;
}

export interface ShabbatTimes {
  candleLighting: Date;
  /** Can fall after Saturday night when a holiday follows Shabbat (e.g. two-day Yom Tov abroad). */
  havdalah: Date;
  /** Null when a holiday replaces the weekly reading. */
  parasha: LocalizedName | null;
  /** Holidays and special Shabbatot falling on this Saturday. */
  holidays: LocalizedName[];
}
