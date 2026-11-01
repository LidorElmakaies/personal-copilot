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

// "Fri 30 Oct" · "שישי, 30 באוק׳"
export function shortDate(translate, date) {
  const { month, day, weekday } = partsOf(date);
  return translate('date.short', {
    weekday: translate(`weekdayShort.${weekday}`),
    day,
    month: translate(`monthShort.${month}`),
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
