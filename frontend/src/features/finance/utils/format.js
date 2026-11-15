import { count, dayMonth } from '../../../shared/i18n/format';
import { utcDay } from '../../../shared/utils/date';
import { DEFAULT_SORT } from './filter';

// ₪ from whole agorot: "₪150", "₪284.90", "₪3,200" — agorot shown only when there are any.
export const formatShekels = (agorot) =>
  `₪${(agorot / 100).toLocaleString('en-US', {
    minimumFractionDigits: agorot % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;

// A list's day heading for a YYYY-MM-DD date: "Today", "Yesterday", else "Oct 25" (dayMonth, in
// `translate`'s language).
export function dayLabel(translate, date, today) {
  const daysAgo = (utcDay(today) - utcDay(date)) / 86_400_000;
  if (daysAgo === 0) return translate('calendar.today');
  if (daysAgo === 1) return translate('finance.yesterday');
  return dayMonth(translate, date);
}

// "Card ••4821", "Bit"… · "כרטיס ••4821", "ביט"…
const paidWithLabel = (translate, { paidWith, cardLast4 }) =>
  translate(`paidWith.${paidWith}`, { last4: cardLast4 });

// An entry's line under what it was for: "Groceries · Card ••4821 · 2 photos"; `day` (a dayLabel, for
// the list sorted by amount) leads it: "Oct 14 · Groceries · Bit". The category, in either language, is
// a first-strong isolate — see frontend.md's "A line takes its direction…".
export function entryDetails(translate, entry, category, day) {
  const photos = entry.attachmentIds.length;
  const parts = [
    day,
    category && `\u2068${category}\u2069`,
    paidWithLabel(translate, entry),
    photos && count(translate, 'count.photos', photos),
  ];
  return translate('finance.details', {
    details: parts.filter(Boolean).join(' · '),
  });
}

const isolate = (text) => `⁨${text}⁩`;

// What the filter asks for, piece by piece: "challah", the categories (by name up to two, else "3
// categories"), the amount range, how it was paid.
function filterParts(translate, filter, categories) {
  const { query, categoryIds, minAgorot, maxAgorot, paidWith } = filter;
  const nameOf = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const min = minAgorot != null && formatShekels(minAgorot);
  const max = maxAgorot != null && formatShekels(maxAgorot);
  return [
    query.trim() &&
      translate('finance.summaryQuery', { query: isolate(query.trim()) }),
    categoryIds.length > 2
      ? count(translate, 'count.categories', categoryIds.length)
      : categoryIds.map((id) => isolate(nameOf[id])).join(', '),
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
// ones shown.
export function filterSummary(
  translate,
  { filter, sort, entries, categories },
) {
  const total = entries.reduce((sum, e) => sum + e.amountAgorot, 0);
  const parts = [
    ...filterParts(translate, filter, categories),
    count(translate, 'count.entries', entries.length),
    formatShekels(total),
  ];
  return {
    title: translate('finance.details', { details: parts.join(' · ') }),
    sort: translate(`finance.sortBy.${sort ?? DEFAULT_SORT}`),
  };
}
