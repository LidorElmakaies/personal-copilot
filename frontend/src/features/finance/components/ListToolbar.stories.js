import ListToolbar from './ListToolbar';

export default {
  component: ListToolbar,
  parameters: { language: 'en' },
  args: { query: '' },
  argTypes: {
    onChangeQuery: { action: 'query' },
    onSort: { action: 'sort' },
    onFilters: { action: 'filters' },
  },
};

export const Empty = {};
export const Searching = { args: { query: 'challah' } };
// Sorted by amount: the sort button lit, with a ₪.
export const ByAmount = { args: { sort: 'highest' } };
// Oldest first: lit, no ₪. The filters button lit too (wired in U4b.5).
export const OldestAndFiltersOn = {
  args: { sort: 'oldest', filtersActive: true },
};
export const Hebrew = { parameters: { language: 'he' } };
export const HebrewByAmount = {
  parameters: { language: 'he' },
  args: { sort: 'highest' },
};
export const HebrewSearching = {
  parameters: { language: 'he' },
  args: { query: 'חלה' },
};
