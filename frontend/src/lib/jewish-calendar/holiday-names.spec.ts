import { holidayName } from './holiday-names';

describe('holidayName', () => {
  const raw = (en: string, he = 'x') => ({ en, he });

  it("drops the year from Rosh Hashana's first day", () => {
    expect(holidayName('Rosh Hashana 5787', raw('Rosh Hashana 5787'))).toEqual({
      en: 'Rosh Hashana I',
      he: 'ראש השנה א׳',
    });
  });

  it('spells out Chol HaMoed for Sukkot and Pesach, II to VI', () => {
    expect(holidayName("Sukkot VI (CH''M)", raw('Sukkot VI (CH’’M)'))).toEqual({
      en: 'Sukkot · day 6 (Chol HaMoed)',
      he: 'סוכות · יום ו׳ (חול המועד)',
    });
    expect(
      holidayName("Pesach III (CH''M)", raw('Pesach III (CH’’M)')).en,
    ).toBe('Pesach · day 3 (Chol HaMoed)');
  });

  it('calls Sukkot VII Hoshana Raba', () => {
    expect(
      holidayName(
        'Sukkot VII (Hoshana Raba)',
        raw('Sukkot VII (Hoshana Raba)'),
      ),
    ).toEqual({ en: 'Hoshana Raba', he: 'הושענא רבה' });
  });

  it('leaves every other name as hebcal gave it', () => {
    for (const desc of [
      'Sukkot II',
      'Pesach VII',
      'Rosh Hashana II',
      'Rosh Hashana LaBehemot',
    ]) {
      const name = raw(desc, 'עברית');
      expect(holidayName(desc, name)).toBe(name);
    }
  });
});
