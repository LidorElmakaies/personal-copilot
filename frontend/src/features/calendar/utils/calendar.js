import { pad2 } from '../../../shared/utils/time';
import { monthAt, weekdayOf } from '../../../shared/utils/date';

// "September 2026".
export const monthTitle = ({ year, month }) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });

// "אלול – תשרי תשפ״ז": the Hebrew months a Gregorian month spans, and the year it ends in.
export function hebrewTitle(days) {
  const months = [...new Set(days.map((d) => d.hebrew.month.he))];
  return `${months.join(' – ')} ${days.at(-1).hebrew.yearHe}`;
}

// The day card's title: its events; else Shabbat, or Erev Shabbat on a Friday with candle
// lighting; else nothing (the card shows the weekday).
export function dayNames(day) {
  if (day.events.length) return day.events.map((e) => e.name);
  const weekday = weekdayOf(day.date);
  if (weekday === 6) return [{ en: 'Shabbat', he: 'שבת' }];
  if (weekday === 5 && day.times.length)
    return [{ en: 'Erev Shabbat', he: 'ערב שבת' }];
  return [];
}

const TIME_LABELS = {
  candleLighting: 'Candle lighting',
  havdalah: 'Havdalah',
  fastBegins: 'Fast begins',
  fastEnds: 'Fast ends',
};

// The card's rows, in order; a fast that begins with candle lighting (Erev Yom Kippur) is one
// row. `candle` marks the rows shown in amber.
export function dayTimeRows(day) {
  const candles = day.times.find((t) => t.kind === 'candleLighting');
  return day.times
    .filter((t) => !(t.kind === 'fastBegins' && candles?.at === t.at))
    .map((t) => ({
      label:
        t.kind === 'candleLighting' &&
        day.times.some((f) => f.kind === 'fastBegins' && f.at === t.at)
          ? 'Candle lighting · fast begins'
          : TIME_LABELS[t.kind],
      at: new Date(t.at),
      candle: t.kind === 'candleLighting',
    }));
}

// The day the card opens on in a month: today if it's in it, else the 1st.
export const openingDate = ({ year, month }, today) => {
  const first = `${year}-${pad2(month)}-01`;
  return today.slice(0, 7) === first.slice(0, 7) ? today : first;
};

// A month's days before calendarService.getMonth answers: just the dates, which the phone can work out.
// Cached, so a page re-rendered mid-swipe gets the same array (and its memoized grid skips).
const placeholders = new Map();
export function placeholderDays(index) {
  if (!placeholders.has(index)) {
    const { year, month } = monthAt(index);
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    placeholders.set(
      index,
      Array.from({ length: count }, (_, i) => ({
        date: `${year}-${pad2(month)}-${pad2(i + 1)}`,
        hebrew: null,
        events: [],
        parasha: null,
        times: [],
      })),
    );
  }
  return placeholders.get(index);
}
