import { CATEGORIES, OCTOBER_ENTRIES } from '../mocks';
import { categoryTotals, spentAgorot } from '../utils/spending';
import SpentCard from './SpentCard';

// October as on the canvas: ₪7,840 in 7 categories.
const OCTOBER = categoryTotals(OCTOBER_ENTRIES, CATEGORIES);
const total = (id, name, shekels) => ({
  id,
  name,
  amountAgorot: Math.round(shekels * 100),
});

export default {
  component: SpentCard,
  parameters: { language: 'en' },
  args: { spent: spentAgorot(OCTOBER_ENTRIES), totals: OCTOBER },
};

export const October = {};
// A month with no entries shows FinanceEmpty instead; on its own the card says ₪0.
export const NoCategories = { args: { spent: 0, totals: [] } };
export const OneCategory = {
  args: { spent: 320000, totals: OCTOBER.slice(0, 1) },
};
export const ThreeCategories = { args: { totals: OCTOBER.slice(0, 3) } };
export const FourCategories = { args: { totals: OCTOBER.slice(0, 4) } };
export const TenCategories = {
  args: {
    totals: [
      ...OCTOBER,
      total('cat-x1', 'Kids', 120),
      total('cat-x2', 'רכב', 80),
      total('cat-x3', 'Pets', 35.5),
    ],
  },
};
export const OverAHundredThousand = {
  args: {
    spent: 12490090,
    totals: [
      total('cat-housing', 'Housing', 98000),
      total('cat-x1', 'Renovation', 25000.9),
      total('cat-groceries', 'Groceries', 1860),
      total('cat-other', 'Other', 40),
    ],
  },
};
export const Hebrew = { parameters: { language: 'he' } };
export const HebrewOneMore = {
  parameters: { language: 'he' },
  args: { totals: OCTOBER.slice(0, 4) },
};
