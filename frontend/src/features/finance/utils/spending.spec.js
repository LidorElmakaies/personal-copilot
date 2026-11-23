import { CATEGORIES, OCTOBER_ENTRIES } from '../mocks';
import {
  barShare,
  categoriesBySpending,
  categoryTotals,
  spentAgorot,
} from './spending';

describe('barShare', () => {
  it.each([
    [320000, 320000, 1],
    [186000, 320000, 0.58125],
    [64000, 320000, 0.2],
    [0, 320000, 0],
  ])('%i of %i → %d', (agorot, biggest, share) => {
    expect(barShare(agorot, biggest)).toBe(share);
  });

  it('is empty when nothing was spent, and never past the end', () => {
    expect(barShare(0, 0)).toBe(0);
    expect(barShare(500, 0)).toBe(0);
    expect(barShare(400, 300)).toBe(1);
    expect(barShare(-100, 300)).toBe(0);
  });
});

describe('categoryTotals', () => {
  it('gives October as on the canvas: ₪7,840, Housing, Groceries, Eating out first, 7 in all', () => {
    const totals = categoryTotals(OCTOBER_ENTRIES, CATEGORIES);
    expect(spentAgorot(OCTOBER_ENTRIES)).toBe(784000);
    expect(totals.slice(0, 3)).toEqual([
      { id: 'cat-housing', name: 'Housing', amountAgorot: 320000 },
      { id: 'cat-groceries', name: 'Groceries', amountAgorot: 186000 },
      { id: 'cat-eating-out', name: 'Eating out', amountAgorot: 64000 },
    ]);
    expect(totals).toHaveLength(7);
  });

  const e = (categories, amountAgorot, direction = 'expense') => ({
    categoryIds: [categories].flat(),
    amountAgorot,
    direction,
  });

  it('leaves out empty categories and income; ties keep the categories’ order', () => {
    const totals = categoryTotals(
      [
        e('cat-gifts', 500),
        e('cat-groceries', 500),
        e('cat-other', 9999, 'income'),
      ],
      CATEGORIES,
    );
    expect(totals.map((t) => t.id)).toEqual(['cat-groceries', 'cat-gifts']);
  });

  it('counts an entry in several in full in each, and once in the total', () => {
    const entries = [
      e(['cat-eating-out', 'cat-gifts'], 15000),
      e('cat-gifts', 2000),
      e('cat-other', 9999, 'income'),
    ];
    expect(
      categoryTotals(entries, CATEGORIES).map((t) => [t.id, t.amountAgorot]),
    ).toEqual([
      ['cat-gifts', 17000],
      ['cat-eating-out', 15000],
    ]);
    expect(spentAgorot(entries)).toBe(17000);
  });

  it('is empty for a month with no entries', () => {
    expect(categoryTotals([], CATEGORIES)).toEqual([]);
    expect(spentAgorot([])).toBe(0);
  });
});

describe('categoriesBySpending', () => {
  it('puts the month’s spending first, biggest first, then the rest in order', () => {
    const totals = categoryTotals(OCTOBER_ENTRIES, CATEGORIES);
    expect(categoriesBySpending(CATEGORIES, totals).map((c) => c.id)).toEqual([
      'cat-housing',
      'cat-groceries',
      'cat-eating-out',
      'cat-transport',
      'cat-bills',
      'cat-shopping',
      'cat-subscriptions',
      'cat-gifts',
      'cat-health',
      'cat-other',
    ]);
  });

  it('leaves out archived categories', () => {
    const archived = CATEGORIES.map((c) =>
      c.id === 'cat-gifts' ? { ...c, archivedAt: '2026-10-01' } : c,
    );
    expect(categoriesBySpending(archived, []).map((c) => c.id)).not.toContain(
      'cat-gifts',
    );
  });
});
