import {
  civilDateIn,
  isoDate,
  ISRAEL_TIME_ZONE,
  ReminderOccurrences,
} from '../../../lib/jewish-calendar';

// Which days a user's own reminder falls on, computed on the phone (src/lib/jewish-calendar).
// A reminder here is its definition: { title, hour, minute, repeat, calendar, start, skipped }
// (its `changed` days' own title/time don't move a day), dates 'YYYY-MM-DD'. Israel's time zone, whatever the phone's — the app is Israel-only.

const occurrences = new ReminderOccurrences();
const NEXT_COUNT = 3;

// 'YYYY-MM-DD' → { year, month, day }.
export const civilDate = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
};

// The rule ReminderOccurrences works on.
export const ruleOf = (reminder) => ({
  start: civilDate(reminder.start),
  hour: reminder.hour,
  minute: reminder.minute,
  repeat: reminder.repeat,
  calendar: reminder.calendar,
  skipped: (reminder.skipped ?? []).map(civilDate),
});

// Whether it falls on `date` — a skipped day not.
export const fallsOn = (reminder, date) =>
  occurrences.fallsOn(ruleOf(reminder), civilDate(date));

// Every day it falls on from `range.from` to `range.to`, both included.
export const datesFor = (reminder, { from, to }) =>
  occurrences
    .datesBetween(ruleOf(reminder), civilDate(from), civilDate(to))
    .map(isoDate);

// The next `count` days a reminder with this timing ({ hour, minute, repeat, calendar, start })
// would go off after `now` — the add sheet's "Next". Empty when it never will again.
export function nextDates(timing, now, count = NEXT_COUNT) {
  const rule = ruleOf({ ...timing, skipped: [] });
  const dates = [];
  let after = now;
  for (let i = 0; i < count; i++) {
    const at = occurrences.nextAfter(rule, after, ISRAEL_TIME_ZONE);
    if (!at) break;
    dates.push(isoDate(civilDateIn(ISRAEL_TIME_ZONE, at)));
    after = at;
  }
  return dates;
}
