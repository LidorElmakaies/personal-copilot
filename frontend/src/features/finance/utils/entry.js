import { PAID_WITH } from './filter';
import { parseShekels } from './format';

// How money can be received: every way but a card.
export const RECEIVED_WITH = PAID_WITH.filter((p) => p !== 'card');

// Why the add sheet can't be saved yet — a dictionary key — or null: no amount (or ₪0), a card without
// its 4 digits. `amount` and `cardDigits` as typed. A future day can't be picked.
export function entryProblem({ amount, paidWith, cardDigits }) {
  if (!parseShekels(amount)) return 'finance.amountRequired';
  if (paidWith === 'card' && cardDigits.length !== 4) {
    return 'finance.cardDigitsRequired';
  }
  return null;
}
