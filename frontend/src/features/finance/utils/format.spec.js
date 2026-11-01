import { translateIn } from '../../../shared/i18n/translate';
import { dayLabel, entryDetails, formatShekels } from './format';

const en = (key, vars) => translateIn('en', key, vars);
const he = (key, vars) => translateIn('he', key, vars);

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
    expect(dayLabel(en, '2026-10-27', '2026-10-27')).toBe('Today');
    expect(dayLabel(en, '2026-10-26', '2026-10-27')).toBe('Yesterday');
    expect(dayLabel(en, '2026-10-25', '2026-10-27')).toBe('Oct 25');
    expect(dayLabel(he, '2026-10-25', '2026-10-27')).toBe('25 באוק׳');
    expect(dayLabel(he, '2026-10-26', '2026-10-27')).toBe('אתמול');
    expect(dayLabel(en, '2026-09-30', '2026-10-01')).toBe('Yesterday');
  });
});

describe('entryDetails', () => {
  const entry = (paidWith, photos = 0) => ({
    paidWith,
    cardLast4: paidWith === 'card' ? '4821' : null,
    attachmentIds: Array.from({ length: photos }, (_, i) => `a${i}`),
  });

  it('joins the category, how it was paid and the photos', () => {
    expect(entryDetails(en, entry('card', 2), 'Groceries')).toBe(
      'Groceries · Card ••4821 · 2 photos',
    );
    expect(entryDetails(en, entry('paybox', 1), 'Gifts')).toBe(
      'Gifts · PayBox · 1 photo',
    );
    expect(entryDetails(en, entry('cash'), 'Groceries')).toBe(
      'Groceries · Cash',
    );
  });

  it('in Hebrew keeps the card digits left to right', () => {
    expect(entryDetails(he, entry('card', 1), 'סופר')).toBe(
      '\u200Fסופר · כרטיס \u2066••4821\u2069 · תמונה אחת',
    );
    expect(entryDetails(he, entry('bit'), 'אוכל בחוץ')).toBe(
      '\u200Fאוכל בחוץ · ביט',
    );
    // An English category: still a Hebrew line, starting on the right.
    expect(entryDetails(he, entry('cash'), 'Groceries')).toBe(
      '\u200FGroceries · מזומן',
    );
  });
});
