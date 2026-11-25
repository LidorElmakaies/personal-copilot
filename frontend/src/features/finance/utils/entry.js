import { PAID_WITH } from './filter';
import { parseShekels, shekelsText } from './format';

// How money can be received: every way but a card.
export const RECEIVED_WITH = PAID_WITH.filter((p) => p !== 'card');

// The add sheet's fields: an entry's, to edit it, or empty ones — spent today, by card. How money is paid
// and how it's received are kept apart, so switching between them and back loses neither.
export function entryDraft(entry, today) {
  const received = entry?.direction === 'income';
  return {
    amount: shekelsText(entry?.amountAgorot),
    description: entry?.description ?? '',
    categoryId: entry?.categoryId ?? null,
    direction: entry?.direction ?? 'expense',
    paidWith: entry && !received ? entry.paidWith : 'card',
    receivedWith: received ? entry.paidWith : RECEIVED_WITH[0],
    date: entry?.occurredOn ?? today,
    cardDigits: entry?.cardLast4 ?? '',
  };
}

// A draft back to an entry's own fields, whole agorot; card digits only for a card.
export function entryFields(draft) {
  const paidWith =
    draft.direction === 'income' ? draft.receivedWith : draft.paidWith;
  return {
    amountAgorot: parseShekels(draft.amount),
    description: draft.description.trim(),
    categoryId: draft.categoryId,
    direction: draft.direction,
    paidWith,
    cardLast4: paidWith === 'card' ? draft.cardDigits : null,
    occurredOn: draft.date,
  };
}

// What a statement line is matched by (the plan's README §4).
const MATCHED_BY = [
  'amountAgorot',
  'direction',
  'paidWith',
  'cardLast4',
  'occurredOn',
];

// An entry with its edited fields; changing anything it was matched by removes its statement line.
export function editedEntry(entry, fields) {
  const rematch = MATCHED_BY.some((key) => fields[key] !== entry[key]);
  return {
    ...entry,
    ...fields,
    statementLine: rematch ? null : entry.statementLine,
  };
}

// Why the add sheet can't be saved yet — a dictionary key — or null: no amount (or ₪0), no
// category, a card without its 4 digits. `amount` and `cardDigits` as typed. A future day can't be picked.
export function entryProblem({ amount, categoryId, paidWith, cardDigits }) {
  if (!parseShekels(amount)) return 'finance.amountRequired';
  if (!categoryId) return 'finance.categoryRequired';
  if (paidWith === 'card' && cardDigits.length !== 4) {
    return 'finance.cardDigitsRequired';
  }
  return null;
}
