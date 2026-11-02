import { MonthCalendar, ShabbatCalendar } from '../../../lib/jewish-calendar';

// Example data for stories (the Hebrew canvas's, H0): Tel Aviv, October 2026, "now" Tuesday
// 27 October 18:42 — computed by the app's own calendar maths, as calendarService does.
export const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };
export const TODAY = '2026-10-27';
export const NOW = new Date('2026-10-27T16:42:07+02:00');

const asJson = (value) => JSON.parse(JSON.stringify(value));

export const OCTOBER = asJson(new MonthCalendar().month(TEL_AVIV, 2026, 10));
export const SHABBAT = asJson(new ShabbatCalendar().current(TEL_AVIV, NOW));

// Friday 30 October: Erev Shabbat, with the canvas's two reminders (selectDayReminders' rows).
export const EREV_SHABBAT = OCTOBER.days[29];
const reminder = (id, title, hour, minute, repeat, calendar) => ({
  id,
  title,
  hour,
  minute,
  reminder: {
    id,
    title,
    hour,
    minute,
    repeat,
    calendar,
    start: '2026-10-30',
    skipped: [],
    changed: {},
  },
});
export const EREV_SHABBAT_REMINDERS = [
  reminder('1', 'Buy challah and flowers', 11, 0, 'once', 'gregorian'),
  reminder('2', 'Call grandma', 12, 30, 'monthly', 'hebrew'),
];
