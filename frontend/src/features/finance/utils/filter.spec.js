import { OCTOBER_ENTRIES } from '../mocks';
import {
  filterEntries,
  isByAmount,
  isFiltering,
  NO_FILTER,
  sheetFiltering,
  sortEntries,
} from './filter';

const descriptions = (entries) => entries.map((e) => e.description);
const filter = (own) =>
  filterEntries(OCTOBER_ENTRIES, { ...NO_FILTER, ...own });

describe('filterEntries', () => {
  it('filters nothing when nothing is on', () => {
    expect(filter({})).toHaveLength(42);
    expect(filter({ query: '   ' })).toHaveLength(42);
  });

  it('searches "what for", ignoring case and extra spaces', () => {
    expect(descriptions(filter({ query: '  CHALLAH ' }))).toEqual([
      'Challah and pastries',
    ]);
    expect(filter({ query: 'milk  and' })).toHaveLength(3);
  });

  it('searches in Hebrew, and the shop as well as "what for"', () => {
    // "חלה" three times by name; the bakery also sold the challah and pastries.
    expect(filter({ query: 'חלה' })).toHaveLength(3);
    expect(filter({ query: "מאפיית אנג'ל" })).toHaveLength(4);
    expect(descriptions(filter({ query: 'ikea' }))).toEqual([
      'Shelves לחדר העבודה',
    ]);
    // A mixed "what for" is found by either word.
    expect(descriptions(filter({ query: 'וכריך' }))).toEqual(['Coffee וכריך']);
  });

  it('keeps any of the chosen categories', () => {
    expect(filter({ categoryIds: ['cat-eating-out'] })).toHaveLength(6);
    expect(
      filter({ categoryIds: ['cat-eating-out', 'cat-transport'] }),
    ).toHaveLength(9);
  });

  it('keeps amounts within the range, both ends included', () => {
    const between = filter({ minAgorot: 15000, maxAgorot: 30000 });
    expect(between.every((e) => e.amountAgorot >= 15000)).toBe(true);
    expect(between.every((e) => e.amountAgorot <= 30000)).toBe(true);
    expect(between).toHaveLength(9);
    expect(filter({ minAgorot: 100000 })).toHaveLength(1); // the rent
    expect(filter({ maxAgorot: 2000 })).toHaveLength(2);
  });

  it('keeps any of the chosen ways of paying', () => {
    expect(filter({ paidWith: ['bit'] })).toHaveLength(3);
    expect(filter({ paidWith: ['bit', 'cash'] })).toHaveLength(5);
  });

  it('combines every filter that is on', () => {
    expect(
      descriptions(
        filter({
          query: 'dinner',
          categoryIds: ['cat-eating-out'],
          minAgorot: 10000,
          paidWith: ['bit'],
        }),
      ),
    ).toEqual(['Dinner with Dana', 'Dinner with Dana']);
    expect(
      filter({ query: 'challah', categoryIds: ['cat-eating-out'] }),
    ).toEqual([]);
  });
});

describe('sortEntries', () => {
  const sample = filter({ categoryIds: ['cat-eating-out'] });

  it('sorts by day, newest or oldest first', () => {
    const newest = sortEntries(sample, 'newest').map((e) => e.occurredOn);
    expect(newest[0]).toBe('2026-10-27');
    expect(newest.at(-1)).toBe('2026-10-07');
    expect(sortEntries(sample, 'oldest')[0].occurredOn).toBe('2026-10-07');
  });

  it('sorts by amount; equal amounts newest first', () => {
    const highest = sortEntries(sample, 'highest');
    expect(highest.map((e) => e.amountAgorot)).toEqual([
      15000, 15000, 15000, 12000, 3800, 3200,
    ]);
    expect(highest.slice(0, 3).map((e) => e.occurredOn)).toEqual([
      '2026-10-27',
      '2026-10-14',
      '2026-10-12',
    ]);
    expect(sortEntries(sample, 'lowest')[0].amountAgorot).toBe(3200);
  });

  it('leaves the original alone and defaults to newest', () => {
    const before = [...sample];
    sortEntries(sample, 'highest');
    expect(sample).toEqual(before);
    expect(sortEntries(sample)).toEqual(sortEntries(sample, 'newest'));
    expect(sortEntries(sample, null)).toEqual(sortEntries(sample, 'newest'));
  });
});

describe('isByAmount and isFiltering', () => {
  it('tells the two kinds of sort apart', () => {
    expect(isByAmount('highest')).toBe(true);
    expect(isByAmount('lowest')).toBe(true);
    expect(isByAmount('newest')).toBe(false);
    expect(isByAmount('oldest')).toBe(false);
    expect(isByAmount(null)).toBe(false);
  });

  it('is filtering once anything differs from the default', () => {
    expect(isFiltering(NO_FILTER)).toBe(false);
    expect(isFiltering({ ...NO_FILTER, query: '  ' })).toBe(false);
    expect(isFiltering(NO_FILTER, null)).toBe(false);
    expect(isFiltering(NO_FILTER, 'highest')).toBe(true);
    expect(isFiltering(NO_FILTER, 'newest')).toBe(true);
    expect(isFiltering({ ...NO_FILTER, query: 'fuel' })).toBe(true);
    expect(isFiltering({ ...NO_FILTER, categoryIds: ['cat-other'] })).toBe(
      true,
    );
    expect(isFiltering({ ...NO_FILTER, maxAgorot: 0 })).toBe(true);
    expect(isFiltering({ ...NO_FILTER, paidWith: ['cash'] })).toBe(true);
  });
});

describe('sheetFiltering', () => {
  it('only what the toolbar does not show lights the filters button', () => {
    expect(sheetFiltering(NO_FILTER)).toBe(false);
    expect(sheetFiltering(NO_FILTER, null)).toBe(false);
    expect(sheetFiltering(NO_FILTER, 'lowest')).toBe(true);
    expect(sheetFiltering({ ...NO_FILTER, query: 'fuel' })).toBe(false);
    expect(sheetFiltering({ ...NO_FILTER, categoryIds: ['a'] })).toBe(false);
    expect(sheetFiltering({ ...NO_FILTER, categoryIds: ['a', 'b'] })).toBe(
      true,
    );
    expect(sheetFiltering({ ...NO_FILTER, minAgorot: 0 })).toBe(true);
    expect(sheetFiltering({ ...NO_FILTER, maxAgorot: 30000 })).toBe(true);
    expect(sheetFiltering({ ...NO_FILTER, paidWith: ['bit'] })).toBe(true);
  });
});
