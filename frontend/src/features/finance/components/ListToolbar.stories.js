import ListToolbar from './ListToolbar';

export default {
  component: ListToolbar,
  parameters: { language: 'en' },
  args: { query: '' },
  argTypes: {
    onChangeQuery: { action: 'query' },
    onFilters: { action: 'filters' },
  },
};

export const Empty = {};
export const Searching = { args: { query: 'challah' } };
export const FiltersOn = { args: { filtersActive: true } };
export const Hebrew = { parameters: { language: 'he' } };
export const HebrewFiltersOn = {
  parameters: { language: 'he' },
  args: { filtersActive: true },
};
export const HebrewSearching = {
  parameters: { language: 'he' },
  args: { query: 'חלה' },
};
