import { CATEGORIES, OCTOBER_ENTRIES } from '../mocks';
import { NO_FILTER } from '../utils/filter';
import { categoriesBySpending, categoryTotals } from '../utils/spending';
import FilterSheet from './FilterSheet';

// October's categories, the month's spending first — as the screen passes them.
const ORDERED = categoriesBySpending(
  CATEGORIES,
  categoryTotals(OCTOBER_ENTRIES, CATEGORIES),
);

export default {
  component: FilterSheet,
  parameters: { language: 'en' },
  args: {
    visible: true,
    filter: NO_FILTER,
    sort: 'newest',
    entries: OCTOBER_ENTRIES,
    categories: ORDERED,
  },
  argTypes: {
    onClose: { action: 'closed' },
    onApply: { action: 'applied' },
    onNewCategory: { action: 'new category' },
  },
};

// Nothing on: "Show 42 entries".
export const Default = {};
// Screen 13: highest first, Groceries and Eating out, ₪50–₪300.
export const AsDrawn = {
  args: {
    sort: 'highest',
    filter: {
      ...NO_FILTER,
      categoryIds: ['cat-groceries', 'cat-eating-out'],
      minAgorot: 5000,
      maxAgorot: 30000,
    },
  },
};
// Paid with Bit or cash, oldest first; the toolbar's search ("a") counted too.
export const PaidWithAndSearch = {
  args: {
    sort: 'oldest',
    filter: { ...NO_FILTER, query: 'a', paidWith: ['bit', 'cash'] },
  },
};
// Nothing matches: "Show 0 entries".
export const NothingMatches = {
  args: { filter: { ...NO_FILTER, minAgorot: 1000000 } },
};
// Without "+ New category" (before U4b.6 wires it).
export const NoNewCategory = { args: { onNewCategory: undefined } };
export const Hebrew = {
  parameters: { language: 'he' },
  args: AsDrawn.args,
};
export const HebrewDefault = { parameters: { language: 'he' } };
