import { count, dayMonth } from '../../../shared/i18n/format';
import { utcDay } from '../../../shared/utils/date';

// ₪ from whole agorot: "₪150", "₪284.90", "₪3,200" — agorot shown only when there are any.
export const formatShekels = (agorot) =>
  `₪${(agorot / 100).toLocaleString('en-US', {
    minimumFractionDigits: agorot % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;

// An amount field's text → whole agorot: "50", "284.9", "12,5" (a comma is the decimal point — the
// phone's decimal keypad has both keys); blank or not a number (more than two decimals too) → null.
export function parseShekels(text) {
  const clean = (text ?? '').replace(/[\s₪]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$|^\.\d{1,2}$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

// What an amount field keeps as it's typed: digits and one decimal point ("," from the keypad
// becomes "."), at most 2 decimals and 7 whole digits, no leading zeros ("007" → "7", "." → "0.").
export function typedShekels(text) {
  const [whole, ...rest] = (text ?? '')
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '')
    .split('.');
  const digits = whole.replace(/^0+(?=\d)/, '').slice(0, 7);
  if (rest.length === 0) return digits;
  return `${digits || '0'}.${rest.join('').slice(0, 2)}`;
}

// A card's last digits as they're typed: digits only, 4 at most.
export const typedCardDigits = (text) =>
  (text ?? '').replace(/\D/g, '').slice(0, 4);

// "What was it for?" as it's typed: English and Hebrew letters as everywhere (`sanitizeName`), and
// here also digits and "-" ("2 coffees", "Super-Pharm" — the user's call, 2026-11-15); single
// spaces, at most DESCRIPTION_MAX. The Finance service (B2) checks the same.
export const DESCRIPTION_MAX = 100;
const NOT_DESCRIPTION_CHAR = /[^A-Za-zא-ת0-9\- ]/g;
export const typedDescription = (text) =>
  (text ?? '')
    .replace(NOT_DESCRIPTION_CHAR, '')
    .replace(/ {2,}/g, ' ')
    .replace(/^ /, '')
    .slice(0, DESCRIPTION_MAX);

// Whole agorot → an amount field's text: "50", "284.90"; null → "".
export const shekelsText = (agorot) =>
  agorot == null
    ? ''
    : agorot % 100
      ? (agorot / 100).toFixed(2)
      : String(agorot / 100);

// A list's day heading for a YYYY-MM-DD date: "Today", "Yesterday", else "Oct 25" (dayMonth, in
// `translate`'s language).
export function dayLabel(translate, date, today) {
  const daysAgo = (utcDay(today) - utcDay(date)) / 86_400_000;
  if (daysAgo === 0) return translate('calendar.today');
  if (daysAgo === 1) return translate('finance.yesterday');
  return dayMonth(translate, date);
}

// "Card ••4821", "Bit"… · "כרטיס ••4821", "ביט"…; `short`: a card is only "••4821".
export const paidWithLabel = (translate, { paidWith, cardLast4 }, short) =>
  translate(
    short && paidWith === 'card'
      ? 'paidWith.cardShort'
      : `paidWith.${paidWith}`,
    { last4: cardLast4 },
  );

// A way to pay by its name alone: "Card", "Bit".
export const paidWithName = (translate, paidWith) =>
  translate(paidWith === 'card' ? 'finance.card' : `paidWith.${paidWith}`);

// An entry's line under what it was for: "Groceries · Card ••4821 · 2 photos"; `day` (a dayLabel, for
// the list sorted by amount) leads it and shortens a card to its digits, so the line fits beside a badge:
// "Oct 14 · Groceries · ••4821". `category` (its name), in either language, is
// a first-strong isolate — see frontend.md's "A line takes its direction…".
export function entryDetails(translate, entry, category, day) {
  const photos = entry.attachmentIds.length;
  const parts = [
    day,
    isolate(category),
    paidWithLabel(translate, entry, !!day),
    photos && count(translate, 'count.photos', photos),
  ];
  return translate('finance.details', {
    details: parts.filter(Boolean).join(' · '),
  });
}

// The user's own text inside a line, laid out by its own first letter.
export const isolate = (text) => `\u2068${text}\u2069`;

// A foreign charge's own amount, from its smallest unit: "$24.99", or "24.99 CHF". Left to right everywhere.
const SYMBOLS = { USD: '$', EUR: '€', GBP: '£' };
export function formatForeign(currency, amount) {
  const number = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
  });
  const symbol = SYMBOLS[currency];
  return `\u2066${symbol ? symbol + number : `${number} ${currency}`}\u2069`;
}

// A statement line's details: "Oct 17 · payment 1 of 12", "Oct 22 · $24.99", "Oct 3 · refund".
export function chargeDetails(translate, line) {
  const parts = [
    dayMonth(translate, line.occurredOn),
    line.amountAgorot < 0 && translate('charge.refund'),
    line.installmentNo &&
      translate('charge.installment', {
        n: line.installmentNo,
        total: line.installmentsTotal,
      }),
    line.originalCurrency &&
      formatForeign(line.originalCurrency, line.originalAmount),
  ];
  return translate('finance.details', {
    details: parts.filter(Boolean).join(' · '),
  });
}

// A value to show bold inside a translated sentence, and the sentence back in pieces: `[{ text, bold }]`.
const BOLD = '\u0001';
export const bold = (text) => BOLD + text + BOLD;
export const boldParts = (sentence) =>
  sentence.split(BOLD).map((text, i) => ({ text, bold: i % 2 === 1 }));

// Category names: up to two ("Groceries, תחבורה"), else counted ("3 categories").
const namesLine = (translate, names) =>
  names.length > 2
    ? count(translate, 'count.categories', names.length)
    : names.map(isolate).join(', ');

function categoryNames(translate, ids, categories) {
  const nameOf = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  return namesLine(
    translate,
    ids.map((id) => nameOf[id]),
  );
}

// What the filter asks for, piece by piece: "challah", the categories (by name up to two, else "3
// categories"), the amount range, how it was paid.
function filterParts(translate, filter, categories) {
  const { query, categoryIds, minAgorot, maxAgorot, paidWith } = filter;
  const min = minAgorot != null && formatShekels(minAgorot);
  const max = maxAgorot != null && formatShekels(maxAgorot);
  return [
    query.trim() &&
      translate('finance.summaryQuery', { query: isolate(query.trim()) }),
    categoryNames(translate, categoryIds, categories),
    min && max
      ? translate('finance.amountRange', { min, max })
      : min
        ? translate('finance.amountFrom', { min })
        : max && translate('finance.amountUpTo', { max }),
    paidWith
      .map((p) => translate(p === 'card' ? 'finance.card' : `paidWith.${p}`))
      .join(', '),
  ].filter(Boolean);
}

// The line over a filtered or re-sorted list (screen 12): `title` — what's asked, how many and their
// total ("Eating out · 8 entries · ₪640") — and `sort` ("Highest amount first"). `entries` are the
// ones shown; none → what was asked and "nothing", no sort (screen 15).
export function filterSummary(
  translate,
  { filter, sort, entries, categories },
) {
  const asked = filterParts(translate, filter, categories);
  if (entries.length === 0) {
    const parts = [...asked, translate('finance.nothing')];
    return {
      title: translate('finance.details', { details: parts.join(' · ') }),
      sort: null,
    };
  }
  const total = entries.reduce((sum, e) => sum + e.amountAgorot, 0);
  const parts = [
    ...asked,
    count(translate, 'count.entries', entries.length),
    formatShekels(total),
  ];
  return {
    title: translate('finance.details', { details: parts.join(' · ') }),
    sort: sort ? translate(`finance.sortBy.${sort}`) : null,
  };
}

// "Nothing matches"' line (screen 15), from what was searched and which categories: "No October entry in
// Eating out mentions “challah”." — without either, the filters as a whole. `month` `{ year, month }`.
export function noMatchLine(translate, { filter, month, categories }) {
  const query = filter.query.trim();
  const vars = {
    month: translate(`month.${month.month}`),
    categories: categoryNames(translate, filter.categoryIds, categories),
    query: isolate(query),
  };
  const key =
    query && filter.categoryIds.length
      ? 'finance.noMatchQueryIn'
      : query
        ? 'finance.noMatchQuery'
        : 'finance.noMatchFilters';
  return translate(key, vars);
}
