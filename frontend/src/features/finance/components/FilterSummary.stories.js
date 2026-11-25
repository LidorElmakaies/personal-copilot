import { CATEGORIES, OCTOBER_ENTRIES } from '../mocks';
import { filterEntries, NO_FILTER } from '../utils/filter';
import FilterSummary from './FilterSummary';

const story = (filter, sort = null, language = 'en') => {
  const full = { ...NO_FILTER, ...filter };
  return {
    parameters: { language },
    args: {
      filter: full,
      sort,
      entries: filterEntries(OCTOBER_ENTRIES, full),
    },
  };
};

export default {
  component: FilterSummary,
  args: { categories: CATEGORIES },
  argTypes: { onClear: { action: 'cleared' } },
};

// Screen 12: one category, biggest first.
export const OneCategoryByAmount = story(
  { categoryIds: ['cat-eating-out'] },
  'highest',
);
// Only the sort changed: the whole month, counted.
export const SortOnly = story({}, 'oldest');
export const Search = story({ query: 'challah' });
export const ThreeCategories = story({
  categoryIds: ['cat-groceries', 'cat-eating-out', 'cat-transport'],
});
// Everything at once: search, two categories, ₪50–₪300, Bit or cash — wraps to two lines.
export const Everything = story(
  {
    query: 'a',
    categoryIds: ['cat-groceries', 'cat-eating-out'],
    minAgorot: 5000,
    maxAgorot: 30000,
    paidWith: ['bit', 'cash'],
  },
  'lowest',
);
export const Nothing = story({ query: 'zzz' });
export const Hebrew = story(
  { categoryIds: ['cat-eating-out'] },
  'highest',
  'he',
);
export const HebrewEverything = story(
  {
    query: 'חלה',
    categoryIds: ['cat-transport'],
    minAgorot: 5000,
    paidWith: ['card'],
  },
  null,
  'he',
);
