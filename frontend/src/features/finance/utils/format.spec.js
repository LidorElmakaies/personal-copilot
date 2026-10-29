import { dayLabel, formatShekels, paidWithLabel } from './format';

describe('formatShekels', () => {
  it.each([
    [15000, '₪150'],
    [28490, '₪284.90'],
    [320000, '₪3,200'],
    [10012345, '₪100,123.45'],
    [0, '₪0'],
  ])('%i agorot → %s', (agorot, text) => {
    expect(formatShekels(agorot)).toBe(text);
  });
});

describe('dayLabel', () => {
  it('names today and yesterday, else the month and day', () => {
    expect(dayLabel('2026-10-27', '2026-10-27')).toBe('Today');
    expect(dayLabel('2026-10-26', '2026-10-27')).toBe('Yesterday');
    expect(dayLabel('2026-10-25', '2026-10-27')).toBe('Oct 25');
    expect(dayLabel('2026-09-30', '2026-10-01')).toBe('Yesterday');
  });
});

describe('paidWithLabel', () => {
  it('shows a card by its last 4 digits', () => {
    expect(paidWithLabel({ paidWith: 'card', cardLast4: '4821' })).toBe(
      'Card ••4821',
    );
    expect(paidWithLabel({ paidWith: 'paybox', cardLast4: null })).toBe(
      'PayBox',
    );
  });
});
