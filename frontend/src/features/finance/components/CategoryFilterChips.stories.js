import { CATEGORIES, OCTOBER_ENTRIES } from '../mocks';
import { categoriesBySpending, categoryTotals } from '../utils/spending';
import CategoryFilterChips from './CategoryFilterChips';

// October's categories, the month's spending first.
const ORDERED = categoriesBySpending(
  CATEGORIES,
  categoryTotals(OCTOBER_ENTRIES, CATEGORIES),
);

export default {
  component: CategoryFilterChips,
  parameters: { language: 'en' },
  args: { categories: ORDERED, selectedIds: [] },
  argTypes: {
    onChange: { action: 'changed' },
    onNewCategory: { action: 'new category' },
  },
};

export const All = {};
export const OneChosen = { args: { selectedIds: ['cat-eating-out'] } };
// Several chosen in the filter sheet: each lit, All not.
export const SeveralChosen = {
  args: { selectedIds: ['cat-groceries', 'cat-transport'] },
};
export const LongName = {
  args: {
    categories: [
      { id: 'cat-x', name: 'Kids, school trips and after-school classes' },
      ...ORDERED,
    ],
  },
};
export const Hebrew = {
  parameters: { language: 'he' },
  args: { selectedIds: ['cat-bills'] },
};
