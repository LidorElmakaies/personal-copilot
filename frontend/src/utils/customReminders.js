import { HDate } from '@hebcal/hdate';
import { israelClock, monthAt } from './calendar';
import { pad2 } from './time';

// Words for a user's own reminder — the add sheet's lines and the day card's rows (mockup 3.6a).
// Which days it falls on is the server's (GET /reminders/custom and its preview); these only
// describe a reminder from its own fields. Dates are 'YYYY-MM-DD'.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const ADAR = 12; // Adar in a regular year, Adar I in a leap year (hebcal's numbering)
const ADAR_II = 13;

const parts = (date) => date.split('-').map(Number);
const hebrewOf = (date) => {
  const [y, m, d] = parts(date);
  return new HDate(new Date(y, m - 1, d)); // hebcal reads local Y/M/D
};

function ordinal(n) {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}

// "Mon 19 Oct", or "Mon 19 Oct 2026".
export function shortDate(date, withYear = false) {
  const [y, m, d] = parts(date);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d} ${MONTHS[m - 1].slice(0, 3)}${withYear ? ` ${y}` : ''}`;
}

// "ט׳ חשון תשפ״ז".
export const hebrewDateText = (date) => hebrewOf(date).renderGematriya(true);

// "8 Cheshvan".
const hebrewDayMonth = (date) => {
  const h = hebrewOf(date);
  return `${h.getDate()} ${h.getMonthName()}`;
};

export const timeText = ({ hour, minute }) => `${pad2(hour)}:${pad2(minute)}`;

// The day before or after `date`.
export function addDay(date, by) {
  const [y, m, d] = parts(date);
  const next = new Date(Date.UTC(y, m - 1, d + by));
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

// The short "how it repeats" under a reminder's title: "Monthly · the 8th (Hebrew)".
export function repeatLabel({ repeat, calendar, start }) {
  const [, m, d] = parts(start);
  if (repeat === 'once') return `Once · ${shortDate(start)}`;
  if (repeat === 'daily') return 'Every day';
  const hebrew = calendar === 'hebrew';
  if (repeat === 'monthly')
    return hebrew
      ? `Monthly · the ${ordinal(hebrewOf(start).getDate())} (Hebrew)`
      : `Monthly · the ${ordinal(d)}`;
  return hebrew
    ? `Yearly · ${hebrewDayMonth(start)}`
    : `Yearly · ${d} ${MONTHS[m - 1]}`;
}

// The sheet's summary line: "Every Hebrew month on the 8th, 09:30".
export function summaryLine(r) {
  const [, m, d] = parts(r.start);
  const hebrew = r.calendar === 'hebrew';
  let line;
  if (r.repeat === 'once') line = `Once, on ${shortDate(r.start, true)}`;
  else if (r.repeat === 'daily') line = `Every day from ${shortDate(r.start)}`;
  else if (r.repeat === 'monthly')
    line = hebrew
      ? `Every Hebrew month on the ${ordinal(hebrewOf(r.start).getDate())}`
      : `Every month on the ${ordinal(d)}`;
  else
    line = hebrew
      ? `Every year on ${hebrewDayMonth(r.start)}`
      : `Every year on ${d} ${MONTHS[m - 1]}`;
  return `${line}, ${timeText(r)}`;
}

// The two calendar choices' small lines: { gregorian: 'the 19th', hebrew: 'the 8th' } for monthly,
// { gregorian: '19 October', hebrew: '8 Cheshvan' } for yearly.
export function calendarChoices({ repeat, start }) {
  const [, m, d] = parts(start);
  return repeat === 'monthly'
    ? {
        gregorian: `the ${ordinal(d)}`,
        hebrew: `the ${ordinal(hebrewOf(start).getDate())}`,
      }
    : { gregorian: `${d} ${MONTHS[m - 1]}`, hebrew: hebrewDayMonth(start) };
}

// What happens on a date some months or years don't have (rules: libs/jewish-calendar's README).
export function oddDateNotes({ repeat, calendar, start }) {
  if (repeat === 'once' || repeat === 'daily') return [];
  const [, m, d] = parts(start);
  const notes = [];
  if (calendar !== 'hebrew') {
    if (repeat === 'monthly' && d > 28)
      notes.push('Months with fewer days: on the last day.');
    if (repeat === 'yearly' && m === 2 && d === 29)
      notes.push('Years without 29 February: on 28 February.');
    return notes;
  }
  const h = hebrewOf(start);
  if (h.getDate() === 30)
    notes.push(
      repeat === 'monthly'
        ? 'Hebrew months with 29 days: on the 29th.'
        : `In years ${h.getMonthName()} has 29 days: on the 29th.`,
    );
  if (repeat === 'yearly') {
    const leap = HDate.isLeapYear(h.getFullYear());
    if (h.getMonth() === ADAR && !leap) notes.push('In leap years: Adar II.');
    if (leap && (h.getMonth() === ADAR || h.getMonth() === ADAR_II))
      notes.push('In regular years: Adar.');
  }
  return notes;
}

// A once-reminder whose time has passed in Israel: kept on its day, dimmed.
export function isDone(reminder, now) {
  if (reminder.repeat !== 'once') return false;
  return `${reminder.start} ${timeText(reminder)}` <= israelClock(now);
}

// The dates the Calendar tab asks reminders for: `around` months either side of month `index`
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

// Same rule as the Reminders Service's TITLE_PATTERN: English or Hebrew letters, digits and basic
// punctuation, single spaces between words; up to 60.
export const TITLE_MAX_LENGTH = 60;
const TITLE_PATTERN =
  /^[A-Za-zא-ת0-9.,'!?:()"&/-]+(?: [A-Za-zא-ת0-9.,'!?:()"&/-]+)*$/;

// Phone keyboards type curly quotes (Mom’s, “Pesach”); the title rule takes the straight ones.
export const straightenQuotes = (text) =>
  text.replace(/[‘’‚‛′]/g, "'").replace(/[“”„‟″]/g, '"');

// Null when the title is fine; else what to fix.
export function titleProblem(title) {
  const t = title.trim();
  if (!t) return 'Give it a title';
  if (!TITLE_PATTERN.test(t))
    return 'English or Hebrew letters, digits and . , \' ! ? : ( ) - " & / only, single spaces';
  return null;
}
