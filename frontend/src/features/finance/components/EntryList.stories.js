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

// The app's words in Hebrew (היום, אתמול, "25 באוק׳", the badges); what for and the categories are
// the user's own, as typed.
export const Hebrew = { parameters: { language: 'he' } };
