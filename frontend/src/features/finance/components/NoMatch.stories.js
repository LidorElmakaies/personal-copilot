import { CATEGORIES } from '../mocks';
import { NO_FILTER } from '../utils/filter';
import NoMatch from './NoMatch';

const OCTOBER = { year: 2026, month: 10 };

export default {
  component: NoMatch,
  parameters: { language: 'en' },
  args: { month: OCTOBER, categories: CATEGORIES },
  argTypes: { onSearchAllCategories: { action: 'search all categories' } },
};

// Screen 15: "challah" in Eating out — with "Search all categories".
export const SearchInCategory = {
  args: {
    filter: { ...NO_FILTER, query: 'challah', categoryIds: ['cat-eating-out'] },
  },
};
export const SearchOnly = {
  args: { filter: { ...NO_FILTER, query: 'challah' } },
};
// Filters with no search: the filters as a whole.
export const FiltersOnly = {
  args: { filter: { ...NO_FILTER, minAgorot: 1000000 } },
};
export const Hebrew = {
  parameters: { language: 'he' },
  args: {
    filter: { ...NO_FILTER, query: 'חלה', categoryIds: ['cat-transport'] },
  },
};
