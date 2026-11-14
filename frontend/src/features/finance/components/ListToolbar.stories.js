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
// Sort and filters on (their buttons lit) — wired in U4b.4–U4b.5.
export const SortAndFiltersOn = {
  args: { sortActive: true, filtersActive: true },
};
export const Hebrew = { parameters: { language: 'he' } };
export const HebrewSearching = {
  parameters: { language: 'he' },
  args: { query: 'חלה' },
};
