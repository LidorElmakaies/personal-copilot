import { OCTOBER_ENTRIES, TODAY } from '../mocks';
import EntryRow from './EntryRow';

const today = OCTOBER_ENTRIES.filter((e) => e.occurredOn === TODAY);
const groceries = today.find((e) => e.description === 'Weekly groceries');

export default {
  component: EntryRow,
  args: { entry: groceries, category: 'Groceries' },
  argTypes: { onPress: { action: 'pressed' } },
};

// 2 photos, matched by the statement.
export const PhotosAndMatched = {};
export const NotSent = {
  args: {
    entry: today.find((e) => e.notSent),
    category: 'Eating out',
  },
};
export const Plain = {
  args: {
    entry: OCTOBER_ENTRIES.find((e) => e.paidWith === 'cash'),
    category: 'Eating out',
  },
};
export const LongText = {
  args: {
    entry: {
      ...groceries,
      description: 'Groceries and cleaning stuff for the week', // 40 characters
    },
  },
};
export const Hebrew = {
  args: { entry: { ...groceries, description: 'קניות שבועיות בשופרסל דיל' } },
};
