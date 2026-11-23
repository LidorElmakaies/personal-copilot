import { monthOf, monthWeeks } from './days';

describe('monthOf', () => {
  it('is the date’s year and month', () => {
    expect(monthOf('2026-10-27')).toEqual({ year: 2026, month: 10 });
    expect(monthOf('2027-01-01')).toEqual({ year: 2027, month: 1 });
  });
});

describe('monthWeeks', () => {
  it('is weeks of 7 from Sunday, blank outside the month (October 2026 starts on a Thursday)', () => {
    const weeks = monthWeeks({ year: 2026, month: 10 });
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]).toEqual([
      null,
      null,
      null,
      null,
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
    expect(weeks[4][6]).toBe('2026-10-31');
  });

  it.each([
    [2026, 2, 28],
    [2028, 2, 29],
    [2026, 11, 30],
    [2026, 12, 31],
  ])('%i-%i has %i days', (year, month, days) => {
    expect(monthWeeks({ year, month }).flat().filter(Boolean)).toHaveLength(
      days,
    );
  });

  it('a month starting on a Sunday has no blanks before it', () => {
    expect(monthWeeks({ year: 2026, month: 11 })[0][0]).toBe('2026-11-01');
  });
});
