const israelParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// 'YYYY-MM-DD HH:MM' of `at` on Israel's clock — the app is Israel-only, whatever the phone's zone.
export function israelClock(at) {
  const p = Object.fromEntries(
    israelParts.formatToParts(at).map(({ type, value }) => [type, value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

// Israel's date at `at`, YYYY-MM-DD — the form a month's days' `date` uses.
export const israelIsoDate = (at) => israelClock(at).slice(0, 10);

// Months as one running number, so a swipe can count across year ends.
export const monthIndex = ({ year, month }) => year * 12 + month - 1;
export const monthAt = (index) => ({
  year: Math.floor(index / 12),
  month: (index % 12) + 1,
});

// A YYYY-MM-DD date as a Date at UTC midnight — read with UTC getters/`timeZone: 'UTC'` so the
// device's zone can't shift it.
export const utcDay = (date) => new Date(`${date}T00:00:00Z`);

// Weekday of a YYYY-MM-DD date, 0 = Sunday.
export const weekdayOf = (date) => utcDay(date).getUTCDay();

// "Saturday 19 September".
export const longDate = (date) =>
  utcDay(date).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
