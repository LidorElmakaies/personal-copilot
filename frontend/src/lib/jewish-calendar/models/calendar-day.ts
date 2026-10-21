import type { LocalizedName } from './shabbat-times';

/** yomTov: work forbidden (incl. Yom Kippur, which is also a fast); fast: any other fast day. */
export type CalendarEventKind = 'yomTov' | 'fast' | 'holiday';

export interface CalendarEvent {
  kind: CalendarEventKind;
  name: LocalizedName;
}

export type CalendarTimeKind =
  'candleLighting' | 'havdalah' | 'fastBegins' | 'fastEnds';

export interface CalendarTime {
  kind: CalendarTimeKind;
  at: Date;
}

export interface HebrewDate {
  day: number;
  /** The day in Hebrew letters, e.g. 'י״ט'. */
  dayHe: string;
  month: LocalizedName;
  year: number;
  /** The year in Hebrew letters, e.g. 'תשפ״ז'. */
  yearHe: string;
}

export interface CalendarDay {
  /** The civil date, YYYY-MM-DD. */
  date: string;
  hebrew: HebrewDate;
  events: CalendarEvent[];
  /** Saturdays' weekly reading; null on other days and when a holiday replaces it. */
  parasha: LocalizedName | null;
  /** In order; candle lighting is on the day it's lit (Friday, an eve, a second Yom Tov night). */
  times: CalendarTime[];
}
