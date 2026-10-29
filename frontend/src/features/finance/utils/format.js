import { utcDay } from '../../../shared/utils/date';

// ₪ from whole agorot: "₪150", "₪284.90", "₪3,200" — agorot shown only when there are any.
export const formatShekels = (agorot) =>
  `₪${(agorot / 100).toLocaleString('en-US', {
    minimumFractionDigits: agorot % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;

// A list's day heading for a YYYY-MM-DD date: "Today", "Yesterday", else "Oct 25".
export function dayLabel(date, today) {
  const daysAgo = (utcDay(today) - utcDay(date)) / 86_400_000;
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  return utcDay(date).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  });
}

const PAID_WITH = {
  bit: 'Bit',
  paybox: 'PayBox',
  cash: 'Cash',
  transfer: 'Transfer',
};

// "Card ••4821", "Bit"…
export const paidWithLabel = ({ paidWith, cardLast4 }) =>
  paidWith === 'card' ? `Card ••${cardLast4}` : PAID_WITH[paidWith];
