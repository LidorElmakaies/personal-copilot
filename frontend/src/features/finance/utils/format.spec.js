import { translateIn } from '../../../shared/i18n/translate';
import { NO_FILTER } from './filter';
import {
  dayLabel,
  entryDetails,
  filterSummary,
  formatShekels,
  noMatchLine,
  parseShekels,
  shekelsText,
  typedDescription,
  typedShekels,
  DESCRIPTION_MAX,
} from './format';

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

describe('typedShekels', () => {
  it.each([
    ['150', '150'],
    ['12,5', '12.5'],
    ['12.567', '12.56'],
    ['1.2.3', '1.23'],
    ['007', '7'],
    ['0', '0'],
    ['0.5', '0.5'],
    ['.', '0.'],
    ['₪ 1-5a', '15'],
    ['123456789', '1234567'],
    ['', ''],
    [null, ''],
  ])('%p → %p', (text, kept) => {
    expect(typedShekels(text)).toBe(kept);
  });

  it('keeps what parseShekels reads', () => {
    expect(parseShekels(typedShekels('284,90'))).toBe(28490);
  });
});

describe('typedDescription', () => {
  it('keeps English and Hebrew letters, digits, "-" and single spaces', () => {
    expect(typedDescription('Dinner  with Dana')).toBe('Dinner with Dana');
    expect(typedDescription(' ארוחה עם דנה!')).toBe('ארוחה עם דנה');
    expect(typedDescription('2 coffees, café')).toBe('2 coffees caf');
    expect(typedDescription('Super-Pharm #12')).toBe('Super-Pharm 12');
    expect(typedDescription('קפה_ומאפה.')).toBe('קפהומאפה');
    expect(typedDescription(null)).toBe('');
  });

  it('stops at DESCRIPTION_MAX', () => {
    expect(typedDescription('a'.repeat(150))).toHaveLength(DESCRIPTION_MAX);
  });
});

describe('parseShekels and shekelsText', () => {
  it.each([
    ['50', 5000],
    ['284.9', 28490],
    ['284.90', 28490],
    ['12,5', 1250],
    ['12,50', 1250],
    [' ₪ 300 ', 30000],
    ['0', 0],
    ['.5', 50],
    ['7.', 700],
  ])('%p → %p agorot', (text, agorot) => {
    expect(parseShekels(text)).toBe(agorot);
  });

  it.each(['', '  ', 'abc', '1.234', '-5', '1.2.3', '1,200.50', null])(
    '%p → null',
    (text) => {
      expect(parseShekels(text)).toBeNull();
    },
  );

  it('writes agorot back as a field would show them', () => {
    expect(shekelsText(5000)).toBe('50');
    expect(shekelsText(28490)).toBe('284.90');
    expect(shekelsText(0)).toBe('0');
    expect(shekelsText(null)).toBe('');
    expect(parseShekels(shekelsText(120050))).toBe(120050);
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

  // The category is the user's, in an isolate (\u2068…\u2069): its own direction in either line.
  it('joins the category, how it was paid and the photos', () => {
    expect(entryDetails(en, entry('card', 2), ['Groceries'])).toBe(
      '\u200E\u2068Groceries\u2069 · Card ••4821 · 2 photos',
    );
    expect(entryDetails(en, entry('paybox', 1), ['Gifts'])).toBe(
      '\u200E\u2068Gifts\u2069 · PayBox · 1 photo',
    );
    expect(entryDetails(en, entry('cash'), ['Groceries'])).toBe(
      '\u200E\u2068Groceries\u2069 · Cash',
    );
  });

  it('led by the day when the list is sorted by amount', () => {
    expect(entryDetails(en, entry('bit'), ['Eating out'], 'Oct 14')).toBe(
      '‎Oct 14 · ⁨Eating out⁩ · Bit',
    );
    // A card is only its digits there, to fit beside a badge.
    expect(entryDetails(en, entry('card', 2), ['Groceries'], 'Today')).toBe(
      '‎Today · ⁨Groceries⁩ · ••4821 · 2 photos',
    );
    expect(entryDetails(he, entry('card'), ['סופר'], 'היום')).toBe(
      '‏היום · ⁨סופר⁩ · ⁦••4821⁩',
    );
    expect(entryDetails(he, entry('cash'), ['Groceries'], '14 באוק׳')).toBe(
      '‏14 באוק׳ · ⁨Groceries⁩ · מזומן',
    );
  });

  it('a Hebrew category in the English line: still an English line', () => {
    expect(entryDetails(en, entry('bit'), ['מתנות'])).toBe(
      '\u200E\u2068מתנות\u2069 · Bit',
    );
  });

  it('in Hebrew keeps the card digits left to right', () => {
    expect(entryDetails(he, entry('card', 1), ['סופר'])).toBe(
      '\u200F\u2068סופר\u2069 · כרטיס \u2066••4821\u2069 · תמונה אחת',
    );
    expect(entryDetails(he, entry('bit'), ['אוכל בחוץ'])).toBe(
      '\u200F\u2068אוכל בחוץ\u2069 · ביט',
    );
    // An English category: still a Hebrew line, starting on the right.
    expect(entryDetails(he, entry('cash'), ['Groceries'])).toBe(
      '\u200F\u2068Groceries\u2069 · מזומן',
    );
  });

  it('names two categories, and counts more', () => {
    expect(entryDetails(en, entry('bit'), ['Groceries', 'מתנות'])).toContain(
      '\u2068Groceries\u2069, \u2068מתנות\u2069 · ',
    );
    expect(entryDetails(en, entry('bit'), ['A', 'B', 'C'])).toContain(
      '3 categories · ',
    );
  });
});

describe('filterSummary', () => {
  const categories = [
    { id: 'g', name: 'Groceries' },
    { id: 'e', name: 'Eating out' },
    { id: 't', name: 'תחבורה' },
  ];
  const entries = [{ amountAgorot: 15000 }, { amountAgorot: 4990 }];
  const summary = (translate, filter, sort, shown = entries) =>
    filterSummary(translate, {
      filter: { ...NO_FILTER, ...filter },
      sort,
      entries: shown,
      categories,
    });

  it('only the sort changed: the count and total, and the sort', () => {
    expect(summary(en, {}, 'highest')).toEqual({
      title: '‎2 entries · ₪199.90',
      sort: 'Highest amount first',
    });
    expect(summary(he, {}, 'oldest')).toEqual({
      title: '‏2 רשומות · ₪199.90',
      sort: 'הישנות קודם',
    });
  });

  it('names one or two categories, counts more', () => {
    expect(summary(en, { categoryIds: ['e'] }, 'newest').title).toBe(
      '‎⁨Eating out⁩ · 2 entries · ₪199.90',
    );
    expect(summary(en, { categoryIds: ['g', 't'] }).title).toBe(
      '‎⁨Groceries⁩, ⁨תחבורה⁩ · 2 entries · ₪199.90',
    );
    expect(summary(en, { categoryIds: ['g', 'e', 't'] }).title).toBe(
      '‎3 categories · 2 entries · ₪199.90',
    );
  });

  it('the search, the amount range and how it was paid', () => {
    expect(
      summary(
        en,
        {
          query: '  challah ',
          minAgorot: 5000,
          maxAgorot: 30000,
          paidWith: ['card', 'bit'],
        },
        'newest',
        entries.slice(0, 1),
      ).title,
    ).toBe('‎“⁨challah⁩” · ₪50–₪300 · Card, Bit · 1 entry · ₪150');
    expect(summary(en, { minAgorot: 5000 }).title).toBe(
      '‎₪50 and up · 2 entries · ₪199.90',
    );
    expect(summary(en, { maxAgorot: 30000 }).title).toBe(
      '‎up to ₪300 · 2 entries · ₪199.90',
    );
  });

  it('in Hebrew', () => {
    expect(
      summary(
        he,
        { query: 'חלה', maxAgorot: 30000, paidWith: ['card'] },
        'lowest',
        entries.slice(1),
      ),
    ).toEqual({
      title: '‏"⁨חלה⁩" · עד ₪300 · כרטיס · רשומה אחת · ₪49.90',
      sort: 'הסכום הנמוך קודם',
    });
  });

  // Screen 15: what was asked, then "nothing" — no count, total or sort.
  it('nothing left', () => {
    expect(
      summary(en, { query: 'challah', categoryIds: ['e'] }, 'highest', []),
    ).toEqual({
      title: '‎“⁨challah⁩” · ⁨Eating out⁩ · nothing',
      sort: null,
    });
    expect(summary(he, { categoryIds: ['t'] }, 'newest', []).title).toBe(
      '‏⁨תחבורה⁩ · אין תוצאות',
    );
  });
});

describe('noMatchLine', () => {
  const categories = [
    { id: 'e', name: 'Eating out' },
    { id: 't', name: 'תחבורה' },
  ];
  const line = (translate, filter) =>
    noMatchLine(translate, {
      filter: { ...NO_FILTER, ...filter },
      month: { year: 2026, month: 10 },
      categories,
    });

  it('says what was searched, and where', () => {
    expect(line(en, { query: ' challah ', categoryIds: ['e'] })).toBe(
      'No October entry in ⁨Eating out⁩ mentions “⁨challah⁩”.',
    );
    expect(line(en, { query: 'challah' })).toBe(
      'No October entry mentions “⁨challah⁩”.',
    );
    expect(line(en, { categoryIds: ['e'], minAgorot: 100000 })).toBe(
      'No October entry matches these filters.',
    );
  });

  it('in Hebrew', () => {
    expect(line(he, { query: 'חלה', categoryIds: ['t'] })).toBe(
      'אין רשומה מאוקטובר ב־⁨תחבורה⁩ שמזכירה "⁨חלה⁩".',
    );
  });
});
