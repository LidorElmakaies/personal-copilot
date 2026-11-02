import {
  addDay,
  calendarChoices,
  hebrewDateText,
  isDone,
  oddDateNotes,
  remindersRange,
  repeatLabel,
  straightenQuotes,
  summaryLine,
  titleProblem,
} from './customReminders';
import { shortDate } from '../../../shared/i18n/format';
import { translateIn } from '../../../shared/i18n/translate';
import { monthIndex } from '../../../shared/utils/date';

const en = (key, vars) => translateIn('en', key, vars);
const he = (key, vars) => translateIn('he', key, vars);

// The words the add sheet and the day card use for a user's own reminder, from its own fields.
// 19 Oct 2026 is 8 Cheshvan 5787. A zone far from Israel's, so a local-time slip shows as a wrong day.
process.env.TZ = 'America/Los_Angeles';

const reminder = (over) => ({
  hour: 9,
  minute: 30,
  repeat: 'monthly',
  calendar: 'gregorian',
  start: '2026-10-19',
  ...over,
});

describe('customReminders words', () => {
  it('dates: short, with a year, a day either side across a month end', () => {
    expect(shortDate(en, '2026-10-19')).toBe('Mon 19 Oct');
    expect(shortDate(en, '2026-10-19', true)).toBe('Mon 19 Oct 2026');
    expect(addDay('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDay('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('the Hebrew date in letters', () => {
    expect(hebrewDateText(en, '2026-10-19')).toBe('ח׳ חשון תשפ״ז');
    expect(hebrewDateText(he, '2026-10-19')).toBe('ח׳ בחשון תשפ״ז');
  });

  it.each([
    [{ repeat: 'once' }, 'Once · Mon 19 Oct'],
    [{ repeat: 'daily' }, 'Every day'],
    [{}, 'Monthly · the 19th'],
    [{ calendar: 'hebrew' }, 'Monthly · the 8th (Hebrew)'],
    [{ repeat: 'yearly' }, 'Yearly · 19 October'],
    [{ repeat: 'yearly', calendar: 'hebrew' }, 'Yearly · 8 Cheshvan'],
  ])('repeatLabel %o → %s', (over, label) => {
    expect(repeatLabel(en, reminder(over))).toBe(label);
  });

  it.each([
    [{ repeat: 'once' }, 'פעם אחת · 19 באוק׳'],
    [{ repeat: 'daily' }, 'כל יום'],
    [{}, 'כל חודש · ב־19'],
    [{ calendar: 'hebrew' }, 'כל חודש · ב־ח׳ (עברי)'],
    [{ repeat: 'yearly' }, 'כל שנה · 19 באוקטובר'],
    [{ repeat: 'yearly', calendar: 'hebrew' }, 'כל שנה · ח׳ בחשון'],
  ])('repeatLabel in Hebrew %o → %s', (over, label) => {
    expect(repeatLabel(he, reminder(over))).toBe(label);
  });

  it.each([
    [{ repeat: 'once' }, 'Once, on Mon 19 Oct 2026, 09:30'],
    [{ repeat: 'daily' }, 'Every day from Mon 19 Oct, 09:30'],
    [{}, 'Every month on the 19th, 09:30'],
    [{ calendar: 'hebrew' }, 'Every Hebrew month on the 8th, 09:30'],
    [{ repeat: 'yearly' }, 'Every year on 19 October, 09:30'],
    [
      { repeat: 'yearly', calendar: 'hebrew' },
      'Every year on 8 Cheshvan, 09:30',
    ],
  ])('summaryLine %o → %s', (over, line) => {
    expect(summaryLine(en, reminder(over))).toBe(line);
  });

  it.each([
    [{ repeat: 'once' }, 'פעם אחת, שני, 19 באוק׳ 2026, 09:30'],
    [{ repeat: 'daily' }, 'כל יום, החל מ־שני, 19 באוק׳, 09:30'],
    [{}, 'כל חודש ב־19, 09:30'],
    [{ calendar: 'hebrew' }, 'כל חודש עברי ב־ח׳, 09:30'],
    [{ repeat: 'yearly' }, 'כל שנה ב־19 באוקטובר, 09:30'],
    [{ repeat: 'yearly', calendar: 'hebrew' }, 'כל שנה ב־ח׳ בחשון, 09:30'],
  ])('summaryLine in Hebrew %o → %s', (over, line) => {
    expect(summaryLine(he, reminder(over))).toBe(line);
  });

  it('the calendar choices and a note, in Hebrew', () => {
    expect(calendarChoices(he, reminder({ repeat: 'yearly' }))).toEqual({
      gregorian: '19 באוקטובר',
      hebrew: 'ח׳ בחשון',
    });
    expect(oddDateNotes(he, reminder({ start: '2026-01-29' }))).toEqual([
      'בחודשים קצרים יותר: ביום האחרון.',
    ]);
  });

  it('the calendar choices: monthly by day, yearly by day and month', () => {
    expect(calendarChoices(en, reminder())).toEqual({
      gregorian: 'the 19th',
      hebrew: 'the 8th',
    });
    expect(calendarChoices(en, reminder({ repeat: 'yearly' }))).toEqual({
      gregorian: '19 October',
      hebrew: '8 Cheshvan',
    });
  });

  describe('oddDateNotes', () => {
    it('none for once, daily, or an ordinary day', () => {
      expect(
        oddDateNotes(en, reminder({ repeat: 'once', start: '2026-01-31' })),
      ).toEqual([]);
      expect(
        oddDateNotes(en, reminder({ repeat: 'daily', start: '2026-01-31' })),
      ).toEqual([]);
      expect(oddDateNotes(en, reminder())).toEqual([]);
    });

    it('Gregorian: the 29th–31st monthly, 29 February yearly', () => {
      expect(oddDateNotes(en, reminder({ start: '2026-01-29' }))).toEqual([
        'Months with fewer days: on the last day.',
      ]);
      expect(
        oddDateNotes(en, reminder({ repeat: 'yearly', start: '2028-02-29' })),
      ).toEqual(['Years without 29 February: on 28 February.']);
    });

    it('Hebrew: the 30th, and Adar in regular and leap years', () => {
      // 30 Cheshvan 5787 = 10 Nov 2026; 1 Adar 5788 (regular) = 28 Feb 2028;
      // 1 Adar I 5787 (leap) = 8 Feb 2027.
      expect(
        oddDateNotes(en, reminder({ calendar: 'hebrew', start: '2026-11-10' })),
      ).toEqual(['Hebrew months with 29 days: on the 29th.']);
      expect(
        oddDateNotes(
          en,
          reminder({
            repeat: 'yearly',
            calendar: 'hebrew',
            start: '2026-11-10',
          }),
        ),
      ).toEqual(['In years Cheshvan has 29 days: on the 29th.']);
      expect(
        oddDateNotes(
          en,
          reminder({
            repeat: 'yearly',
            calendar: 'hebrew',
            start: '2028-02-28',
          }),
        ),
      ).toEqual(['In leap years: Adar II.']);
      expect(
        oddDateNotes(
          en,
          reminder({
            repeat: 'yearly',
            calendar: 'hebrew',
            start: '2027-02-08',
          }),
        ),
      ).toEqual(['In regular years: Adar.']);
    });
  });

  it("isDone: a once-reminder whose time has passed on Israel's clock", () => {
    const once = reminder({ repeat: 'once', start: '2026-10-19' });
    expect(isDone(once, new Date('2026-10-19T06:29:00Z'))).toBe(false); // 09:29 in Israel
    expect(isDone(once, new Date('2026-10-19T06:30:00Z'))).toBe(true);
    expect(isDone(reminder(), new Date('2027-01-01T00:00:00Z'))).toBe(false);
  });

  it('remindersRange: months either side, first day to last, across a year end', () => {
    expect(remindersRange(monthIndex({ year: 2026, month: 12 }), 1)).toEqual({
      from: '2026-11-01',
      to: '2027-01-31',
    });
    expect(remindersRange(monthIndex({ year: 2028, month: 2 }), 0)).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
  });

  it("straightens a phone keyboard's curly quotes, which the title rule then takes", () => {
    const title = straightenQuotes('Mom’s “Pesach”');
    expect(title).toBe('Mom\'s "Pesach"');
    expect(titleProblem(title)).toBeNull();
  });
});
