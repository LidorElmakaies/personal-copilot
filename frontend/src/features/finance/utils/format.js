import { count, dayMonth } from '../../../shared/i18n/format';
import { utcDay } from '../../../shared/utils/date';

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

// An entry's line under what it was for: "Groceries · Card ••4821 · 2 photos". The category, in
// either language, is a first-strong isolate — see frontend.md's "A line takes its direction…".
export function entryDetails(translate, entry, category) {
  const photos = entry.attachmentIds.length;
  const parts = [
    category && `\u2068${category}\u2069`,
    paidWithLabel(translate, entry),
    photos && count(translate, 'count.photos', photos),
  ];
  return translate('finance.details', {
    details: parts.filter(Boolean).join(' · '),
  });
}
