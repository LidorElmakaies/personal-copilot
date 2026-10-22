import { HDate } from '@hebcal/core';
import { addDays, type CivilDate } from '../models/civil-date';
import { hebrewDayOf } from './hebrew-dates';

// hebrewDayOf is cached per civil day: the same answers as hebcal, before and after the cache
// empties itself.
const fromHebcal = (d: CivilDate) => {
  const hd = new HDate(new Date(d.year, d.month - 1, d.day));
  return { year: hd.getFullYear(), month: hd.getMonth(), day: hd.getDate() };
};

describe('hebrewDayOf', () => {
  it('22 Oct 2026 is 11 Cheshvan 5787, asked once or again', () => {
    const date = { year: 2026, month: 10, day: 22 };
    expect(hebrewDayOf(date)).toEqual({ year: 5787, month: 8, day: 11 });
    expect(hebrewDayOf({ ...date })).toBe(hebrewDayOf(date));
  });

  it('matches hebcal day by day over more days than the cache holds', () => {
    let d: CivilDate = { year: 2020, month: 1, day: 1 };
    for (let i = 0; i < 5000; i++, d = addDays(d, 1)) {
      expect(hebrewDayOf(d)).toEqual(fromHebcal(d));
    }
    const first = { year: 2020, month: 1, day: 1 };
    expect(hebrewDayOf(first)).toEqual(fromHebcal(first));
  });
});
