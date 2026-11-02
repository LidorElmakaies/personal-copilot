import { HDate } from '@hebcal/hdate';
import {
  hebrewDate,
  hebrewLetters,
  shortDate,
} from '../../../shared/i18n/format';
import { israelClock, monthAt } from '../../../shared/utils/date';
import { pad2 } from '../../../shared/utils/time';

// Words for a user's own reminder — the add sheet's lines and the day card's rows (mockup 3.6a),
// in `translate`'s language (useTranslate()'s). Which days it falls on is in occurrences.js; these
// only describe a reminder from its own fields and check the title (titleProblem). Dates are
// 'YYYY-MM-DD'.

const ADAR = 12; // Adar in a regular year, Adar I in a leap year (hebcal's numbering)
const ADAR_II = 13;

const parts = (date) => date.split('-').map(Number);
const localDate = (date) => {
  const [y, m, d] = parts(date);
  return new Date(y, m - 1, d); // hebcal reads local Y/M/D
};
const hebrewOf = (date) => new HDate(localDate(date));

// "th" for 19 — English's; the dictionary decides whether a language uses it (`ordinal`).
function suffixOf(n) {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return suffix[(v - 20) % 10] || suffix[v] || suffix[0];
}

// The day a monthly or yearly reminder repeats on, in its own calendar, as each language writes
// it: `nth` ("19th" / "8th" · "19" / "ח׳"), `day` and `month` ("19 October" / "8 Cheshvan" ·
// "19 באוקטובר" / "ח׳ בחשון").
function repeatDay(translate, { calendar, start }) {
  const [, m, d] = parts(start);
  if (calendar !== 'hebrew')
    return {
      nth: translate('ordinal', { n: d, suffix: suffixOf(d) }),
      day: d,
      month: translate(`month.${m}`),
    };
  const h = hebrewOf(start);
  const n = h.getDate();
  const { dayHe, month } = hebrewLetters(localDate(start));
  return {
    nth: translate('hebrewCalendar.nth', {
      n,
      suffix: suffixOf(n),
      letters: dayHe,
    }),
    day: translate('hebrewCalendar.day', { n, letters: dayHe }),
    month: translate('hebrewCalendar.month', {
      name: h.getMonthName(),
      nameHe: month.he,
    }),
  };
}

// A day's Hebrew date in letters: "ח׳ חשון תשפ״ז" · "ח׳ בחשון תשפ״ז".
export const hebrewDateText = (translate, date) =>
  hebrewDate(translate, hebrewLetters(localDate(date)));

export const timeText = ({ hour, minute }) => `${pad2(hour)}:${pad2(minute)}`;

// The day before or after `date`.
export function addDay(date, by) {
  const [y, m, d] = parts(date);
  const next = new Date(Date.UTC(y, m - 1, d + by));
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

// The short "how it repeats" under a reminder's title: "Monthly · the 8th (Hebrew)" · "כל חודש ·
// ב־ח׳ (עברי)".
export function repeatLabel(translate, reminder) {
  const { repeat, calendar, start } = reminder;
  if (repeat === 'daily') return translate('repeat.daily');
  if (repeat === 'once') {
    const [y, m, d] = parts(start);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return translate('repeat.once', {
      weekday: translate(`weekdayShort.${weekday}`),
      day: d,
      month: translate(`monthShort.${m}`),
    });
  }
  const day = repeatDay(translate, reminder);
  if (repeat === 'yearly') return translate('repeat.yearly', day);
  return translate(
    calendar === 'hebrew' ? 'repeat.monthlyHebrew' : 'repeat.monthly',
    day,
  );
}

// The sheet's summary line: "Every Hebrew month on the 8th, 09:30" · "כל חודש עברי ב־ח׳, 09:30".
export function summaryLine(translate, reminder) {
  const { repeat, calendar, start } = reminder;
  const time = timeText(reminder);
  if (repeat === 'once')
    return translate('summary.once', {
      date: shortDate(translate, start, true),
      time,
    });
  if (repeat === 'daily')
    return translate('summary.daily', {
      date: shortDate(translate, start),
      time,
    });
  const day = { ...repeatDay(translate, reminder), time };
  if (repeat === 'yearly') return translate('summary.yearly', day);
  return translate(
    calendar === 'hebrew' ? 'summary.monthlyHebrew' : 'summary.monthly',
    day,
  );
}

// The two calendar choices' small lines: { gregorian: 'the 19th', hebrew: 'the 8th' } for monthly,
// { gregorian: '19 October', hebrew: '8 Cheshvan' } for yearly.
export function calendarChoices(translate, { repeat, start }) {
  const key =
    repeat === 'monthly' ? 'sheet.choiceMonthly' : 'sheet.choiceYearly';
  const choice = (calendar) =>
    translate(key, repeatDay(translate, { calendar, start }));
  return { gregorian: choice('gregorian'), hebrew: choice('hebrew') };
}

// What happens on a date some months or years don't have (rules: src/lib/jewish-calendar/README.md).
export function oddDateNotes(translate, reminder) {
  const { repeat, calendar, start } = reminder;
  if (repeat === 'once' || repeat === 'daily') return [];
  const [, m, d] = parts(start);
  const notes = [];
  if (calendar !== 'hebrew') {
    if (repeat === 'monthly' && d > 28) notes.push(translate('notes.monthEnd'));
    if (repeat === 'yearly' && m === 2 && d === 29)
      notes.push(translate('notes.february29'));
    return notes;
  }
  const h = hebrewOf(start);
  if (h.getDate() === 30)
    notes.push(
      repeat === 'monthly'
        ? translate('notes.hebrewMonth30')
        : translate('notes.hebrewYear30', {
            month: repeatDay(translate, reminder).month,
          }),
    );
  if (repeat === 'yearly') {
    const leap = HDate.isLeapYear(h.getFullYear());
    if (h.getMonth() === ADAR && !leap) notes.push(translate('notes.adarLeap'));
    if (leap && (h.getMonth() === ADAR || h.getMonth() === ADAR_II))
      notes.push(translate('notes.adarRegular'));
  }
  return notes;
}

// A once-reminder whose time has passed in Israel: kept on its day, dimmed.
export function isDone(reminder, now) {
  if (reminder.repeat !== 'once') return false;
  return `${reminder.start} ${timeText(reminder)}` <= israelClock(now);
}

// The dates the Calendar tab shows reminders for: `around` months either side of month `index`
// (monthIndex), first day to last.
export function remindersRange(index, around) {
  const first = monthAt(index - around);
  const last = monthAt(index + around);
  const lastDay = new Date(Date.UTC(last.year, last.month, 0)).getUTCDate();
  return {
    from: `${first.year}-${pad2(first.month)}-01`,
    to: `${last.year}-${pad2(last.month)}-${pad2(lastDay)}`,
  };
}

// A title: English or Hebrew letters, digits and basic punctuation,
// single spaces between words; up to 60.
export const TITLE_MAX_LENGTH = 60;
const TITLE_PATTERN =
  /^[A-Za-zא-ת0-9.,'!?:()"&/-]+(?: [A-Za-zא-ת0-9.,'!?:()"&/-]+)*$/;

// Phone keyboards type curly quotes (Mom’s, “Pesach”); the title rule takes the straight ones.
export const straightenQuotes = (text) =>
  text.replace(/[‘’‚‛′]/g, "'").replace(/[“”„‟″]/g, '"');

// Null when the title is fine; else what to fix — a dictionary key, which the sheet shows.
export function titleProblem(title) {
  const t = title.trim();
  if (!t) return 'reminders.titleEmpty';
  if (!TITLE_PATTERN.test(t)) return 'reminders.titleInvalid';
  return null;
}
