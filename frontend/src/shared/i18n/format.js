import { HDate } from '@hebcal/hdate';

// Dates in the chosen language, one function per kind. Each takes `translate` — useTranslate()'s,
// or `(key, vars) => translateIn(code, key, vars)` outside React — and a date: 'YYYY-MM-DD' (a
// calendar day, read as is) or a Date (read on the phone's clock, like formatTime). Times ("18:12"), numbers
// and ₪ amounts read the same in both languages: utils/time.js, finance's formatShekels.

function partsOf(date) {
  if (typeof date === 'string') {
    const [year, month, day] = date.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return { year, month, day, weekday };
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    weekday: date.getDay(),
  };
}

// "Saturday 19 September" · "יום שבת, 19 בספטמבר"
export function longDate(translate, date) {
  const { month, day, weekday } = partsOf(date);
  return translate('date.long', {
    weekday: translate(`weekday.${weekday}`),
    day,
    month: translate(`month.${month}`),
  });
}

// "Fri 30 Oct" · "שישי, 30 באוק׳"; `withYear` adds it: "Fri 30 Oct 2026".
export function shortDate(translate, date, withYear = false) {
  const { year, month, day, weekday } = partsOf(date);
  return translate(withYear ? 'date.shortYear' : 'date.short', {
    weekday: translate(`weekdayShort.${weekday}`),
    day,
    month: translate(`monthShort.${month}`),
    year,
  });
}

// "Oct 25" · "25 באוק׳"
export function dayMonth(translate, date) {
  const { month, day } = partsOf(date);
  return translate('date.dayMonth', {
    day,
    month: translate(`monthShort.${month}`),
  });
}

// "Tuesday, October" · "יום שלישי, אוקטובר"
export function weekdayMonth(translate, date) {
  const { month, weekday } = partsOf(date);
  return translate('date.weekdayMonth', {
    weekday: translate(`weekday.${weekday}`),
    month: translate(`month.${month}`),
  });
}

// "October 2026" · "אוקטובר 2026" — `{ year, month }`, month 1–12.
export const monthTitle = (translate, { year, month }) =>
  translate('date.month', { month: translate(`month.${month}`), year });

// A day's Hebrew date, from the calendar's `day.hebrew` (Hebrew letters in both languages):
// "ט״ז חשון תשפ״ז" · "ט״ז בחשון תשפ״ז"
export const hebrewDate = (translate, hebrew) =>
  translate('date.hebrew', {
    day: hebrew.dayHe,
    month: hebrew.month.he,
    year: hebrew.yearHe,
  });

// A length of time in minutes: "30m", "1h", "1h 30m" · "30 דק׳", "שעה", "שעה ו־30 דק׳".
export function duration(translate, minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours =
    h === 1
      ? translate('duration.hour')
      : h === 2
        ? translate('duration.twoHours')
        : h && translate('duration.hours', { n: h });
  const mins = m && translate('duration.minutes', { n: m });
  if (hours && mins)
    return translate('duration.both', { hours, minutes: mins });
  return hours || mins || '';
}

// "1 reminder", "3 reminders" · "תזכורת אחת", "3 תזכורות": `key`.one for 1, `key`.other otherwise.
export const count = (translate, key, n) =>
  translate(`${key}.${n === 1 ? 'one' : 'other'}`, { n });

// A Date's Hebrew day, month and year in letters — the shape of the calendar's `day.hebrew`, for
// hebrewDate(): { dayHe: 'כ״א', month: { he: 'חשון' }, yearHe: 'תשפ״ז' }. A month can be two words
// ("אדר א׳"). hebcal reads the Date's local year, month and day.
export function hebrewLetters(date) {
  const words = new HDate(date).renderGematriya(true).split(' ');
  return {
    dayHe: words[0],
    month: { he: words.slice(1, -1).join(' ') },
    yearHe: words.at(-1),
  };
}
