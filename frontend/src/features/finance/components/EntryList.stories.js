import { CATEGORIES, OCTOBER_ENTRIES, TODAY } from '../mocks';
import EntryList from './EntryList';

export default {
  component: EntryList,
  args: { entries: OCTOBER_ENTRIES, categories: CATEGORIES, today: TODAY },
  argTypes: { onPressEntry: { action: 'entry pressed' } },
};

// October 2026's 42 entries.
export const October = {};
export const OneEntry = { args: { entries: OCTOBER_ENTRIES.slice(-1) } };
export const FiftyEntries = {
  args: {
    entries: [...OCTOBER_ENTRIES, ...OCTOBER_ENTRIES.slice(0, 8)].map(
      (e, i) => ({ ...e, id: `story-${i}` }),
    ),
  },
};
